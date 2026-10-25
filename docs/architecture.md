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
             ├─ clue    (string — the prompt text)
             ├─ answer  (string)
             ├─ value   (number)
             ├─ wagerable?  (bool — Daily Double style wager)
             ├─ longForm?   (bool — Final Jeopardy long answer)
             └─ imageSrc?   (string — added in migration 20230906)
```

DB tables: `games`, `categories`, `clues`, `accounts`, `rooms`, `room_events`,
`solves`, `reports`.

## Realtime / rooms

- Supabase Realtime drives multiplayer. `rooms` + `room_events` tables; buzzing and
  scoring sync through room events. (Details TBD in deep-dive.)

## Open questions to resolve during feature work

- Exact room-event protocol and how buzz order / lockout is tracked.
- How the engine reduces `room_events` into game state (looks like an event-sourced reducer).
- Where clue rendering happens (`components/prompt/`) — the seam for typed questions / `blocks[]`.
