# Feature 02 — Reliable joining + "Rooms in progress"

**Branch:** `feat/join-sync-and-rooms-list`
**Status:** ✅ implemented & tested (no DB migration)

Two items found while playtesting (see the backlog in [../README.md](../README.md)).

## Part A — join race / client sync

### Problem

Tapping "Join game" right after the room page loaded — before the Supabase realtime
channel reached `SUBSCRIBED` — saved the `join` room event, but the client never
applied it: the join dialog stayed and the player looked stuck. Any own early action
had the same problem. Supabase can also drop `postgres_changes` INSERTs that happen
right after `SUBSCRIBED` (CDC warm-up), which hits other players' events too.

A second, latent bug: `fetchMissedEvents` asked for `id > max(seen ids)`. If realtime
dropped event N but delivered N+1, the catch-up skipped N for good.

### Design (and why)

`app/engine/use-game-engine.ts`:

1. **Merge every fresh loader snapshot.** React Router already revalidates the room
   loader after every fetcher action (all room actions are fetchers to
   `/room/{id}/{verb}`; only `root` opts out of revalidation). The loader returns the
   full, ordered `roomEvents`, but the hook only used them to seed `useReducer`. It now
   merges each new `serverRoomEvents` into state. This fixes own actions at the root
   with **zero extra requests** and no new API (no `sync()` to remember to call).
2. **Second catch-up fetch 3 s after `SUBSCRIBED`** — covers events from other players
   inserted during the CDC warm-up window.
3. **Correct watermark.** The catch-up fetch now uses `fetchedUpToId`, advanced only by
   complete sources (loader snapshot, catch-up fetch), never by realtime events.
4. **One merge path, deduped by id.** Realtime, catch-up fetches and loader snapshots all
   go through `mergeRoomEvents` (`app/engine/room-event.ts`), which dedupes by event id,
   drops unknown types and orders by `(ts, id)` like the server. If a newly found event
   sorts _before_ already-applied ones (the dropped-N case), the hook rebuilds state by
   replaying all known events (`REPLACE_STATE` internal action) instead of applying it
   late in the wrong order. The normal case stays an incremental append.

Considered and rejected: exposing `sync()` from the engine context and calling it after
each fetcher — needs every action site (or a `useFetchers` watcher) to cooperate, and
costs an extra request per action when the loader snapshot already has the data.

### Reconnect review (mobile)

Fixed (clear bugs):

- **Escalation never fired under repeated errors.** Supabase retries emit
  `CHANNEL_ERROR`/`TIMED_OUT` every few seconds and each one restarted the 60 s
  RECONNECTING → DISCONNECTED timer, so the manual "retry" never showed. The timer now
  starts once; once escalated the state stays DISCONNECTED until a real `SUBSCRIBED`
  (no flicker back to "Reconnecting").
- **Dead socket looked healthy.** After a phone lock the channel can still report
  `joined` while the socket is gone. Visibility/staleness checks now also require
  `client.realtime.isConnected()`.
- **Network back / bfcache.** Resync on `online`; on Safari back/forward-cache restore
  (`pageshow` with `persisted`) force a fresh channel (the effect doesn't re-run there).

Findings, not changed:

- While backgrounded, timers are throttled; on return the `visibilitychange` handler
  fetches missed events immediately, so state converges even before the channel rejoins.
- The catch-up has a tiny theoretical gap if two inserts commit out of id order and a
  fetch sees only the later one; realtime or the next loader snapshot still delivers it.
- Loader revalidation re-runs the room loader (game + all events) after each action —
  that was already the case before this change.

## Part B — Rooms in progress

### Goal

Friends can join a running room of the same game without someone sharing the link.

### Design (and why)

- **Where:** the game page (`/game/:id`, `app/routes/game_.$gameId_.tsx`) shows a
  "Rooms in progress" section below the Play buttons. Most players start from the home
  page cards, which link straight to `/game/:id/play` and never see the game page, so
  **`/game/:id/play` now shows the same list** with a "Start a new room" button when
  rooms are in progress; with none it creates a room and redirects exactly as before.
  `?new` skips the choice (used by "Start a new room" and by the game page's "Play with
  friends", since the list is already visible there).
- **Which rooms:** activity (an event) in the last **12 h**, at least one player, not
  `GameOver`. Most recently active first; max **8** rooms inspected/listed.
- **How (no migration):** `rooms` has no `created_at`, so `getActiveRooms`
  (`app/models/room.server.ts`) does one PostgREST query for the newest rooms (highest
  id) of the game with an `!inner` embed on `room_events` filtered by `ts >= now-12h`
  (embedded `limit 1`, so the payload stays tiny), then fetches each candidate's events
  in parallel and replays them with the engine (`summarizeActiveRoom`,
  `app/models/active-rooms.ts`) to get players (names + colors via `getPlayerColor`)
  and the game state. Replaying reuses the real reducer, so "over" and "who's in" are
  exactly what the room page would compute. Rooms whose events can't be replayed are
  skipped instead of breaking the page.
- **Time ago** is computed server-side as whole minutes ("just now", "5 min ago",
  "2 h ago") to avoid hydration mismatches.
- **UI:** `app/components/active-rooms.tsx` — one card per room (room slug, player
  count, last activity, colored dot + name per player, "Join"); one column on phones,
  two on `md+`.
- The `/play` route's loader returns `preview` (not `game`) because the header treats
  any route with `game` loader data as an in-game page.
- Privacy: anyone who can open the game can see room slugs and player names of its
  active rooms. That matches today's RLS (anon can read `rooms`/`room_events`) and the
  goal of letting friends join; the game page still serializes no clues.

## How to use

- Open a game's page, or click a game card / "Play with friends": if friends are
  already playing it, pick their room under **Rooms in progress** (or **Start a new
  room**).
- Joining no longer needs waiting for "Connected".

## Files touched

- `app/engine/use-game-engine.ts` — snapshot merge, watermark, delayed catch-up,
  rebuild on out-of-order events, reconnect fixes.
- `app/engine/room-event.ts` — `compareRoomEvents`, `mergeRoomEvents`.
- `app/models/active-rooms.ts` (new) — `summarizeActiveRoom`, `formatTimeAgo`, limits.
- `app/models/room.server.ts` — `getActiveRooms`.
- `app/components/active-rooms.tsx` (new) — list UI.
- `app/routes/game_.$gameId_.tsx`, `app/routes/game_.$gameId.play.tsx` — loaders + UI.
- Tests: `app/engine/room-event.test.ts`, `app/engine/use-game-engine.test.tsx`,
  `app/models/active-rooms.test.ts`, `e2e/rooms.spec.ts` (added to the `db` project in
  `playwright.config.ts`).

## Verification

- **Unit:** `mergeRoomEvents` (append, dedupe, sort, out-of-order, unknown types);
  `useGameEngine` with a mocked Supabase client (snapshot merge before SUBSCRIBED, no
  double-apply, delayed catch-up, watermark + in-order rebuild, escalation under
  repeated errors); `summarizeActiveRoom` (players/colors/minutes, empty, game over,
  bad events) and `formatTimeAgo`.
- **E2E (`e2e/rooms.spec.ts`):** with the realtime websocket blocked
  (`routeWebSocket`), clicking "Join game" immediately joins (fails on the old hook,
  passes now); a guest sees the room on the game page, gets the chooser from `/play`,
  joins via the list, and "Start a new room" creates a different room.
- Checked visually at 390 px and 1280 px widths.
