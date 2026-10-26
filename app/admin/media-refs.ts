/** Which files of the "game-media" Storage bucket are used by games: pure
 * helpers for deleting a game's media and for the orphaned-files cleanup.
 *
 * A clue references a file through a public URL
 * (`<supabase>/storage/v1/object/public/game-media/<path>`) in its `media` or
 * `answer_media` blocks or its `image_src`. SIGame imports put each pack's
 * files under their own `siq/<uuid>/` prefix, but clues are copied by value
 * (random boards, uploaded .jep.json files), so any game may use another
 * game's files: decisions are always made against the clues of all games. */

export const GAME_MEDIA_PUBLIC_PATH = "/storage/v1/object/public/game-media/";

/** mediaObjectPath returns the object path inside the bucket for a public
 * URL of a "game-media" file, or null for anything else. Any origin counts
 * (a reference is a reason to keep a file, so being generous is safe). */
export function mediaObjectPath(src: unknown): string | null {
  if (typeof src !== "string") return null;
  let pathname: string;
  try {
    pathname = new URL(src).pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(GAME_MEDIA_PUBLIC_PATH)) return null;
  const encoded = pathname.slice(GAME_MEDIA_PUBLIC_PATH.length);
  if (!encoded) return null;
  try {
    return encoded.split("/").map(decodeURIComponent).join("/");
  } catch {
    return null;
  }
}

/** The clue columns that can reference media. */
export interface ClueMediaRow {
  media: unknown;
  answer_media: unknown;
  image_src: string | null;
}

/** A clue's media columns and the game it belongs to. */
export interface GameClueMediaRow extends ClueMediaRow {
  game_id: string;
}

function blockSources(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.map((block: unknown) =>
    typeof block === "object" && block !== null && "src" in block
      ? block.src
      : null,
  );
}

/** clueMediaPaths lists the bucket paths one clue references. */
export function clueMediaPaths(row: ClueMediaRow): string[] {
  const sources = [
    ...blockSources(row.media),
    ...blockSources(row.answer_media),
    row.image_src,
  ];
  const paths = new Set<string>();
  for (const src of sources) {
    const path = mediaObjectPath(src);
    if (path) paths.add(path);
  }
  return [...paths];
}

/** referencedPaths is every bucket path referenced by any of `rows`. */
export function referencedPaths(rows: Iterable<ClueMediaRow>): Set<string> {
  const paths = new Set<string>();
  for (const row of rows) {
    for (const path of clueMediaPaths(row)) paths.add(path);
  }
  return paths;
}

/** planGameMediaDeletion splits the files used by game `gameId` into those
 * that can be removed with it and those another game still uses. `rows` are
 * the media-carrying clues of all games (including this one). */
export function planGameMediaDeletion(
  gameId: string,
  rows: Iterable<GameClueMediaRow>,
): { remove: string[]; keep: string[] } {
  const own = new Set<string>();
  const others = new Set<string>();
  for (const row of rows) {
    const target = row.game_id === gameId ? own : others;
    for (const path of clueMediaPaths(row)) target.add(path);
  }
  const remove: string[] = [];
  const keep: string[] = [];
  for (const path of [...own].sort()) {
    (others.has(path) ? keep : remove).push(path);
  }
  return { remove, keep };
}

/** A file in the bucket. */
export interface MediaObject {
  name: string;
  size: number;
  /** ISO time the file was uploaded. */
  created_at: string;
}

/** Files younger than this are never treated as orphans: a SIGame import
 * uploads its files before it creates the game that references them. */
export const ORPHAN_MIN_AGE_MS = 60 * 60 * 1000;

/** findOrphans lists files no clue references, uploaded at least `minAgeMs`
 * before `now`, with their total size. */
export function findOrphans(
  objects: Iterable<MediaObject>,
  referenced: ReadonlySet<string>,
  { now, minAgeMs = ORPHAN_MIN_AGE_MS }: { now: number; minAgeMs?: number },
): { orphans: MediaObject[]; bytes: number } {
  const orphans: MediaObject[] = [];
  let bytes = 0;
  for (const object of objects) {
    if (referenced.has(object.name)) continue;
    // Supabase's placeholder for an empty folder is not a real file.
    if (object.name.endsWith("/.emptyFolderPlaceholder")) continue;
    const uploadedAt = Date.parse(object.created_at);
    if (!Number.isFinite(uploadedAt) || now - uploadedAt < minAgeMs) continue;
    orphans.push(object);
    bytes += object.size;
  }
  return { orphans, bytes };
}
