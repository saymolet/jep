/** Estimates the server's clock on this device, so timers that start at a
 * room event's timestamp (server clock) show the same time left everywhere,
 * even on a phone whose clock is a few seconds (or minutes) off.
 *
 * Each sample is a server timestamp and the local time we received it at.
 * `local - server` is this device's clock offset plus the delay of that
 * message, which is never negative, so the smallest value seen is the best
 * estimate of the offset (a small delay at most). It errs towards showing a
 * little more time left — never less — so a device never runs out of time
 * before the server would agree. */
export class ServerClock {
  private offsetMs: number | null = null;

  /** note records that the server time was `serverMs` at local time
   * `localMs` (or a little earlier). */
  note(serverMs: number, localMs: number) {
    if (!Number.isFinite(serverMs) || !Number.isFinite(localMs)) return;
    const offset = localMs - serverMs;
    if (this.offsetMs === null || offset < this.offsetMs) {
      this.offsetMs = offset;
    }
  }

  /** now is the estimated server time at local time `localMs`. Without any
   * sample, the device's own clock is trusted. */
  now(localMs: number) {
    return localMs - (this.offsetMs ?? 0);
  }

  get offset() {
    return this.offsetMs;
  }
}

const clock = new ServerClock();

/** noteServerTime records a server timestamp received just now (a live room
 * event, a loader's server time, a solo action). Browser only. */
export function noteServerTime(serverMs: number, localMs = Date.now()) {
  clock.note(serverMs, localMs);
}

/** serverNow is the estimated current server time. Browser only: never call
 * it while rendering server-side UI (see "Hydration" in architecture.md). */
export function serverNow(localMs = Date.now()) {
  return clock.now(localMs);
}
