import type { AuthSession } from "~/models/auth";
import type { Game } from "~/models/convert.server";
import { getGame } from "~/models/game.server";
import {
  MAX_MY_ROOM_CANDIDATES,
  MAX_MY_ROOMS,
  MY_ROOMS_MAX_AGE_MS,
  type MyRoom,
  summarizeMyRoom,
} from "~/models/my-rooms";
import { getRoomEvents } from "~/models/room-event.server";
import { getSupabase } from "~/supabase";

/** getMyRoomsInProgress lists the rooms the current user plays in that are
 * not over and had activity in the last MY_ROOMS_MAX_AGE_MS, most recently
 * active first, at most MAX_MY_ROOMS.
 *
 * `userIds` are the current user's own ids only — their account id (when
 * logged in) and the guest id from their session cookie — never ids taken
 * from the request body, so nobody can list another person's rooms.
 * `accountId` is used to open the user's own private games.
 *
 * One SQL function (user_rooms_in_progress, on an index of `join` events)
 * finds the candidate rooms; each candidate is then replayed, like the
 * "rooms in progress" list, to drop finished games and rooms the user left.
 * Errors (e.g. the function is missing) give an empty list: the home page
 * must never fail because of this section. */
export async function getMyRoomsInProgress(
  userIds: (string | null | undefined)[],
  {
    accessToken,
    accountId,
    now = Date.now(),
  }: {
    accessToken?: AuthSession["accessToken"];
    accountId?: string;
    now?: number;
  } = {},
): Promise<MyRoom[]> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return [];

  try {
    const { data, error } = await getSupabase(accessToken).rpc(
      "user_rooms_in_progress",
      {
        user_ids: ids,
        since: new Date(now - MY_ROOMS_MAX_AGE_MS).toISOString(),
        max_count: MAX_MY_ROOM_CANDIDATES,
      },
    );
    if (error !== null) throw new Error(error.message);

    const games = new Map<string, Promise<Game | null>>();
    const gameFor = (gameId: string) => {
      let game = games.get(gameId);
      if (!game) {
        game = getGame(gameId, accountId).catch(() => null);
        games.set(gameId, game);
      }
      return game;
    };

    const rooms = await Promise.all(
      data.map(async (room) => {
        const game = await gameFor(room.game_id);
        if (!game) return null;
        const events = await getRoomEvents(room.room_id, accessToken);
        return summarizeMyRoom(
          game,
          { id: room.room_id, name: room.room_name },
          events,
          ids,
          now,
        );
      }),
    );

    return rooms
      .filter((room): room is MyRoom => room !== null)
      .sort((a, b) => a.minutesAgo - b.minutesAgo)
      .slice(0, MAX_MY_ROOMS);
  } catch (error: unknown) {
    console.error("Could not list the user's rooms in progress", error);
    return [];
  }
}
