import { requireAdmin } from "~/admin/auth.server";
import { StatTile, UsageBar } from "~/admin/components";
import { DATABASE_LIMIT_BYTES, STORAGE_LIMIT_BYTES } from "~/admin/constants";
import { ErrorMessage } from "~/components/error";
import { useTranslation } from "~/i18n";
import { type AdminStats, getAdminStats } from "~/models/admin.server";

import type { Route } from "./+types/admin._index";

type LoadedStats =
  | { stats: AdminStats; error: null }
  | { stats: null; error: string };

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  let result: LoadedStats;
  try {
    result = { stats: await getAdminStats(), error: null };
  } catch (error: unknown) {
    result = {
      stats: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return result;
}

export default function AdminDashboard({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const { stats, error } = loaderData;
  if (!stats) {
    return (
      <ErrorMessage>
        {t("admin.dash.statsError", { error: error ?? "" })}
      </ErrorMessage>
    );
  }
  const games = stats.games_public + stats.games_unlisted + stats.games_private;
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink-900">
          {t("admin.dash.games")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label={t("admin.dash.games")}
            value={games}
            testId="stat-games"
          />
          <StatTile
            label={t("common.visibility.PUBLIC")}
            value={stats.games_public}
          />
          <StatTile
            label={t("common.visibility.UNLISTED")}
            value={stats.games_unlisted}
          />
          <StatTile
            label={t("common.visibility.PRIVATE")}
            value={stats.games_private}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-semibold text-ink-900">
          {t("admin.nav.rooms")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile
            label={t("admin.dash.rooms24h")}
            value={stats.rooms_active_24h}
          />
          <StatTile label={t("admin.dash.roomsTotal")} value={stats.rooms} />
          <StatTile
            label={t("admin.dash.roomEvents")}
            value={stats.room_events}
          />
          <StatTile label={t("admin.dash.accounts")} value={stats.accounts} />
          <StatTile label={t("admin.dash.reports")} value={stats.reports} />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <UsageBar
          label={t("admin.dash.storage")}
          used={stats.media_bytes}
          limit={STORAGE_LIMIT_BYTES}
          extra={t("admin.dash.files", { count: stats.media_objects })}
        />
        <UsageBar
          label={t("admin.dash.database")}
          used={stats.database_bytes}
          limit={DATABASE_LIMIT_BYTES}
        />
        <p className="text-sm text-ink-500">{t("admin.dash.freePlan")}</p>
      </section>
    </div>
  );
}
