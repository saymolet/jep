import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { createT, type TFunction } from "./translate";

/** localeFromMatches reads the UI language from the root loader's data, for
 * `meta` functions (which can't use hooks). */
export function localeFromMatches(
  matches: readonly ({ id: string; loaderData?: unknown } | undefined)[],
): Locale {
  const root = matches.find((match) => match?.id === "root")?.loaderData;
  if (typeof root === "object" && root !== null && "locale" in root) {
    return isLocale(root.locale) ? root.locale : DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

/** metaT returns `t` for the UI language, for `meta` functions. */
export function metaT(
  matches: readonly ({ id: string; loaderData?: unknown } | undefined)[],
): TFunction {
  return createT(localeFromMatches(matches));
}
