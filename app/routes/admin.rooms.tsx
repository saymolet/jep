import {
  data,
  Form,
  Link as RouterLink,
  redirect,
  useLocation,
} from "react-router";
import { z } from "zod";

import { errorMessage } from "~/admin/actions.server";
import { requireAdmin } from "~/admin/auth.server";
import {
  AdminHeading,
  Card,
  ConfirmPanel,
  CsrfInput,
  Pager,
} from "~/admin/components";
import { ADMIN_PAGE_SIZE, pagePath } from "~/admin/constants";
import { parsePage } from "~/admin/format";
import Button from "~/components/button";
import { FormStateMessage } from "~/components/form-state-message";
import Link from "~/components/link";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { formatTimeAgo } from "~/models/active-rooms";
import { deleteRoom, listAdminRooms } from "~/models/admin.server";
import { flashFormState, getSessionFormState } from "~/session.server";

import type { Route } from "./+types/admin.rooms";

export async function loader({ request }: Route.LoaderArgs) {
  const { csrf } = await requireAdmin(request);
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const { rooms, total } = await listAdminRooms(page);
  const now = Date.now();
  const [formState, headers] = await getSessionFormState(request);
  return data(
    {
      csrf,
      page,
      total,
      formState,
      // Minutes are computed here, so the page renders the same on the
      // server and in the browser.
      rooms: rooms.map((room) => ({
        ...room,
        minutesAgo: room.lastActivity
          ? Math.max(
              0,
              Math.floor((now - Date.parse(room.lastActivity)) / 60_000),
            )
          : null,
      })),
    },
    { headers },
  );
}

const DeleteForm = z.object({
  roomId: z.coerce.number().int().positive(),
  roomName: z.string().max(200),
});

export async function action({ request }: Route.ActionArgs) {
  const { formData } = await requireAdmin(request);
  const t = createT(getRequestLocale(request));
  const parsed = DeleteForm.safeParse(Object.fromEntries(formData!));
  if (!parsed.success) throw new Response("Bad Request", { status: 400 });
  let formState;
  try {
    await deleteRoom(parsed.data.roomId);
    formState = {
      success: true,
      message: t("admin.rooms.deleted", { room: parsed.data.roomName }),
    };
  } catch (error: unknown) {
    formState = { success: false, message: errorMessage(error, t) };
  }
  const url = new URL(request.url);
  url.searchParams.delete("delete");
  throw redirect(pagePath(url.toString()), {
    headers: await flashFormState(request, formState),
  });
}

export default function AdminRooms({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { csrf, rooms, total, page, formState } = loaderData;
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const confirmId = Number(searchParams.get("delete"));
  searchParams.delete("delete");
  const withParams = (extra: Record<string, string>) => {
    const params = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(extra)) params.set(k, v);
    const query = params.toString();
    return query ? `?${query}` : location.pathname;
  };

  return (
    <div className="flex flex-col gap-4">
      <AdminHeading>{t("admin.rooms.title")}</AdminHeading>
      {formState ? <FormStateMessage formState={formState} /> : null}
      <p className="text-sm text-ink-500">
        {t("admin.rooms.count", { count: total })}
      </p>
      {rooms.length === 0 ? (
        <p>{t("admin.rooms.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rooms.map((room) => (
            <li key={room.id} data-testid="admin-room">
              <Card>
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 text-sm">
                    <p className="text-base">
                      <Link to={`/room/${room.roomName}`}>
                        <span className="font-semibold">{room.roomName}</span>
                      </Link>{" "}
                      <span className="text-ink-500">·</span>{" "}
                      <RouterLink
                        to={`/admin/games/${room.gameId}`}
                        className="break-words text-accent hover:underline"
                      >
                        {room.gameTitle}
                      </RouterLink>
                    </p>
                    <p className="break-words text-ink-500">
                      {t("admin.rooms.colPlayers")}:{" "}
                      {room.players.length > 0
                        ? room.players.join(", ")
                        : t("admin.rooms.noPlayers")}
                    </p>
                    <p className="text-ink-500">
                      {t("admin.rooms.colActivity")}:{" "}
                      {room.minutesAgo === null
                        ? t("admin.rooms.never")
                        : formatTimeAgo(room.minutesAgo, t)}{" "}
                      · {t("admin.rooms.colEvents")}: {room.events} ·{" "}
                      {t("admin.rooms.colStatus")}:{" "}
                      <span className="font-medium text-ink-700">
                        {t(`admin.rooms.status.${room.status}`)}
                      </span>
                    </p>
                  </div>
                  {confirmId === room.id ? null : (
                    <RouterLink
                      to={withParams({ delete: String(room.id) })}
                      className="self-start rounded-md border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/60"
                    >
                      {t("admin.rooms.delete")}
                    </RouterLink>
                  )}
                </div>
                {confirmId === room.id ? (
                  <ConfirmPanel
                    title={t("admin.rooms.deleteConfirm", {
                      room: room.roomName,
                    })}
                  >
                    <div className="flex flex-wrap gap-2">
                      <Form method="POST">
                        <CsrfInput csrf={csrf} />
                        <input type="hidden" name="roomId" value={room.id} />
                        <input
                          type="hidden"
                          name="roomName"
                          value={room.roomName}
                        />
                        <Button variant="danger" type="submit">
                          {t("admin.rooms.deleteYes")}
                        </Button>
                      </Form>
                      <RouterLink
                        to={withParams({})}
                        className="rounded-md border border-ink-300 bg-paper px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
                      >
                        {t("admin.cancel")}
                      </RouterLink>
                    </div>
                  </ConfirmPanel>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Pager
        page={page}
        total={total}
        pageSize={ADMIN_PAGE_SIZE}
        searchParams={searchParams}
      />
    </div>
  );
}
