import clsx from "clsx";
import * as React from "react";

import type { Player } from "~/engine";
import { CANT_BUZZ_FLAG, CLUE_TIMEOUT_MS } from "~/engine";
import { useTranslation } from "~/i18n";
import { BUZZ_HAPTIC, LOCKOUT_HAPTIC, vibrate } from "~/utils/haptics";

/** BUZZ_BAR_MEDIA is where the big BUZZ button is shown: touch screens and
 * narrow windows. Keep in sync with the `buzzbar` variant in app/styles.css
 * (the button is shown with CSS so server and client render the same HTML). */
export const BUZZ_BAR_MEDIA = "(pointer: coarse), (max-width: 639.98px)";

/** ARM_DELAY_MS ignores presses right after the button appears, so the tap
 * that opened the question (or closed a dialog) can't land on it. */
const ARM_DELAY_MS = 400;

/** DOUBLE_FIRE_MS ignores a second press this soon after the first. */
const DOUBLE_FIRE_MS = 100;

export type BuzzButtonState =
  /** The question is being read; pressing now locks you out. */
  | { kind: "waiting" }
  /** Buzzers are open. */
  | { kind: "open" }
  /** Buzzed before the buzzers opened: briefly locked out. */
  | { kind: "tooEarly" }
  /** Already answered this question wrong (it's being re-read for others). */
  | { kind: "alreadyAnswered" }
  /** Didn't buzz in time. */
  | { kind: "timedOut" }
  /** Someone else buzzed in first. */
  | { kind: "otherWon"; name?: string }
  /** This player buzzed in first. */
  | { kind: "won" };

/** isValidBuzz is true for a real buzz (not a "can't buzz" flag or a
 * timeout). */
function isValidBuzz(ms: number) {
  return ms !== CANT_BUZZ_FLAG && ms <= CLUE_TIMEOUT_MS;
}

/** getBuzzButtonState derives what the BUZZ button shows from the prompt's
 * state. It only reads the state; buzz timing is decided by the prompt. */
export function getBuzzButtonState({
  lockout,
  buzzerOpen,
  buzzes,
  userId,
  players,
}: {
  lockout: boolean;
  buzzerOpen: boolean;
  buzzes: Map<string, number>;
  userId: string;
  players: Map<string, Player>;
}): BuzzButtonState {
  if (lockout) return { kind: "tooEarly" };
  const mine = buzzes.get(userId);
  if (mine === CANT_BUZZ_FLAG) return { kind: "alreadyAnswered" };

  let fastest: [string, number] | undefined;
  for (const [id, ms] of buzzes) {
    if (id === userId || !isValidBuzz(ms)) continue;
    if (!fastest || ms < fastest[1]) fastest = [id, ms];
  }
  if (mine !== undefined && isValidBuzz(mine)) {
    if (!fastest || mine <= fastest[1]) return { kind: "won" };
  }
  if (fastest) {
    return { kind: "otherWon", name: players.get(fastest[0])?.name };
  }
  if (mine !== undefined) return { kind: "timedOut" };
  return buzzerOpen ? { kind: "open" } : { kind: "waiting" };
}

/** pressable states still pass presses on to the prompt (which decides what
 * a press does: lock out, buzz, or nothing). */
function isPressable(state: BuzzButtonState) {
  return (
    state.kind === "waiting" ||
    state.kind === "open" ||
    state.kind === "otherWon"
  );
}

const STATE_CLASSES: Record<BuzzButtonState["kind"], string> = {
  waiting: "bg-slate-700 text-white",
  open: "bg-lime-500 text-black shadow-glow-green-200",
  tooEarly: "bg-red-600 text-white",
  alreadyAnswered: "bg-slate-800 text-slate-300",
  timedOut: "bg-slate-800 text-slate-300",
  otherWon: "bg-slate-600 text-white",
  won: "bg-yellow-400 text-black",
};

/** BuzzButton is the big BUZZ button pinned to the bottom of the question on
 * phones (see BUZZ_BAR_MEDIA). It shows the buzzer state with color and text
 * and buzzes on pointerdown for the fastest possible response. Hidden on
 * desktops, where players click the question or press Enter. */
export function BuzzButton({
  state,
  clueDurationMs,
  onBuzz,
  mute = false,
  armDelayMs = ARM_DELAY_MS,
}: {
  state: BuzzButtonState;
  /** How long the question is read; drives the progress fill while waiting. */
  clueDurationMs: number;
  onBuzz: () => void;
  /** Haptics follow the sound setting: no vibration when muted. */
  mute?: boolean;
  armDelayMs?: number;
}) {
  const { t } = useTranslation();
  const mountedAt = React.useRef<number | null>(null);
  const lastPressAt = React.useRef(-Infinity);

  React.useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  // Vibrate when a press locks this player out.
  const prevKind = React.useRef(state.kind);
  React.useEffect(() => {
    if (state.kind === "tooEarly" && prevKind.current !== "tooEarly" && !mute) {
      vibrate(LOCKOUT_HAPTIC);
    }
    prevKind.current = state.kind;
  }, [state.kind, mute]);

  function press() {
    const now = Date.now();
    if (mountedAt.current === null || now - mountedAt.current < armDelayMs) {
      return;
    }
    if (now - lastPressAt.current < DOUBLE_FIRE_MS) return;
    lastPressAt.current = now;
    onBuzz();
    if (state.kind === "open" && !mute) vibrate(BUZZ_HAPTIC);
  }

  const { label, hint } = labels(state, t);
  const showProgress = state.kind === "waiting" || state.kind === "tooEarly";

  return (
    <div
      className="sticky bottom-0 z-20 hidden shrink-0 bg-blue-bright/95 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] buzzbar:block"
      data-testid="buzz-bar"
    >
      <button
        type="button"
        data-state={state.kind}
        aria-disabled={!isPressable(state)}
        onPointerDown={(e) => {
          if (!e.isPrimary) return;
          if (e.pointerType === "mouse" && e.button !== 0) return;
          press();
        }}
        onClick={(e) => {
          // A click with detail 0 comes from the keyboard (Space/Enter on the
          // focused button) or assistive tech; taps already buzzed on
          // pointerdown.
          if (e.detail === 0) press();
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={clsx(
          "relative flex min-h-[72px] w-full touch-manipulation flex-col items-center justify-center overflow-hidden rounded-xl px-4 py-2 font-bold transition-colors duration-100 select-none",
          STATE_CLASSES[state.kind],
        )}
        style={{
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {showProgress ? (
          <span
            aria-hidden
            data-testid="buzz-progress"
            className="absolute inset-y-0 left-0 bg-white/25"
            style={{
              animation: `${clueDurationMs / 1000}s linear 0s 1 growFromLeft forwards`,
            }}
          />
        ) : null}
        <span className="relative text-2xl leading-tight font-black uppercase">
          {label}
        </span>
        {hint ? (
          <span className="relative text-sm leading-tight font-normal">
            {hint}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function labels(
  state: BuzzButtonState,
  t: ReturnType<typeof useTranslation>["t"],
): { label: string; hint?: string } {
  switch (state.kind) {
    case "waiting":
      return {
        label: t("play.buzzer.wait"),
        hint: t("play.buzzer.waitHint"),
      };
    case "open":
      return { label: t("play.buzzer.open") };
    case "tooEarly":
      return {
        label: t("play.buzzer.tooEarly"),
        hint: t("play.buzzer.tooEarlyHint"),
      };
    case "alreadyAnswered":
      return {
        label: t("play.buzzer.alreadyAnswered"),
        hint: t("play.buzzer.alreadyAnsweredHint"),
      };
    case "timedOut":
      return {
        label: t("play.buzzer.timedOut"),
        hint: t("play.buzzer.timedOutHint"),
      };
    case "otherWon":
      return {
        label: t("play.buzzer.otherWon", {
          name: state.name ?? t("play.choices.someone"),
        }),
        hint: t("play.buzzer.otherWonHint"),
      };
    case "won":
      return { label: t("play.buzzer.won") };
  }
}

/** isBuzzBarShown tells whether the big BUZZ button is on screen (checked at
 * event time, so it is safe during server rendering). */
export function isBuzzBarShown() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(BUZZ_BAR_MEDIA).matches
  );
}
