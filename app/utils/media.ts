/** Media attached to a clue: pictures, sound and video shown together with the
 * clue text (`media`) or when the answer is revealed (`answerMedia`).
 *
 * This module is shared by the server (game validation) and the client
 * (rendering), so it must stay free of server-only imports.
 */

export const MEDIA_TYPES = ["image", "audio", "video"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export interface MediaBlock {
  type: MediaType;
  /** An https: URL of the file, or (for type "video") a YouTube link. */
  src: string;
  /** Text alternative for screen readers. */
  alt?: string;
}

/** The subset of a clue that carries media. */
export interface ClueWithMedia {
  clue: string;
  imageSrc?: string;
  media?: MediaBlock[];
  answerMedia?: MediaBlock[];
  /** Options of a multiple choice clue; read together with the clue. */
  choices?: string[];
  /** The question's own reading time (pack hint), in seconds. */
  readTimeSec?: number;
}

/** MAX_MEDIA_BLOCKS caps the number of media blocks per clue/answer. */
export const MAX_MEDIA_BLOCKS = 10;

export function isHttpsUrl(src: string): boolean {
  try {
    return new URL(src).protocol === "https:";
  } catch {
    return false;
  }
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** isYouTubeUrl reports whether the URL points at YouTube at all, so we can
 * tell "not YouTube" apart from "a YouTube link we can't understand". */
export function isYouTubeUrl(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    return YOUTUBE_HOSTS.has(host) || host === "youtu.be";
  } catch {
    return false;
  }
}

/** parseTimestamp parses YouTube start times: "90", "90s", "1m30s", "1h2m3s".
 * Returns undefined for anything else. */
function parseTimestamp(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match) return undefined;
  const [, h, m, s] = match;
  if (h === undefined && m === undefined && s === undefined) return undefined;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

export interface YouTubeVideo {
  id: string;
  /** Start offset in whole seconds. */
  start?: number;
}

/** parseYouTubeUrl extracts the video ID and optional start time from the
 * common YouTube link formats:
 * - https://www.youtube.com/watch?v=ID&t=1m30s
 * - https://youtu.be/ID?t=90
 * - https://www.youtube.com/shorts/ID, /embed/ID, /live/ID
 * Returns null if the URL is not a recognizable https YouTube video link.
 */
export function parseYouTubeUrl(src: string): YouTubeVideo | null {
  let url: URL;
  try {
    url = new URL(src.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  let id: string | null = null;
  if (url.hostname === "youtu.be") {
    id = url.pathname.split("/")[1] ?? null;
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    const [, first, second] = url.pathname.split("/");
    if (first === "watch") {
      id = url.searchParams.get("v");
    } else if (first === "shorts" || first === "embed" || first === "live") {
      id = second ?? null;
    }
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;

  const start =
    parseTimestamp(url.searchParams.get("t")) ??
    parseTimestamp(url.searchParams.get("start"));
  return start ? { id, start } : { id };
}

/** youTubeEmbedUrl builds a privacy-enhanced (youtube-nocookie.com) embed URL. */
export function youTubeEmbedUrl(
  video: YouTubeVideo,
  { autoPlay = false }: { autoPlay?: boolean } = {},
): string {
  const params = new URLSearchParams({ playsinline: "1", rel: "0" });
  if (video.start) params.set("start", video.start.toString());
  if (autoPlay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${video.id}?${params}`;
}

/** mediaBlockError returns a human-readable problem with a media block's
 * source, or null if it is valid. */
export function mediaBlockError(block: MediaBlock): string | null {
  const src = block.src.trim();
  if (!isHttpsUrl(src)) {
    return "media src must be an https:// URL";
  }
  if (isYouTubeUrl(src)) {
    if (block.type !== "video") {
      return 'YouTube links must use type "video"';
    }
    if (!parseYouTubeUrl(src)) {
      return "media src is not a recognized YouTube video link";
    }
  }
  return null;
}

/** getClueMedia returns the media shown with the clue text. A legacy
 * `imageSrc` is treated as an image block shown before any other media;
 * `imageAlt` describes it (pass a translated one in the UI). */
export function getClueMedia(
  clue: ClueWithMedia,
  imageAlt: (clueText: string) => string = (clueText) =>
    `Image for clue: ${clueText}`,
): MediaBlock[] {
  const blocks: MediaBlock[] = [];
  if (clue.imageSrc) {
    blocks.push({
      type: "image",
      src: clue.imageSrc,
      alt: clue.clue ? imageAlt(clue.clue) : undefined,
    });
  }
  return blocks.concat(clue.media ?? []);
}

/** hasPlayableMedia reports whether any block is audio or video. */
export function hasPlayableMedia(blocks: MediaBlock[]): boolean {
  return blocks.some((b) => b.type === "audio" || b.type === "video");
}

/** READ_PER_CHAR_MS is the number of milliseconds to "read" each character of
 * the clue before the buzzer opens. Longer clues should take longer to read.
 */
export const READ_PER_CHAR_MS = 60;

/** READ_BASE_MS is the base amount of time it takes to read a clue. */
export const READ_BASE_MS = 1000;

/** IMAGE_READ_MS is the minimum read time for a clue with pictures, so players
 * get a moment to look at the picture even if the clue text is short. */
export const IMAGE_READ_MS = 3000;

/** PLAYBACK_READ_MS is the minimum read time for a clue with audio or video,
 * so everyone hears/sees a meaningful part of the clip before the buzzers open. */
export const PLAYBACK_READ_MS = 10_000;

/** getClueReadMs is how long the buzzers stay locked while the clue is "read".
 *
 * - Text only: READ_BASE_MS + READ_PER_CHAR_MS per character (unchanged);
 *   the options of a multiple choice clue count as text too.
 * - With pictures: at least IMAGE_READ_MS.
 * - With audio or video: at least PLAYBACK_READ_MS.
 */
export function getClueReadMs(clue: ClueWithMedia): number {
  const numChars =
    clue.clue.length +
    (clue.choices ?? []).reduce((sum, choice) => sum + choice.length, 0);
  const textMs = READ_BASE_MS + READ_PER_CHAR_MS * numChars;
  const media = getClueMedia(clue);
  if (hasPlayableMedia(media)) return Math.max(textMs, PLAYBACK_READ_MS);
  if (media.length > 0) return Math.max(textMs, IMAGE_READ_MS);
  return textMs;
}

/** READ_REOPENED_MS is how long the question is "re-read" after a wrong
 * answer before the buzzers open again for the others. */
export const READ_REOPENED_MS = 1000;

/** getRoomReadMs is how long the buzzers stay locked while the question is
 * read, with the room's reading time setting (State.readTimeSec): a fixed
 * number of seconds, or with "Auto" (null) the question's own hint
 * (`readTimeSec`, e.g. from a SIGame pack) or else getClueReadMs. A re-read
 * after a wrong answer takes READ_REOPENED_MS, or less when the room's fixed
 * reading time is shorter. */
export function getRoomReadMs(
  clue: ClueWithMedia,
  readTimeSec: number | null,
  { reRead = false }: { reRead?: boolean } = {},
): number {
  if (reRead) {
    return readTimeSec === null
      ? READ_REOPENED_MS
      : Math.min(READ_REOPENED_MS, readTimeSec * 1000);
  }
  if (readTimeSec !== null) return readTimeSec * 1000;
  if (clue.readTimeSec !== undefined) return clue.readTimeSec * 1000;
  return getClueReadMs(clue);
}
