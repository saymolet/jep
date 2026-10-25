import { useTranslation } from "~/i18n";
import { useHydrated } from "~/utils/use-hydrated";

const OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "long",
  day: "numeric",
};

const formatters = new Map<string, Intl.DateTimeFormat>();

/** dateFormatter returns a cached formatter for the UI language. The server
 * doesn't know the viewer's time zone, so the server render (and the
 * hydration render that must match it) uses UTC. */
function dateFormatter(intlLocale: string, utc: boolean) {
  const key = `${intlLocale}|${utc}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(
      intlLocale,
      utc ? { ...OPTIONS, timeZone: "UTC" } : OPTIONS,
    );
    formatters.set(key, formatter);
  }
  return formatter;
}

/** parseTimestamp parses a date, reading a timestamp without a time zone
 * (Postgres `timestamp without time zone`, like `games.created_at`) as UTC
 * rather than as local time, which differs between server and browser. */
export function parseTimestamp(date: string | number | Date): Date {
  if (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(date) &&
    !/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(date)
  ) {
    return new Date(date + "Z");
  }
  return new Date(date);
}

/** LocalDate renders a date like "October 25, 2026" (in Ukrainian
 * "25 жовтня 2026 р.") in the viewer's time zone. Before hydration it renders
 * the UTC date, which can be a day off. */
export default function LocalDate({ date }: { date: string | number | Date }) {
  const hydrated = useHydrated();
  const { intlLocale } = useTranslation();
  const formatter = dateFormatter(intlLocale, !hydrated);
  return <>{formatter.format(parseTimestamp(date))}</>;
}
