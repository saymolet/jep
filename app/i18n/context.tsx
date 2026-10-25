import * as React from "react";

import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./locales";
import { formatRich, type RichValue } from "./rich";
import {
  createT,
  interpolate,
  lookupMessage,
  type MessageKey,
  resolveMessage,
  type TFunction,
} from "./translate";

export interface I18n {
  locale: Locale;
  /** BCP 47 tag for `Intl` formatters, e.g. "uk-UA". */
  intlLocale: string;
  t: TFunction;
  /** rich formats a message with tags/React values (see `formatRich`). */
  rich: (
    key: MessageKey,
    values?: Record<string, RichValue>,
  ) => React.ReactNode;
}

export function createI18n(locale: Locale): I18n {
  return {
    locale,
    intlLocale: INTL_LOCALE[locale],
    t: createT(locale),
    rich: (key, values) => {
      const message = resolveMessage(
        locale,
        lookupMessage(locale, key),
        values,
      );
      // Plain values ({count}, {name}) are interpolated first so plural forms
      // can use them; React values and tags are rendered by formatRich.
      const plain: Record<string, string | number> = {};
      for (const [name, value] of Object.entries(values ?? {})) {
        if (typeof value === "string" || typeof value === "number") {
          plain[name] = value;
        }
      }
      return formatRich(interpolate(message, plain), values);
    },
  };
}

const I18nContext = React.createContext<I18n>(createI18n(DEFAULT_LOCALE));
const ChangeLocaleContext = React.createContext<
  ((locale: Locale) => void) | undefined
>(undefined);

/** I18nProvider makes the UI language available to `useTranslation`. The
 * locale comes from the root loader, so the server and the browser render the
 * same language. `onChangeLocale` shows another language at once (the
 * language switcher). */
export function I18nProvider({
  locale,
  onChangeLocale,
  children,
}: {
  locale: Locale;
  onChangeLocale?: (locale: Locale) => void;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => createI18n(locale), [locale]);
  return (
    <I18nContext.Provider value={value}>
      <ChangeLocaleContext.Provider value={onChangeLocale}>
        {children}
      </ChangeLocaleContext.Provider>
    </I18nContext.Provider>
  );
}

/** useChangeLocale returns the function that switches the UI language right
 * away, or undefined outside the app's root (e.g. on error pages). */
export function useChangeLocale() {
  return React.useContext(ChangeLocaleContext);
}

/** useTranslation returns `t` (and friends) for the current UI language. */
export function useTranslation(): I18n {
  return React.useContext(I18nContext);
}
