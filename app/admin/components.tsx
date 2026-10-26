import { Link as RouterLink } from "react-router";

import { useTranslation } from "~/i18n";

import { CSRF_FIELD_NAME } from "./constants";
import { formatBytes, pageCount, usagePercent } from "./format";

/** CsrfInput is the hidden CSRF token every admin form must send. */
export function CsrfInput({ csrf }: { csrf: string }) {
  return <input type="hidden" name={CSRF_FIELD_NAME} value={csrf} />;
}

export function AdminHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xl font-semibold text-ink-900">{children}</h2>
  );
}

/** Card is a light panel on the page (themed with the paper/ink tokens). */
export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-ink-200 bg-paper p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: React.ReactNode;
  testId?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="text-2xl font-semibold text-ink-900" data-testid={testId}>
        {value}
      </p>
    </Card>
  );
}

/** UsageBar shows how much of a plan limit is used. */
export function UsageBar({
  label,
  used,
  limit,
  extra,
}: {
  label: string;
  used: number;
  limit: number;
  extra?: string;
}) {
  const { t } = useTranslation();
  const percent = usagePercent(used, limit);
  const color =
    percent >= 90
      ? "bg-red-600"
      : percent >= 70
        ? "bg-yellow-500"
        : "bg-accent";
  return (
    <Card>
      <p className="text-sm text-ink-500">{label}</p>
      <p className="mb-2 font-semibold text-ink-900">
        {t("admin.dash.usage", {
          used: formatBytes(used, t),
          limit: formatBytes(limit, t),
          percent,
        })}
        {extra ? (
          <span className="font-normal text-ink-500"> · {extra}</span>
        ) : null}
      </p>
      <div
        className="h-3 w-full overflow-hidden rounded-full bg-ink-100"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
      >
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(percent, 0.5))}%` }}
        />
      </div>
    </Card>
  );
}

/** Pager links to the previous and next pages, keeping the other search
 * params (e.g. the search text). */
export function Pager({
  page,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  total: number;
  pageSize: number;
  searchParams: URLSearchParams;
}) {
  const { t } = useTranslation();
  const pages = pageCount(total, pageSize);
  if (pages <= 1) return null;
  const linkTo = (p: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(p));
    return `?${params}`;
  };
  const linkClass =
    "rounded-md border border-ink-300 bg-paper px-3 py-2 text-sm text-accent hover:bg-ink-100";
  return (
    <nav className="mt-4 flex items-center justify-between gap-2">
      {page > 1 ? (
        <RouterLink to={linkTo(page - 1)} className={linkClass}>
          {t("admin.pager.previous")}
        </RouterLink>
      ) : (
        <span />
      )}
      <span className="text-sm text-ink-500">
        {t("admin.pager.page", { page, pages })}
      </span>
      {page < pages ? (
        <RouterLink to={linkTo(page + 1)} className={linkClass}>
          {t("admin.pager.next")}
        </RouterLink>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** ConfirmPanel asks before something that can't be undone. */
export function ConfirmPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200"
      role="alertdialog"
      aria-label={title}
    >
      <p className="mb-2 font-semibold">{title}</p>
      {children}
    </div>
  );
}

export const SELECT_CLASS =
  "rounded-md border border-ink-300 bg-ink-50 p-2 text-sm text-ink-900 focus:border-blue-500 focus:ring-blue-500";
