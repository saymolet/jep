/** PresenceRole is what a client announces on the room's Realtime channel
 * (presence). Only roles are shared, never names or user ids. */
export type PresenceRole = "player" | "spectator" | "presenter";

/** countWatchers counts the spectators in a Realtime presence state
 * (`channel.presenceState()`: presence key -> metas). A key with several
 * metas (e.g. re-tracked) counts once, by its latest role. Presenter screens
 * (TVs) and players are not counted. */
export function countWatchers(
  presenceState: Record<string, readonly { role?: unknown }[]>,
): number {
  let count = 0;
  for (const metas of Object.values(presenceState)) {
    if (metas.at(-1)?.role === "spectator") count++;
  }
  return count;
}
