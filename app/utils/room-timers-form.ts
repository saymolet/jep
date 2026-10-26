import { z } from "zod";

import {
  DEFAULT_AUTO_WRONG_ON_TIMEOUT,
  isAnswerTimeSec,
} from "~/engine/answer-timer";
import {
  DEFAULT_ROOM_TIMERS,
  isBuzzWindowSec,
  isFinalAnswerTimeSec,
  isReadTimeSec,
  isWagerTimeSec,
} from "~/engine/room-timers";

/** READ_TIME_AUTO is the form value of the "Auto" reading time. */
export const READ_TIME_AUTO = "auto";

const seconds = (valid: (value: unknown) => boolean) =>
  z.coerce.number().int().refine(valid);

/** roomSettingsFormSchema parses the room settings form (the settings route
 * and the admin's "new room" step). The answer timer fields are required as
 * before; the room timers are optional (a client from before them leaves
 * them as they are). The engine validates every value again. */
export const roomSettingsFormSchema = z.object({
  /** Seconds for the answer timer, 0 = off. */
  answerTimeSec: seconds(isAnswerTimeSec),
  /** "true" / "false": mark the answer wrong when the time runs out. */
  autoWrongOnTimeout: z.enum(["true", "false"]).transform((v) => v === "true"),
  /** "auto" or whole seconds 0–60. */
  readTimeSec: z
    .union([
      z.literal(READ_TIME_AUTO).transform(() => null),
      seconds(isReadTimeSec),
    ])
    .optional(),
  buzzWindowSec: seconds(isBuzzWindowSec).optional(),
  finalAnswerTimeSec: seconds(isFinalAnswerTimeSec).optional(),
  wagerTimeSec: seconds(isWagerTimeSec).optional(),
});

export type RoomSettingsForm = z.output<typeof roomSettingsFormSchema>;

/** toSettingsPayload drops the room timers the form left out, so the event
 * only carries what was sent. */
export function toSettingsPayload(form: RoomSettingsForm) {
  const payload: {
    answerTimeSec: number;
    autoWrongOnTimeout: boolean;
    readTimeSec?: number | null;
    buzzWindowSec?: number;
    finalAnswerTimeSec?: number;
    wagerTimeSec?: number;
  } = {
    answerTimeSec: form.answerTimeSec,
    autoWrongOnTimeout: form.autoWrongOnTimeout,
  };
  if (form.readTimeSec !== undefined) payload.readTimeSec = form.readTimeSec;
  if (form.buzzWindowSec !== undefined) {
    payload.buzzWindowSec = form.buzzWindowSec;
  }
  if (form.finalAnswerTimeSec !== undefined) {
    payload.finalAnswerTimeSec = form.finalAnswerTimeSec;
  }
  if (form.wagerTimeSec !== undefined) payload.wagerTimeSec = form.wagerTimeSec;
  return payload;
}

/** RoomSettingsValues are all the room settings (answer timer + timers). */
export interface RoomSettingsValues {
  answerTimeSec: number;
  autoWrongOnTimeout: boolean;
  readTimeSec: number | null;
  buzzWindowSec: number;
  finalAnswerTimeSec: number;
  wagerTimeSec: number;
}

/** toSettingsFormData is what the panel sends (every field). */
export function toSettingsFormData(
  values: RoomSettingsValues,
): Record<string, string> {
  return {
    answerTimeSec: values.answerTimeSec.toString(),
    autoWrongOnTimeout: values.autoWrongOnTimeout.toString(),
    readTimeSec:
      values.readTimeSec === null
        ? READ_TIME_AUTO
        : values.readTimeSec.toString(),
    buzzWindowSec: values.buzzWindowSec.toString(),
    finalAnswerTimeSec: values.finalAnswerTimeSec.toString(),
    wagerTimeSec: values.wagerTimeSec.toString(),
  };
}

/** DEFAULT_ROOM_SETTINGS are a new room's settings (today's behaviour). */
export const DEFAULT_ROOM_SETTINGS: RoomSettingsValues = {
  answerTimeSec: 0,
  autoWrongOnTimeout: DEFAULT_AUTO_WRONG_ON_TIMEOUT,
  ...DEFAULT_ROOM_TIMERS,
};

/** validRoomSettings keeps the valid values of stored settings (e.g. the
 * admin's last-used ones) and uses the defaults for the rest. */
export function validRoomSettings(
  stored: Partial<RoomSettingsValues> | null | undefined,
): RoomSettingsValues {
  const d = DEFAULT_ROOM_SETTINGS;
  if (!stored) return d;
  return {
    answerTimeSec: isAnswerTimeSec(stored.answerTimeSec)
      ? stored.answerTimeSec
      : d.answerTimeSec,
    autoWrongOnTimeout:
      typeof stored.autoWrongOnTimeout === "boolean"
        ? stored.autoWrongOnTimeout
        : d.autoWrongOnTimeout,
    readTimeSec:
      stored.readTimeSec !== undefined && isReadTimeSec(stored.readTimeSec)
        ? stored.readTimeSec
        : d.readTimeSec,
    buzzWindowSec: isBuzzWindowSec(stored.buzzWindowSec)
      ? stored.buzzWindowSec
      : d.buzzWindowSec,
    finalAnswerTimeSec: isFinalAnswerTimeSec(stored.finalAnswerTimeSec)
      ? stored.finalAnswerTimeSec
      : d.finalAnswerTimeSec,
    wagerTimeSec: isWagerTimeSec(stored.wagerTimeSec)
      ? stored.wagerTimeSec
      : d.wagerTimeSec,
  };
}
