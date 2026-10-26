# Architecture

> Stub — will be filled in with a proper deep-dive when we start the first feature.
> Captures what we already know from the initial repo scan.

## Layout (`app/`)

- `routes/` — React Router v7 routes: `_index` (landing), `game`, `profile`,
  `room.$roomName_.summary`.
- `components/` — UI: `board/`, `player/`, `prompt/`, `preview/`, `sound/`, `icons/`.
- `engine/` — game-state logic (buzzing, scoring, round flow).
- `models/` — data access + `auth/`, `user/`; `database.types.ts` generated from schema.
- `supabase/` — client setup (`client.ts`: anon client for browser, service-role for server).
- `utils/` — env handling (`env.ts`), helpers.
- `static/*.jep.json` — sample games.

## Game data model (`.jep.json`)

Current shape (to be extended for audio/video/multiple-choice):

```
Game
 ├─ title, author, copyright, note
 └─ boards[]                      (rounds: single, double, final…)
     ├─ categoryNames[]
     └─ categories[]
         ├─ name
         └─ clues[]
             ├─ clue    (string — the prompt text; may be "" if media is set)
             ├─ answer  (string)
             ├─ value   (number)
             ├─ wagerable?  (bool — Daily Double style wager)
             ├─ longForm?   (bool — Final Jeopardy long answer)
             ├─ imageSrc?   (string — added in migration 20230906)
             ├─ media?       ({type: image|audio|video, src, alt?}[] — shown with the clue)
             └─ answerMedia? (same — shown with the answer; jsonb columns, migration 20261025)
```

DB tables: `games`, `categories`, `clues`, `accounts`, `rooms`, `room_events`,
`solves`, `reports`.
SQL functions (RPC): `random_board_categories(max_count)` / `random_final_clues(max_count)` —
random candidates from PUBLIC games for the random board generator
(see [features/10-random-board.md](./features/10-random-board.md)).
`user_rooms_in_progress(user_ids, since, max_count)` — rooms a user joined (partial index
`room_events_join_user_id_idx` on `join` events' `payload->>'userId'`), for "Your games in
progress" (see [features/17-standings-resume.md](./features/17-standings-resume.md)).

`admin_stats()`, `admin_media_objects()`, `admin_recent_rooms(max_count, skip)` — the admin
panel's dashboard counts, the `game-media` file list and the rooms list; `SECURITY DEFINER`,
executable by the service role only (see [features/18-admin.md](./features/18-admin.md)).
`cleanup_inactive_rooms(max_idle, dry_run)` — deletes (or counts) rooms with no activity for
`max_idle` (5 h, `ROOM_MAX_IDLE_HOURS` in `app/models/room-cleanup.js`); service role only;
run hourly by `scripts/cleanup-inactive-rooms.mjs` and from the admin Rooms page
(see [features/19-seat-lock-cleanup.md](./features/19-seat-lock-cleanup.md)).

## Admin panel

`/admin/*` (feature 18) is gated by the `ADMIN_PASSWORD` server env var (unset → 404), not by
a user role. Every admin loader and action starts with `requireAdmin(request)`
(`app/admin/auth.server.ts`): 404 when off, redirect to `/admin/login` without a valid admin
session (expiry + password fingerprint in the signed session cookie), and a CSRF token check
on every POST. Admin data access is in `app/models/admin.server.ts` (service role, server
only). A new admin route must call `requireAdmin` first — `app/admin/require-admin.test.ts`
checks every `app/routes/admin*.tsx` module automatically.

## Realtime / rooms

- Supabase Realtime drives multiplayer. `rooms` + `room_events` tables; buzzing and
  scoring sync through room events. (Details TBD in deep-dive.)
- Client sync (`useGameEngine`): state = replay of `room_events`. New events come from
  realtime INSERTs, catch-up fetches (on SUBSCRIBED, +3 s, visibility/online) and the
  room loader's snapshot after every own action (fetcher revalidation); all are merged
  by id via `mergeRoomEvents`, rebuilding state if one arrives out of order.
- Who may insert which event: the browser key (anon/authenticated) may insert every
  `room_events` type except `set_settings`, `kick`, `leave` and `transfer_player` (RLS insert
  policy). Those are inserted by the server with the service role
  (`createRoomEventAsServer`) after the route's checks; admin-only ones carry `admin: true`.
  Seats are keyed by userId, locked once the game is underway (`isGameUnderway`), and a
  Join never resets a seat (see [features/19-seat-lock-cleanup.md](./features/19-seat-lock-cleanup.md)).
- Presence: the same room channel carries Realtime presence. Each client may announce a role
  (`player` / `spectator` / `presenter`, never names); `watchers` in the engine context is the
  number of spectators (see [features/11-spectator-presenter.md](./features/11-spectator-presenter.md)).
- Broadcast: the same channel also carries ephemeral Realtime broadcasts (event `soundboard`)
  exposed as `engine.soundboard` (`RoomBroadcast`); never stored, not part of the replayed
  state. Payloads are untrusted and validated by the receiver
  (see [features/15-soundboard.md](./features/15-soundboard.md)).
- Read-only viewers (spectators, the TV page `/room/:roomName/present`) render the same engine
  context through `components/watch/` (`getViewerStatus`, `ViewerPromptContent`); they never
  submit room actions.

## Hydration (server render → client)

Every page is server-rendered and then hydrated by React. If the first client render differs
from the server HTML, React reports error #418 ("Hydration failed…"), throws the server HTML
away and re-renders the page on the client, so the page becomes interactive later (worst on
slow phones). Fixed on `fix/hydration`; the causes found were:

| Where                                                      | Cause                                                                                                                                                                                         | Fix                                                                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solo games (`/mock`, `/mock?game=…`), connection indicator | `useSoloGameEngine` read `navigator.onLine` during render. Node 21+ has a global `navigator` **without** `onLine`, so the server rendered "Offline" (red) and the browser "Connected" (green) | start `CONNECTED`, read `navigator.onLine` in the mount effect                                                                                      |
| `/howto` buzzer demo                                       | "Clue shown at" rendered `Date.now()` from the render                                                                                                                                         | set it in a mount effect                                                                                                                            |
| `/profile` game and solve dates                            | formatted in the server's time zone; `games.created_at` is `timestamp without time zone`, so `new Date()` parsed it as _local_ time on each side                                              | `components/local-date.tsx`: zone-less timestamps parsed as UTC; UTC date in the hydration render, the viewer's local date after it (`useHydrated`) |

Rules for new code:

- Don't read `Date.now()`, `Math.random()`, `navigator`, `window`, `localStorage`, IndexedDB
  or the local time zone during render of server-rendered UI. Render a server-safe value first
  and update it in an effect, or branch on `useHydrated()` (`app/utils/use-hydrated.ts`).
  (`typeof navigator === "undefined"` is **not** a server check any more.)
- Format times on the server (as `active-rooms` does for "5 min ago") or with `LocalDate`.
- Radix dialogs (e.g. "Join game") render in a portal that only mounts on the client, so they
  are never in the server HTML and can't be tapped before hydration.
- `root.tsx` sets `<html data-hydrated="true">` after hydration. E2E specs navigate with
  `goto()`/`reload()` from `e2e/helpers.ts`, which wait for it, and
  `e2e/hydration*.spec.ts` fail on any hydration error (run in two time zones, UTC+14 and
  UTC−12, which always disagree with the server about the date).

## i18n (English + Ukrainian)

The UI is translated into English (`en`, the source language) and Ukrainian (`uk`) with a
small typed layer in `app/i18n/` (no library). **Every new user-facing string goes into both
languages.** Game content (titles, categories, questions, answers) is never translated.

- **Dictionaries:** `app/i18n/en/<area>.ts` (English, the source of truth) and
  `app/i18n/uk/<area>.ts`, one file per area (`common`, `header`, `play`, `room`, `auth`, ...),
  merged in `app/i18n/en.ts` / `uk.ts` (`en/areas.ts` lists the areas). Keys start with the
  area: `"room.startRound"`. Each `uk/<area>.ts` is typed `Dictionary<typeof en>`, so a
  missing or extra key, or a plural where English has a string, is a **type error**;
  `app/i18n/i18n.test.ts` also checks key prefixes, placeholders and plural forms.
- **Messages:** `"Hi {name}"` placeholders; plurals are objects keyed by `Intl.PluralRules`
  category with a `{count}` param — English `{ one, other }`, Ukrainian
  `{ one, few, many, other }` (1 гравець, 2 гравці, 5 гравців, 1,5 гравця).
- **In components:** `const { t, rich, locale, intlLocale } = useTranslation()` from
  `~/i18n`. `t("room.players", { count })` returns a string (params are type-checked against
  the English message). `rich(key, { link: (c) => <Link to="/x">{c}</Link>, name })` renders
  messages with simple tags (`<link>…</link>`) and React values. Format dates and numbers with
  `intlLocale` (`"en-US"` / `"uk-UA"`). "$" game points keep `formatDollars` (en-US).
- **In `meta` functions:** `metaT(matches)("about.title")` (`~/i18n/meta`).
- **On the server** (actions/loaders producing text, e.g. errors, upload summaries):
  `createT(getRequestLocale(request))` (`~/i18n/resolve`).
- **Language resolution** (`resolveLocale`, run in the root loader so server and client render
  the same language — no hydration mismatch): the `lang` cookie (set by the **EN / УКР**
  switcher in the header and settings) → the logged-in user's `accounts.settings.language` →
  `Accept-Language` (only `uk*` gives Ukrainian) → English. Tests without a cookie or
  Accept-Language get English. The root sets `<html lang>`.
- Components rendered without the provider (unit tests) get English.

## Themes (Classic / Dark / System)

- `app/theme/theme.ts`: `resolveTheme` in the root loader — the `theme` cookie (set by the
  header menu / Settings) → `accounts.settings.theme` → **Classic**. The root renders
  `<html data-theme="classic|dark|system">`; the switcher (`useSetTheme`) updates root state,
  the cookie and the account setting, so the change shows at once and the next server render
  agrees. System is resolved purely in CSS (`prefers-color-scheme`), never in JS.
- **Colors come from theme tokens** (`app/styles.css` `@theme`): `page`, `paper`, `ink`,
  `ink-50…950` (= slate in Classic), `accent*`, `link-*`, `header`, and the game colors
  `blue-1000`, `blue-bright`, `blue-925`, `yellow-1000`. The Dark theme redefines them in one
  block at the end of the file. **For new light-UI code (text, borders, fills on the page or a
  card) use `ink-*` / `paper` / `page` / `accent`, not `slate-*` / `white`;** game surfaces
  (board, prompt, dialogs, TV) are dark in every theme and keep `white` / `slate-*` text.
- `dark:` utilities follow the theme (`@custom-variant dark` = Dark, or System on a dark
  device); use them only for one-off status colors.

## Open questions to resolve during feature work

- Exact room-event protocol and how buzz order / lockout is tracked.
- How the engine reduces `room_events` into game state (looks like an event-sourced reducer).
- Where clue rendering happens (`components/prompt/`) — the seam for typed questions / `blocks[]`.
