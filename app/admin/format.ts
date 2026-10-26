import type { TFunction } from "~/i18n";

const UNITS = ["B", "KB", "MB", "GB"] as const;

/** formatBytes renders a size like "12.3 MB" (binary units, one decimal from
 * KB up). Plain arithmetic rather than Intl, so the server and the browser
 * always render the same text. */
export function formatBytes(bytes: number, t: TFunction): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const number = unit === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${number} ${t(`admin.unit.${UNITS[unit]}`)}`;
}

/** usagePercent is `used` as a share of `limit`, rounded to 0.1 %. */
export function usagePercent(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.round((used / limit) * 1000) / 10;
}

/** pageCount is the number of pages for `total` items. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** parsePage reads the `page` search param (1 when missing or invalid). */
export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 && page <= 100_000 ? page : 1;
}
