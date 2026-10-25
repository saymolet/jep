/** A message whose wording depends on a number (`count`). The keys are the
 * `Intl.PluralRules` categories: English uses `one`/`other`, Ukrainian
 * `one`/`few`/`many`/`other`. `other` is always required. */
export interface PluralMessage {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralMessage;

export type Messages = Record<string, Message>;

/** Dictionary<T> is a translation of the English messages T: exactly the same
 * keys (a missing or extra key is a type error), a string for every string
 * and plural forms for every plural message. */
export type Dictionary<T extends Messages> = {
  [K in keyof T]: T[K] extends string ? string : PluralMessage;
};

/** The `{name}` placeholders in a message. */
type PlaceholdersOf<S> = S extends `${string}{${infer Name}}${infer Rest}`
  ? Name | PlaceholdersOf<Rest>
  : never;

/** Params a message needs: its placeholders, plus `count` for plurals. */
export type ParamsOf<M> = M extends string
  ? PlaceholdersOf<M>
  : M extends PluralMessage
    ? "count" | PlaceholdersOf<M[keyof M]>
    : never;

export type ParamValue = string | number;
