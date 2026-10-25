import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ANN,
  BOB,
  engineFor,
  play,
  STEPS,
} from "~/components/watch/fixtures.test-helpers";
import { ViewerPromptContent } from "~/components/watch/viewer-prompt";
import { ActionType, GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

import { AnswerTimerBar } from "./answer-timer";
import { ConnectedPrompt } from "./prompt";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
/** Room actions sent by the page: [verb, form fields]. */
let sent: [string, Record<string, FormDataEntryValue>][] = [];

beforeEach(() => {
  vi.useFakeTimers();
  sent = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function text() {
  return container.textContent ?? "";
}

function timerState() {
  return container
    .querySelector('[data-testid="answer-timer"]')
    ?.getAttribute("data-state");
}

describe("AnswerTimerBar", () => {
  function renderBar(
    status: React.ComponentProps<typeof AnswerTimerBar>["status"],
    locale: Locale = "en",
  ) {
    act(() =>
      root.render(
        <I18nProvider locale={locale}>
          <AnswerTimerBar status={status} />
        </I18nProvider>,
      ),
    );
  }

  it("shows a full bar without text before the time is known", () => {
    renderBar(null);
    expect(timerState()).toBe("pending");
    expect(text()).not.toMatch(/second|Time/);
  });

  it.each<[Locale, number, string]>([
    ["en", 12, "12 seconds left"],
    ["en", 1, "1 second left"],
    ["uk", 1, "Залишилася 1 секунда"],
    ["uk", 3, "Залишилося 3 секунди"],
    ["uk", 12, "Залишилося 12 секунд"],
  ])("counts down (%s, %i s)", (locale, secondsLeft, expected) => {
    renderBar(
      { secondsLeft, fraction: secondsLeft / 15, expired: false },
      locale,
    );
    expect(timerState()).toBe("running");
    expect(text()).toContain(expected);
  });

  it("hurries in the last seconds", () => {
    renderBar({ secondsLeft: 3, fraction: 0.2, expired: false });
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    renderBar({ secondsLeft: 8, fraction: 0.5, expired: false });
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it.each<[Locale, string]>([
    ["en", "Time's up!"],
    ["uk", "Час вийшов!"],
  ])("says time's up (%s)", (locale, expected) => {
    renderBar({ secondsLeft: 0, fraction: 0, expired: true }, locale);
    expect(timerState()).toBe("expired");
    expect(text()).toContain(expected);
  });
});

const timerOn = (answerTimeSec: number, autoWrongOnTimeout = true) => [
  {
    type: ActionType.SetSettings,
    payload: { userId: BOB, answerTimeSec, autoWrongOnTimeout },
  },
];

/** Ann won the buzz on the first question ($200) with the timer on. */
function annAnswering(answerTimeSec = 10, autoWrong = true) {
  return play(
    STEPS.join,
    timerOn(answerTimeSec, autoWrong),
    STEPS.start,
    STEPS.chooseFirst,
    STEPS.buzzFirst,
  );
}

function renderPrompt(state: State, userId: string, locale: Locale = "en") {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/play",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            <ConnectedPrompt roomId={7} userId={userId} />
          </GameEngineContext.Provider>
        </I18nProvider>
      ),
    },
    {
      path: "/room/:roomId/:verb",
      action: async ({ request, params }) => {
        sent.push([
          params.verb ?? "",
          Object.fromEntries(await request.formData()),
        ]);
        return null;
      },
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/play"]} />));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("answer timer in the prompt", () => {
  it("counts down for the answering player and marks wrong when time is up", async () => {
    const state = annAnswering(10);
    const start = state.answerStartedAt ?? 0;
    vi.setSystemTime(start + 2_000);
    renderPrompt(state, ANN);
    await advance(0);

    expect(timerState()).toBe("running");
    expect(text()).toContain("8 seconds left");
    expect(text()).toContain(
      "When the time runs out, your answer counts as wrong.",
    );
    expect(sent).toEqual([]);

    await advance(8_000);
    expect(timerState()).toBe("expired");
    expect(text()).toContain("Time's up!");
    expect(text()).toContain("Your answer counts as wrong.");
    expect(sent).toEqual([
      [
        "check",
        { i: "0", j: "0", userId: ANN, result: "incorrect", timedOut: "true" },
      ],
    ]);

    // Only once.
    await advance(5_000);
    expect(sent).toHaveLength(1);
  });

  it("marks wrong right away when the answering player comes back late", async () => {
    const state = annAnswering(10);
    vi.setSystemTime((state.answerStartedAt ?? 0) + 60_000);
    renderPrompt(state, ANN);
    await advance(0);
    expect(timerState()).toBe("expired");
    expect(sent).toHaveLength(1);
  });

  it("doesn't mark when the player already marked themselves", async () => {
    const state = annAnswering(10);
    vi.setSystemTime(state.answerStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(600);
    const button = (label: string) =>
      Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent === label,
      );
    act(() => button("Reveal answer")?.click());
    await act(async () => {
      button("correct!")?.click();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sent).toEqual([
      ["check", expect.objectContaining({ result: "correct" })],
    ]);
    await advance(15_000);
    expect(sent).toHaveLength(1);
  });

  it("only shows time's up without auto-marking", async () => {
    const state = annAnswering(10, false);
    vi.setSystemTime(state.answerStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(10_500);
    expect(text()).toContain("Time's up!");
    expect(text()).toContain("Mark your answer now.");
    expect(text()).not.toContain("Your answer counts as wrong.");
    expect(sent).toEqual([]);
  });

  it("shows the countdown to the other players, who send nothing", async () => {
    const state = annAnswering(15);
    vi.setSystemTime(state.answerStartedAt ?? 0);
    renderPrompt(state, BOB, "uk");
    await advance(0);
    expect(text()).toContain("Залишилося 15 секунд");
    await advance(15_000);
    expect(text()).toContain("Час вийшов!");
    expect(sent).toEqual([]);
  });

  it("keeps the old 5 second hint without the timer", async () => {
    const state = annAnswering(0);
    expect(state.answerTimeSec).toBe(0);
    renderPrompt(state, ANN);
    await advance(20_000);
    expect(timerState()).toBeUndefined();
    expect(sent).toEqual([]);
  });

  it("times out a multiple choice pick without a pick", async () => {
    const state = play(
      STEPS.join,
      timerOn(10),
      STEPS.start,
      STEPS.chooseFirst,
      STEPS.buzzFirst,
      STEPS.checkFirst,
      STEPS.nextFirst,
      [{ type: ActionType.ChooseClue, payload: { userId: ANN, i: 1, j: 1 } }],
      STEPS.buzzChoice,
    );
    vi.setSystemTime((state.answerStartedAt ?? 0) + 11_000);
    renderPrompt(state, ANN);
    await advance(0);
    expect(sent).toEqual([
      [
        "check",
        { i: "1", j: "1", userId: ANN, result: "incorrect", timedOut: "true" },
      ],
    ]);
    // The options stay visible, but can't be picked any more.
    expect(container.querySelector('[data-testid="choices"]')).not.toBeNull();
    expect(
      container.querySelectorAll('[data-testid="choices"] button'),
    ).toHaveLength(0);
  });
});

describe("answer timer for viewers", () => {
  it("shows the countdown and time's up on the TV", async () => {
    const state = annAnswering(10);
    vi.setSystemTime((state.answerStartedAt ?? 0) + 4_000);
    const engine = engineFor(state);
    act(() =>
      root.render(
        <GameEngineContext.Provider value={engine}>
          <ViewerPromptContent
            variant="tv"
            status={{ kind: "answering", name: "Ann" }}
          />
        </GameEngineContext.Provider>,
      ),
    );
    await advance(0);
    expect(text()).toContain("6 seconds left");
    await advance(6_000);
    expect(text()).toContain("Time's up!");
  });
});
