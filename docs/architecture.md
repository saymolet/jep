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

## Realtime / rooms

- Supabase Realtime drives multiplayer. `rooms` + `room_events` tables; buzzing and
  scoring sync through room events. (Details TBD in deep-dive.)
- Client sync (`useGameEngine`): state = replay of `room_events`. New events come from
  realtime INSERTs, catch-up fetches (on SUBSCRIBED, +3 s, visibility/online) and the
  room loader's snapshot after every own action (fetcher revalidation); all are merged
  by id via `mergeRoomEvents`, rebuilding state if one arrives out of order.

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

## Open questions to resolve during feature work

- Exact room-event protocol and how buzz order / lockout is tracked.
- How the engine reduces `room_events` into game state (looks like an event-sourced reducer).
- Where clue rendering happens (`components/prompt/`) — the seam for typed questions / `blocks[]`.
