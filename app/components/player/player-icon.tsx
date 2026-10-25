import clsx from "clsx";

import type { Player } from "~/engine/state";
import { parseAvatar } from "~/models/avatar";
import { getPlayerColor } from "~/utils";

// https://stackoverflow.com/questions/70524820/is-there-still-no-easy-way-to-split-strings-with-compound-emojis-into-an-array
const COMPOUND_EMOJI_REGEX =
  /\p{RI}\p{RI}|\p{Emoji}(\p{EMod}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?(\u{200D}\p{Emoji}(\p{EMod}|\u{FE0F}\u{20E3}?|[\u{E0020}-\u{E007E}]+\u{E007F})?)*|./gsu;

/** firstCharacter is the first character of a name, keeping compound emoji
 * whole. */
export function firstCharacter(name: string) {
  const matches = name.match(COMPOUND_EMOJI_REGEX);
  return matches ? matches[0] : name[0];
}

type PlayerIconSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<PlayerIconSize, string> = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-14 w-14",
};

const LETTER_CLASSES: Record<PlayerIconSize, string> = {
  sm: "text-xs",
  md: "text-md",
  lg: "text-2xl",
};

const EMOJI_CLASSES: Record<PlayerIconSize, string> = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-4xl",
};

/** PlayerIcon is a round bubble in the player's color showing their avatar:
 * an emoji, a photo (ringed in the player's color), or — without an avatar —
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
  return (
    <div
      className={clsx(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        SIZE_CLASSES[size],
        { "p-0.5": avatar?.kind === "image" },
      )}
      style={{ backgroundColor }}
      title={player.name}
      data-testid="player-icon"
    >
      {avatar?.kind === "image" ? (
        <img
          src={avatar.src}
          alt=""
          className="h-full w-full rounded-full object-cover"
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
            LETTER_CLASSES[size],
          )}
        >
          {firstCharacter(player.name)}
        </div>
      )}
    </div>
  );
}
