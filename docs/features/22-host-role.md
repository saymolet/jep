# Feature 22 — Host role (SIGame "showman")

**Branch:** `feat/host-role`
**Status:** 🚧 in progress (plan below)
**Migration:** none planned (new event types only; `room_events` inserts are already server-only)
**New dependencies:** none

## Goal

Owner (verbatim): "We need to rework the answer system. Now it needs to have a host role which
will see the answer constantly. So people won't see the right answer when answering incorrect.
It needs to mimic the host role in Vladimir Khil's SIGame game."

SIGame's showman (ведучий) doesn't play, sees the right answer all the time, judges the
players' spoken answers and controls the flow. The owner decided:

- **The host seat is claimed**: in the lobby anyone who is not playing can take the free
  "Host" seat; the site admin can always take it over or give it to someone.
- **Players answer out loud** (voice call / same room); the host taps Right / Wrong.
- **Both modes stay**: host mode while someone holds the host seat, otherwise the current
  self-marking game, unchanged.
- **Multiple choice stays automatic** (the server judges the pick); the host just sees it.

## Plan

### State and events (engine)

- `State.host: { userId, name, avatar? } | null` — not a player: no score, can't buzz, not in
  standings / teams. `State.revealed: Map<"round,i,j", { answer, answerMedia? }>` — answers
  revealed by `reveal_answer` events.
- New events (all inserted by the server after the route's checks; the engine re-validates):
  - `claim_host { userId, name, avatar? }` — a visitor who is not a player takes the **free**
    seat. Accepted between questions (no question open) any time before game over.
  - `release_host { userId, admin?|host? }` — the host (or the admin) frees the seat, between
    questions only. The room **falls back to self-marking** from the next question on.
  - `assign_host { userId, name, avatar?, admin: true }` — admin only: give the seat to a
    visitor (or themselves). Replacing a host is allowed any time (host mode doesn't change);
    filling an empty seat only between questions (the mode changes only between questions).
  - `reveal_answer { round, i, j, answer, answerMedia? }` — the answer of a question that was
    resolved in host mode (see "Answers withheld").
- Seat rules: the host can't `join` as a player; a player can't take the host seat; while
  the seat is taken only the admin can replace the host (seat lock as for players). A
  disconnect changes nothing.
- **Mode changes only between questions** — this keeps everything about an open question
  consistent (who may judge, the buzz tiebreak seed, what is withheld).

### Host-mode rules (engine, only while `state.host` is set)

- `check` (non multiple-choice, and every timed-out check) is accepted only with
  `host: true` (the host judged) or `admin: true`; a player's own check is ignored. Right →
  +value, board control, answer revealed; Wrong → −value, lockout, buzzers reopen; nobody left →
  revealed (the existing transitions).
- Multiple choice: the buzz winner picks as today; the server computes `correct` and in host
  mode the engine **trusts the payload** (players' clients don't have the answer). Self-marking
  rooms keep re-checking against the game data.
- Final: players type their answers; the host judges each (`check` with `host: true`); players
  see the verdicts only once all are judged (UI).
- Flow: `start_round` and `next_clue` (incl. "Show the answer" of a Final nobody could wager on)
  only by the host (`userId` = the host's id) or admin-tagged; `choose_clue` by the
  board-control player or the host (for them). `correct_check` (Undo) only host/admin-tagged.
- Buzz tiebreak seed: `clue.clue || clue.answer` today; in host mode the answer isn't known to
  players, so `clue.clue || "round,i,j"` (the same on every client).
- Answer timer auto-mark: sent by the **host's** device (`check` with `timedOut` + `host: true`),
  once per turn; players' devices send nothing in host mode.
- `host: true` on any act-for-player event (host powers) is accepted only while there is a host.

### Answers withheld from players

- Room loader (`/room/:name`) and TV loader (`/room/:name/present`): in host mode, for every
  viewer except the host and the site admin, `answer` is emptied and `answerMedia` dropped for
  every question that isn't resolved yet (nothing else identifies the right option of a
  multiple choice question). Resolved questions keep their answers. `answersHidden` tells the
  client. The summary (game over) gets everything.
- When a question is resolved in host mode the server inserts `reveal_answer` (helper called
  by the buzz, check, next-clue, admin and host routes after their insert, and by the room
  loader as self-healing; duplicates are harmless). Realtime delivers it, late joiners replay
  it. The engine overlays revealed answers on the board / clue it exposes.
- Mode switch: the client compares "should answers be hidden for me" with the loader's
  `answersHidden` and revalidates the loader when they differ (host claimed / released /
  replaced); `useGameEngine` rebuilds its state from the known events when `answersHidden`
  changes.
- Known limit (documented, not in scope): the pack itself may be public (`/game/:id.json`,
  the game page); withholding protects the room page, its data requests and realtime.

### Routes

- `POST /room/:roomId/host` — `intent=claim|release|assign` (assign: admin only, target
  visitor from presence, or the admin themselves). 403/409 with translated messages.
- `authorizeRoomActor` learns `host=true`: the session user must be the room's current host
  (403 otherwise); events get `host: true`. Used by every act-for-player route (check, buzz,
  wager, pass-clue, answer, start, choose-clue, next-clue).
- Players' self-check in host mode → 403 (check route, non multiple-choice / timed out).
- `/room/:roomId/admin` (skip, scores) and `/room/:roomId/settings` (timers): admin **or the
  room's host**.

### UI

- Join dialog: **Host this game** (seat free) next to Join / Just watch.
- Host badge "🎤 Host: <name>" in the board header row and on the TV; the host gets
  **Stop hosting** (between questions).
- Host screen: the question + the correct answer (+ answer media) all the time, "<name> is
  answering", **Right** / **Wrong**; MC: the right option highlighted and the pick; Final:
  typed answers live, Right / Wrong per player; reveal: "Back to board"; preview: "Start
  round".
- Players in host mode: no "Reveal answer" / self-check: "<name> is answering — the host will
  judge" (or "You're answering — say it out loud…"); the Final shows "The host is judging".
- Host powers: the 🛡 sheet (as 🎤 "Host controls") for the host: skip, act for a player,
  scores; timers editable by the host. The admin's sheet gets "Host seat": make a watcher
  host / take the seat / free it.
- Presence: spectators also announce `userId` + display name (needed to pick a watcher as
  host).

### Tests

Engine tables (claim/release/assign, locking, non-player rule, judging right/wrong/rebuzz/
all-wrong, wagerable, secret, MC trust, Final judging, timer auto-mark by host, fallback after
release, replay of old events), loader withholding, routes (403s), components EN/UK, E2E (host +
two players, payload check, self-marking room unchanged), screenshots 390 px / desktop,
Classic + Dark.
