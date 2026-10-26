import * as React from "react";
import { Form, redirect, useNavigation } from "react-router";

import { getAdmin } from "~/admin/auth.server";
import { ActiveRoomsList } from "~/components/active-rooms";
import { RoomTimersFields } from "~/components/answer-timer-settings";
import Button, { ButtonLink } from "~/components/button";
import { Play } from "~/components/icons";
import { ActionType } from "~/engine";
import { createT, getRequestLocale, useTranslation } from "~/i18n";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { createRoomEventAsServer } from "~/models/room-event.server";
import { createRoom, getActiveRooms } from "~/models/room.server";
import {
  getLastRoomSettings,
  getUserSession,
  setLastRoomSettings,
} from "~/session.server";
import { parseFormData } from "~/utils/http.server";
import {
  DEFAULT_ROOM_SETTINGS,
  roomSettingsFormSchema,
  toSettingsFormData,
  toSettingsPayload,
  validRoomSettings,
} from "~/utils/room-timers-form";

import type { Route } from "./+types/game_.$gameId.play";

export const meta: Route.MetaFunction = ({ loaderData }) => {
  return loaderData ? [{ title: loaderData.preview.title }] : [];
};

/** Opening a game for multiplayer creates a new room — unless rooms of this
 * game are already in progress, in which case the player chooses between
 * joining one of them and starting a new room (`?new` skips the choice).
 *
 * The site admin first sees the new room's timers (their last-used settings,
 * else the defaults) and creates the room with them (the action below);
 * everyone else gets a room with the default settings right away. */
export async function loader({ request, params }: Route.LoaderArgs) {
  const t = createT(getRequestLocale(request));
  const gameId = params.gameId;

  if (!gameId) {
    throw new Response(t("room.error.noGameInUrl"), { status: 404 });
  }

  const authSession = await getValidAuthSession(request);
  const isAdmin = (await getAdmin(request)) !== null;
  const game =
    isAdmin || !new URL(request.url).searchParams.has("new")
      ? await getGame(gameId, authSession?.userId)
      : null;

  if (!new URL(request.url).searchParams.has("new")) {
    const activeRooms = game
      ? await getActiveRooms(game, authSession?.accessToken)
      : [];
    if (game && activeRooms.length > 0) {
      // Not `game`: the header treats routes with `game` data as in-game.
      return {
        kind: "choose" as const,
        preview: { id: game.id, title: game.title },
        activeRooms,
      };
    }
  }

  if (isAdmin && game) {
    const last = await getLastRoomSettings(request);
    return {
      kind: "create" as const,
      preview: { id: game.id, title: game.title },
      settings: validRoomSettings(last),
      lastUsed: last !== null,
    };
  }

  const roomName = await createRoom(gameId, authSession?.accessToken);

  throw redirect(`/room/${roomName}`);
}

/** The admin creates a room with the chosen timers: they become the room's
 * first event (set_settings, inserted by the server with `admin: true`) and
 * the admin's defaults for the next room. */
export async function action({ request, params }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const gameId = params.gameId;
  if (!gameId) {
    throw new Response(t("room.error.noGameInUrl"), { status: 404 });
  }
  if (!(await getAdmin(request))) {
    throw new Response(t("room.error.settingsAdminOnly"), { status: 403 });
  }
  const form = parseFormData(await request.formData(), roomSettingsFormSchema);
  const authSession = await getValidAuthSession(request);
  const game = await getGame(gameId, authSession?.userId);
  if (!game) {
    throw new Response(t("room.error.gameNotFound"), { status: 404 });
  }

  const payload = toSettingsPayload(form);
  const roomName = await createRoom(gameId, authSession?.accessToken);
  const roomId = parseInt(roomName);
  // The engine accepts the admin's change from anyone; the userId only
  // records who made it.
  const userId =
    authSession?.userId ?? (await getUserSession(request)) ?? "admin";
  await createRoomEventAsServer(roomId, ActionType.SetSettings, {
    userId,
    ...payload,
    admin: true,
  });

  const headers = await setLastRoomSettings(
    request,
    validRoomSettings(payload),
  );
  throw redirect(`/room/${roomName}`, { headers });
}

function ChooseRoom({
  game,
  activeRooms,
}: {
  game: { id: string; title: string };
  activeRooms: Extract<
    Route.ComponentProps["loaderData"],
    { kind: "choose" }
  >["activeRooms"];
}) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-white sm:text-4xl">
          {game.title}
        </h1>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">
          {t("room.alreadyPlaying")}
        </p>
      </div>

      <ActiveRoomsList rooms={activeRooms} />

      <div className="grid sm:flex">
        <ButtonLink to={`/game/${game.id}/play?new`} variant="primary">
          <Play className="h-4 w-4" />
          {t("room.startNewRoom")}
        </ButtonLink>
      </div>
    </>
  );
}

/** CreateRoom is the admin's "new room" step: the room timers, pre-filled,
 * and one tap to create the room. */
function CreateRoom({
  game,
  initial,
  lastUsed,
}: {
  game: { id: string; title: string };
  initial: typeof DEFAULT_ROOM_SETTINGS;
  lastUsed: boolean;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [values, setValues] = React.useState(initial);
  const busy = navigation.state !== "idle";

  return (
    <Form method="POST" className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-white sm:text-4xl">
          {game.title}
        </h1>
        <p className="mt-2 text-sm text-slate-300 sm:text-base">
          {t("room.create.intro")}
        </p>
        {lastUsed ? (
          <p className="mt-1 text-xs text-slate-400">
            {t("room.create.lastUsed")}
          </p>
        ) : null}
      </div>
      <section
        className="rounded-lg border border-white/10 bg-white/5 p-4"
        aria-labelledby="room-timers-title"
      >
        <h2 id="room-timers-title" className="mb-3 font-bold text-white">
          {t("room.timers.title")}
        </h2>
        <RoomTimersFields
          values={values}
          onChange={setValues}
          disabled={busy}
        />
      </section>
      {Object.entries(toSettingsFormData(values)).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="primary" loading={busy}>
          <Play className="h-4 w-4" />
          {t("room.create.submit")}
        </Button>
        <Button
          type="button"
          onClick={() => setValues(DEFAULT_ROOM_SETTINGS)}
          disabled={busy}
        >
          {t("room.create.defaults")}
        </Button>
      </div>
    </Form>
  );
}

export default function PlayGame({ loaderData }: Route.ComponentProps) {
  return (
    <main className="flex grow flex-col bg-blue-1000 text-white">
      <div className="mx-auto flex w-full max-w-screen-lg flex-col gap-5 p-3 text-slate-100 sm:p-6 md:p-12">
        {loaderData.kind === "choose" ? (
          <ChooseRoom
            game={loaderData.preview}
            activeRooms={loaderData.activeRooms}
          />
        ) : (
          <CreateRoom
            game={loaderData.preview}
            initial={loaderData.settings}
            lastUsed={loaderData.lastUsed}
          />
        )}
      </div>
    </main>
  );
}
