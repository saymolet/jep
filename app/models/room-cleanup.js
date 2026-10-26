// Room cleanup (feature 19): rooms nobody used for ROOM_MAX_IDLE_HOURS are
// deleted with their events and results by the SQL function
// `cleanup_inactive_rooms` (service role only).
//
// Plain JavaScript (typed with JSDoc) so the scheduled job
// `scripts/cleanup-inactive-rooms.mjs` can run it with plain Node, without
// the app's build; the admin panel imports the same code.

/** Rooms with no activity for this many hours are deleted. The single place
 * to change it: the admin panel and the scheduled job both use it. */
export const ROOM_MAX_IDLE_HOURS = 5;

/**
 * @typedef {{
 *   rpc: (
 *     fn: "cleanup_inactive_rooms",
 *     args: { max_idle: string; dry_run?: boolean },
 *   ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
 * }} CleanupClient
 * A Supabase client with the service role key (only the service role may
 * call the function).
 */

/**
 * Deletes every room created more than `maxIdleHours` ago with no event in
 * the last `maxIdleHours` and returns how many were deleted. With `dryRun`
 * it only counts them.
 *
 * @param {CleanupClient} client
 * @param {{ dryRun?: boolean; maxIdleHours?: number }} [options]
 * @returns {Promise<number>}
 */
export async function cleanupInactiveRooms(
  client,
  { dryRun = false, maxIdleHours = ROOM_MAX_IDLE_HOURS } = {},
) {
  if (!Number.isInteger(maxIdleHours) || maxIdleHours < 1) {
    throw new Error("maxIdleHours must be a whole number of hours, at least 1");
  }
  const { data, error } = await client.rpc("cleanup_inactive_rooms", {
    max_idle: `${maxIdleHours} hours`,
    dry_run: dryRun,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    throw new Error("cleanup_inactive_rooms returned " + JSON.stringify(data));
  }
  return data;
}
