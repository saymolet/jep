import clsx from "clsx";
import * as React from "react";
import { useFetcher } from "react-router";

import type { Action } from "~/engine";
import { GameState, useEngineContext } from "~/engine";
import {
  type AnswerTimerStatus,
  getAnswerTimerStatus,
} from "~/engine/answer-timer";
import { useTranslation } from "~/i18n";
import { serverNow } from "~/utils/server-clock";
import useSoloAction from "~/utils/use-solo-action";
import useGameSound from "~/utils/use-sound";

const TIMES_UP_SFX = "/sounds/times-up.mp3";
const TICK_MS = 250;
/** The bar turns red and pulses in the last seconds. */
const HURRY_SEC = 3;

export interface AnswerTimer {
  /** A timed answer turn is going on. */
  timed: boolean;
  /** The player whose turn it is. */
  answererId?: string;
  durationSec: number;
  /** null until the page is hydrated (the time left depends on the
   * device's clock, so it is never rendered on the server). */
  status: AnswerTimerStatus | null;
}

/** useAnswerTimer is the countdown of the current answer turn, the same on
 * every device: it runs from the timestamp of the room event that gave the
 * player their turn (server clock, see utils/server-clock.ts). It keeps
 * ticking while the tab is in the background (as fast as the browser lets
 * it) and catches up as soon as the tab is visible again. */
export function useAnswerTimer(): AnswerTimer {
  const { type, answerTimeSec, answerStartedAt, winningBuzzer } =
    useEngineContext();
  const timed =
    type === GameState.RevealAnswerToBuzzer &&
    answerTimeSec > 0 &&
    answerStartedAt !== null &&
    winningBuzzer !== undefined;

  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!timed || answerStartedAt === null) {
      setNow(null);
      return;
    }
    const deadline = answerStartedAt + answerTimeSec * 1000;
    const tick = () => {
      const t = serverNow();
      setNow(t);
      if (t >= deadline) clearInterval(interval);
    };
    const interval = setInterval(tick, TICK_MS);
    tick();
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [timed, answerStartedAt, answerTimeSec]);

  const status =
    timed && answerStartedAt !== null && now !== null
      ? getAnswerTimerStatus({
          startedAt: answerStartedAt,
          durationSec: answerTimeSec,
          now,
        })
      : null;

  return {
    timed,
    answererId: timed ? winningBuzzer : undefined,
    durationSec: answerTimeSec,
    status,
  };
}

/** AnswerTimerBar shows the time left as a shrinking bar and a sentence, or
 * "Time's up!". `status` null shows a full bar without text (before
 * hydration). */
export function AnswerTimerBar({
  status,
  variant = "screen",
  children,
}: {
  status: Pick<
    AnswerTimerStatus,
    "secondsLeft" | "fraction" | "expired"
  > | null;
  variant?: "screen" | "tv";
  /** Extra line under the timer (e.g. a hint for the answering player). */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const expired = status?.expired ?? false;
  const hurry = status !== null && !expired && status.secondsLeft <= HURRY_SEC;
  const tv = variant === "tv";
  return (
    <div
      className="flex w-full flex-col items-center gap-1 px-4 pb-2"
      data-testid="answer-timer"
      data-state={status === null ? "pending" : expired ? "expired" : "running"}
      role="timer"
      aria-label={t("play.answerTimer.label")}
    >
      <div
        className={clsx(
          "w-full max-w-screen-sm overflow-hidden rounded-full bg-slate-500/60",
          tv ? "h-5" : "h-3",
        )}
      >
        <div
          className={clsx(
            "h-full rounded-full transition-[width] duration-200 ease-linear",
            hurry ? "animate-pulse bg-red-500" : "bg-yellow-300",
          )}
          style={{ width: `${(status?.fraction ?? 1) * 100}%` }}
        />
      </div>
      <p
        className={clsx(
          "text-center font-bold",
          expired ? "text-red-300 uppercase" : "text-white",
          tv ? "text-3xl lg:text-5xl" : expired ? "text-2xl" : "text-base",
        )}
        aria-live={expired ? "assertive" : "off"}
      >
        {status === null ? (
          // Keeps the height until the time left is known.
          <span className="invisible">0</span>
        ) : expired ? (
          t("play.answerTimer.timesUp")
        ) : (
          t("play.answerTimer.secondsLeft", { count: status.secondsLeft })
        )}
      </p>
      {children}
    </div>
  );
}

/** ConnectedAnswerTimer shows the current answer turn's countdown (nothing
 * when no timed turn is going on) and plays the "time's up" sound when it
 * runs out while this page watches it. */
export function ConnectedAnswerTimer({
  timer,
  variant = "screen",
  children,
}: {
  timer: AnswerTimer;
  variant?: "screen" | "tv";
  children?: React.ReactNode;
}) {
  const { status } = timer;
  const [playTimesUpSfx] = useGameSound(TIMES_UP_SFX);

  // Only when this page saw the time run out, not when it loads a turn that
  // is already over.
  const sawRunning = React.useRef(false);
  const expired = status?.expired;
  React.useEffect(() => {
    if (expired === false) {
      sawRunning.current = true;
    } else if (expired === true && sawRunning.current) {
      sawRunning.current = false;
      playTimesUpSfx();
    }
  }, [expired, playTimesUpSfx]);

  if (!timer.timed) return null;
  return (
    <AnswerTimerBar status={status} variant={variant}>
      {children}
    </AnswerTimerBar>
  );
}

/** useAutoWrongOnTimeout runs on the answering player's own device: when
 * their time runs out (and the room marks timeouts wrong), it sends the
 * normal "incorrect" check for them — once per turn, and not if they already
 * marked (or picked) themselves (`marked`). On a multiple choice question
 * it is a wrong answer without a pick. A tab in the background sends it as
 * soon as the browser runs its timers again (at the latest when the tab is
 * visible). If the player's device is offline, nothing is sent and the game
 * waits, like it does without a timer.
 *
 * Returns true once the time is up and the answer is (being) marked wrong,
 * so the prompt can hide the answer buttons. */
export function useAutoWrongOnTimeout({
  roomId,
  userId,
  timer,
  marked,
}: {
  roomId: number;
  userId: string;
  timer: AnswerTimer;
  /** The player already marked (or picked) themselves. */
  marked: boolean;
}) {
  const { activeClue, answerStartedAt, autoWrongOnTimeout, soloDispatch } =
    useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const submit = fetcher.submit;

  const timeUp =
    timer.timed &&
    timer.answererId === userId &&
    autoWrongOnTimeout &&
    timer.status?.expired === true;

  // The turn (by its start time) the timeout was sent for.
  const sentFor = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (
      !timeUp ||
      !activeClue ||
      answerStartedAt === null ||
      sentFor.current === answerStartedAt ||
      marked
    ) {
      return;
    }
    sentFor.current = answerStartedAt;
    const [i, j] = activeClue;
    submit(
      {
        i: i.toString(),
        j: j.toString(),
        userId,
        result: "incorrect",
        timedOut: "true",
      },
      { method: "post", action: `/room/${roomId}/check` },
    );
  }, [timeUp, activeClue, answerStartedAt, marked, submit, userId, roomId]);

  return timeUp && !marked;
}
