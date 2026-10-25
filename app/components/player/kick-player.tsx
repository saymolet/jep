import { useFetcher } from "react-router";

import * as DropdownMenu from "~/components/dropdown-menu";
import { UserMinus } from "~/components/icons";
import type { Action, Player } from "~/engine";
import { useEngineContext } from "~/engine";
import useSoloAction from "~/utils/use-solo-action";

import { PlayerIcon, type PlayerIconSize } from "./player-icon";

export function KickablePlayerIcon({
  player,
  roomId,
  isSelf,
  size = "tile",
}: {
  player: Player;
  roomId: number;
  isSelf: boolean;
  size?: PlayerIconSize;
}) {
  const { soloDispatch } = useEngineContext();

  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="shrink-0 cursor-pointer rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none md:rounded-2xl"
          aria-label={isSelf ? "Leave game" : `Kick player ${player.name}`}
        >
          <PlayerIcon player={player} size={size} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Label>
            <span className="font-bold">{player.name}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            asChild
            onSelect={(e: Event) => e.preventDefault()}
          >
            <fetcher.Form method="DELETE" action={`/room/${roomId}/player`}>
              <input type="hidden" name="userId" value={player.userId} />
              <input type="hidden" name="name" value={player.name} />
              <DropdownMenu.Action type="submit">
                <UserMinus className="absolute left-0 m-1 h-5 w-5" />
                <span className="pl-7">
                  {isSelf ? "Leave game" : "Kick player"}
                </span>
              </DropdownMenu.Action>
            </fetcher.Form>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
