/* When the buzzers of an open question may close (feature 27). */
import { ActionType } from "~/engine/engine";
import type { DbRoomEvent } from "~/models/room-event.server";

/** CLOCK_TOLERANCE_MS absorbs the difference between this server's clock,
 * the database's event timestamps and the opener device's timers. */
const CLOCK_TOLERANCE_MS = 1500;
/** AFTER_FIRST_BUZZ_MS: once someone buzzed, the buzzers may close this long
 * after their buzz (near-ties still count: see QUANTIZATION_FACTOR_MS). */
export const AFTER_FIRST_BUZZ_MS = 1000;

function sameClue(
  event: DbRoomEvent,
  round: number,
  i: number,
  j: number,
  withRound = true,
) {
  const p = event.payload;
  if (!p || typeof p !== "object" || Array.isArray(p)) return false;
  return p.i === i && p.j === j && (!withRound || (p.round ?? round) === round);
}

/** mayCloseBuzzersYet: the buzz time is over (from the last open_buzzers of this
 * question), or someone buzzed in a moment ago. */
export function mayCloseBuzzersYet(
  events: DbRoomEvent[],
  { round, i, j }: { round: number; i: number; j: number },
  buzzWindowMs: number,
  now: number,
) {
  let openIndex = -1;
  for (let k = events.length - 1; k >= 0; k--) {
    if (
      events[k].type === ActionType.OpenBuzzers &&
      sameClue(events[k], round, i, j)
    ) {
      openIndex = k;
      break;
    }
  }
  if (openIndex < 0) return false;
  const openedAt = Date.parse(events[openIndex].ts);
  if (now >= openedAt + buzzWindowMs - CLOCK_TOLERANCE_MS) return true;
  const firstBuzz = events.slice(openIndex + 1).find((e) => {
    if (e.type !== ActionType.Buzz || !sameClue(e, round, i, j, false)) {
      return false;
    }
    const p = e.payload;
    const deltaMs =
      p && typeof p === "object" && !Array.isArray(p) ? p.deltaMs : null;
    return (
      typeof deltaMs === "number" && deltaMs >= 0 && deltaMs <= buzzWindowMs
    );
  });
  return (
    firstBuzz !== undefined &&
    now >= Date.parse(firstBuzz.ts) + AFTER_FIRST_BUZZ_MS - CLOCK_TOLERANCE_MS
  );
}
