import { z } from "zod";

/** A player's avatar. Stored as a string so it fits in room event payloads
 * and user settings:
 * - `emoji:🦊` — an emoji (normally one from AVATAR_EMOJI)
 * - `data:image/(webp|jpeg|png);base64,…` — a small photo, already cropped
 *   and resized in the browser (see utils/avatar-image.ts). There is no file
 *   hosting: the photo travels inline.
 */
export type Avatar = string;

export const EMOJI_AVATAR_PREFIX = "emoji:";

/** Upper bound on the length (= bytes; data URLs are ASCII) of an avatar. A
 * 96×96 WebP/JPEG is a few KB, so this leaves plenty of room. */
export const MAX_AVATAR_LENGTH = 24 * 1024;

/** Maximum number of code points of an emoji avatar (after the prefix). */
export const MAX_EMOJI_AVATAR_CODE_POINTS = 16;

/** Preset emoji offered by the avatar picker. */
export const AVATAR_EMOJI = [
  "🦊",
  "🐼",
  "🐸",
  "🐙",
  "🦄",
  "🐯",
  "🐵",
  "🐧",
  "🦉",
  "🐢",
  "🦖",
  "🐝",
  "🍕",
  "🍩",
  "🌮",
  "🍉",
  "🥑",
  "🍄",
  "🌵",
  "🚀",
  "🎸",
  "👾",
  "🤖",
  "👻",
  "🎩",
  "⚽",
  "🔥",
  "🌈",
] as const;

const EMOJI_CHARS_REGEX =
  /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\p{Emoji_Component}|\u{200D}|\u{FE0F})+$/u;
const HAS_PICTOGRAPH_REGEX =
  /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const DATA_URL_REGEX =
  /^data:image\/(?:webp|jpeg|png);base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{4}))$/;

function isValidEmoji(emoji: string) {
  const codePoints = Array.from(emoji).length;
  return (
    codePoints > 0 &&
    codePoints <= MAX_EMOJI_AVATAR_CODE_POINTS &&
    EMOJI_CHARS_REGEX.test(emoji) &&
    HAS_PICTOGRAPH_REGEX.test(emoji)
  );
}

/** isValidAvatar checks an avatar string (see Avatar). */
export function isValidAvatar(value: unknown): value is Avatar {
  if (typeof value !== "string" || value.length > MAX_AVATAR_LENGTH) {
    return false;
  }
  if (value.startsWith(EMOJI_AVATAR_PREFIX)) {
    return isValidEmoji(value.slice(EMOJI_AVATAR_PREFIX.length));
  }
  return DATA_URL_REGEX.test(value);
}

/** normalizeAvatar returns the avatar if it is valid and undefined otherwise.
 * Used where bad values must be ignored rather than rejected (engine replay,
 * stored settings). */
export function normalizeAvatar(value: unknown): Avatar | undefined {
  return isValidAvatar(value) ? value : undefined;
}

export type ParsedAvatar =
  | { kind: "emoji"; emoji: string }
  | { kind: "image"; src: string };

/** parseAvatar splits a valid avatar into something renderable. */
export function parseAvatar(value: unknown): ParsedAvatar | undefined {
  if (!isValidAvatar(value)) {
    return undefined;
  }
  if (value.startsWith(EMOJI_AVATAR_PREFIX)) {
    return { kind: "emoji", emoji: value.slice(EMOJI_AVATAR_PREFIX.length) };
  }
  return { kind: "image", src: value };
}

export function emojiAvatar(emoji: string): Avatar {
  return EMOJI_AVATAR_PREFIX + emoji;
}

/** AvatarInput validates an avatar submitted by a client: a valid avatar, or
 * the empty string to remove the avatar. */
export const AvatarInput = z.union([
  z.literal(""),
  z.string().refine(isValidAvatar, { message: "Invalid avatar" }),
]);
