/** The answer timer (room setting): how long the player whose turn it is to
 * answer has before their time runs out. 0 turns it off. */
export const ANSWER_TIME_OPTIONS = [0, 10, 15, 20, 30, 60] as const;
export type AnswerTimeSec = (typeof ANSWER_TIME_OPTIONS)[number];

/** By default a player who runs out of time loses the question's value. */
export const DEFAULT_AUTO_WRONG_ON_TIMEOUT = true;

export function isAnswerTimeSec(value: unknown): value is AnswerTimeSec {
  return ANSWER_TIME_OPTIONS.some((option) => option === value);
}

export interface AnswerTimerStatus {
  /** When the time runs out, in server epoch milliseconds. */
  deadline: number;
  /** Milliseconds left (0 once the time is up). */
  remainingMs: number;
  /** Whole seconds left, rounded up (shown on the countdown). */
  secondsLeft: number;
  /** Share of the time left, 1 (just started) to 0 (time's up). */
  fraction: number;
  expired: boolean;
}

/** getAnswerTimerStatus computes the countdown of an answer turn.
 *
 * `startedAt` is the room event timestamp (server clock) of the event that
 * gave the player their turn, and `now` is the current time on the server
 * clock (see utils/server-clock.ts), so every device — including people who
 * load the page in the middle of the turn — shows the same time left. */
export function getAnswerTimerStatus({
  startedAt,
  durationSec,
  now,
}: {
  startedAt: number;
  durationSec: number;
  now: number;
}): AnswerTimerStatus {
  const durationMs = durationSec * 1000;
  const deadline = startedAt + durationMs;
  // A start "in the future" (clock estimate slightly off) shows a full timer.
  const remainingMs = Math.min(durationMs, Math.max(0, deadline - now));
  return {
    deadline,
    remainingMs,
    secondsLeft: Math.ceil(remainingMs / 1000),
    fraction: durationMs > 0 ? remainingMs / durationMs : 0,
    expired: remainingMs <= 0,
  };
}
