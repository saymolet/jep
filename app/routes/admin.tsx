import { Form, NavLink, Outlet } from "react-router";

import { getAdmin, requireAdminEnabled } from "~/admin/auth.server";
import { CsrfInput } from "~/admin/components";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { ADMIN_ROBOTS_DIRECTIVES } from "~/utils/seo";

import type { Route } from "./+types/admin";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: metaT(matches)("admin.metaTitle") },
];

/** Every admin response tells crawlers to stay away (the page's <meta
 * robots> says the same). */
export function headers() {
  return {
    "X-Robots-Tag": ADMIN_ROBOTS_DIRECTIVES,
    "Cache-Control": "no-store",
  };
}

/** The layout of the admin panel. It only decides whether to show the
 * navigation; every admin loader and action checks the admin session itself
 * (`requireAdmin`), because child loaders run in parallel with this one. */
export async function loader({ request }: Route.LoaderArgs) {
  requireAdminEnabled();
  const admin = await getAdmin(request);
  return { csrf: admin?.csrf ?? null };
}

const NAV = [
  { to: "/admin", key: "admin.nav.dashboard", end: true },
  { to: "/admin/games", key: "admin.nav.games", end: false },
  { to: "/admin/rooms", key: "admin.nav.rooms", end: false },
  { to: "/admin/reports", key: "admin.nav.reports", end: false },
  { to: "/admin/storage", key: "admin.nav.storage", end: false },
] as const;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { csrf } = loaderData;
  return (
    <div className="max-w-full grow">
      <main className="mx-auto w-full max-w-screen-lg grow px-4 pt-6 pb-16 text-ink-700 md:pt-10">
        <h1 className="mb-4 text-2xl font-semibold text-ink-900">
          {t("admin.title")}
        </h1>
        {csrf ? (
          <nav
            className="mb-6 flex flex-wrap items-center gap-2 border-b border-ink-200 pb-3"
            aria-label={t("admin.title")}
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive
                      ? "bg-accent text-white dark:text-ink-950"
                      : "text-accent hover:bg-ink-100"
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
            <Form method="POST" action="/admin/logout" className="ml-auto">
              <CsrfInput csrf={csrf} />
              <button
                type="submit"
                className="rounded-md px-3 py-2 text-sm text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                {t("admin.nav.logOut")}
              </button>
            </Form>
          </nav>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
