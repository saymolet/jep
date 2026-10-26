/** Soundboard: fun reaction sounds a player taps that play on every device in
 * the room. Messages are ephemeral Realtime broadcasts on the room channel
 * (never stored, never part of the game state). This module lists the sounds
 * and validates incoming messages: anyone on the channel can send anything,
 * so receivers only trust what they check here. */

export const SOUND_IDS = [
  "applause",
  "drumroll",
  "tada",
  "wrong",
  "airhorn",
  "laugh",
  "ooh",
  "crickets",
  "ding",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

export interface SoundInfo {
  id: SoundId;
  emoji: string;
  labelKey: `soundboard.sound.${SoundId}`;
}

const EMOJI: Record<SoundId, string> = {
  applause: "👏",
  drumroll: "🥁",
  tada: "🎺",
  wrong: "❌",
  airhorn: "📯",
  laugh: "😂",
  ooh: "😮",
  crickets: "🦗",
  ding: "🔔",
};

function labelKey(id: SoundId): SoundInfo["labelKey"] {
  return `soundboard.sound.${id}`;
}

export function getSound(id: SoundId): SoundInfo {
  return { id, emoji: EMOJI[id], labelKey: labelKey(id) };
}

/** SOUNDS in the order they are shown on the soundboard. */
export const SOUNDS: readonly SoundInfo[] = SOUND_IDS.map(getSound);

export function isSoundId(value: unknown): value is SoundId {
  return typeof value === "string" && SOUND_IDS.some((id) => id === value);
}

/** The Realtime broadcast event name on the room channel. */
export const SOUNDBOARD_EVENT = "soundboard";

/** Longest sender name kept from a message (player names are ≤ 50). */
export const MAX_SENDER_NAME_LENGTH = 50;
const MAX_USER_ID_LENGTH = 100;

export interface SoundboardMessage {
  sound: SoundId;
  /** The sender's user id (as claimed by the sender). */
  userId: string;
  /** The sender's player name, for display. */
  name: string;
}

/** parseSoundboardMessage checks a broadcast payload and returns a clean
 * message, or null when it is malformed or names an unknown sound. */
export function parseSoundboardMessage(
  payload: unknown,
): SoundboardMessage | null {
  if (typeof payload !== "object" || payload === null) return null;
  if (Array.isArray(payload)) return null;
  const sound: unknown = Reflect.get(payload, "sound");
  const userId: unknown = Reflect.get(payload, "userId");
  const name: unknown = Reflect.get(payload, "name");
  if (!isSoundId(sound)) return null;
  if (
    typeof userId !== "string" ||
    userId.length === 0 ||
    userId.length > MAX_USER_ID_LENGTH
  ) {
    return null;
  }
  if (typeof name !== "string") return null;
  return {
    sound,
    userId,
    name: name.trim().slice(0, MAX_SENDER_NAME_LENGTH),
  };
}
