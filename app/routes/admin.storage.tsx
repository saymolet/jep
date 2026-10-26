import {
  data,
  Form,
  Link as RouterLink,
  redirect,
  useNavigation,
} from "react-router";

import { errorMessage } from "~/admin/actions.server";
import { requireAdmin } from "~/admin/auth.server";
import {
  AdminHeading,
  Card,
  ConfirmPanel,
  CsrfInput,
} from "~/admin/components";
import { formatBytes } from "~/admin/format";
import Button from "~/components/button";
import { FormStateMessage } from "~/components/form-state-message";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { deleteOrphans, scanOrphans } from "~/models/admin.server";
import { flashFormState, getSessionFormState } from "~/session.server";

import type { Route } from "./+types/admin.storage";

/** At most this many unused files are listed by name. */
const MAX_LISTED = 20;

export async function loader({ request }: Route.LoaderArgs) {
  const { csrf } = await requireAdmin(request);
  const params = new URL(request.url).searchParams;
  const [formState, headers] = await getSessionFormState(request);
  let scan = null;
  if (params.get("scan") === "1") {
    const { objects, orphans, bytes } = await scanOrphans();
    scan = {
      objects,
      count: orphans.length,
      bytes,
      examples: orphans.slice(0, MAX_LISTED).map((o) => o.name),
    };
  }
  return data(
    { csrf, scan, confirming: params.get("confirm") === "1", formState },
    { headers },
  );
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const t = createT(getRequestLocale(request));
  let formState;
  try {
    const { count, bytes } = await deleteOrphans();
    formState = {
      success: true,
      message: t("admin.storage.deleted", {
        count,
        size: formatBytes(bytes, t),
      }),
    };
  } catch (error: unknown) {
    formState = { success: false, message: errorMessage(error, t) };
  }
  throw redirect("/admin/storage?scan=1", {
    headers: await flashFormState(request, formState),
  });
}

export default function AdminStorage({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { csrf, scan, confirming, formState } = loaderData;
  return (
    <div className="flex flex-col gap-4">
      <AdminHeading>{t("admin.storage.title")}</AdminHeading>
      {formState ? <FormStateMessage formState={formState} /> : null}
      <p className="text-sm">{t("admin.storage.intro")}</p>
      <Form method="GET">
        <input type="hidden" name="scan" value="1" />
        <Button type="submit" loading={navigation.state === "loading"}>
          {t("admin.storage.scan")}
        </Button>
      </Form>
      {scan ? (
        <Card>
          <p className="text-sm text-ink-500">
            {t("admin.storage.total", { count: scan.objects })}
          </p>
          {scan.count === 0 ? (
            <p className="font-semibold text-ink-900">
              {t("admin.storage.none")}
            </p>
          ) : (
            <>
              <p className="font-semibold text-ink-900" data-testid="orphans">
                {t("admin.storage.found", {
                  count: scan.count,
                  size: formatBytes(scan.bytes, t),
                })}
              </p>
              <p className="mt-2 text-sm text-ink-500">
                {t("admin.storage.examples")}
              </p>
              <ul className="mb-3 list-disc pl-5 text-sm break-all">
                {scan.examples.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              {confirming ? (
                <ConfirmPanel
                  title={t("admin.storage.found", {
                    count: scan.count,
                    size: formatBytes(scan.bytes, t),
                  })}
                >
                  <p className="mb-3 text-sm">
                    {t("admin.storage.deleteText")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Form method="POST">
                      <CsrfInput csrf={csrf} />
                      <Button variant="danger" type="submit">
                        {t("admin.storage.deleteConfirm")}
                      </Button>
                    </Form>
                    <RouterLink
                      to="?scan=1"
                      className="rounded-md border border-ink-300 bg-paper px-4 py-2 text-sm text-ink-700 hover:bg-ink-100"
                    >
                      {t("admin.cancel")}
                    </RouterLink>
                  </div>
                </ConfirmPanel>
              ) : (
                <RouterLink
                  to="?scan=1&confirm=1"
                  className="inline-block rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-400 dark:text-red-300 dark:hover:bg-red-950/60"
                >
                  {t("admin.storage.delete")}
                </RouterLink>
              )}
            </>
          )}
        </Card>
      ) : null}
    </div>
  );
}
