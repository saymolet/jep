import { data, Form, redirect, useNavigation } from "react-router";

import { adminLogin, getAdmin, requireAdminEnabled } from "~/admin/auth.server";
import { AdminHeading, Card } from "~/admin/components";
import Button from "~/components/button";
import { ErrorMessage } from "~/components/error";
import Input from "~/components/input";
import { createT, useTranslation } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { safeRedirect } from "~/utils/http.server";

import type { Route } from "./+types/admin.login";

/** adminRedirectTo keeps a post-login redirect inside the admin panel. */
function adminRedirectTo(request: Request) {
  const to = safeRedirect(
    new URL(request.url).searchParams.get("redirectTo"),
    "/admin",
  );
  return to === "/admin" || to.startsWith("/admin/") ? to : "/admin";
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdminEnabled();
  if (await getAdmin(request)) throw redirect(adminRedirectTo(request));
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  requireAdminEnabled();
  const formData = await request.formData();
  const result = await adminLogin(request, formData.get("password"));
  if (result.ok) {
    throw redirect(adminRedirectTo(request), { headers: result.headers });
  }
  const t = createT(getRequestLocale(request));
  return data({ message: t("admin.login.failed") }, { status: result.status });
}

export default function AdminLogin({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <AdminHeading>{t("admin.login.title")}</AdminHeading>
        <Form method="POST" className="flex flex-col gap-3">
          <label
            htmlFor="admin-password"
            className="text-sm font-medium text-ink-700"
          >
            {t("admin.login.password")}
          </label>
          <Input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Button
            variant="primary"
            type="submit"
            loading={navigation.state === "submitting"}
          >
            {t("admin.login.submit")}
          </Button>
          {actionData?.message ? (
            <ErrorMessage>{actionData.message}</ErrorMessage>
          ) : null}
        </Form>
      </Card>
    </div>
  );
}
