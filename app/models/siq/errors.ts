import type { Locale } from "~/i18n/locales";
import { type MessageKey, translate } from "~/i18n/translate";
import type { ParamValue } from "~/i18n/types";

export type SiqErrorKey = Extract<MessageKey, `siq.error.${string}`>;

/** SiqImportError is a problem with an uploaded SIGame pack that the user
 * can understand and fix. Its `message` is English; `localize` gives it in
 * the user's language. */
export class SiqImportError extends Error {
  readonly key: SiqErrorKey;
  readonly params: Record<string, ParamValue>;

  constructor(key: SiqErrorKey, params: Record<string, ParamValue> = {}) {
    super(translate("en", key, params));
    this.name = "SiqImportError";
    this.key = key;
    this.params = params;
  }

  /** localize returns the message in `locale`. */
  localize(locale: Locale): string {
    return translate(locale, this.key, this.params);
  }
}
