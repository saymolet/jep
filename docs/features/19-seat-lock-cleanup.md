# Feature 19 — Seat lock & inactive room cleanup

**Branch:** `feat/seat-lock-cleanup`
**Status:** ✅ implemented & tested
**Migrations:** `20261026172752_room_events_seats_server_only.sql` (room_events insert policy
also rejects `kick` / `leave` / `transfer_player` from the browser key),
`20261026173001_cleanup_inactive_rooms.sql` (additive `rooms.created_at` + service-role-only
function `cleanup_inactive_rooms`)
**New dependencies:** none

## Goal

Two requests from the owner:

1. **Seat lock.** A player who steps away (smoke break) or loses their connection keeps their
   seat and points for the whole game; nobody else can kick them or take their seat. During
   a game only the admin may remove a player.
2. **Room cleanup.** Rooms with no activity for **5 hours** are deleted automatically (the
   owner accepted that their history / summary goes with them).

## How to use it

- **Before the game** (the first round's preview, or its board before anyone opened a
  question) players can still kick each other from the tile menu, as before.
- **Once the first question was opened** the kick buttons disappear for players. Leaving
  yourself still works between questions. The **site admin** (logged in at `/admin` on the same
  device, see feature 18) sees **Kick player** on every tile between questions — also when only
  watching — and can remove anyone but the last player.
- **Coming back:** a player who left, or was removed by the admin during the game, opens the
  room link again and taps **Join game**: they get their seat back with their score, color,
  avatar and team (the name is taken from the join dialog). Closing the tab or losing the
  connection doesn't remove anyone at all.
- **Rooms are deleted after 5 h without activity.** Admin → **Rooms** shows "Rooms with no
  activity for 5 hours are deleted automatically…" and **Delete rooms inactive for 5 h now** →
  "Delete 3 rooms inactive for 5 hours?" → **Yes, delete** → "Deleted 3 inactive rooms."
  (Ukrainian: **Видалити кімнати без активності 5 год зараз**.)
- Errors from the server (EN / UK): "the game has started: only the admin can kick a player
  now" / "гра вже почалася: тепер вигнати гравця може лише адміністратор"; "only players in this
  game can kick a player"; "a player can only be kicked between questions".

### Scheduled cleanup (production)

The coordinator runs this every hour (e.g. a systemd timer) from the app checkout:

```sh
varlock run -- node scripts/cleanup-inactive-rooms.mjs
# → cleanup-inactive-rooms: deleted 2 room(s) inactive for 5 h
```

`--dry-run` only counts. It needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (from
Varlock), prints one line, and exits with 1 on any error. It uses plain Node (no build step):
the shared code is `app/models/room-cleanup.js` (plain JS with JSDoc types).

## Design decisions

### When is the game "underway"?

`isGameUnderway(state)` (engine): **from the moment the first question of the game is
opened** — i.e. not (`PreviewRound` or `ShowBoard`, round 1, no question answered yet). This is
exactly the rule the engine already applied to every kick, so **all kick events already in the
database replay exactly as before** (no retroactive change), and "Start round" alone doesn't
lock seats: until somebody picks a question, a wrong person in the room can still be kicked by
the others. Game over counts as underway.

### Who may kick

- **Route** `DELETE /room/:roomId/player`: the target is the visitor's own seat → **Leave**,
  anyone else → **Kick**. For a kick the route replays the room: game over → 409; the
  **admin** (`getAdmin`) → allowed between questions (409 while a question is open), payload
  tagged `admin: true`; a **non-admin** → 403 once the game is underway, and 403 if they don't
  play in the room (before, anyone who could reach the route could kick before the game; the UI
  only ever offered it to players).
- **Database:** the browser key could insert `kick` events directly and skip all of this. The
  migration extends the insert policy from `type <> 'set_settings'` to
  `type not in ('set_settings', 'kick', 'leave', 'transfer_player')`:
  - `kick` — as asked. Player kicks before the game now also go through the server
    (service role, `createRoomEventAsServer`) after the route's checks; their behaviour is
    unchanged.
  - `leave` — a forged `leave` with someone else's userId is a kick in disguise (moves them
    out of the game). The route only ever sends a leave for the visitor's own userId, so it
    goes through the server too.
  - `transfer_player` — a forged transfer could move someone's seat (and score) to the
    forger's id. Only the room loader sends it (guest cookie id → the same visitor's account id),
    now with the service role.
  - All other types (join, buzz, check, …) are accepted exactly as before.
- **Engine:** a Kick with `admin: true` (only the server can write it) is accepted whenever
  the board or round preview shows, never for the last player; without the flag the old rule
  applies (before the game only). An admin kick **during** the game moves the player to
  `leftPlayers` (like Leave: they stay on the summary with their points and get the seat back
  if they join again); before the game it removes them for good like a player kick. Note:
  `isPlayerAction` strips the payload to a player's fields, so the flag is read first.
- **UI:** `PlayerScores` gets `isAdmin` from the room loader (as for the answer timer) — no
  hydration risk, both renders use the loader value. Players see kick buttons only before the
  game is underway; the admin sees them between questions, playing or watching.

### Seats and rejoining

- **Seats are keyed by userId**: the account id when logged in, else the guest id in the
  signed session cookie. Join and ChangeName require `requireSessionUserId` (you can only act
  as yourself); Leave is only ever your own id; TransferPlayer only from your own guest id to
  your own account (and the engine only moves a seat whose old id is still playing). So through
  the app nobody can sit in or take over someone else's seat.
- **A Join never resets a seat** (engine change): before, a second Join for a seated player —
  or a Join after leaving — started them again at $0. Now a Join for a userId that is seated
  keeps the seat, and one for a userId in `leftPlayers` restores it (score, color, avatar, team,
  moved back out of `leftPlayers`); only the name comes from the new Join. Board control is not
  given back (it moved on when they left). A player kicked before the game was removed for
  good, so they join again from scratch. Old rooms where someone re-joined while seated replay
  with the score kept instead of zeroed — that was the bug being fixed.
- **Disconnecting already kept the seat**: there is no event for closing a tab, going offline
  or locking the phone. The player stays in `players`; at most the game waits for them (as
  before). Presence only counts spectators.
- **Remaining trust model (unchanged, documented):** the browser key can still insert other
  event types for any userId (it always could; players mark their own answers). A forged `join`
  can no longer reset anyone's points; a forged `change_name` could still rename someone, and a
  forged `buzz`/`check` could still cheat. Moving every room event behind the server would be a
  larger change (all routes + realtime echo) — possible follow-up.

### Room cleanup

- **Rule:** a room is deleted when it was **created more than 5 h ago** and has **no event in
  the last 5 h** (its latest `room_events.ts` is older, or it has none). Events and results go
  with it: `room_events.room_id` and `solves.room_id` reference `rooms` with `ON DELETE
CASCADE`; nothing else references rooms (reports reference games).
- **`rooms.created_at`** (`timestamptz not null default now()`, additive): rooms had no
  creation time, so a room nobody joined couldn't be aged. Existing rows get the migration's
  time — every existing room is kept for at least 5 h after the deploy (also old rooms with
  old events, which are then removed by the first run after that).
- **`cleanup_inactive_rooms(max_idle interval, dry_run boolean default false) returns
integer`** — `SECURITY DEFINER`, `search_path = ''`, `EXECUTE` revoked from public / anon /
  authenticated and granted to `service_role` only (like the admin panel functions; checked:
  anon gets "permission denied"). It refuses `max_idle` under 1 hour, so a typo can't delete
  rooms in play. `dry_run` counts instead of deleting (the admin confirmation).
- **One constant:** `ROOM_MAX_IDLE_HOURS = 5` in `app/models/room-cleanup.js`, used by the
  admin page and the script; the SQL function takes the interval as an argument.
- **Admin page:** `?cleanup=1` renders the count in a red confirmation panel from the server
  (same pattern as the other admin confirmations); the POST (`intent=cleanup`, CSRF-checked
  by `requireAdmin`) runs the same function and flashes how many were deleted.
- **Race:** an event inserted at the very moment a 5-h-idle room is deleted is deleted with
  it. A room idle for 5 h getting its next event in that same instant is negligible.
- **Other places that link rooms:** "Rooms in progress" (game page / Play chooser) only lists
  rooms active in the last 12 h — unaffected. "Your games in progress" still looks back 7 days
  (`MY_ROOMS_MAX_AGE_MS`); rooms idle for 5 h are gone anyway, so in practice it lists rooms
  active in the last few hours (no user-facing text mentions 7 days; the comment says so). The
  admin dashboard tile "Rooms active in the last 7 days" was removed — it would now silently
  undercount (deleted rooms vanish); "Rooms active in the last 24 h" stays (the SQL field is
  kept for compatibility). Room links and summaries of deleted rooms answer "room not found".

## Files

- Engine: `app/engine/engine.ts` (`isGameUnderway`, Kick rules, Join keeps/restores seats),
  `actions.ts` (`isAdminAction`), `index.ts`.
- Routes: `app/routes/room.$roomId.player.tsx` (kick checks, leave/kick via the service role),
  `room.$roomName.tsx` (TransferPlayer via the service role), `admin.rooms.tsx` (cleanup
  action), `admin._index.tsx` (7-day tile removed).
- Models: `app/models/room-cleanup.js` (new), `admin.server.ts` (`countInactiveRooms`,
  `deleteInactiveRooms`), `room-event.server.ts` (doc), `my-rooms.ts` (doc),
  `database.types.ts`.
- UI: `app/components/player/player.tsx` (`isAdmin`, kick rule), `game.tsx`.
- i18n: `room.error.kick*` in `app/i18n/{en,uk}/room.ts`, `admin.rooms.cleanup*` in
  `app/i18n/{en,uk}/admin.ts`.
- `scripts/cleanup-inactive-rooms.mjs` (new), migrations above, `playwright.config.ts`.

## Verification

- Engine `app/engine/engine-seats.test.ts` (table-driven): `isGameUnderway` (preview, board,
  question open, after a question, later round, game over); player kicks before / during /
  with a question open; admin kick before (removed), during (left with points), with a
  question open (ignored), last player, unknown player, malformed flag; rejoin after leaving
  and after an admin kick (score back), Join for a seated player doesn't reset, someone
  else's Join doesn't touch a seat, pre-game kicked player starts from scratch; color / avatar
  / team restored with the new name; no join after game over; old kick events replay
  unchanged. All existing engine tests still pass.
- Route `app/routes/room.$roomId.player.test.ts`: pre-game kick on the preview and the board
  (service-role insert), 403 while a question is open / once underway (EN and UK text),
  403 for a non-player, admin kick during the game tagged `admin: true`, admin 409 with a
  question open, leave via the service role without a replay, join still a normal insert
  (403 for someone else's id), solo returns the action.
- Model `app/models/room-cleanup.test.ts` (fake client): arguments, dry run, other hours,
  refused hours, database error, odd results.
- Component `app/components/player/kick-player.test.tsx`: kick buttons before / during the
  game, Leave still offered, admin playing / watching, Ukrainian.
- E2E `e2e/seat-lock-room.spec.ts` (`db` project): three players; a pre-game kick works;
  after one question players have no kick buttons and the route answers 403; the admin
  watching kicks the host from the tile menu, the host sees the join dialog, rejoins and has
  $200 again; the stored kicks (one plain, one `admin: true`). RLS: the anon key can't insert
  `kick` / `leave` / `transfer_player` / `set_settings` (42501) but still inserts `join`.
  Cleanup: rooms created via the service role — idle (event 6 h old), old without events,
  old with a recent event, fresh — the anon key can't call the function; the admin page counts,
  confirms and deletes: only the active and fresh rooms remain, the idle room's events are
  gone; Ukrainian button text.
- Script run against the local stack: `varlock run -- node scripts/cleanup-inactive-rooms.mjs
--dry-run` → "would delete 0 room(s) inactive for 5 h".

### Manual test script

1. Open a room on a laptop and a phone, join with both (not logged in as admin). Before
   picking a question, tap the phone player's tile on the laptop → **Kick player** works.
2. Join again with the phone, start the round, play one question. Tap the other player's
   tile: no **Kick player** (your own tile still offers **Leave game**).
3. On the phone tap your own tile → **Leave game**, then **Join game** again: your score is
   back, same color and avatar.
4. Lock the phone for a minute and unlock: still in the game, nothing changed.
5. On a third device log in at `/admin`, open the room link, **Just watch**: every tile has
   **Kick player** between questions. Kick the phone player: the phone shows the join dialog;
   join → the score is back.
6. Admin → **Rooms** → **Delete rooms inactive for 5 h now**: the confirmation shows how many
   rooms; confirm → "Deleted N inactive rooms." Switch to УКР and check the texts.
7. On the server: `varlock run -- node scripts/cleanup-inactive-rooms.mjs --dry-run`.
