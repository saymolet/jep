import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";

/** Name of the cookie holding the language the visitor picked. */
export const LANG_COOKIE = "lang";

/** One year, in seconds. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type LocaleSource = "cookie" | "account" | "header" | "default";

/** parseLangCookie reads the `lang` cookie from a Cookie header. */
export function parseLangCookie(
  cookieHeader: string | null | undefined,
): Locale | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LANG_COOKIE) {
      const value = decodeURIComponent(rest.join("=").trim());
      return isLocale(value) ? value : undefined;
    }
  }
  return undefined;
}

/** serializeLangCookie builds the Set-Cookie value (and the document.cookie
 * string) remembering `locale`. */
export function serializeLangCookie(locale: Locale): string {
  return `${LANG_COOKIE}=${locale}; Path=/; Max-Age=${LANG_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** localeFromAcceptLanguage picks the language from an Accept-Language
 * header: the preferred language (highest q) that we support. Only Ukrainian
 * (`uk`, `uk-UA`, ...) gives Ukrainian; any other language gives English. */
export function localeFromAcceptLanguage(
  header: string | null | undefined,
): Locale | undefined {
  if (!header) return undefined;
  const ranges = header
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return {
        language: tag.trim().toLowerCase().split("-")[0],
        q: Number.isFinite(q) ? q : 0,
        index,
      };
    })
    .filter((range) => range.language !== "" && range.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { language } of ranges) {
    if (language === "uk") return "uk";
    if (language === "en") return "en";
  }
  return ranges.length > 0 ? DEFAULT_LOCALE : undefined;
}

/** resolveLocale decides the UI language, in order: the language picked with
 * the switcher (cookie), the logged-in user's account setting, the browser's
 * Accept-Language, English. */
export function resolveLocale({
  cookie,
  account,
  acceptLanguage,
}: {
  cookie?: string | null;
  account?: string | null;
  acceptLanguage?: string | null;
}): { locale: Locale; source: LocaleSource } {
  const fromCookie = parseLangCookie(cookie);
  if (fromCookie) return { locale: fromCookie, source: "cookie" };
  if (isLocale(account)) return { locale: account, source: "account" };
  const fromHeader = localeFromAcceptLanguage(acceptLanguage);
  if (fromHeader) return { locale: fromHeader, source: "header" };
  return { locale: DEFAULT_LOCALE, source: "default" };
}

/** getRequestLocale resolves the language of a request (for actions and
 * loaders that produce user-facing text). `account` is the user's saved
 * language when it is at hand. */
export function getRequestLocale(request: Request, account?: string): Locale {
  return resolveLocale({
    cookie: request.headers.get("Cookie"),
    account,
    acceptLanguage: request.headers.get("Accept-Language"),
  }).locale;
}
