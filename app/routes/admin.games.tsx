import { data, Form, Link as RouterLink, redirect } from "react-router";

import { changeVisibility, errorMessage } from "~/admin/actions.server";
import { requireAdmin } from "~/admin/auth.server";
import {
  AdminHeading,
  Card,
  CsrfInput,
  Pager,
  SELECT_CLASS,
} from "~/admin/components";
import {
  ADMIN_PAGE_SIZE,
  GAME_VISIBILITIES,
  pagePath,
} from "~/admin/constants";
import { parsePage } from "~/admin/format";
import Button from "~/components/button";
import { FormStateMessage } from "~/components/form-state-message";
import Input from "~/components/input";
import Link from "~/components/link";
import LocalDate from "~/components/local-date";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { listAdminGames } from "~/models/admin.server";
import { flashFormState, getSessionFormState } from "~/session.server";

import type { Route } from "./+types/admin.games";

export async function loader({ request }: Route.LoaderArgs) {
  const { csrf } = await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const page = parsePage(params.get("page"));
  const search = params.get("q");
  const { games, total } = await listAdminGames({ page, search });
  const [formState, headers] = await getSessionFormState(request);
  return data(
    { csrf, games, total, page, search: search ?? "", formState },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  const { formData } = await requireAdmin(request);
  const t = createT(getRequestLocale(request));
  let formState;
  try {
    formState = await changeVisibility(formData!, t);
  } catch (error: unknown) {
    if (error instanceof Response) throw error;
    formState = { success: false, message: errorMessage(error, t) };
  }
  throw redirect(pagePath(request.url), {
    headers: await flashFormState(request, formState),
  });
}

export default function AdminGames({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { csrf, games, total, page, search, formState } = loaderData;
  const searchParams = new URLSearchParams(search ? { q: search } : {});
  return (
    <div className="flex flex-col gap-4">
      <AdminHeading>{t("admin.games.title")}</AdminHeading>
      {formState ? <FormStateMessage formState={formState} /> : null}
      <Form
        method="GET"
        className="flex flex-col gap-2 sm:flex-row"
        role="search"
      >
        <label htmlFor="admin-game-search" className="sr-only">
          {t("admin.games.searchLabel")}
        </label>
        <Input
          id="admin-game-search"
          type="search"
          name="q"
          defaultValue={search}
          placeholder={t("admin.games.searchPlaceholder")}
        />
        <Button type="submit">{t("admin.games.search")}</Button>
      </Form>
      <p className="text-sm text-ink-500">
        {t("admin.games.count", { count: total })}
      </p>
      {games.length === 0 ? (
        <p>{t("admin.games.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {games.map((game) => (
            <li key={game.id} data-testid="admin-game">
              <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <Link to={`/admin/games/${game.id}`}>
                    <span className="font-semibold break-words">
                      {game.title}
                    </span>
                  </Link>
                  <p className="text-sm break-words text-ink-500">
                    {t("admin.games.byAuthor", { author: game.author })} ·{" "}
                    {t("admin.games.questions", { count: game.questions })} ·{" "}
                    <LocalDate date={game.created_at} />
                  </p>
                  <p className="text-sm break-all text-ink-500">
                    {t("admin.games.colUploader")}:{" "}
                    {game.uploaderEmail ?? t("admin.games.guest")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Form
                    key={game.visibility}
                    method="POST"
                    className="flex items-center gap-2"
                  >
                    <CsrfInput csrf={csrf} />
                    <input type="hidden" name="gameId" value={game.id} />
                    <label className="sr-only" htmlFor={`vis-${game.id}`}>
                      {t("admin.games.colVisibility")}
                    </label>
                    <select
                      id={`vis-${game.id}`}
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
                  <RouterLink
                    to={`/admin/games/${game.id}`}
                    className="rounded-md px-3 py-2 text-sm text-accent hover:bg-ink-100"
                  >
                    {t("admin.games.manage")}
                  </RouterLink>
                </div>
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
