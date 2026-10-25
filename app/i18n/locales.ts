/** The languages the UI is translated into. English is the source language
 * and the fallback for everything. */
export const LOCALES = ["en", "uk"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** BCP 47 tags for `Intl` formatters. */
export const INTL_LOCALE: Record<Locale, string> = {
  en: "en-US",
  uk: "uk-UA",
};

/** Short names for the language switcher. */
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  uk: { short: "УКР", name: "Українська" },
};

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}
