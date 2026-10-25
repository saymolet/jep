# Feature 09 — Ukrainian translation (i18n)

**Branch:** `feat/i18n-uk`
**Status:** ✅ implemented & tested
**Migration:** none (the language is stored in the existing `accounts.settings` jsonb)
**New dependencies:** none

## Goal

The site was English-only. Add internationalization with English and Ukrainian and translate
the whole UI into natural, friendly Ukrainian (party game for friends: «ти», standard terms —
гравець, раунд, категорія, питання, відповідь, ставка, «Кіт у мішку»). Game content
(titles, categories, questions, answers of uploaded games) is never translated.

## How to use it

- **EN / УКР** switcher in the header (every page, phones included) and in **Settings →
  Language**. The choice applies at once and is remembered in the `lang` cookie (1 year) and,
  when logged in, in the account settings.
- First visit without a choice: a browser whose preferred language (Accept-Language) is
  Ukrainian gets Ukrainian; everyone else gets English (Russian → English, on purpose).
- Logging in on a new device uses the language saved in the account.

## Design decisions

- **No library.** `app/i18n/` is ~300 lines: typed dictionaries, `t(key, params)` with
  `{name}` interpolation, plurals via `Intl.PluralRules` (uk: one/few/many/other), `rich()` for
  messages with inline markup (`<link>…</link>`, `<code>…</code>` → React elements), and a
  React context. i18next/react-intl would add bundle size and SSR wiring for little gain.
- **Type safety.** `en` is the source of truth. Messages are split by area
  (`app/i18n/{en,uk}/<area>.ts`, merged in `en.ts` / `uk.ts`; deviation from a single
  `en.ts`/`uk.ts`: one file per area keeps them reviewable and let areas be translated in
  parallel). Each Ukrainian area is typed `Dictionary<typeof en>`: a missing or extra key or a
  string-vs-plural mismatch is a **typecheck error**. `t()` params are type-checked against the
  `{placeholders}` of the English message. A unit test also checks key prefixes, identical
  placeholders in both languages and complete plural forms.
- **Server-side resolution** in the root loader (`resolveLocale`): `lang` cookie → account
  setting (`accounts.settings.language`) → `Accept-Language` (only `uk*`) → English. The locale
  is in the root loader data, so the server HTML and the hydration render are the same language
  (no hydration mismatch); `<html lang>` follows it. Playwright sends no cookie and an English
  Accept-Language, so tests stay English.
- **Switching** is client-side: set the cookie, show the new language immediately (root keeps
  the locale in state), save `settings.language` through the existing debounced settings sync,
  and revalidate loaders so server-made text (flash messages, etc.) follows.
- When the language came from the account (no cookie yet), the client writes the cookie so
  later actions (which only look at cookie/Accept-Language) answer in the same language.
- **Server text** (form errors, upload/import messages, SIQ summary and warnings, room action
  errors) uses `createT(getRequestLocale(request))`. `SiqImportError` carries a message key and
  is localized at the route. Names Jep! invents during a SIQ import (e.g. "Theme 3", "Unknown")
  are written in the importer's language.
- **Long help pages** (`/howto`, `/upload-help`, `/about`, `/community`) are dictionary
  messages too (one key per paragraph, `rich()` for code/links). JSON samples and the type
  definition stay as they are (they are the file format).
- **Formatting:** dates (`LocalDate`, profile, connection popover times, `/howto` timestamps)
  use `Intl` with the UI locale (`uk-UA`). **"$" points keep the en-US format** (`$1,000`) in
  both languages: they are game points styled after the TV show, board cells are labelled
  "$ 200" (e2e relies on it), and "$1 000" would look odd.
- **Schema change (backward compatible):** `userSettingsSchema` gets optional
  `language: "en" | "uk"`; an unknown value is dropped (`.catch`) without invalidating the
  other settings. Old settings parse unchanged.

## Left untranslated (on purpose)

- Game content, and texts that come from it (pack round/theme names in SIQ warnings).
- The JSON schema file `/game.schema.json` (descriptions are part of the published format) and
  JSON samples on `/upload-help`.
- Technical messages that only appear for tampered requests or developer errors: engine
  reducer errors, "Method not allowed", missing-param 400s, "Invalid avatar".
- JSON upload validation details (zod messages naming JSON fields) and media/choice validation
  reasons inside SIQ warnings — shown after a translated prefix.
- Supabase auth error texts passed through as-is (they come from Supabase in English).
- The last-resort error page (`SafeErrorBoundary`, shown only when the error page itself
  crashed) — it can't read the language.
- The English subtitle "Кот в мешке · secret question" keeps its Russian name as before; the
  Ukrainian UI says «Кіт у мішку».

## Files

- `app/i18n/` — `locales.ts`, `types.ts`, `translate.ts`, `rich.tsx`, `context.tsx`,
  `resolve.ts`, `meta.ts`, `index.ts`, `en.ts`, `uk.ts`, `en/*.ts`, `uk/*.ts`, `i18n.test.ts`.
- `app/root.tsx` (loader locale, `<html lang>`, provider, translated error page),
  `app/components/language-switcher.tsx`, `app/utils/user-settings.tsx` (`useSetLanguage`),
  `app/models/user-settings.ts` (+ test).
- Practically every component and route with UI text; server routes/models with user-facing
  messages (`routes/room.$roomId.*`, `routes/account.*`, `routes/game/*`, `models/siq/*`,
  `models/active-rooms.ts`, `utils/wager-strategy.ts`, `utils/media.ts`).
- `e2e/i18n.spec.ts`; `docs/architecture.md` (i18n section: how to add strings).

## Verification

- Unit: Ukrainian plurals (0, 1, 2–4, 5, 11–14, 21, 22, 25, 101, 111, 1.5), dictionary-backed
  plurals in both languages, interpolation, missing keys (returns the key), rich messages,
  resolution order (cookie → account → Accept-Language → default, invalid values ignored),
  Accept-Language parsing with q-values, cookie parse/serialize, dictionary integrity; settings
  schema with/without/invalid `language`; Ukrainian upload messages, SIQ warnings/summary and
  "time ago".
- E2E (`e2e/i18n.spec.ts`): English by default; switch to УКР → Ukrainian header, `lang="uk"`,
  survives reload, switch back; a solo question played with Ukrainian buttons; with
  `Accept-Language: uk` (`locale: "uk-UA"`) `/`, `/mock`, `/howto`, `/about`, `/login` render in
  Ukrainian and hydrate without errors. Existing `e2e/hydration*.spec.ts` still pass.
- `jep-validate`: format, lint (0 errors, 2 pre-existing warnings), typecheck, 5901 unit tests, 84 e2e tests — all pass.

### Manual test script

1. Open the home page in a fresh private window: English. Tap **УКР** in the header: the
   whole page switches; reload — still Ukrainian.
2. Phone width: the header shows Jep!, EN/УКР and «Увійти» on one row; links below.
3. Open a game → **Грати самому**: join, start the round, play a question (buttons «Показати
   відповідь», «правильно!», «До табло»), wager on a «Подвійна ставка» question, play a «Кіт у
   мішку» question in `/mock?game=secret`. Question texts stay as written in the game.
4. Upload a `.siq` pack in Ukrainian: the summary and warnings are Ukrainian.
5. Log in, switch to УКР, log out, clear cookies, log in again: Ukrainian (from the account).
6. Settings page: the Language section switches too. Read `/howto`, `/upload-help`, `/about`,
   `/community` in Ukrainian.
7. Set the browser language to Ukrainian, clear cookies: first visit is Ukrainian.
