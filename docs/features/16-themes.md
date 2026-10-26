# Feature 16 — Themes: Classic / Dark (F12c)

**Branch:** `feat/themes`
**Status:** ✅ implemented & tested
**Migration:** none (the theme is one more optional key in `accounts.settings`)
**New dependencies:** none

## Goal

A theme choice for the whole site: **Classic** (the original blue look, unchanged), **Dark**
(a dark UI that is easy on the eyes in a dim room or on a TV at night, with the Jeopardy board
still recognisable) and **System** (follows the device's light / dark mode).

## How to use it

1. **Header:** a small icon button left of **EN / УКР** (☀ Classic, ☾ Dark, 🖥 System) opens a
   menu with the three themes. The page switches at once, without a reload. The button is
   shown everywhere the header is (home, game pages, rooms), so it is also reachable during a
   game; on a 390 px phone it fits next to the language switcher and **Log in**.
2. **Settings** (`/settings`, logged in): a **Theme** section with three buttons — Classic,
   Dark, System.
3. The choice is remembered in the `theme` cookie (one year) and, when logged in, saved to
   the account, so it follows you to a new device after logging in.
4. **System:** Dark when the device prefers a dark color scheme, Classic otherwise — it
   follows the OS setting live (pure CSS).
5. **Ukrainian:** **Тема**, **Класична**, **Темна**, **Системна**; the header button's label
   is "Тема: Темна" etc.

The TV / presenter page (`/room/:roomName/present`) has no header; it follows the theme
saved on that browser (cookie).

## Design decisions

- **Resolution like the language** (`app/theme/theme.ts`, `resolveTheme`, run in the root
  loader): the `theme` cookie → the logged-in user's `accounts.settings.theme` → **Classic**.
  When the theme came from the account, the root also writes the cookie (as for `lang`).
  `parseUserSettings` drops an unknown `theme` without invalidating the other settings, so old
  rows and future values are fine.
- **Default: Classic, not System.** Everyone keeps today's look unless they choose otherwise;
  a phone in dark mode does not suddenly get a different site. System is one tap away.
- **Server-rendered, no flash, no hydration mismatch.** The root renders
  `<html data-theme="classic|dark|system">` from the loader. The switcher updates React state
  in the root (like the language), so the attribute changes immediately; the cookie keeps the
  next server render consistent. System is resolved **only in CSS**
  (`@media (prefers-color-scheme: dark)` under `[data-theme=system]`) — no JS detection, so the
  server and the client always render the same markup.
  - Exception: on error pages where the root loader did not run (e.g. 404 for an unknown URL)
    the server renders Classic and the browser switches to the cookie's theme after hydration
    (a short flash on those pages only).
- **Tokens, not `dark:` everywhere.** `app/styles.css` defines theme tokens in `@theme` that
  equal exactly the colors Classic always used, and the Dark theme redefines them in one block:
  - `page` / `paper` — page background / cards, panels, inputs' surroundings (Classic: white);
  - `ink` (default text, Classic: black) and `ink-50…950`, a theme-aware neutral scale
    (Classic: Tailwind's slate) used **instead of slate** for text, borders and fills on the
    site's light UI (home, settings, profile, auth pages, upload, inputs, buttons, toasts);
  - `accent`, `accent-strong`, `accent-soft`, `link-*` — links and outlined buttons;
  - `header` — the top bar; plus the game tokens `blue-1000`, `blue-bright`, `blue-925`,
    `yellow-1000` (board, prompt, dialogs, TV) and the `gray-*` shades used only by auth pages.

  Game surfaces (board, question prompt, player tiles, dialogs, TV) are dark in every theme
  and keep their white / slate text, so they only change through the game tokens. Components
  were edited only where they hardcoded light-UI colors (`slate-*` → `ink-*`, `bg-white` →
  `bg-paper`/`bg-page`); since `ink-*` = slate in Classic, Classic is pixel-identical.
  A handful of status colors (error / success / warning boxes, the danger zone, drag states of
  the upload box) use `dark:` utilities; the `dark` variant is redefined to follow the theme
  (`@custom-variant dark`) instead of only the OS.

- **Dark palette:** charcoal page `#0e1117`, cards `#161a22`, soft text `#e4e7ee`; header
  `#141831`; game background `#0b0e1c`, board cells / prompt a deep indigo `#1a1f4e` with
  near-black gaps and slightly brighter gold values `#e3b25f`. Text contrast is WCAG AA or
  better everywhere checked: secondary text 6–7.7:1, the subtlest text (ink-400) ≥ 4.8:1 on
  every dark surface, links 6–7.9:1, gold on cells 8:1, white on the indigo prompt 15.5:1.
- **`color-scheme`** is `light` in Classic and `dark` in Dark (and System on a dark device), so
  form controls, scrollbars and autofill follow the theme.
- **Switcher UI:** an icon button + menu in the header (compact, doesn't crowd phones; no need
  for a separate entry in the game menu since the header is visible in games) and a
  segmented control in Settings. A cycling button was rejected: you can't tell what the next
  tap does.
- **Not themed on purpose:** the "How to Play" sticky note (yellow card), the multiple-choice
  and secret-question cards and the white "Resume" button on the pause overlay keep their
  bright look on the dark game surfaces — they are designed as cards and stay readable.

## Files

- `app/theme/theme.ts` (+ test) — themes, cookie, `resolveTheme`; `app/theme/context.tsx` —
  `ThemeProvider` / `useTheme`.
- `app/utils/user-settings.tsx` — `useSetTheme` (state + cookie + account save).
- `app/models/user-settings.ts` — `theme` in the settings schema.
- `app/root.tsx` — loader resolution, `<html data-theme>`, error pages.
- `app/components/theme-switcher.tsx` (+ test) — `ThemeMenu` (header), `ThemeSwitcher`
  (settings); icons `sun`, `moon`, `computer-desktop`.
- `app/styles.css` — tokens, Dark values, `dark` variant.
- Light-UI components switched to tokens: button, input, link, main, code, search, upload,
  error/form messages, toasts, language switcher, wager-hints control, game visibility icon,
  dialog overlay, header, home, game cards, profile, settings, login/signup, random board,
  community, how-to page, team-name input.

## Verification

- Unit: `app/theme/theme.test.ts` (resolution order cookie → account → Classic, invalid
  values, cookie round trip), `app/models/user-settings.test.ts` (schema keeps / drops
  `theme`), `app/components/theme-switcher.test.tsx` (applies the theme at once, writes the
  cookie, saves to the account only when logged in, Ukrainian labels).
- E2E: `e2e/themes.spec.ts` — Classic by default; switch to Dark in the header → applied at
  once, cookie set, reload keeps Dark, back to Classic; a solo question in Dark; Ukrainian
  menu; no hydration errors and the right page background for Dark, System + emulated
  `colorScheme: 'dark'` and System + light on `/`, `/mock`, `/howto`, `/login`.
  `e2e/settings.spec.ts` — Dark in Settings is saved to the account and comes back on a new
  device (cookie cleared). The existing hydration specs still pass.
- Screenshots (Playwright, 390×844 and 1280×800) of home, game page, how-to, upload help,
  about, community, login, signup, random board, 404, room join dialog, board, game menu,
  question prompt (plain, multiple choice, secret, wager, answer revealed), TV page, summary
  / replay, profile and settings were taken in Classic and Dark and looked at; Classic was
  compared pixel by pixel against the same screens built from `main`.
