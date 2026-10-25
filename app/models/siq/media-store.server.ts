import { randomUUID } from "node:crypto";

import { getSupabaseAdmin } from "~/supabase/admin.server";

import type { MediaStore } from "./import.server";

/** GAME_MEDIA_BUCKET is the public Supabase Storage bucket for imported media
 * (created by the `game_media_bucket` migration). */
export const GAME_MEDIA_BUCKET = "game-media";

/** Storage removes at most this many files per request. */
const REMOVE_BATCH = 1000;

/** createGameMediaStore uploads to `game-media/siq/<random id>/` with the
 * service-role client; each import gets its own prefix. */
export function createGameMediaStore(
  prefix = `siq/${randomUUID()}`,
): MediaStore & { prefix: string } {
  const bucket = getSupabaseAdmin().storage.from(GAME_MEDIA_BUCKET);
  const uploaded: string[] = [];

  return {
    prefix,
    async upload(name, bytes, contentType) {
      const path = `${prefix}/${name}`;
      const { error } = await bucket.upload(path, bytes, {
        contentType,
        // Files never change: each import writes new paths.
        cacheControl: "31536000",
        upsert: false,
      });
      if (error) throw error;
      uploaded.push(path);
      return bucket.getPublicUrl(path).data.publicUrl;
    },
    async removeAll() {
      for (let i = 0; i < uploaded.length; i += REMOVE_BATCH) {
        const { error } = await bucket.remove(
          uploaded.slice(i, i + REMOVE_BATCH),
        );
        if (error) throw error;
      }
      uploaded.length = 0;
    },
  };
}
