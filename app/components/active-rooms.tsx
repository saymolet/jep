import { Link } from "react-router";

import { Play } from "~/components/icons";
import { firstCharacter } from "~/components/player/player-icon";
import { type ActiveRoom, formatTimeAgo } from "~/models/active-rooms";

function PlayerList({ players }: { players: ActiveRoom["players"] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {players.map((player, i) => (
        <li key={i} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-xs leading-none"
            style={{ backgroundColor: player.color }}
          >
            {player.emoji ?? (
              <span className="font-mono text-[0.625rem] font-bold text-white">
                {firstCharacter(player.name)}
              </span>
            )}
          </span>
          <span className="truncate">{player.name}</span>
        </li>
      ))}
    </ul>
  );
}

/** ActiveRoomsList shows a game's rooms that are still in progress so friends
 * can join one without a shared link. Renders nothing when there are none. */
export function ActiveRoomsList({ rooms }: { rooms: ActiveRoom[] }) {
  if (rooms.length === 0) return null;

  return (
    <section aria-labelledby="active-rooms-heading" className="flex flex-col">
      <h2
        id="active-rooms-heading"
        className="mb-2 text-lg font-semibold text-white"
      >
        Rooms in progress
      </h2>
      <ul className="grid gap-2 md:grid-cols-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link
              to={`/room/${room.roomName}`}
              className="flex items-center gap-3 rounded-md border border-slate-500 bg-blue-950/60 p-3 text-sm text-slate-100 transition-colors hover:border-blue-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <div className="flex min-w-0 grow flex-col gap-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-white">
                    {room.roomName}
                  </span>
                  <span className="text-xs text-slate-300">
                    {room.players.length} player
                    {room.players.length === 1 ? "" : "s"} &middot; active{" "}
                    {formatTimeAgo(room.minutesAgo)}
                  </span>
                </div>
                <PlayerList players={room.players} />
              </div>
              <span className="flex shrink-0 items-center gap-1 font-medium text-blue-200">
                <Play className="h-4 w-4" />
                Join
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
