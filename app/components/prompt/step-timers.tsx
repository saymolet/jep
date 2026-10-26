import * as React from "react";

import { CANT_BUZZ_FLAG, GameState, useEngineContext } from "~/engine";
import type { AnswerTimerStatus } from "~/engine/answer-timer";
import { useTranslation } from "~/i18n";

import { StepTimer, useCountdownStatus } from "./answer-timer";

export interface StepTimerState {
  /** When the step started (server clock); null: no countdown. */
  startedAt: number | null;
  durationSec: number;
  /** null until hydrated, and without a countdown. */
  status: AnswerTimerStatus | null;
}

/** useWagerTimer is the room's wager time (Double Down, Final) for the
 * current wager step, if the room has one (State.wagerTimeSec > 0). */
export function useWagerTimer(): StepTimerState {
  const { type, wagerTimeSec, wagerStartedAt } = useEngineContext();
  const startedAt =
    type === GameState.WagerClue && wagerTimeSec > 0 ? wagerStartedAt : null;
  const status = useCountdownStatus(startedAt, wagerTimeSec);
  return { startedAt, durationSec: wagerTimeSec, status };
}

/** useFinalAnswerTimer is the room's Final answer time while the players
 * write their answers (not when nobody could wager, and not when the room
 * has no limit: 0). */
export function useFinalAnswerTimer(): StepTimerState {
  const { type, finalAnswerTimeSec, longFormStartedAt, buzzes, players } =
    useEngineContext();
  const nobodyCanAnswer =
    buzzes.size === players.size &&
    Array.from(buzzes.values()).every((b) => b === CANT_BUZZ_FLAG);
  const startedAt =
    type === GameState.ReadLongFormClue &&
    !nobodyCanAnswer &&
    finalAnswerTimeSec > 0
      ? longFormStartedAt
      : null;
  const status = useCountdownStatus(startedAt, finalAnswerTimeSec);
  return { startedAt, durationSec: finalAnswerTimeSec, status };
}

/** WagerTimer shows the wager countdown to everyone (players, spectators,
 * the TV). */
export function WagerTimer({
  timer,
  variant = "screen",
  children,
}: {
  timer: StepTimerState;
  variant?: "screen" | "tv";
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <StepTimer
      {...timer}
      testId="wager-timer"
      label={t("play.stepTimer.wagerLabel")}
      variant={variant}
    >
      {children}
    </StepTimer>
  );
}

/** FinalAnswerTimer shows the Final answer countdown to everyone. */
export function FinalAnswerTimer({
  timer,
  variant = "screen",
  children,
}: {
  timer: StepTimerState;
  variant?: "screen" | "tv";
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <StepTimer
      {...timer}
      testId="final-answer-timer"
      label={t("play.stepTimer.finalLabel")}
      variant={variant}
    >
      {children}
    </StepTimer>
  );
}

/** isTimeUp is true once a step's countdown ran out on this device. */
export function isTimeUp(timer: StepTimerState) {
  return timer.startedAt !== null && timer.status?.expired === true;
}

/** useOnceWhenTimeUp runs `send` on this device once per step (keyed by the
 * step's start) when its time is up — unless `done` (the player already
 * acted). Only ever used by the player's own form, so it is the player's own
 * device that acts for them, like the answer timer's auto-mark. A device that
 * is offline or closed sends nothing (the admin can act for the player). */
export function useOnceWhenTimeUp(
  timer: StepTimerState,
  done: boolean,
  send: () => void,
) {
  const timeUp = isTimeUp(timer);
  const sentFor = React.useRef<number | null>(null);
  const sendRef = React.useRef(send);
  React.useEffect(() => {
    sendRef.current = send;
  }, [send]);
  React.useEffect(() => {
    if (
      !timeUp ||
      done ||
      timer.startedAt === null ||
      sentFor.current === timer.startedAt
    ) {
      return;
    }
    sentFor.current = timer.startedAt;
    sendRef.current();
  }, [timeUp, done, timer.startedAt]);
  return timeUp;
}
