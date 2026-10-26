/** Color themes. "classic" is the original blue look, "dark" a dark UI and
 * "system" follows the device (`prefers-color-scheme`: dark → Dark, light →
 * Classic). The theme is applied as `<html data-theme>` and implemented purely
 * in CSS (`app/styles.css`), so the server renders it and nothing flashes. */
export const THEMES = ["classic", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

/** Today's look stays the default until the visitor picks another theme. */
export const DEFAULT_THEME: Theme = "classic";

/** Name of the cookie holding the theme the visitor picked. */
export const THEME_COOKIE = "theme";

/** One year, in seconds. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ThemeSource = "cookie" | "account" | "default";

export function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value);
}

/** nextTheme is the theme after `theme`, in menu order. */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/** parseThemeCookie reads the `theme` cookie from a Cookie header. */
export function parseThemeCookie(
  cookieHeader: string | null | undefined,
): Theme | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === THEME_COOKIE) {
      const value = decodeURIComponent(rest.join("=").trim());
      return isTheme(value) ? value : undefined;
    }
  }
  return undefined;
}

/** serializeThemeCookie builds the Set-Cookie value (and the document.cookie
 * string) remembering `theme`. */
export function serializeThemeCookie(theme: Theme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

/** resolveTheme decides the theme, in order: the theme picked with the
 * switcher (cookie), the logged-in user's account setting, Classic. */
export function resolveTheme({
  cookie,
  account,
}: {
  cookie?: string | null;
  account?: string | null;
}): { theme: Theme; source: ThemeSource } {
  const fromCookie = parseThemeCookie(cookie);
  if (fromCookie) return { theme: fromCookie, source: "cookie" };
  if (isTheme(account)) return { theme: account, source: "account" };
  return { theme: DEFAULT_THEME, source: "default" };
}
