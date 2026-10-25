import { data, Form } from "react-router";
import { ENV } from "varlock/env";
import { z } from "zod";

import Button from "~/components/button";
import { ErrorMessage, SuccessMessage } from "~/components/error";
import Input from "~/components/input";
import Link, { Anchor } from "~/components/link";
import Main from "~/components/main";
import { createT } from "~/i18n";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getRequestLocale } from "~/i18n/resolve";
import { getValidAuthSession } from "~/models/auth";
import { getGame } from "~/models/game.server";
import { insertReport } from "~/models/report.server";
import { getRoom } from "~/models/room.server";
import { GITHUB_URL } from "~/utils";
import { parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/report";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: metaT(matches)("report.metaTitle") },
];

const formSchema = z.object({
  url: z.string().min(1),
  reason: z.string().min(1),
});
const ROOM_NAME_REGEX = /^\d+-\w+$/;

export function loader({ request }: Route.LoaderArgs) {
  const searchParams = new URL(request.url).searchParams;
  const gameId = searchParams.get("gameId");

  return { BASE_URL: ENV.BASE_URL, gameId };
}

export async function action({ request }: Route.ActionArgs) {
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { url: urlStr, reason } = parseFormData(formData, formSchema);
  const url = new URL(urlStr);

  if (url.origin !== ENV.BASE_URL) {
    return data(
      {
        success: false,
        message: t("report.wrongOrigin", { base: ENV.BASE_URL }),
      },
      { status: 400 },
    );
  }

  const authSession = await getValidAuthSession(request);
  const pathname = url.pathname;

  if (pathname.startsWith("/room/")) {
    const roomNameAndId = pathname.slice("/room/".length);

    if (!ROOM_NAME_REGEX.test(roomNameAndId)) {
      return data(
        {
          success: false,
          message: t("report.badRoomName", {
            roomId: "{roomId}",
            roomName: "{roomName}",
          }),
        },
        { status: 400 },
      );
    }

    const parts = roomNameAndId.split("-");
    const roomId = parseInt(parts[0]);
    const name = parts[1];

    const room = await getRoom(roomId, authSession?.accessToken);
    if (!room || room.name !== name) {
      return data(
        {
          success: false,
          message: t("report.roomNotFound", { room: roomNameAndId }),
        },
        { status: 404 },
      );
    }

    await insertReport(
      room.game_id,
      reason,
      authSession?.userId,
      authSession?.accessToken,
    );

    return data({
      success: true,
      message: t("report.reportedRoom", {
        gameId: room.game_id,
        room: roomNameAndId,
      }),
    });
  } else if (pathname.startsWith("/game/")) {
    const gameIdAndSubpath = pathname.slice("/game/".length);
    const gameId = gameIdAndSubpath.split("/")[0];

    try {
      const game = await getGame(gameId, authSession?.userId);
      if (!game) {
        return data(
          { success: false, message: t("report.gameNotFound", { gameId }) },
          { status: 404 },
        );
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return data(
          {
            success: false,
            message: t("report.fetchError", { error: error.message }),
          },
          { status: 404 },
        );
      }
      throw error;
    }

    await insertReport(
      gameId,
      reason,
      authSession?.userId,
      authSession?.accessToken,
    );

    return data(
      { success: true, message: t("report.reportedGame", { gameId }) },
      { status: 404 },
    );
  }

  return data(
    { success: false, message: t("report.noGameOrRoom") },
    { status: 400 },
  );
}

export default function Report({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { t, rich } = useTranslation();
  return (
    <div className="max-w-full grow">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">{t("report.title")}</h1>
        <p className="mb-4">
          {rich("report.intro", {
            guidelines: (chunks) => <Link to="/community">{chunks}</Link>,
          })}
          <br className="mb-1" />
          {rich("report.otherIssues", {
            github: (chunks) => <Anchor href={GITHUB_URL}>{chunks}</Anchor>,
          })}
        </p>
        <Form method="POST" className="flex flex-col gap-2">
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700"
          >
            {t("report.linkLabel")}
          </label>
          <Input
            type="text"
            id="url"
            name="url"
            placeholder={t("report.linkPlaceholder", {
              base: loaderData.BASE_URL,
            })}
            required
            defaultValue={
              loaderData.gameId
                ? `${loaderData.BASE_URL}/game/${loaderData.gameId}`
                : undefined
            }
          />
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-gray-700"
          >
            {t("report.reasonLabel")}
          </label>
          <Input
            type="text"
            id="reason"
            name="reason"
            placeholder={t("report.reasonPlaceholder")}
            required
          />
          <Button variant="primary" type="submit">
            {t("report.submit")}
          </Button>
          {actionData ? (
            actionData?.success ? (
              <SuccessMessage>{actionData?.message}</SuccessMessage>
            ) : (
              <ErrorMessage>{actionData?.message}</ErrorMessage>
            )
          ) : null}
        </Form>
      </Main>
    </div>
  );
}
