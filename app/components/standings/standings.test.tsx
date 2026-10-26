import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANN,
  BOB,
  engineFor,
  play,
  playUntil,
  STEPS,
  WATCH_GAME,
} from "~/components/watch/fixtures.test-helpers";
import { Presenter } from "~/components/watch/presenter";
import { ActionType, GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

import { formatChange, StandingsButton } from "./standings";
import { SCORE_CHANGES_VISIBLE_MS } from "./use-recent-score-changes";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function renderButton(
  state: State,
  {
    locale = "en",
    theme = "classic",
    userId = BOB,
  }: { locale?: Locale; theme?: string; userId?: string } = {},
) {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <div data-theme={theme}>
          <I18nProvider locale={locale}>
            <GameEngineContext.Provider value={engine}>
              <StandingsButton userId={userId} />
            </GameEngineContext.Provider>
          </I18nProvider>
        </div>
      ),
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

function button() {
  return container.querySelector<HTMLButtonElement>(
    '[data-testid="standings-button"]',
  )!;
}

function panel() {
  return document.querySelector<HTMLElement>('[data-testid="standings-panel"]');
}

function open() {
  act(() => button().click());
  const p = panel();
  expect(p).not.toBeNull();
  return p!;
}

function rows(p: HTMLElement) {
  return Array.from(
    p.querySelectorAll<HTMLElement>('[data-testid="standings-player"]'),
  );
}

/** Ann scored $200 on the first question; Bob has $0. */
const AFTER_FIRST = () => playUntil("nextFirst");

describe("StandingsButton", () => {
  it("opens a ranked list with the change since the previous question", () => {
    renderButton(AFTER_FIRST());
    expect(button().getAttribute("aria-label")).toBe("Standings");
    const p = open();
    expect(p.getAttribute("role")).toBe("dialog");
    expect(p.textContent).toContain("Standings");

    const [first, second] = rows(p);
    expect(first.dataset.userId).toBe(ANN);
    expect(first.textContent).toContain("Place 1");
    expect(first.textContent).toContain("$200");
    expect(first.textContent).toContain("+$200");
    expect(first.textContent).toContain("+$200 on the previous question");
    // Ann answered right, so she picks next.
    expect(first.textContent).toContain("Picks next");

    expect(second.dataset.userId).toBe(BOB);
    expect(second.textContent).toContain("Place 2");
    expect(second.textContent).toContain("(you)");
    expect(second.textContent).toContain("No change on the previous question");
  });

  it("shows losses with a minus sign and ties sharing a rank", () => {
    // Ann answers the first question wrong: -$200; Bob $0.
    const state = play(STEPS.join, STEPS.start, STEPS.chooseFirst, [
      {
        type: ActionType.Buzz,
        payload: { userId: ANN, i: 0, j: 0, deltaMs: 100 },
      },
      {
        type: ActionType.Buzz,
        payload: { userId: BOB, i: 0, j: 0, deltaMs: 99_999 },
      },
      {
        type: ActionType.Check,
        payload: { userId: ANN, i: 0, j: 0, correct: false },
      },
    ]);
    renderButton(state);
    const [first, second] = rows(open());
    expect(first.dataset.userId).toBe(BOB);
    expect(second.textContent).toContain("−$200");
    expect(formatChange(-200)).toBe("−$200");
    expect(formatChange(400)).toBe("+$400");

    act(() => root.unmount());
    root = createRoot(container);
    renderButton(playUntil("start"));
    const tied = rows(open());
    expect(tied.map((r) => r.textContent?.includes("Place 1, tied"))).toEqual([
      true,
      true,
    ]);
  });

  it("puts team totals on top in team mode", () => {
    const state = play(
      [
        {
          type: ActionType.Join,
          payload: { userId: ANN, name: "Ann", team: "red" },
        },
        {
          type: ActionType.Join,
          payload: { userId: BOB, name: "Bob", team: "blue" },
        },
      ],
      STEPS.start,
      STEPS.chooseFirst,
      STEPS.buzzFirst,
      STEPS.checkFirst,
    );
    renderButton(state);
    const p = open();
    const teams = p.querySelectorAll('[data-testid^="standings-team-"]');
    expect(Array.from(teams, (t) => t.getAttribute("data-testid"))).toEqual([
      "standings-team-red",
      "standings-team-blue",
    ]);
    expect(teams[0].textContent).toContain("Red team");
    expect(teams[0].textContent).toContain("+$200");
    expect(p.textContent).toContain("Teams");
    expect(p.textContent).toContain("Players");
  });

  it("closes with Escape", () => {
    renderButton(AFTER_FIRST());
    const p = open();
    act(() => {
      p.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(panel()).toBeNull();
  });

  for (const theme of ["classic", "dark"]) {
    it(`renders in Ukrainian with the ${theme} theme, without missing keys`, () => {
      renderButton(AFTER_FIRST(), { locale: "uk", theme });
      expect(button().getAttribute("aria-label")).toBe("Рахунок");
      const p = open();
      const text = p.textContent ?? "";
      expect(text).toContain("Рахунок");
      expect(text).toContain("1 місце");
      expect(text).toContain("Обирає питання");
      expect(text).toContain("+$200 за попереднє питання");
      expect(text).not.toMatch(/standings\./);
    });

    it(`renders in English with the ${theme} theme, without missing keys`, () => {
      renderButton(AFTER_FIRST(), { theme });
      expect(open().textContent).not.toMatch(/standings\./);
    });
  }
});

describe("TV score changes", () => {
  let setState: (s: State) => void = () => {};

  function Tv({ initial }: { initial: State }) {
    const [state, set] = React.useState(initial);
    setState = set;
    return (
      <I18nProvider locale="en">
        <GameEngineContext.Provider value={engineFor(state)}>
          <Presenter game={WATCH_GAME} joinUrl="http://localhost/room/1-a" />
        </GameEngineContext.Provider>
      </I18nProvider>
    );
  }

  function changes() {
    return Array.from(
      container.querySelectorAll(
        '[data-testid="presenter-players"] [data-testid="score-change"]',
      ),
      (el) => el.getAttribute("data-change"),
    );
  }

  it("shows the changes for a few seconds after a question, not on load", () => {
    vi.useFakeTimers();
    const Stub = createRoutesStub([
      { path: "/", Component: () => <Tv initial={playUntil("checkFirst")} /> },
    ]);
    act(() => root.render(<Stub initialEntries={["/"]} />));
    // Changes from before the page loaded aren't flashed.
    expect(changes()).toEqual([]);

    act(() => setState(playUntil("finishWager")));
    expect(changes()).toEqual(["150"]);

    act(() => {
      vi.advanceTimersByTime(SCORE_CHANGES_VISIBLE_MS + 100);
    });
    expect(changes()).toEqual([]);
  });
});
