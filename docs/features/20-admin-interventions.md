# Feature 20 — Admin controls & interventions

**Branch:** `feat/admin-interventions`
**Status:** ✅ implemented & tested
**Migration:** `20261026180715_room_events_server_only.sql` (the `room_events` insert policy
rejects every insert from the browser key; no data or schema change)
**New dependencies:** none

## Goal

The game has no host: players choose, buzz and mark their own answers, and the owner likes
it that way. But when a player steps away or loses their connection the game can get stuck
waiting for them. The owner asked (verbatim): "Admin Controls & Interventions: Allow the
admin to: (1) Force-skip questions if necessary. (2) Answer on behalf of a player ("вибрати
замість когось"). (3) Manually adjust/change players' scores at any time ("міняти очки")."
For (2) the owner chose **any stuck step**: whatever the game is waiting on from a player.

"Admin" is the site admin of feature 18: a visitor with a valid admin session (log in at
`/admin` on the same device, then open or reload the room). The admin may play in the room
or just watch.

Part of the same change, as a security hardening: **every room event is now inserted by the
server**; the browser key can't write to `room_events` at all.

## How to use it

1. Log in at `/admin`, open the room. If you don't play, choose **Just watch**.
2. Tap the round **🛡** button (bottom right; above the BUZZ bar while a question is open,
   above the spectator bar while watching). The **Admin controls** sheet opens (a bottom
   sheet on phones, a side panel on wider screens). Players never see the button.
3. **Right now** says what the game waits for and offers that step for the player:

   | The game waits for…                     | The admin can                                                                |
   | --------------------------------------- | ---------------------------------------------------------------------------- |
   | Ann to start the round                  | **Start the round for Ann**                                                  |
   | Ann to choose a question                | **Choose a question for Ann** — a list of the unplayed questions by category |
   | wagers (Double Down / Final)            | **Wager for Ann** — amount (with the allowed range) → **Place wager**        |
   | Ann to give the cat in the bag away     | **Give the cat in the bag (for Ann) to:** one button per player              |
   | players to buzz in or pass              | per player: **Buzz in for Bob** / **Bob passes**                             |
   | Final answers                           | **Answer for Bob** — what they said (may be empty) → **Submit answer**       |
   | Ann to mark her answer                  | **Right** / **Wrong**                                                        |
   | Ann to pick an option (multiple choice) | **Pick an option for Ann:** A. … B. … (the server decides if it's right)     |
   | Final answers to be marked              | per player: **Right** / **Wrong**                                            |
   | Ann to go back to the board             | **Back to the board for Ann**                                                |
   | nobody could wager on the Final         | **Show the answer**                                                          |

4. **Question:** while a question is open (until its answer is shown to everyone) —
   **⏭ Skip this question** → "Skip this question?" → **Yes, skip**. Everyone sees the answer
   with "The admin skipped this question.", nobody gets or loses points for the skip, the
   question counts as played and the board-control player goes back to the board as usual
   (or the admin does it for them). On the board instead: **Skip a question on the board** —
   tap one of the unplayed questions: it is marked as played without opening it.
5. **Scores:** every player's score with an amount field (100 by default): **+ Add**,
   **− Subtract**, **= Set** (the score becomes the amount). Works any time before game over,
   also during a question. Everyone sees a toast "🛡 Admin: Ann +$500", the tiles, the
   standings and the team totals update.
6. Everything is in English and Ukrainian (Керування адміністратора, Пропустити це питання,
   Обрати питання за гравця Ann, Додати / Відняти / Встановити, …) and follows the Classic /
   Dark theme.

Errors the server may answer (EN / UK): "only the admin can do this" / "це може зробити лише
адміністратор"; "this question can't be skipped now"; "this player is not in the game";
"the wager must be from $5 to $1,000".

## Design decisions

### Part 0 — every room event from the server

- **Checked first:** the browser never inserted into `room_events` itself (grep: the only
  writes are in `app/models/room-event.server.ts`; the client only reads — the realtime
  subscription and catch-up fetches in `use-game-engine.ts`). Every room action already went
  through a route `app/routes/room.$roomId.*.tsx`.
- **One write path:** `createRoomEvent` (browser key / the user's token) is gone; every route
  calls `createRoomEventAsServer` (service role) after its existing checks, which bind the
  action to the session user (`requireSessionUserId`) or the admin. Routes without a user
  (pause, clock) behave as before (any visitor of the room may send them through the route).
- **Migration** `20261026180715_room_events_server_only.sql`:
  `alter policy "Enable insert for all users" on public.room_events with check (false)` —
  every insert from anon/authenticated is rejected (42501), whatever the type. The select
  policy and the realtime publication are unchanged; realtime delivers service-role inserts
  because it checks the _subscriber's_ select policy (as it already did for `set_settings`,
  `kick`, …). Additive: no data change, old events replay as before. This closes forged
  `join` / `change_name` / `buzz` / `check` / `answer` / … events for any userId, and of
  course forged admin events.
- **Hardening found on the way:** the engine rejects a wager outside the allowed range by
  _throwing_, which would break replaying the room for everyone. The wager route now checks
  the range against the replayed state (400 "the wager must be from … to …") before inserting.
  `getWagerRange` is shared by the engine, the route and the admin panel.

### Engine

- **Skip** — new `skip_clue` event `{ i, j, admin: true }` (only the server inserts it, only
  for the admin; without the flag, or malformed, it is ignored — never thrown, so a bad event
  can't break a room). Accepted for the open question in every state before its answer is
  shown to everyone (`OPEN_QUESTION_STATES`: wager, cat-in-the-bag hand-over, reading /
  buzzing, the buzz winner answering, Final answers, Final checks) and for an unplayed,
  playable question on the board (`canSkipClue`, shared with the route). The question is
  marked played (`isAnswered`, answer order, `numAnswered`) with `skipped: true`:
  - open question → `RevealAnswerToAll` (answer to everyone; the answer timer is cleared);
    then everything is exactly as after a normal finished question (the board-control
    player's "Back to board", round end, game over). **Board control stays** (also for the
    Final, where a normal end would give it to the leader — irrelevant after the last
    question).
  - board question → stays on the board; when it was the round's last question the round ends
    right away (next round's preview with the usual lowest-score board control, or game over)
    — the round-end logic of NextClue moved into `finishBoard` and is shared.
  - **"Nobody's score changes for it"** means the skip itself: points already won or lost on
    that question stay (a wrong answer before someone else could buzz, Final answers already
    checked). They happened; the admin can still change scores, and a wrong answer remains
    correctable with Undo.
- **Act for a player** — no new actions. The admin sends the player's own action (start,
  choose, wager, pass, buzz, answer, check, next) through that action's own route with
  `admin=true`. `authorizeRoomActor` (`app/admin/room-actor.server.ts`): with `admin=true` a
  valid admin session is required (403 otherwise) and the userId may be any player (the admin
  needn't play); without it the userId must be the visitor's own, as before. The event gets
  `admin: true` (for the record — the engine reads nothing from it). The engine applies it
  **exactly** as if the player had done it, with all the game rules: only the board-control
  player's turn can be acted on, only the buzz winner's answer can be marked, a multiple choice
  pick is judged from the game data (the check route decides correctness on the server, the
  engine re-checks it), etc. Table-driven tests compare the state after the player's action and
  after the same action tagged by the admin, for allowed and refused cases.
- **What the game waits for** — `getAdminStep(state)` (`app/engine/admin.ts`, unit-tested
  per state) names the stuck step and the player(s) for the panel. Where any player may act
  (Final), the board-control player (else the first player) is used.
- **Buzz "pass"** — a player who closed their tab never sends the 5-second "no buzz", so the
  buzzers would stay open forever. The admin can send it for them (**Bob passes**, the same
  timeout buzz the player's device sends) or buzz in for them (Δ 0 ms; a faster real buzz still
  wins).
- **Scores** — new `adjust_score` event `{ userId, delta | score, admin: true }` (exactly one
  of them; whole numbers up to ±1,000,000; otherwise ignored). `score` sets an exact value and
  is stored in the state as the difference. Allowed any time **before game over** (final
  results stay final; the room page redirects to the summary at game over anyway), also during
  a question (it doesn't touch the flow: board control, buzzes, the answer turn stay), for a
  player in the game or one who left (their points still count for their team and the
  summary). A change of nothing is not recorded.
- **Standings delta** — the standings show each player's change "on the previous question".
  An admin change is recorded with the question it belongs to (`scoreAdjustments` in the
  state: the open question, else the most recently finished one, else none) and is added to
  that question's change, so `score − change` is still the score before it. Before any
  question it shows on its own; once the next question is scored the delta starts from zero
  again. The TV flashes it like a question's changes (`scoreChangesKey` includes it). Team
  totals are sums of player scores, so they follow. The summary chart moves the player's latest
  point (same rule).
- **Replay** — old events are untouched: nothing existing changed meaning; the new event types
  only exist with the admin flag. Solo play has no admin (the admin route answers 400 for room
  −1; act-for-player routes return the plain action for solo and ignore the flag); saved solo
  states get an empty `scoreAdjustments`.

### Routes

- `POST /room/:roomId/admin` (new) — `intent=skip` (`i`, `j`) or `intent=score` (`userId`,
  `op` = add / subtract / set, `amount`). The admin session is checked **first** (403 before
  anything else); then the state is replayed: game over → 409; a skip that isn't allowed now
  (the question moved on, another question, preview) → 409 with a message; an unknown player →
  409; a bad amount → 400. Races (the admin clicks just as a player acts) answer with an error
  message instead of throwing, so the panel shows it and the page doesn't break.
- Act-for-player — the eight existing routes (`start`, `choose-clue`, `wager`, `pass-clue`,
  `buzz`, `answer`, `check`, `next-clue`) accept `admin=true` as above.
- No CSRF token, like the settings route: the admin session cookie is `SameSite=Lax` (no
  cross-site POST carries it) and the room page must not learn anything about the session.

### UI

- `AdminControls` (`app/components/admin-room/admin-panel.tsx`) is rendered by
  `GameComponent` only when the room loader's `isAdmin` is true (and not in solo play), so
  the server and browser render the same thing; the sheet's content only renders when opened
  (portal) — no hydration risk. The 🛡 button is fixed bottom right, positioned like the
  soundboard's 🎺 (left) so it stays reachable over an open question on phones. The sheet
  ignores focus moving to the question behind it (its buttons autofocus as steps change), and
  Enter inside it doesn't reach the buzzer key listener.
- Each step uses a fetcher per form; the skip asks for a confirmation (client state, after
  hydration). Wager and amount fields are number inputs with the allowed range.
- `AdminToasts` (everyone in the room, also players): "🛡 Admin: Ann +$500" for each score
  change and "The admin skipped a question." for each skip that arrives while the page is
  open (nothing is announced for what happened before the page loaded; nothing renders on the
  server). The reveal of a skipped question says "The admin skipped this question.".
- Theme: the same palette as the standings sheet (`bg-blue-1000`, white / slate text, red /
  green action buttons), which both themes map.
- **Not on the TV page** (`/room/:name/present`): it has no controls by design; it shows the
  results (answer reveal, standings flash) like any other change.

## Files

- Migration `supabase/migrations/20261026180715_room_events_server_only.sql`.
- Engine: `app/engine/engine.ts` (`SkipClue`, `AdjustScore`, `finishBoard`, `getWagerRange`),
  `actions.ts` (`isSkipClueAction`, `isAdjustScoreAction`, `MAX_ADMIN_SCORE`), `skip.ts`
  (`canSkipClue`, `OPEN_QUESTION_STATES`), `admin.ts` (`getAdminStep`, `canSkipOpenClue`),
  `state.ts` (`ClueAnswer.skipped`, `scoreAdjustments`, `getLastFinishedQuestion`),
  `standings.ts`, `use-game-engine.ts` / `use-engine-context.ts` (`adminStep`,
  `canSkipOpenClue`, `scoreAdjustments`, `numSkipped`, `activeClueSkipped`), `index.ts`.
- Server: `app/models/room-event.server.ts` (only `createRoomEventAsServer`),
  `app/models/room-state.server.ts` (replay helper), `app/admin/room-actor.server.ts`,
  routes `room.$roomId.admin.tsx` (new) and every `room.$roomId.*.tsx` that inserts events.
- UI: `app/components/admin-room/` (`admin-panel.tsx`, `admin-toasts.tsx`), `game.tsx`,
  `prompt/next-clue-form.tsx`; summary chart `room.$roomName_.summary/chart.tsx`;
  `app/utils/offline-storage.ts`.
- i18n: `room.admin.*`, `room.error.admin*`, `room.error.wagerRange`, `play.next.skipped` in
  `app/i18n/{en,uk}/{room,play}.ts`.
- Tests: `app/engine/engine-admin.test.ts`, `app/routes/room.admin-interventions.test.ts`,
  `app/components/admin-room/admin-panel.test.tsx`, chart test, updated route tests,
  `e2e/admin-interventions-room.spec.ts`, `e2e/seat-lock-room.spec.ts` (RLS),
  `e2e/admin-timer-room.spec.ts`, `playwright.config.ts`.

## Verification

- Engine (`engine-admin.test.ts`, table-driven): skip in every open state (reading, buzz
  winner answering, after a wrong answer, Double Down while wagering and after the wager,
  Final wagering / answering / checking, cat in the bag handed over and answered), back to the
  board with board control kept, round end and game over (also from the board), ignored
  without / with a malformed flag, for another question, a played one, after the reveal, on the
  preview, outside the board, after game over, malformed payloads not thrown, the answer turn
  cleared, replay from room events, a wrong answer still correctable after the skip; score
  add / subtract / set (stored as the difference) on the preview, the board and during a
  question without changing the flow, for a player who left, ignored without the flag / for
  an unknown player / both or neither amount / non-whole or huge amounts / zero / after game
  over, next round's board control, team totals; standings deltas before any question, after a
  question, during one, reset by the next question; acting for a player = the player's own
  action for start, choose, buzz pass, check, next, wager, Final answer, cat in the bag,
  multiple choice (forged "correct" judged wrong) and refused for the wrong player; solo play
  unchanged; `getAdminStep` for every state and `canSkipClue`.
- Routes (`room.admin-interventions.test.ts`): each of the eight act-for-player routes — the
  admin (not a player) acts for a player (`admin: true` stored, service role), 403 without an
  admin session, 403 without the flag for someone else, solo ignores the flag; the wager range
  check; the admin route — 403 before anything else for non-admins, skip open / board
  question, 409 for skips not allowed now, score add / subtract / set, nothing stored for no
  change, 409 unknown player, 400 bad amounts / intent, 409 after game over, 400 in solo. The
  existing route tests now expect the service-role insert.
- Components (`admin-panel.test.tsx`): no 🛡 for non-admins; the watching admin chooses a
  question for the board-control player, marks the buzz winner right, picks a multiple choice
  option, passes on the buzzer for a player, hands over the cat in the bag, skips (with the
  confirmation) the open question and a board question, changes a score — each checked against
  the request sent; everyone gets the toast; Ukrainian.
- E2E (`admin-interventions-room.spec.ts`, `db` project): two players + the admin watching —
  players have no 🛡 and the admin route answers 403; the admin gives the host +$500 (both
  players get the toast and see $500); the host opens a question and the guest buzzes in, the admin skips it (the
  guest sees "The admin skipped this question.", scores unchanged, back to the board); the
  guest buzzes in and closes the tab, the admin marks it right for them (+$200) and goes back to
  the board for them; the guest (board control, gone) — the admin chooses the next question for
  them and it opens for the host; the stored events are tagged `admin: true`. Ukrainian sheet.
  RLS (`seat-lock-room.spec.ts`): the anon key can't insert any of the 21 event types (42501),
  nothing is stored; `admin-timer-room.spec.ts` updated the same way.
- `jep-validate` green.

### Manual test script

1. Laptop: log in at `/admin`. Phone A and phone B: open the same room and join; start the
   round on phone A.
2. Laptop: open the room → **Just watch** → 🛡. "Waiting for A to choose a question." Under
   **Scores** type 500 for B → **+ Add**: both phones show "🛡 Admin: B +$500" and $500.
3. Phone A opens a question. Laptop: **⏭ Skip this question** → **Yes, skip**: both phones show
   the answer and "The admin skipped this question.", then the board (no score change).
4. Phone A opens another question; phone B buzzes in, then lock phone B. Laptop: "Waiting for
   B to mark their answer." → **Right** → B +$200 → **Back to the board for B** →
   "Waiting for B to choose a question." → pick a question: it opens on phone A.
5. On the board: **Skip a question on the board** → tap one: it disappears from the board.
6. Switch the laptop to УКР: the sheet is in Ukrainian. Switch to the Dark theme: it still
   looks right. Try it on a phone too (bottom sheet).
7. Phones never show 🛡.
