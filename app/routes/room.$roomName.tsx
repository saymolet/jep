import * as React from "react";
import { data, redirect, useMatches } from "react-router";
import { ENV } from "varlock/env";

import GameComponent from "~/components/game";
import { ActionType, GameEngineContext, useGameEngine } from "~/engine";
import type { PresenceRole } from "~/engine/presence";
import { applyRoomEventsToState } from "~/engine/room-event";
import { GameState, stateFromGame } from "~/engine/state";
import { createT, getRequestLocale } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoomEvent, getRoomEvents } from "~/models/room-event.server";
import { getRoomByName } from "~/models/room.server";
import { getUserByEmail } from "~/models/user";
import { parseUserSettings } from "~/models/user-settings";
import { getOrCreateUserSession, getUserSession } from "~/session.server";
import { getRandomEmoji } from "~/utils";

import type { Route } from "./+types/room.$roomName";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  try {
    return [{ title: loaderData?.game.title }];
  } catch {
    return [];
  }
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const t = createT(getRequestLocale(request));
  const roomName = params.roomName;
  if (!roomName) {
    throw new Response(t("room.error.noRoomInUrl"), { status: 404 });
  }

  const authSession = await getValidAuthSession(request);
  const room = await getRoomByName(roomName, authSession?.accessToken);
  if (!room) {
    throw new Response(t("room.error.roomNotFound"), { status: 404 });
  }
  const roomId = room.id;

  const game = await getGame(room.game_id, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }

  const user = authSession
    ? await getUserByEmail(authSession.email, authSession.accessToken)
    : null;
  const accessToken = authSession?.accessToken;

  const roomEvents = await getRoomEvents(room.id, accessToken);
  const gameDefaults = user
    ? parseUserSettings(user.settings).gameDefaults
    : undefined;
  const name = gameDefaults?.playerName ?? getRandomEmoji();
  const playerColor = gameDefaults?.playerColor;

  const state = applyRoomEventsToState(stateFromGame(game), roomEvents);

  if (state.type === GameState.GameOver) {
    return redirect(`/room/${roomName}/summary`);
  }

  if (user) {
    const userId = user.id;

    // Check if this authenticated user was previously playing as an anonymous
    // guest. If so, transfer the anonymous player to their authenticated
    // identity so they keep their score and participation. If the
    // authenticated user is already in the game too, the anonymous player is
    // retired to leftPlayers so it doesn't block the game.
    const anonymousUserId = await getUserSession(request);
    if (
      anonymousUserId &&
      anonymousUserId !== userId &&
      state.players.has(anonymousUserId)
    ) {
      await createRoomEvent(
        room.id,
        ActionType.TransferPlayer,
        { oldUserId: anonymousUserId, newUserId: userId },
        accessToken,
      );
      // Re-fetch room events to include the transfer.
      const updatedRoomEvents = await getRoomEvents(room.id, accessToken);
      return {
        game,
        name,
        playerColor,
        roomEvents: updatedRoomEvents,
        roomId,
        roomName,
        userId,
        BASE_URL: ENV.BASE_URL,
        accessToken,
      };
    }

    return {
      game,
      name,
      playerColor,
      roomEvents,
      roomId,
      roomName,
      userId,
      BASE_URL: ENV.BASE_URL,
      accessToken,
    };
  }

  const headers = new Headers();
  const userId = await getOrCreateUserSession(request, headers);
  return data(
    {
      game,
      name,
      playerColor,
      roomEvents,
      roomId,
      roomName,
      accessToken,
      userId,
      BASE_URL: ENV.BASE_URL,
    },
    { headers },
  );
}

export default function PlayGame({ loaderData }: Route.ComponentProps) {
  const matches = useMatches();
  const pathname = matches[matches.length - 1].pathname;

  // "Just watch": the visitor closed the join dialog without joining.
  const [watching, setWatching] = React.useState(false);
  // Announced with Realtime presence so the room can show how many people
  // watch. It depends on the engine's players, so it follows them one render
  // later.
  const [presence, setPresence] = React.useState<PresenceRole | null>(null);

  const engine = useGameEngine(
    loaderData.game,
    loaderData.roomEvents,
    loaderData.roomId,
    loaderData.accessToken,
    presence,
  );

  const isPlayer = engine.players.has(loaderData.userId);
  const role: PresenceRole | null = isPlayer
    ? "player"
    : watching
      ? "spectator"
      : null;
  React.useEffect(() => setPresence(role), [role]);

  return (
    <GameEngineContext.Provider value={engine}>
      <GameComponent
        game={loaderData.game}
        name={loaderData.name}
        playerColor={loaderData.playerColor}
        roomId={loaderData.roomId}
        roomName={loaderData.roomName}
        userId={loaderData.userId}
        url={loaderData.BASE_URL + pathname}
        watching={watching}
        onWatchingChange={setWatching}
      />
    </GameEngineContext.Provider>
  );
}
