import {
  data,
  Form,
  Link as RouterLink,
  redirect,
  useLocation,
} from "react-router";
import { z } from "zod";

import { changeVisibility, errorMessage } from "~/admin/actions.server";
import { requireAdmin } from "~/admin/auth.server";
import {
  AdminHeading,
  Card,
  ConfirmPanel,
  CsrfInput,
  SELECT_CLASS,
} from "~/admin/components";
import { GAME_VISIBILITIES } from "~/admin/constants";
import Button from "~/components/button";
import { FormStateMessage } from "~/components/form-state-message";
import Link from "~/components/link";
import LocalDate from "~/components/local-date";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { deleteGameWithMedia, getAdminGame } from "~/models/admin.server";
import { flashFormState, getSessionFormState } from "~/session.server";

import type { Route } from "./+types/admin.games_.$gameId";

const GameId = z.guid();

function parseGameId(value: string | undefined) {
  const parsed = GameId.safeParse(value);
  if (!parsed.success) throw new Response("Not Found", { status: 404 });
  return parsed.data;
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const { csrf } = await requireAdmin(request);
  const game = await getAdminGame(parseGameId(params.gameId));
  if (!game) throw new Response("Not Found", { status: 404 });
  const [formState, headers] = await getSessionFormState(request);
  // Not called `game`: the site header shows a game menu for any page whose
  // loader returns a `game`.
  return data({ csrf, adminGame: game, formState }, { headers });
}

export async function action({ request, params }: Route.ActionArgs) {
  const { formData } = await requireAdmin(request);
  const gameId = parseGameId(params.gameId);
  const t = createT(getRequestLocale(request));
  const intent = formData!.get("intent");

  if (intent === "delete") {
    let formState;
    let target = "/admin/games";
    try {
      const result = await deleteGameWithMedia(gameId);
      formState = result
        ? {
            success: true,
            message: t("admin.games.deleted", {
              title: result.title,
              removed: result.removed,
              kept: result.kept,
            }),
          }
        : { success: false, message: t("admin.game.notFound") };
    } catch (error: unknown) {
      formState = { success: false, message: errorMessage(error, t) };
      target = `/admin/games/${gameId}`;
    }
    throw redirect(target, {
      headers: await flashFormState(request, formState),
    });
  }

  if (intent === "visibility") {
    formData!.set("gameId", gameId);
    let formState;
    try {
      formState = await changeVisibility(formData!, t);
    } catch (error: unknown) {
      if (error instanceof Response) throw error;
      formState = { success: false, message: errorMessage(error, t) };
    }
    throw redirect(`/admin/games/${gameId}`, {
      headers: await flashFormState(request, formState),
    });
  }

  throw new Response("Bad Request", { status: 400 });
}

export default function AdminGame({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { csrf, adminGame: game, formState } = loaderData;
  const location = useLocation();
  const confirming =
    new URLSearchParams(location.search).get("confirm") === "delete";

  return (
    <div className="flex flex-col gap-4">
      <p>
        <Link to="/admin/games">← {t("admin.game.back")}</Link>
      </p>
      <AdminHeading>
        <span className="break-words">{game.title}</span>
      </AdminHeading>
      {formState ? <FormStateMessage formState={formState} /> : null}

      <Card>
        <h3 className="mb-2 font-semibold text-ink-900">
          {t("admin.game.details")}
        </h3>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-ink-500">{t("admin.games.colAuthor")}</dt>
          <dd className="break-words">{game.author}</dd>
          <dt className="text-ink-500">{t("admin.games.colUploader")}</dt>
          <dd className="break-all">
            {game.uploaderEmail ?? t("admin.games.guest")}
          </dd>
          <dt className="text-ink-500">{t("admin.games.colCreated")}</dt>
          <dd>
            <LocalDate date={game.created_at} />
          </dd>
          <dt className="text-ink-500">{t("admin.games.colQuestions")}</dt>
          <dd>{game.questions}</dd>
          <dt className="text-ink-500">{t("admin.game.rooms")}</dt>
          <dd>{game.rooms}</dd>
          <dt className="text-ink-500">{t("admin.game.media")}</dt>
          <dd>
            <span data-testid="media-remove">
              {t("admin.game.mediaRemove", { count: game.media.remove.length })}
            </span>
            {game.media.keep.length > 0 ? (
              <>
                <br />
                {t("admin.game.mediaKeep", { count: game.media.keep.length })}
              </>
            ) : null}
          </dd>
        </dl>
        <p className="mt-3 text-sm">
          <Link to={`/game/${game.id}`}>{t("admin.game.open")}</Link>
        </p>
      </Card>

      <Card>
        <Form
          key={game.visibility}
          method="POST"
          className="flex flex-wrap items-center gap-2"
        >
          <CsrfInput csrf={csrf} />
          <input type="hidden" name="intent" value="visibility" />
          <label
            htmlFor="admin-visibility"
            className="font-semibold text-ink-900"
          >
            {t("admin.game.visibility")}
          </label>
          <select
            id="admin-visibility"
            name="visibility"
            defaultValue={game.visibility}
            className={SELECT_CLASS}
          >
            {GAME_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {t(`common.visibility.${v}`)}
              </option>
            ))}
          </select>
          <Button type="submit">{t("admin.games.save")}</Button>
        </Form>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold text-ink-900">
          {t("admin.game.reports")}
        </h3>
        {game.reports.length === 0 ? (
          <p className="text-sm text-ink-500">{t("admin.game.noReports")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {game.reports.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-2 text-sm first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="break-words">{report.reason}</p>
                  <p className="text-ink-500">
                    <LocalDate date={report.created_at} /> ·{" "}
                    {t("admin.reports.reportedBy", {
                      who: report.reporterEmail ?? t("admin.reports.anonymous"),
                    })}
                  </p>
                </div>
                <Form method="POST" action="/admin/reports">
                  <CsrfInput csrf={csrf} />
                  <input type="hidden" name="reportId" value={report.id} />
                  <input
                    type="hidden"
                    name="redirectTo"
                    value={`/admin/games/${game.id}`}
                  />
                  <Button type="submit">{t("admin.reports.dismiss")}</Button>
                </Form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        {confirming ? (
          <ConfirmPanel title={t("admin.game.deleteTitle")}>
            <p className="mb-3 text-sm">{t("admin.game.deleteText")}</p>
            <p className="mb-3 text-sm">
              {t("admin.game.mediaRemove", { count: game.media.remove.length })}
              {game.media.keep.length > 0
                ? ` · ${t("admin.game.mediaKeep", { count: game.media.keep.length })}`
                : null}
            </p>
            <div className="flex flex-wrap gap-2">
              <Form method="POST">
                <CsrfInput csrf={csrf} />
                <input type="hidden" name="intent" value="delete" />
                <Button variant="danger" type="submit">
                  {t("admin.game.deleteConfirm")}
                </Button>
              </Form>
              <RouterLink
                to={`/admin/games/${game.id}`}
                className="rounded-md border border-ink-300 bg-paper px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
              >
                {t("admin.cancel")}
              </RouterLink>
            </div>
          </ConfirmPanel>
        ) : (
          <RouterLink
            to="?confirm=delete"
            className="inline-block rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/60"
          >
            {t("admin.game.delete")}
          </RouterLink>
        )}
      </Card>
    </div>
  );
}
