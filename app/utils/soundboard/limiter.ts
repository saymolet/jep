/** A player can send one soundboard sound every SEND_COOLDOWN_MS. */
export const SEND_COOLDOWN_MS = 2_000;

/** Receivers ignore a sender's sounds that arrive faster than this. A bit
 * shorter than the sender's cooldown, so network jitter does not drop
 * honest sounds, but a client that skips its cooldown is still throttled. */
export const RECEIVE_COOLDOWN_MS = 1_700;

/** At most this many soundboard sounds play at the same time on a device. */
export const MAX_OVERLAPPING_SOUNDS = 3;

/** SoundboardLimiter keeps the soundboard fun rather than annoying: a
 * cooldown for this device's own sounds, a per-sender cooldown for sounds
 * from others, and a cap on sounds playing at once. Times are in ms (any
 * monotonic clock, e.g. Date.now()). */
export class SoundboardLimiter {
  private lastSentAt = -Infinity;
  private lastReceivedAt = new Map<string, number>();
  private playingUntil: number[] = [];

  /** trySend reports whether this device may send a sound now, and if so
   * starts the cooldown. */
  trySend(now: number): boolean {
    if (now - this.lastSentAt < SEND_COOLDOWN_MS) return false;
    this.lastSentAt = now;
    return true;
  }

  /** When this device can send its next sound (0 if it never sent one). */
  sendReadyAt(): number {
    return Number.isFinite(this.lastSentAt)
      ? this.lastSentAt + SEND_COOLDOWN_MS
      : 0;
  }

  /** tryReceive reports whether a sound from `userId` should be accepted
   * now. Ignored sounds do not restart the sender's cooldown. */
  tryReceive(userId: string, now: number): boolean {
    const last = this.lastReceivedAt.get(userId);
    if (last !== undefined && now - last < RECEIVE_COOLDOWN_MS) return false;
    this.lastReceivedAt.set(userId, now);
    return true;
  }

  /** tryStartPlayback reports whether another sound may start now (fewer
   * than MAX_OVERLAPPING_SOUNDS are playing); if so it is counted as
   * playing for `durationMs`. */
  tryStartPlayback(now: number, durationMs: number): boolean {
    this.playingUntil = this.playingUntil.filter((end) => end > now);
    if (this.playingUntil.length >= MAX_OVERLAPPING_SOUNDS) return false;
    this.playingUntil.push(now + durationMs);
    return true;
  }
}
