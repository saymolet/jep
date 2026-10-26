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

function stateOf(testId: string) {
  return container
    .querySelector(`[data-testid="${testId}"]`)
    ?.getAttribute("data-state");
}

const timers = (extra: Record<string, unknown>) => [
  {
    type: ActionType.SetSettings,
    payload: {
      userId: BOB,
      answerTimeSec: 0,
      autoWrongOnTimeout: true,
      ...extra,
    },
  },
];

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

function renderTv(state: State, locale: Locale = "en") {
  const engine = engineFor(state);
  act(() =>
    root.render(
      <I18nProvider locale={locale}>
        <GameEngineContext.Provider value={engine}>
          <ViewerPromptContent variant="tv" status={{ kind: "reading" }} />
        </GameEngineContext.Provider>
      </I18nProvider>,
    ),
  );
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** advanceInSteps lets React render (and start new timers) along the way,
 * like a real page: the buzzers open, then the buzz window starts. */
async function advanceInSteps(ms: number, stepMs = 100) {
  for (let elapsed = 0; elapsed < ms; elapsed += stepMs) {
    await advance(Math.min(stepMs, ms - elapsed));
  }
}

/** Ann (board control) has to wager on the Double Down. */
function annWagering(wagerTimeSec: number) {
  return play(
    STEPS.join,
    timers({ wagerTimeSec }),
    STEPS.start,
    STEPS.chooseFirst,
    STEPS.buzzFirst,
    STEPS.checkFirst,
    STEPS.nextFirst,
    STEPS.chooseWager,
  );
}

/** Both players wagered on the Final and write their answers. */
function finalAnswers(
  finalAnswerTimeSec: number,
  ...extra: { type: ActionType; payload?: unknown }[][]
) {
  return play(
    STEPS.join,
    timers({ finalAnswerTimeSec }),
    STEPS.start,
    STEPS.chooseFirst,
    STEPS.buzzFirst,
    STEPS.checkFirst,
    STEPS.nextFirst,
    STEPS.chooseWager,
    STEPS.wager,
    STEPS.finishWager,
    STEPS.chooseSecret,
    STEPS.passSecret,
    STEPS.finishSecret,
    STEPS.chooseChoice,
    STEPS.buzzChoice,
    STEPS.finishChoice,
    STEPS.startFinal,
    STEPS.chooseFinal,
    STEPS.wagerAnnFinal,
    STEPS.wagerBobFinal,
    ...extra,
  );
}

describe("wager time", () => {
  it("places the minimum wager ($5 on a Double Down) for the wagering player when time is up", async () => {
    const state = annWagering(15);
    expect(state.wagerStartedAt).not.toBeNull();
    vi.setSystemTime((state.wagerStartedAt ?? 0) + 5_000);
    renderPrompt(state, ANN);
    await advance(0);
    expect(stateOf("wager-timer")).toBe("running");
    expect(text()).toContain("10 seconds left");
    expect(text()).toContain("When the time runs out, you wager $5.");
    expect(sent).toEqual([]);

    await advance(10_000);
    expect(stateOf("wager-timer")).toBe("expired");
    expect(text()).toContain("Time's up! Your wager: $5.");
    expect(sent).toEqual([
      ["wager", { userId: ANN, i: "1", j: "0", wager: "5" }],
    ]);

    // Only once.
    await advance(10_000);
    expect(sent).toHaveLength(1);
  });

  it("other players see the countdown and send nothing (Ukrainian)", async () => {
    const state = annWagering(15);
    vi.setSystemTime(state.wagerStartedAt ?? 0);
    renderPrompt(state, BOB, "uk");
    await advance(0);
    expect(text()).toContain("Залишилося 15 секунд");
    await advance(16_000);
    expect(text()).toContain("Час вийшов!");
    expect(sent).toEqual([]);
  });

  it("is off by default: no countdown, nothing sent", async () => {
    const state = annWagering(0);
    vi.setSystemTime(state.wagerStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(120_000);
    expect(container.querySelector('[data-testid="wager-timer"]')).toBeNull();
    expect(sent).toEqual([]);
  });

  it("places $0 on the Final for a player who hasn't wagered (Ukrainian)", async () => {
    const state = play(
      STEPS.join,
      timers({ wagerTimeSec: 15 }),
      STEPS.start,
      STEPS.chooseFirst,
      STEPS.buzzFirst,
      STEPS.checkFirst,
      STEPS.nextFirst,
      STEPS.chooseWager,
      STEPS.wager,
      STEPS.finishWager,
      STEPS.chooseSecret,
      STEPS.passSecret,
      STEPS.finishSecret,
      STEPS.chooseChoice,
      STEPS.buzzChoice,
      STEPS.finishChoice,
      STEPS.startFinal,
      STEPS.chooseFinal,
      STEPS.wagerAnnFinal,
    );
    vi.setSystemTime(state.wagerStartedAt ?? 0);
    // Ann already wagered: her device sends nothing.
    renderPrompt(state, ANN);
    await advance(16_000);
    expect(sent).toEqual([]);
    act(() => root.unmount());
    root = createRoot(container);

    renderPrompt(state, BOB, "uk");
    await advance(0);
    expect(sent).toEqual([
      ["wager", { userId: BOB, i: "0", j: "0", wager: "0" }],
    ]);
    expect(text()).toContain("Час вийшов! Твоя ставка: $0.");
  });

  it("shows the countdown on the TV", async () => {
    const state = annWagering(30);
    vi.setSystemTime(state.wagerStartedAt ?? 0);
    renderTv(state);
    await advance(0);
    expect(stateOf("wager-timer")).toBe("running");
    expect(text()).toContain("30 seconds left");
  });
});

describe("Final answer time", () => {
  it("sends what the player typed when the time runs out", async () => {
    const state = finalAnswers(15);
    expect(state.longFormStartedAt).not.toBeNull();
    vi.setSystemTime(state.longFormStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(0);
    expect(stateOf("final-answer-timer")).toBe("running");
    expect(text()).toContain("15 seconds left");
    expect(text()).toContain("When the time runs out, what you typed is sent.");

    const input = container.querySelector<HTMLInputElement>("#answer");
    if (!input) throw new Error("no answer input");
    act(() => {
      input.value = "  Paris ";
    });
    await advance(15_000);
    expect(stateOf("final-answer-timer")).toBe("expired");
    expect(text()).toContain("Time's up! Your answer was sent.");
    expect(sent).toEqual([
      ["answer", { userId: ANN, i: "0", j: "0", answer: "Paris" }],
    ]);
    expect(input.readOnly).toBe(true);
    await advance(10_000);
    expect(sent).toHaveLength(1);
  });

  it("sends an empty answer when nothing was typed (late return)", async () => {
    const state = finalAnswers(30);
    vi.setSystemTime((state.longFormStartedAt ?? 0) + 120_000);
    renderPrompt(state, BOB, "uk");
    await advance(0);
    expect(sent).toEqual([
      ["answer", { userId: BOB, i: "0", j: "0", answer: "" }],
    ]);
    expect(text()).toContain("Час вийшов! Твою відповідь надіслано.");
  });

  it("sends nothing for a player who already answered", async () => {
    const state = finalAnswers(15, [STEPS.answerFinal[0]]);
    expect(state.answers.get("1,0,0")?.get(ANN)).toBe("Paris");
    vi.setSystemTime(state.longFormStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(20_000);
    expect(sent).toEqual([]);
  });

  it("has no countdown and sends nothing without a limit (Off)", async () => {
    const state = finalAnswers(0);
    expect(state.finalAnswerTimeSec).toBe(0);
    vi.setSystemTime(state.longFormStartedAt ?? 0);
    renderPrompt(state, ANN);
    await advance(300_000);
    expect(
      container.querySelector('[data-testid="final-answer-timer"]'),
    ).toBeNull();
    expect(text()).not.toContain("When the time runs out");
    expect(container.querySelector<HTMLInputElement>("#answer")?.readOnly).toBe(
      false,
    );
    expect(sent).toEqual([]);
  });

  it("uses the room's duration (default 30 s) and shows it on the TV", async () => {
    const state = finalAnswers(90);
    expect(state.finalAnswerTimeSec).toBe(90);
    vi.setSystemTime(state.longFormStartedAt ?? 0);
    renderTv(state);
    await advance(0);
    expect(stateOf("final-answer-timer")).toBe("running");
    expect(text()).toContain("90 seconds left");
  });
});

describe("buzz window and reading time", () => {
  it("opens the buzzers at once with 0 s reading and sends no-buzz after the 3 s window", async () => {
    const state = play(
      STEPS.join,
      timers({ readTimeSec: 0, buzzWindowSec: 3 }),
      STEPS.start,
      STEPS.chooseFirst,
    );
    vi.setSystemTime(1_000_000);
    renderPrompt(state, BOB);
    await advanceInSteps(2_900);
    expect(sent).toEqual([]);
    // (The prompt fades in first, so allow a little more.)
    await advanceInSteps(1_500);
    expect(sent).toEqual([
      ["buzz", { i: "0", j: "0", userId: BOB, deltaMs: "3001" }],
    ]);
  });

  it("keeps the default 5 s window", async () => {
    const state = play(
      STEPS.join,
      timers({ readTimeSec: 0 }),
      STEPS.start,
      STEPS.chooseFirst,
    );
    renderPrompt(state, BOB);
    await advanceInSteps(4_900);
    expect(sent).toEqual([]);
    await advanceInSteps(1_500);
    expect(sent).toEqual([
      ["buzz", { i: "0", j: "0", userId: BOB, deltaMs: "5001" }],
    ]);
  });

  it("a fixed reading time keeps the buzzers closed that long", async () => {
    const state = play(
      STEPS.join,
      timers({ readTimeSec: 10, buzzWindowSec: 3 }),
      STEPS.start,
      STEPS.chooseFirst,
    );
    renderPrompt(state, BOB);
    await advanceInSteps(12_900);
    expect(sent).toEqual([]);
    await advanceInSteps(1_500);
    expect(sent).toEqual([
      ["buzz", { i: "0", j: "0", userId: BOB, deltaMs: "3001" }],
    ]);
  });
});
