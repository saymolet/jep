import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PlayerScores } from "~/components/player";
import {
  ANN,
  BOB,
  engineFor,
  play,
  STEPS,
} from "~/components/watch/fixtures.test-helpers";
import { GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

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
});

function render(
  state: State,
  props: { userId: string; isAdmin?: boolean },
  locale: Locale = "en",
) {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            <PlayerScores roomId={1} {...props} />
          </GameEngineContext.Provider>
        </I18nProvider>
      ),
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

/** The aria-labels of the kick / leave buttons on the tiles. */
const kickLabels = () =>
  Array.from(container.querySelectorAll("button[aria-label]"))
    .map((b) => b.getAttribute("aria-label") ?? "")
    .filter((l) => /Kick|Leave|Вигнати|Вийти/i.test(l));

const BEFORE_GAME = play(STEPS.join, STEPS.start);
const UNDERWAY = play(
  STEPS.join,
  STEPS.start,
  STEPS.chooseFirst,
  STEPS.buzzFirst,
  STEPS.checkFirst,
  STEPS.nextFirst,
);

describe("kick buttons", () => {
  it("a player may kick before the game is underway", () => {
    render(BEFORE_GAME, { userId: ANN });
    expect(kickLabels()).toContain("Kick player Bob");
  });

  it("a player can't kick once the game is underway, but can still leave", () => {
    render(UNDERWAY, { userId: ANN });
    expect(kickLabels()).not.toContain("Kick player Bob");
    expect(kickLabels()).toContain("Leave game");
  });

  it("the admin (playing) may kick during the game", () => {
    render(UNDERWAY, { userId: ANN, isAdmin: true });
    expect(kickLabels()).toContain("Kick player Bob");
  });

  it("the admin (only watching) may kick during the game", () => {
    render(UNDERWAY, { userId: "admin-watching", isAdmin: true });
    expect(kickLabels()).toEqual(
      expect.arrayContaining(["Kick player Ann", "Kick player Bob"]),
    );
  });

  it("Ukrainian", () => {
    render(UNDERWAY, { userId: BOB, isAdmin: true }, "uk");
    expect(kickLabels()).toContain("Вигнати гравця Ann");
  });
});
