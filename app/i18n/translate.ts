import { en } from "./en";
import { DEFAULT_LOCALE, INTL_LOCALE, type Locale } from "./locales";
import type {
  Message,
  Messages,
  ParamsOf,
  ParamValue,
  PluralMessage,
} from "./types";
import { uk } from "./uk";

export type MessageKey = keyof typeof en;

const DICTIONARIES: Record<Locale, Messages> = { en, uk };

/** Params of a message: required when the message has placeholders. */
export type TranslateArgs<K extends MessageKey> = [
  ParamsOf<(typeof en)[K]>,
] extends [never]
  ? [params?: Record<string, ParamValue>]
  : [params: Record<ParamsOf<(typeof en)[K]>, ParamValue>];

export type TFunction = <K extends MessageKey>(
  key: K,
  ...args: TranslateArgs<K>
) => string;

const pluralRulesCache = new Map<Locale, Intl.PluralRules>();

function pluralRules(locale: Locale) {
  let rules = pluralRulesCache.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(INTL_LOCALE[locale]);
    pluralRulesCache.set(locale, rules);
  }
  return rules;
}

/** selectPlural picks the plural form of `message` for `count`. */
export function selectPlural(
  locale: Locale,
  message: PluralMessage,
  count: number,
): string {
  const category = pluralRules(locale).select(count);
  return message[category] ?? message.other;
}

/** interpolate replaces `{name}` placeholders with params. Placeholders
 * without a param are left as they are. */
export function interpolate(
  message: string,
  params?: Record<string, ParamValue>,
): string {
  if (!params) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** lookupMessage returns the message for `key` in `locale`, falling back to
 * English and then to the key itself (so a missing key never crashes the
 * page; it shows up as the key instead). */
export function lookupMessage(locale: Locale, key: string): Message {
  return DICTIONARIES[locale][key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
}

/** resolveMessage turns a message into a string for the given params,
 * choosing the plural form by `params.count`. Placeholders are not
 * interpolated. */
export function resolveMessage(
  locale: Locale,
  message: Message,
  params?: Record<string, unknown>,
): string {
  if (typeof message === "string") return message;
  const count = typeof params?.count === "number" ? params.count : 0;
  return selectPlural(locale, message, count);
}

/** translate formats the message `key` in `locale`. */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, ParamValue>,
): string {
  const message = resolveMessage(locale, lookupMessage(locale, key), params);
  return interpolate(message, params);
}

/** createT returns a `t(key, params)` bound to a locale. */
export function createT(locale: Locale): TFunction {
  return (key, ...args) => translate(locale, key, args[0]);
}
