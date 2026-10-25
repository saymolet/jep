import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Player } from "~/engine";
import { CANT_BUZZ_FLAG, CLUE_TIMEOUT_MS } from "~/engine";
import { I18nProvider, type Locale } from "~/i18n";
import { BUZZ_HAPTIC, LOCKOUT_HAPTIC } from "~/utils/haptics";

import type { BuzzButtonState } from "./buzz-button";
import { BuzzButton, getBuzzButtonState } from "./buzz-button";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ME = "me";
const PLAYERS = new Map<string, Player>([
  [ME, { userId: ME, name: "Ann", score: 0 }],
  ["bob", { userId: "bob", name: "Bob", score: 0 }],
]);

let container: HTMLDivElement;
let root: Root;
let vibrateSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  vibrateSpy = vi.fn(() => true);
  Object.defineProperty(navigator, "vibrate", {
    value: vibrateSpy,
    configurable: true,
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  Reflect.deleteProperty(navigator, "vibrate");
});

function render(
  state: BuzzButtonState,
  {
    onBuzz = () => null,
    locale = "en",
    armDelayMs = 0,
    mute = false,
  }: {
    onBuzz?: () => void;
    locale?: Locale;
    armDelayMs?: number;
    mute?: boolean;
  } = {},
) {
  act(() =>
    root.render(
      <I18nProvider locale={locale}>
        <BuzzButton
          state={state}
          clueDurationMs={3000}
          onBuzz={onBuzz}
          armDelayMs={armDelayMs}
          mute={mute}
        />
      </I18nProvider>,
    ),
  );
}

function button() {
  const el = container.querySelector("button");
  if (!el) throw new Error("no button");
  return el;
}

function pointerDown(
  el: Element,
  init: PointerEventInit = { pointerType: "touch", isPrimary: true },
) {
  act(() => {
    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, button: 0, ...init }),
    );
  });
}

function click(el: Element, detail: number) {
  act(() => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
  });
}

describe("getBuzzButtonState", () => {
  const base = {
    lockout: false,
    buzzerOpen: false,
    buzzes: new Map<string, number>(),
    userId: ME,
    players: PLAYERS,
  };

  it("waits while the question is being read", () => {
    expect(getBuzzButtonState(base)).toEqual({ kind: "waiting" });
  });

  it("is open once the buzzers open", () => {
    expect(getBuzzButtonState({ ...base, buzzerOpen: true })).toEqual({
      kind: "open",
    });
  });

  it("shows the early lockout first", () => {
    expect(
      getBuzzButtonState({ ...base, lockout: true, buzzerOpen: true }),
    ).toEqual({ kind: "tooEarly" });
  });

  it("is locked out for a player who already answered wrong", () => {
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([[ME, CANT_BUZZ_FLAG]]),
      }),
    ).toEqual({ kind: "alreadyAnswered" });
  });

  it("is won when this player is the fastest", () => {
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([
          [ME, 120],
          ["bob", 400],
        ]),
      }),
    ).toEqual({ kind: "won" });
  });

  it("names the player who was faster", () => {
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([
          [ME, 400],
          ["bob", 120],
        ]),
      }),
    ).toEqual({ kind: "otherWon", name: "Bob" });
    // Before this player's own (timeout) buzz is sent, too.
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([["bob", 120]]),
      }),
    ).toEqual({ kind: "otherWon", name: "Bob" });
  });

  it("times out when nobody buzzed in time", () => {
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([[ME, CLUE_TIMEOUT_MS + 1]]),
      }),
    ).toEqual({ kind: "timedOut" });
  });

  it("ignores players who can't buzz or timed out", () => {
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([["bob", CANT_BUZZ_FLAG]]),
      }),
    ).toEqual({ kind: "open" });
    expect(
      getBuzzButtonState({
        ...base,
        buzzerOpen: true,
        buzzes: new Map([["bob", CLUE_TIMEOUT_MS + 1]]),
      }),
    ).toEqual({ kind: "open" });
  });
});

describe("BuzzButton", () => {
  it.each<[BuzzButtonState, string, string | null]>([
    [{ kind: "waiting" }, "Wait…", "Tapping now locks you out"],
    [{ kind: "open" }, "BUZZ!", null],
    [{ kind: "tooEarly" }, "Too early!", "Locked out for a moment"],
    [
      { kind: "alreadyAnswered" },
      "Locked out",
      "You already tried this question",
    ],
    [{ kind: "timedOut" }, "Time's up", "You didn't buzz in time"],
    [
      { kind: "otherWon", name: "Bob" },
      "Bob was faster",
      "Wait for their answer",
    ],
    [{ kind: "won" }, "Your turn — answer!", null],
  ])("shows the %o state", (state, label, hint) => {
    render(state);
    const el = button();
    expect(el.dataset.state).toBe(state.kind);
    expect(el.textContent).toContain(label);
    if (hint) expect(el.textContent).toContain(hint);
  });

  it("shows the read-timer progress only while waiting", () => {
    render({ kind: "waiting" });
    const progress = container.querySelector<HTMLElement>(
      "[data-testid=buzz-progress]",
    );
    expect(progress?.style.animation).toContain("3s");
    // The bar keeps running through a short lockout.
    render({ kind: "tooEarly" });
    expect(container.querySelector("[data-testid=buzz-progress]")).toBe(
      progress,
    );
    render({ kind: "open" });
    expect(container.querySelector("[data-testid=buzz-progress]")).toBeNull();
  });

  it("marks finished states as disabled for assistive tech", () => {
    render({ kind: "open" });
    expect(button().getAttribute("aria-disabled")).toBe("false");
    render({ kind: "won" });
    expect(button().getAttribute("aria-disabled")).toBe("true");
    render({ kind: "alreadyAnswered" });
    expect(button().getAttribute("aria-disabled")).toBe("true");
  });

  it("speaks Ukrainian", () => {
    render({ kind: "open" }, { locale: "uk" });
    expect(button().textContent).toContain("ТИСНИ!");
    render({ kind: "waiting" }, { locale: "uk" });
    expect(button().textContent).toContain("Чекай…");
    render({ kind: "tooEarly" }, { locale: "uk" });
    expect(button().textContent).toContain("Зарано!");
    render({ kind: "otherWon", name: "Богдан" }, { locale: "uk" });
    expect(button().textContent).toContain("Швидше за всіх: Богдан");
    render({ kind: "won" }, { locale: "uk" });
    expect(button().textContent).toContain("Твоя черга — відповідай!");
  });

  it("buzzes on pointerdown, not on the click that follows", () => {
    const onBuzz = vi.fn();
    render({ kind: "open" }, { onBuzz });
    pointerDown(button());
    expect(onBuzz).toHaveBeenCalledTimes(1);
    click(button(), 1);
    expect(onBuzz).toHaveBeenCalledTimes(1);
  });

  it("buzzes on keyboard / assistive-tech activation (click with no pointer)", () => {
    const onBuzz = vi.fn();
    render({ kind: "open" }, { onBuzz });
    click(button(), 0);
    expect(onBuzz).toHaveBeenCalledTimes(1);
  });

  it("ignores extra fingers and non-primary mouse buttons", () => {
    const onBuzz = vi.fn();
    render({ kind: "open" }, { onBuzz });
    pointerDown(button(), { pointerType: "touch", isPrimary: false });
    pointerDown(button(), { pointerType: "mouse", isPrimary: true, button: 2 });
    expect(onBuzz).not.toHaveBeenCalled();
  });

  it("ignores a second press right after the first (double fire)", () => {
    const onBuzz = vi.fn();
    render({ kind: "open" }, { onBuzz });
    pointerDown(button());
    click(button(), 0);
    pointerDown(button());
    expect(onBuzz).toHaveBeenCalledTimes(1);
  });

  it("ignores presses right after it appears (the tap that opened the question)", () => {
    vi.useFakeTimers();
    try {
      const onBuzz = vi.fn();
      render({ kind: "waiting" }, { onBuzz, armDelayMs: 400 });
      pointerDown(button());
      expect(onBuzz).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(500));
      pointerDown(button());
      expect(onBuzz).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("vibrates briefly on a buzz and with a pattern on a lockout", () => {
    render({ kind: "open" });
    pointerDown(button());
    expect(vibrateSpy).toHaveBeenCalledWith(BUZZ_HAPTIC);

    render({ kind: "waiting" });
    expect(vibrateSpy).toHaveBeenCalledTimes(1);
    render({ kind: "tooEarly" });
    expect(vibrateSpy).toHaveBeenLastCalledWith(LOCKOUT_HAPTIC);
    expect(vibrateSpy).toHaveBeenCalledTimes(2);
  });

  it("does not vibrate when sound is muted", () => {
    render({ kind: "open" }, { mute: true });
    pointerDown(button());
    render({ kind: "tooEarly" }, { mute: true });
    expect(vibrateSpy).not.toHaveBeenCalled();
  });

  it("does not crash where vibration is not supported", () => {
    Reflect.deleteProperty(navigator, "vibrate");
    const onBuzz = vi.fn();
    render({ kind: "open" }, { onBuzz });
    pointerDown(button());
    render({ kind: "tooEarly" }, { onBuzz });
    expect(onBuzz).toHaveBeenCalledTimes(1);
  });
});
