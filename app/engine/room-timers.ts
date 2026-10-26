/** Room timers (room settings, see ActionType.SetSettings): how long the
 * question is "read" before the buzzers open, how long the buzzers stay open,
 * how long players have to write their Final answer and to wager. The answer
 * time after winning the buzz lives in answer-timer.ts.
 *
 * SIGame packs don't store any of these (they are settings of the SIGame
 * app); only a question's own display-time hint (`readTimeSec`, imported
 * from a `.siq`) is used by the "Auto" reading time. */

/** The default buzz window: the time players have to buzz in after the
 * question is read. */
export const DEFAULT_BUZZ_WINDOW_SEC = 5;
export const BUZZ_WINDOW_OPTIONS = [3, 5, 7, 10, 15, 20] as const;

/** Reading time: null is "Auto" (from the question's text and media, or the
 * pack's hint); otherwise a fixed number of seconds, 0–60. */
export const MAX_READ_TIME_SEC = 60;
export const READ_TIME_OPTIONS = [
  null,
  0,
  1,
  2,
  3,
  5,
  10,
  15,
  20,
  30,
  45,
  60,
] as const;

/** Time to write the Final (long-form) answer; 0 = no limit (the Final waits
 * for every answer, as before the room timers). */
export const DEFAULT_FINAL_ANSWER_TIME_SEC = 30;
export const FINAL_ANSWER_TIME_OPTIONS = [0, 15, 30, 45, 60, 90, 120] as const;

/** Time to place a wager (Double Down, Final); 0 = unlimited. */
export const DEFAULT_WAGER_TIME_SEC = 0;
export const WAGER_TIME_OPTIONS = [0, 15, 30, 60] as const;

export interface RoomTimers {
  /** null = Auto. */
  readTimeSec: number | null;
  buzzWindowSec: number;
  finalAnswerTimeSec: number;
  wagerTimeSec: number;
}

export const DEFAULT_ROOM_TIMERS: RoomTimers = {
  readTimeSec: null,
  buzzWindowSec: DEFAULT_BUZZ_WINDOW_SEC,
  finalAnswerTimeSec: DEFAULT_FINAL_ANSWER_TIME_SEC,
  wagerTimeSec: DEFAULT_WAGER_TIME_SEC,
};

function isOneOf(options: readonly unknown[], value: unknown) {
  return options.some((option) => option === value);
}

/** isReadTimeSec accepts null (Auto) and any whole number of seconds from 0
 * to MAX_READ_TIME_SEC (the panel offers READ_TIME_OPTIONS). */
export function isReadTimeSec(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= MAX_READ_TIME_SEC)
  );
}

export function isBuzzWindowSec(value: unknown): value is number {
  return isOneOf(BUZZ_WINDOW_OPTIONS, value);
}

export function isFinalAnswerTimeSec(value: unknown): value is number {
  return isOneOf(FINAL_ANSWER_TIME_OPTIONS, value);
}

export function isWagerTimeSec(value: unknown): value is number {
  return isOneOf(WAGER_TIME_OPTIONS, value);
}

/** getBuzzWindowMs is the room's buzz window in milliseconds (buzzes up to
 * and including it count; a "no buzz" is sent as one millisecond more). */
export function getBuzzWindowMs(state: { buzzWindowSec?: number }) {
  return (state.buzzWindowSec ?? DEFAULT_BUZZ_WINDOW_SEC) * 1000;
}

/** getNoBuzzMs is the delta a device sends when its player didn't buzz in
 * within the buzz window. */
export function getNoBuzzMs(state: { buzzWindowSec?: number }) {
  return getBuzzWindowMs(state) + 1;
}
