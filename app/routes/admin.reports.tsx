import { data, Form, Link as RouterLink, redirect } from "react-router";
import { z } from "zod";

import { errorMessage } from "~/admin/actions.server";
import { requireAdmin } from "~/admin/auth.server";
import { AdminHeading, Card, CsrfInput, Pager } from "~/admin/components";
import { ADMIN_PAGE_SIZE, pagePath } from "~/admin/constants";
import { parsePage } from "~/admin/format";
import Button from "~/components/button";
import { FormStateMessage } from "~/components/form-state-message";
import LocalDate from "~/components/local-date";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { deleteReport, listReports } from "~/models/admin.server";
import { flashFormState, getSessionFormState } from "~/session.server";

import type { Route } from "./+types/admin.reports";

export async function loader({ request }: Route.LoaderArgs) {
  const { csrf } = await requireAdmin(request);
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  const { reports, total } = await listReports(page);
  const [formState, headers] = await getSessionFormState(request);
  return data({ csrf, reports, total, page, formState }, { headers });
}

const DismissForm = z.object({
  reportId: z.coerce.number().int().positive(),
  redirectTo: z.string().optional(),
});

/** Where to go after dismissing: back to the admin page the form was on. */
function adminTarget(value: string | undefined, fallback: string) {
  return value && /^\/admin(\/[\w\-/]*)?$/.test(value) ? value : fallback;
}

export async function action({ request }: Route.ActionArgs) {
  const { formData } = await requireAdmin(request);
  const t = createT(getRequestLocale(request));
  const parsed = DismissForm.safeParse(Object.fromEntries(formData!));
  if (!parsed.success) throw new Response("Bad Request", { status: 400 });
  let formState;
  try {
    await deleteReport(parsed.data.reportId);
    formState = { success: true, message: t("admin.reports.dismissed") };
  } catch (error: unknown) {
    formState = { success: false, message: errorMessage(error, t) };
  }
  throw redirect(adminTarget(parsed.data.redirectTo, pagePath(request.url)), {
    headers: await flashFormState(request, formState),
  });
}

export default function AdminReports({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { csrf, reports, total, page, formState } = loaderData;
  return (
    <div className="flex flex-col gap-4">
      <AdminHeading>{t("admin.reports.title")}</AdminHeading>
      {formState ? <FormStateMessage formState={formState} /> : null}
      <p className="text-sm text-ink-500">
        {t("admin.reports.count", { count: total })}
      </p>
      {reports.length === 0 ? (
        <p>{t("admin.reports.none")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((report) => (
            <li key={report.id} data-testid="admin-report">
              <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="text-base font-semibold break-words text-ink-900">
                    {report.game_title ?? t("admin.reports.deletedGame")}
                  </p>
                  <p className="break-words">{report.reason}</p>
                  <p className="break-all text-ink-500">
                    <LocalDate date={report.created_at} /> ·{" "}
                    {t("admin.reports.reportedBy", {
                      who: report.reporterEmail ?? t("admin.reports.anonymous"),
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {report.game_title !== null ? (
                    <RouterLink
                      to={`/admin/games/${report.game_id}`}
                      className="rounded-md px-3 py-2 text-sm text-accent hover:bg-ink-100"
                    >
                      {t("admin.reports.manageGame")}
                    </RouterLink>
                  ) : null}
                  <Form method="POST">
                    <CsrfInput csrf={csrf} />
                    <input type="hidden" name="reportId" value={report.id} />
                    <Button type="submit">{t("admin.reports.dismiss")}</Button>
                  </Form>
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
        searchParams={new URLSearchParams()}
      />
    </div>
  );
}
