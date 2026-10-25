# Feature 13 — Team mode

**Branch:** `feat/teams`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** none

## Goal

Friends can play in teams (e.g. couples vs couples) without changing how a question is
played: buzzing, self-marking, wagers, cat in the bag and multiple choice all stay per
player. A team's score is simply the sum of its players' scores.

## How to use it

1. **Join dialog:** under the avatar picker, **Play in a team (optional)** shows big chips
   for the four teams — **Red team / Червоні**, **Blue team / Сині**, **Green team / Зелені**,
   **Yellow team / Жовті** — with how many players are on each, plus **No team**. Pick one
   (or leave **No team**) and **Join game**.
2. **Your own tile:** a team pill under your name (swatch + team name, or "No team") opens
   **Choose your team**: the same chips, plus a **Team name** field for your current team
   (placeholder = the default name; **Save**; a blank name restores the default).
   Team changes are only possible between questions (the chips are disabled with
   "Teams can be changed between questions." while a question is open); renaming works any
   time before the game ends.
3. **Scoreboard:** as soon as anyone has a team, the player tiles are grouped under team
   headers (color swatch, name, total), the team with the highest total first, then a
   **No team** group for solo players. Your own tile leads its group. Each tile in a team
   gets a stripe in the team color. Still 2 tiles per row on phones.
4. **TV (`/room/:roomName/present`):** big team totals (name + score, color bar) above the
   player list; at game over "🏆 Winning team: Foxes" (or "It's a tie between …") above the
   individual winner.
5. **Summary:** above the individual results, "🏆 Winning team: …" and a **Team standings**
   list (rank, color, name, total, players — leavers marked "(left)").
6. **Rooms in progress:** rooms that play in teams list the team names and totals above the
   players.

## Design decisions

- **Two new room events** following the existing pattern:
  - `set_team` `{ userId, team: "red" | "blue" | "green" | "yellow" | null }` — route
    `POST /room/:roomId/team` (form `team=""` means no team).
  - `rename_team` `{ userId, team, name }` — route `POST /room/:roomId/team-name`.
  - Both use `requireSessionUserId` (you can only change **your own** team / rename the team
    **you are on**), replay the room server-side for clear errors (403 not in game / not on
    that team, 409 question open or game over, 400 bad team / name too long), and return the
    Action for solo play (roomId −1). The engine re-validates everything on replay.
  - The join dialog's pick travels in the existing **Join** payload (`team`, optional), so
    joining a team is one event. Unknown teams in Join are dropped on replay (like invalid
    avatars), not fatal.
- **State:** `Player.team?: TeamId` and `State.teamNames: Map<TeamId, string>` (custom
  names only; default names are translated in the UI). Old events and old saved solo
  states (no `teamNames`) keep working.
- **Fixed teams, not user-created:** 4 teams with fixed colors keep the UI simple
  (tappable chips, no "create team" flow) and are enough for a living room.
- **Team names:** whitespace collapsed and trimmed, max 24 characters (code points; the
  input caps UTF-16 units at 24), blank resets to default. Only current members can rename.
  A team's custom name is forgotten once nobody is (or was) on it, so a team started later
  gets the default name again.
- **When teams can change:** `set_team` is ignored while a question is open
  (`activeClue !== null`, same rule as pause) and after game over — regrouping the
  scoreboard mid-question would be confusing. Allowed in the lobby, on the board, during
  pause and in the round preview. `rename_team` only affects a label, so it is allowed any
  time before game over.
- **Scoring:** unchanged and per player. Team total = sum of the current members' scores
  **plus players who left the game while on that team** (their points were earned for the
  team, and leaving must not erase a team's points or dump negative ones). Points move with
  the player: switching teams between questions takes your score along (it's a friendly
  game; we chose transparency over locking teams). Solo players (no team) are not part of
  the team standings; they still appear individually and can still be the individual
  winner.
- **Kick** deletes the player (only possible before anyone scored), so they no longer count.
- **Board control, round transitions, the final** — untouched; all per player.
- **Replay / score chart** stay per player (the chart and replay board show players; team
  totals are a straight sum and are shown in the standings above).

## Files

- `app/models/team.ts` — team ids, colors, name validation.
- `app/engine/teams.ts` — `isTeamMode`, `getTeamStandings`, `getWinningTeams`,
  `countTeamMembers`.
- `app/engine/{engine,actions,state,use-game-engine,use-engine-context}.ts` — new actions,
  state, context fields (`leftPlayers`, `teamNames`).
- `app/routes/room.$roomId.team.tsx`, `room.$roomId.team-name.tsx`, `room.$roomId.player.tsx`
  (team in Join).
- `app/components/team/team.tsx` (picker, pill, header, dialog), `team-standings.tsx`
  (summary).
- `app/components/player/{player,edit-player}.tsx`, `preview/preview.tsx`,
  `watch/presenter.tsx`, `active-rooms.tsx`, `models/active-rooms.ts`,
  `routes/room.$roomName_.summary/route.tsx`, `utils/offline-storage.ts`.
- i18n: new area `app/i18n/{en,uk}/team.ts`, error strings in `room.ts`.

## Verification

- Engine: `app/engine/engine-teams.test.ts` (table-driven set/clear/switch/rename,
  validation incl. too long / emoji length / unknown team, forgotten names, kick/leave,
  blocked while a question is open and after game over, rename during a question,
  pause, TransferPlayer, replay from room events, standings incl. leavers, ties).
- Routes: `app/routes/room.$roomId.team.test.ts` (own team, can't set someone else's team,
  not in game, question open, bad team, rename own/other team, too long, solo).
- Components: `app/components/team/team.test.tsx` (grouped scoreboard order and totals,
  custom + Ukrainian names, team dialog posts the pick and locks during a question,
  presenter totals and Ukrainian winning team, summary winner/standings/tie in Ukrainian).
- Rooms list: `app/models/active-rooms.test.ts`.
- E2E: `e2e/teams-room.spec.ts` — two players join different teams in the join dialog,
  the host renames their team, scores; totals update on the other player, the TV and the
  summary (winning team); second test: grouped order on both clients and switching teams
  between questions.

### Manual test script

1. Open a game in a room on a laptop; in the join dialog pick **Red team** and join.
2. On a phone open the room link; the join dialog shows "Red team · 1 player"; pick
   **Blue team** and join.
3. Open ⓘ → **Show on TV** on a third screen: team totals are listed above the players.
4. On the laptop tap the team pill on your tile → type "Foxes" → **Save**: the phone and TV
   show "Foxes".
5. Start the round, play a question correctly on the laptop: the scoreboard groups "Foxes
   $200" first on both devices and the TV.
6. Open a question and tap your team pill: the chips are disabled. Go back to the board and
   switch the phone to **Red/Foxes**: both totals regroup.
7. Finish the game: the summary says "🏆 Winning team: Foxes" with team standings; the TV
   shows the winning team. Switch to УКР: "Перемогла команда: …", "Червоні", "Сині".
