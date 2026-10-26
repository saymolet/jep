# Feature 18 — Admin panel (F12e)

**Branch:** `feat/admin`
**Status:** ✅ implemented & tested
**Migration:** `20261026033929_admin_panel.sql` (additive: three read-only SQL functions,
callable only by the service role)
**New env var:** `ADMIN_PASSWORD` (optional, sensitive; unset = admin panel off)
**New dependencies:** none

## Goal

A place for the site owner to look after the site without opening the Supabase dashboard:
how much is used (games, rooms, storage, database), moderate games (visibility, delete),
clean up rooms and reports, and free Storage space taken by media nobody uses any more.

## How to use it

1. Set `ADMIN_PASSWORD` in the server's `.env.local` (a long random value, e.g.
   `openssl rand -base64 24`) and rebuild/restart (Varlock bakes the env into the build:
   `jep-deploy`). Without it, every `/admin` URL answers **404**.
2. Open **`/admin`** (there is no link to it anywhere on the site). You are sent to
   `/admin/login`; enter the admin password. The admin session lasts **12 hours** (or until
   **Log out**, top right of the admin navigation).
3. Pages (navigation at the top; cards, so it works on phones):
   - **Dashboard** — games (all / public / unlisted / private), rooms active in the last
     24 h / 7 days, rooms in total, room events, accounts, reports; **media storage** used of
     the free plan's 1 GB (bar + file count) and **database size** of 500 MB.
   - **Games** — search by title or author (every word must match; any language), 20 per
     page, newest first: title, author, number of questions, created date, uploader's email
     (or "guest"). Change the visibility inline (Public / Unlisted / Private → **Save**) or
     **Manage** a game.
   - **Game page** (`/admin/games/:id`) — details, number of rooms, how many of its media
     files will be deleted with it and how many stay because another game uses them, its
     reports (with **Dismiss**), visibility, and **Delete game…** → a confirmation panel →
     **Delete for good**.
   - **Rooms** — most recently active first: room (link), game (link to its admin page),
     players, last activity, number of events, status (In progress / Finished / No events).
     **Delete** → confirm → the room and all its events (and results) are deleted.
   - **Reports** — reported game, reason, date, reporter's email (or anonymous); **Manage
     game** jumps to the game's admin page; **Dismiss** deletes the report.
   - **Storage** — **Scan for unused files** lists how many files of the `game-media` bucket
     no question of any game uses (with their total size and up to 20 names), then **Delete
     unused files…** → confirm.
4. Everything is in English and Ukrainian (Панель адміністратора, Огляд, Ігри, Кімнати,
   Скарги, Сховище) and follows the Classic / Dark theme.

## Design decisions

### Security

- **A dedicated password, not a user role.** There is no admin role in the database and the
  owner didn't want admin rights tied to an email address. `ADMIN_PASSWORD` is declared in
  `.env.schema` as `@optional @sensitive` (min. 12 characters). Varlock never exposes
  sensitive values to the browser bundle (verified: the test password is not in
  `build/client`; it is in `build/server`, like `SESSION_SECRET`), and its response
  patch would refuse a page that leaked it.
- **Feature off = 404.** Without `ADMIN_PASSWORD` every admin loader and action answers 404,
  so the panel looks like it doesn't exist (unit-tested).
- **Password check** (`app/admin/password.server.ts`): both the input and the password are
  hashed with SHA-256 and compared with `crypto.timingSafeEqual` on the equal-length
  digests, so the time doesn't depend on where or whether the lengths differ. Empty input
  and an unset password are always rejected.
- **Admin session** lives in the existing signed `__session` cookie (`HttpOnly`,
  `SameSite=Lax`, `Secure` in production) under `admin`: an expiry (12 h), a **fingerprint
  of the password** (HMAC with `SESSION_SECRET`, so the readable cookie reveals nothing
  about the password; changing `ADMIN_PASSWORD` logs every admin out) and a random **CSRF
  token**. The player id in the same cookie is untouched by admin login/logout.
- **One guard for everything:** `requireAdmin(request)` (`app/admin/auth.server.ts`) is the
  first call of every admin loader and action: 404 when off, redirect to the login page
  when not logged in (expired, or opened with another password), and for every POST it
  reads the form and checks the CSRF token (403 otherwise) — on top of `SameSite=Lax`, which
  already keeps the cookie off cross-site POSTs. A table-driven unit test imports every
  `app/routes/admin*.tsx` module and checks each loader/action (and that none touches the
  database before the check passes).
- **Brute-force protection** (`app/admin/throttle.ts`, in memory): 5 wrong passwords from
  one address within 15 minutes lock that address out for 15 minutes; 50 from all addresses
  together lock the login for everyone for 15 minutes (so many addresses can't share the
  work). While locked, even the right password is refused, and the message is always the
  same generic one ("Could not log in. Check the password, or wait a few minutes…"). The
  address is `X-Real-IP` (set by nginx), else the **last** `X-Forwarded-For` entry (the one
  nginx appended; earlier ones come from the client), else one shared "unknown" key —
  `react-router-serve` doesn't expose the socket address to loaders. A restart clears it.
- **Not findable:** no link anywhere; `/admin/*` pages send `X-Robots-Tag: noindex,
nofollow` and `<meta name="robots" content="noindex, nofollow">` (`isAdminPath` in
  `app/utils/seo.ts`); `Cache-Control: no-store`. robots.txt doesn't list it (that would
  advertise the URL).
- **Server only:** all reads and writes use the service-role client
  (`app/models/admin.server.ts`) after `requireAdmin`. The three SQL functions are
  `SECURITY DEFINER` with `EXECUTE` revoked from `public`, `anon` and `authenticated` and
  granted to `service_role` only (checked: anon gets "permission denied").

### Data

- **Migration** `20261026033929_admin_panel.sql` adds `admin_stats()` (all dashboard counts,
  `pg_database_size`, and the bucket's file count/bytes from `storage.objects` in one
  call), `admin_media_objects()` (every file of `game-media`: path, size, upload time) and
  `admin_recent_rooms(max_count, skip)` (rooms by last event, with game title and event
  count). Counting distinct active rooms and reading `storage.objects` can't be done
  through the REST API, and listing Storage folder by folder would take one request per
  imported pack.
- **Room status and players** come from replaying each listed room's events (like the
  rooms-in-progress list); private games are opened with `getGame(…, { ignoreVisibility })`.

### Deleting a game and its media

SIGame imports put each pack's files under their own `siq/<uuid>/` prefix, but questions are
**copied by value** — random boards, re-uploaded `.jep.json` files (game-media URLs are
accepted in uploads) — so another game can use the same files. `deleteGameWithMedia`:

1. reads every question that has `media`, `answer_media` or `image_src` (with its game) —
   paginated, service role;
2. `planGameMediaDeletion` (pure, `app/admin/media-refs.ts`): the bucket paths the game
   uses, minus those any **other** game uses; any URL whose path is
   `/storage/v1/object/public/game-media/<path>` counts (any origin, percent-decoded) — a
   reference is a reason to keep a file, so being generous is safe;
3. deletes the game row (categories, questions, rooms, events, results and reports go with
   it by the existing `ON DELETE CASCADE`);
4. removes the planned files from Storage (1000 per request). The row goes first: if
   removing files fails they are just orphans for the cleanup, never missing files of a
   game that still exists.

The user-side delete on the profile page is unchanged (it still leaves the media behind);
the Storage cleanup finds those files.

### Storage cleanup

`findOrphans` (pure): files of the bucket no question references, **older than one hour**
(a SIGame import uploads its files before it creates the game — a running import must
never lose them), skipping Supabase's `.emptyFolderPlaceholder`. Deleting scans again on
the server; the browser never sends a list of files to delete.

### UI

- Confirmations are a `?confirm=…` / `?delete=<id>` URL that renders a red confirmation
  panel from the server — no client state, so nothing depends on hydration.
- After every action: flash message (the existing `flashFormState`) + redirect back to the
  page (POST/redirect/GET; the page path is taken from the request without React Router's
  `.data` suffix).
- Theme tokens (`paper`, `ink-*`, `accent`) for the cards and text; `dark:` only for the red
  danger colors. Sizes are formatted with plain arithmetic (`formatBytes`, "26.3 KB" /
  "26.3 КБ"), dates with `LocalDate` and "5 min ago" computed on the server, so the server
  and browser render the same text.
- The game page's loader returns `adminGame`, not `game`: the site header shows a game
  menu for any page whose loader data has a `game`.

## Files

- `app/admin/`: `auth.server.ts` (requireAdmin, login/logout), `password.server.ts`,
  `throttle.ts`, `media-refs.ts`, `format.ts`, `constants.ts`, `components.tsx`,
  `actions.server.ts`, tests (`*.test.ts`, incl. `require-admin.test.ts`).
- `app/models/admin.server.ts` (+ test); `getGame` option `ignoreVisibility`.
- Routes: `admin.tsx` (layout, headers), `admin.login.tsx`, `admin.logout.tsx`,
  `admin._index.tsx`, `admin.games.tsx`, `admin.games_.$gameId.tsx`, `admin.rooms.tsx`,
  `admin.reports.tsx`, `admin.storage.tsx`.
- `app/session.server.ts` (admin part of the session), `app/utils/seo.ts`,
  `app/i18n/{en,uk}/admin.ts`, `.env.schema` / `env.d.ts`.
- `scripts/with-local-supabase.sh` sets a test-only `ADMIN_PASSWORD` default
  (`e2e-admin-password`) for the e2e build and server; `playwright.config.ts` runs
  `e2e/admin.spec.ts` in the `db` project.

## Admin in rooms (follow-up `feat/admin-timer`)

The admin session also counts in game rooms: only the admin may change a room's answer timer
(see [14-answer-timer.md](./14-answer-timer.md), "Only the admin changes it"). The room
loader exposes just `isAdmin` (a boolean from `getAdmin`), and the settings route answers 403
without an admin session. Log in at `/admin` on the device you'll use, then open (or reload)
the room.

## Production setup

1. Apply the migration (`jep-deploy` does it).
2. Add `ADMIN_PASSWORD=<long random value>` to the production `.env.local`, then
   `jep-deploy` (the env is baked into the build). Give the password to the owner.
3. Open `https://<site>/admin`. To turn the panel off, remove the variable and redeploy;
   to log everyone out, change it.

## Verification

- Unit: password check (right / wrong / prefix / longer / empty / non-string / unset;
  `timingSafeEqual` called on 32-byte digests), throttle (5 failures → 15 min, window,
  reset on success, global limit, bounded size), client address (X-Real-IP, last
  X-Forwarded-For entry), every admin loader/action (404 when off, redirect without /
  with expired / with another password's session, 403 without the right CSRF token, no
  database before the check), login lockout refusing the right password, media
  references / orphans / game deletion plan (copied questions keep files), deletion order
  (row before files), formatting, `pagePath`, robots metadata.
- E2E (`e2e/admin.spec.ts`, with `ADMIN_PASSWORD` set by the e2e setup): `/admin` redirects
  to the login page and is `noindex, nofollow`; Ukrainian login + dashboard; wrong password
  rejected; login → dashboard → logout; a guest-imported `.siq` pack (fixture builder) is
  made Private (its public page then 404s), then deleted from its admin page: the game is
  gone and its Storage file no longer loads.
- `jep-validate` green.
