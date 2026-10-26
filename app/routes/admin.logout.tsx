import { redirect } from "react-router";

import { adminLogout, requireAdmin } from "~/admin/auth.server";
import { ADMIN_LOGIN_PATH } from "~/admin/constants";

import type { Route } from "./+types/admin.logout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  throw redirect("/admin");
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  throw redirect(ADMIN_LOGIN_PATH, { headers: await adminLogout(request) });
}
