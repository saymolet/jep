import clsx from "clsx";

import type { Player } from "~/engine/state";
import { parseAvatar } from "~/models/avatar";
import { getPlayerColor } from "~/utils";

// https://stackoverflow.com/questions/70524820/is-there-still-no-easy-way-to-split-strings-with-compound-emojis-into-an-array
const COMPOUND_EMOJI_REGEX =
  /\p{RI}\p{RI}|\p{Emoji}(\p{EMod}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?(\u{200D}\p{Emoji}(\p{EMod}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?)*|./gsu;

const EMOJI_REGEX = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** firstCharacter is the first character of a name, keeping compound emoji
 * whole. */
export function firstCharacter(name: string) {
  const matches = name.match(COMPOUND_EMOJI_REGEX);
  return matches ? matches[0] : name[0];
}

export type PlayerIconSize = "xs" | "sm" | "md" | "lg" | "tile";

const SIZE_CLASSES: Record<PlayerIconSize, string> = {
  xs: "h-5 w-5 rounded-sm",
  sm: "h-6 w-6 rounded-md",
  md: "h-8 w-8 rounded-lg",
  lg: "h-14 w-14 rounded-xl",
  // The big square on score tiles and in the join dialog: 72px on phones,
  // 96px from the md breakpoint up.
  tile: "h-18 w-18 rounded-xl md:h-24 md:w-24 md:rounded-2xl",
};

/** Padding around a photo, showing the player color as a frame. */
const FRAME_CLASSES: Record<PlayerIconSize, string> = {
  xs: "p-px",
  sm: "p-0.5",
  md: "p-0.5",
  lg: "p-1",
  tile: "p-1 md:p-1.5",
};

const IMAGE_CLASSES: Record<PlayerIconSize, string> = {
  xs: "rounded-xs",
  sm: "rounded",
  md: "rounded-md",
  lg: "rounded-lg",
  tile: "rounded-lg md:rounded-xl",
};

const LETTER_CLASSES: Record<PlayerIconSize, string> = {
  xs: "text-[0.625rem]",
  sm: "text-xs",
  md: "text-md",
  lg: "text-2xl",
  tile: "text-3xl md:text-5xl",
};

const EMOJI_CLASSES: Record<PlayerIconSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-xl",
  lg: "text-4xl",
  tile: "text-5xl md:text-7xl",
};

/** PlayerIcon is a rounded square in the player's color showing their avatar:
 * an emoji, a photo (framed in the player's color), or — without an avatar —
 * the first character of their name.
 */
export function PlayerIcon({
  player,
  size = "md",
}: {
  player: Pick<Player, "name" | "userId" | "color" | "avatar">;
  size?: PlayerIconSize;
}) {
  const backgroundColor = getPlayerColor(player);
  const avatar = parseAvatar(player.avatar);
  const initial = firstCharacter(player.name);
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden",
        SIZE_CLASSES[size],
        avatar?.kind === "image" && FRAME_CLASSES[size],
      )}
      style={{ backgroundColor }}
      title={player.name}
      data-testid="player-icon"
    >
      {avatar?.kind === "image" ? (
        <img
          src={avatar.src}
          alt=""
          className={clsx("h-full w-full object-cover", IMAGE_CLASSES[size])}
          draggable={false}
        />
      ) : avatar?.kind === "emoji" ? (
        <span
          className={clsx("leading-none select-none", EMOJI_CLASSES[size])}
          aria-hidden="true"
        >
          {avatar.emoji}
        </span>
      ) : (
        <div
          className={clsx(
            "font-mono font-bold text-white",
            // Names may start with an emoji (random names do): show it at
            // emoji size like an emoji avatar.
            EMOJI_REGEX.test(initial)
              ? clsx("leading-none", EMOJI_CLASSES[size])
              : LETTER_CLASSES[size],
          )}
        >
          {initial}
        </div>
      )}
    </div>
  );
}
