import type { ActionType } from "~/engine";
import { AuthSession } from "~/models/auth";
import type { Database, Json } from "~/models/database.types";
import { getSupabase } from "~/supabase";
import { getSupabaseAdmin } from "~/supabase/admin.server";

type RoomEventTable = Database["public"]["Tables"]["room_events"];
export type DbRoomEvent = RoomEventTable["Row"];

/* Reads */

export async function getRoomEvents(
  roomId: number,
  accessToken?: AuthSession["accessToken"],
): Promise<DbRoomEvent[]> {
  const client = getSupabase(accessToken);
  const { data, error } = await client
    .from<"room_events", RoomEventTable>("room_events")
    .select("*")
    .order("ts", { ascending: true })
    .eq("room_id", roomId);

  if (error !== null) {
    throw new Error(error.message);
  }

  return data;
}

/* Writes */

/** createRoomEventAsServer inserts a room event with the service role. It is
 * the only way room events are written: the browser key may not insert into
 * room_events at all (RLS, see the room_events_server_only migration), so
 * every room action goes through a server route that first checks who is
 * asking (the visitor's own userId via requireSessionUserId, or the site
 * admin via getAdmin). Only call it after such a check. Realtime still
 * delivers the insert to every subscriber (it checks the subscriber's select
 * policy, not the inserter's role). */
export async function createRoomEventAsServer(
  roomId: number,
  type: ActionType,
  payload?: Json,
) {
  const client = getSupabaseAdmin();
  const { data, error } = await client
    .from<"room_events", RoomEventTable>("room_events")
    .insert<RoomEventTable["Insert"]>({
      room_id: roomId,
      type,
      payload,
    })
    .select();

  if (error !== null) {
    throw new Error(error.message);
  }

  const roomEvent = data.at(0);
  if (!roomEvent) {
    throw new Error("room event not created");
  }
  return roomEvent;
}
