import { redirect } from "react-router";

import { ActiveRoomsList } from "~/components/active-rooms";
import { ButtonLink } from "~/components/button";
import { Play } from "~/components/icons";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoom, getActiveRooms } from "~/models/room.server";

import type { Route } from "./+types/game_.$gameId.play";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return loaderData ? [{ title: loaderData.preview.title }] : [];
};

/** Opening a game for multiplayer creates a new room — unless rooms of this
 * game are already in progress, in which case the player chooses between
 * joining one of them and starting a new room (`?new` skips the choice). */
export async function loader({ request, params }: Route.LoaderArgs) {
  const gameId = params.gameId;

  if (!gameId) {
    throw new Response("game ID not found", { status: 404 });
  }

  const authSession = await getValidAuthSession(request);

  if (!new URL(request.url).searchParams.has("new")) {
    const game = await getGame(gameId, authSession?.userId);
    const activeRooms = game
      ? await getActiveRooms(game, authSession?.accessToken)
      : [];
    if (game && activeRooms.length > 0) {
      // Not `game`: the header treats routes with `game` data as in-game.
      return { preview: { id: game.id, title: game.title }, activeRooms };
    }
  }

  const roomName = await createRoom(gameId, authSession?.accessToken);

  throw redirect(`/room/${roomName}`);
}

export default function ChooseRoom({ loaderData }: Route.ComponentProps) {
  const { preview: game, activeRooms } = loaderData;

  return (
    <main className="flex grow flex-col bg-blue-1000 text-white">
      <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-5 p-3 text-slate-100 sm:p-6 md:p-12">
        <div>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight text-white sm:text-4xl">
            {game.title}
          </h1>
          <p className="mt-2 text-sm text-slate-300 sm:text-base">
            This game is already being played. Join a room in progress or start
            your own.
          </p>
        </div>

        <ActiveRoomsList rooms={activeRooms} />

        <div className="grid sm:flex">
          <ButtonLink to={`/game/${game.id}/play?new`} variant="primary">
            <Play className="h-4 w-4" />
            Start a new room
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
