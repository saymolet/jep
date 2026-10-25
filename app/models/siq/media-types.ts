import type { MediaType } from "~/utils/media";

export interface MediaFileType {
  type: MediaType;
  contentType: string;
}

/** The file types an imported pack may contain, by extension. Everything
 * else (SVG, HTML, executables, ...) is skipped. SVG is left out on purpose:
 * it can carry scripts. */
const TYPES: Record<string, MediaFileType> = {
  jpg: { type: "image", contentType: "image/jpeg" },
  jpeg: { type: "image", contentType: "image/jpeg" },
  png: { type: "image", contentType: "image/png" },
  gif: { type: "image", contentType: "image/gif" },
  webp: { type: "image", contentType: "image/webp" },
  avif: { type: "image", contentType: "image/avif" },
  bmp: { type: "image", contentType: "image/bmp" },
  mp3: { type: "audio", contentType: "audio/mpeg" },
  m4a: { type: "audio", contentType: "audio/mp4" },
  aac: { type: "audio", contentType: "audio/aac" },
  wav: { type: "audio", contentType: "audio/wav" },
  ogg: { type: "audio", contentType: "audio/ogg" },
  oga: { type: "audio", contentType: "audio/ogg" },
  opus: { type: "audio", contentType: "audio/ogg" },
  flac: { type: "audio", contentType: "audio/flac" },
  weba: { type: "audio", contentType: "audio/webm" },
  mp4: { type: "video", contentType: "video/mp4" },
  m4v: { type: "video", contentType: "video/mp4" },
  webm: { type: "video", contentType: "video/webm" },
  ogv: { type: "video", contentType: "video/ogg" },
  mov: { type: "video", contentType: "video/quicktime" },
};

/** ALLOWED_CONTENT_TYPES is every content type an import uploads (the
 * storage bucket's allow list must contain them all). */
export const ALLOWED_CONTENT_TYPES = [
  ...new Set(Object.values(TYPES).map((t) => t.contentType)),
].sort();

export function fileExtension(name: string): string {
  const base = name.slice(name.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** mediaFileType returns how to serve a file, or undefined if the type is not
 * supported. The extension decides the media type: a SIGame "image" item that
 * is really an .mp3 is played as audio. */
export function mediaFileType(name: string): MediaFileType | undefined {
  return TYPES[fileExtension(name)];
}
