# Feature 17 — Live standings + resume my games (F12d)

**Branch:** `feat/standings-resume`
**Status:** ✅ implemented & tested
**Migration:** `20261026021235_user_rooms_in_progress.sql` (additive: one partial index on
`room_events`, one read-only SQL function)
**New dependencies:** none

## Goal

1. **Live standings:** at any moment in a room, see who is winning: the ranked list of
   players (and teams), their scores and what the previous question gave or took.
2. **Resume my games:** a player who closed the tab (or switched device to the same browser
   later) finds their unfinished rooms on the home page and gets back in with one tap.

## How to use it

### Standings

1. In a room, tap **🏆 Standings** in the control row under the board (next to the answer
   timer / Pause / clock; on phones just 🏆). Players and spectators have it; solo games too.
   It never covers the BUZZ button or the 🎺 soundboard button.
2. A drawer opens — a bottom sheet on phones, a side panel on wider screens — with:
   - **Teams** (team mode only), on top: place, team name, members, total, change;
   - **Players**: place (ties share it, shown as `=1`), avatar, name, "(you)", team, score,
     the **change on the previous question** (`+$400` green, `−$200` red, `—` none) and
     **Picks next** for the player with board control (highlighted like on the tiles).
3. It updates live while open. Close it with **Esc**, the ✕ button or a tap on the backdrop.
4. **TV page** (`/room/:roomName/present`): after each question the changes appear next to
   the players' scores (and team totals) for 6 seconds.
5. Ukrainian: **Рахунок**, «1 місце», «нарівно», «Обирає питання», «+$200 за попереднє
   питання».

### Your games in progress

1. On the home page, **Your games in progress** (Ukrainian: **Ваші незакінчені ігри**) appears
   above the search when you are a player in at least one unfinished room that was active
   in the last 7 days.
2. Each card: game title, room name, last activity ("active 5 min ago", "3 days ago"),
   players (small squares with emoji / initial), **your score** and **place** ("#2 of 4"),
   **Continue ▶**. Newest activity first, at most 6.
3. Tap a card → you are back in the room as a player (no join dialog; it is your own player).

## Design decisions

### "Previous question" and the change

The change shown for a player is **what the previous question did to their score**, so
`score − change` is their score before that question. "The previous question" is
(`getLastScoredClue` in `app/engine/standings.ts`):

- the **open question as soon as someone was checked on it** — e.g. Ann answered wrong
  (−$200) and the buzzers reopened; or Final answers being checked one by one. This way the
  change always explains the score you see;
- otherwise the **last finished question** (highest `answerOrder`, any round). Choosing the
  next question doesn't reset it; it stays until that question changes a score.

It is computed from the state alone, not by replaying events: each finished question keeps
who was checked right/wrong (`answeredBy`), and the value per player comes from
`getClueValueForRound` (the wager on wagerable questions — including the −wager for a
timeout —, the secret value on secret questions, the clue value otherwise). Check
corrections rewrite `answeredBy`, and guest→account transfers move it, so both are
reflected. Players the question didn't touch have no entry (shown as `—`).

### Ranking

`rankByScore`: standard competition ranking ("1224") — ties share a place, the next place
skips; ties keep the join order. Players who **left** are not listed as players (they are
not in the room) but their points and changes still count for the team they were on, as
on the scoreboard and summary (`getTeamStandings`). Teams are ranked the same way.

### UI

- A drawer (Radix Dialog: focus trap, Esc, backdrop, `role="dialog"` with a title and a
  description) rather than a permanent panel: the room's scoreboard is already on screen;
  the drawer is the compact, sorted answer to "who's winning and what just happened".
- The control row now wraps (`flex-wrap`) so the extra button never pushes anything off a
  390 px screen.
- Room surfaces are dark in every theme, so the drawer uses the game tokens
  (`bg-blue-1000`, `text-slate-*`) and looks right in Classic and Dark; the home page cards
  are light site UI and use `ink-*` / `paper` / `accent` tokens.
- Enter inside the drawer doesn't reach the prompt's "Enter buzzes" listener.
- The TV flash (`useRecentScoreChanges`) only reacts to changes **after** the page loaded,
  and renders nothing on the server (hydration-safe). It keys on
  `scoreChangesKey` (question + changes), so a correction re-flashes.

### Resume: query

Rooms have no owner/created column; membership lives in `room_events` (`join` payloads
carry `userId`). The migration adds:

```sql
create index if not exists room_events_join_user_id_idx
  on public.room_events ((payload ->> 'userId'))
  where type = 'join';
```

- **Partial** (only `join` rows, a small fraction of all events) and on the expression
  used by the lookup. A plain `create index` (not `concurrently`, which can't run in the
  migration's transaction) briefly blocks writes to `room_events` while it is built; with
  our table size that is well under a second, so it is fine to apply live.
- `public.user_rooms_in_progress(user_ids text[], since timestamp, max_count int)` —
  `SECURITY INVOKER`, `stable`, returns `room_id, room_name, game_id, last_activity` for
  rooms one of the ids joined with any event since `since`, newest first, capped (≤ 50; at
  most 4 ids are used). The literal `type = 'join'` inside the function lets the planner
  use the partial index (checked with `EXPLAIN`: index scan on
  `room_events_join_user_id_idx`).
- The server (`getMyRoomsInProgress`, `app/models/my-rooms.server.ts`) asks for 12
  candidates from the last 7 days, loads each game once and replays each room
  (`summarizeMyRoom`, sharing `summarizePlayers` with the rooms-in-progress list) to drop
  **finished games**, rooms the user **left or was removed from**, games they can't open
  (private games of someone else), and unreplayable rooms; then keeps 6. Only on the first
  page of the home loader (infinite scroll pages skip it).
- If the function is missing (migration not applied yet) or anything fails, the section is
  simply empty: the home page never fails because of it.

### Resume: who is "me"

The same ids the room loader uses: the **account id** when logged in and the **guest id**
from the session cookie (`getUserSession`, never created on the home page). Both are passed
(account first).

- **Guest → account (TransferPlayer):** a guest who joined rooms and then logged in on the
  same browser still has the guest cookie, so those rooms are found by the guest id and
  listed; when they open one, the room loader transfers the guest player to the account
  (existing behaviour) and from then on it is found by the account id.
- **Covered:** rooms joined as a guest on this browser (logged in or not), rooms joined
  with the account (on any browser, once logged in).
- **Not covered:** rooms joined as a guest on _another_ browser/device (that guest id is
  unknown here); a guest who cleared cookies.

### Privacy

- Ids come only from the user's own session (cookie / auth session), never from the request,
  so nobody can list another person's rooms through the page.
- The cards show only what the room itself shows anyone with the link (game title, room
  name, player names/emoji, scores); photo avatars are left out as in the rooms list.
- `room_events` and `rooms` are already readable by everyone (RLS `select using (true)`), so
  the new function (security invoker) exposes nothing that wasn't readable before; it only
  makes the lookup cheap.

## Files

- `app/engine/standings.ts` (+ test) — `getLastScoredClue`, `getScoreChanges`,
  `rankByScore`, `getStandings`, `scoreChangesKey`.
- `app/engine/use-game-engine.ts`, `use-engine-context.ts` — `scoreChanges`,
  `scoreChangesKey` in the engine context; `state.ts` — `getClueValueForRound` takes a
  `Pick` of the state.
- `app/components/standings/standings.tsx` (+ test) — `StandingsButton` (drawer),
  `StandingsList`, `ScoreChange`; `use-recent-score-changes.ts` — TV flash.
- `app/components/game.tsx` — the button in the control row; `player/player.tsx` —
  optional `scoreChange` on a tile; `watch/presenter.tsx` — chips on the TV.
- `app/models/my-rooms.ts` (+ test), `my-rooms.server.ts` (+ test with a fake Supabase
  client), `active-rooms.ts` (`summarizePlayers`, days in `formatTimeAgo`),
  `components/my-rooms.tsx` (+ test), `components/active-rooms.tsx` (exports `PlayerList`),
  `routes/_index/route.tsx`.
- `app/i18n/{en,uk}/standings.ts` (new area), `{en,uk}/home.ts`.
- `supabase/migrations/20261026021235_user_rooms_in_progress.sql`,
  `app/models/database.types.ts`.

## Verification

- Unit: `app/engine/standings.test.ts` — changes after right / wrong / wager / secret /
  Final answers, the open question once checked, unchanged while the next question is
  open, check corrections, ties (`1224`), all-negative scores, board control, teams with
  totals and a leaver who counts for the team only. `app/models/my-rooms.test.ts` — score
  and place, left / never joined / finished / unreplayable rooms, guest id for a user who
  logged in (before and after the transfer), "N days ago" in EN/UK.
  `app/models/my-rooms.server.test.ts` (fake client) — rpc arguments (deduplicated own ids,
  7 days, candidate cap), the user's token and account for private games, no query without
  ids, finished / left / unopenable rooms dropped, each game loaded once, at most 6, empty
  list on a database error. Component tests: `standings.test.tsx` (ranked list, `+$200` /
  `−$200`, tied places, Picks next, teams on top, Esc closes, EN and UK in Classic and Dark
  without missing keys, the TV flash shows only new changes and hides after 6 s),
  `my-rooms.test.tsx` (EN/UK, both themes).
- E2E `e2e/standings-resume.spec.ts`: (1) two players, the host answers a question; the
  guest opens Standings and sees the host first with `+$200` and Picks next, themselves 2nd
  with `$0`; Esc closes. (2) a guest joins room A, then plays room B (one-question game) to
  the end; on the home page only room A is under "Your games in progress"; tapping it lands
  in room A as a player (Start round, no Join).
- Screenshots (390×800 and 1280×800, Classic and Dark) of the room, the open drawer and the
  home section were looked at.
