# Feature 01 — Pause game

**Branch:** `feat/pause-game`
**Status:** ✅ implemented & tested — scope: **Option C (no pausing mid-clue)**

## Result / verification (2026-07-10)

- **Unit:** 6 new `TogglePause` cases in `engine.test.ts` + `isPaused` asserted in the
  shared reducer loop + `offline-storage` reset test. Full unit suite: **5366 passed**.
- **Typecheck / lint / format:** all clean.
- **E2E:** new `e2e/pause.spec.ts` — pause on the board shows the overlay for everyone,
  resume dismisses it, and gameplay (opening a clue) works again. Passes.
  (Full parallel e2e run showed 3 unrelated flaky failures in keyboard-nav/solves that
  pass on isolated re-run; the change is additive so cannot affect those flows.)
- Implemented with **no `prompt.tsx` changes** as planned — pause is gated to
  `activeClue === null`, so the buzz-timing core is untouched. The pause control is
  disabled while a clue is open, and the open clue's prompt covers it anyway.

## Goal

Let players pause an in-progress game so real-life interruptions don't wreck the
game. While paused: the game stopwatch stops, buzzers are disabled, and everyone
sees a clear "Paused" screen. Resuming continues the game.

## What already exists (don't rebuild)

- **A game stopwatch** already lives in `State` (`clockRunning`, `clockAccumulatedMs`,
  `clockLastResumedAt`) with `pauseClock()` / `resumeClock()` helpers in `engine.ts`,
  a `ToggleClock` action, a route `room.$roomId.toggle-clock.tsx`, and a UI button in
  `components/game-clock.tsx`. **But** this clock is a cosmetic elapsed-time stopwatch —
  it does **not** gate any gameplay (buzzing still works while it's "paused").
- **Buzz timing is independent and client-side**: `components/prompt/prompt.tsx` opens
  the buzzer via `useTimeout` on `Date.now()` deltas, and `read-clue-timer.tsx` is a CSS
  animation. This is the competitive-integrity core (tie quantization in `engine.ts`).
- **Event-sourced, no-host model**: all state changes are `room_events` rows applied by
  the `gameEngine` reducer. RLS allows **any** client to insert events; the reducer is
  the only place that enforces rules. Solo play reuses the same reducer — action routes
  return the `Action` for `roomId === -1` and `useSoloAction` dispatches it locally.

## Design

A dedicated pause concept (not overloading the stopwatch's manual toggle):

1. **State:** add `readonly isPaused: boolean` (init `false` in `stateFromGame`, and in
   `offline-storage` serialize/restore + `use-engine-context` default).
2. **Action:** add `ActionType.TogglePause`. Reducer:
   - No-op if `GameState.GameOver`.
   - Flip `isPaused`. On pause → `pauseClock()`; on resume → `resumeClock()` so the
     stopwatch excludes paused time ("timer stops").
3. **Reducer gating (integrity):** while `isPaused`, make gameplay actions no-ops:
   `Buzz`, `ChooseClue`, `SetClueWager`, `Answer`, `Check`, `NextClue`, `StartRound`.
   (`Join`/`Leave`/`ChangeName`/`TogglePause`/`Restore` still allowed.)
4. **Route:** `room.$roomId.pause.tsx` mirroring `toggle-clock.tsx` (returns the action
   for solo `roomId === -1`, else `createRoomEvent(TogglePause)`).
5. **Engine context:** expose `isPaused` from `stateToGameEngine`.
6. **UI:**
   - A Pause/Resume control (extend the area next to `GameClock` in `game.tsx`).
   - A full-screen **"⏸ Paused"** overlay (new component) shown to everyone when
     `isPaused`, with a Resume button. Covers the board and any open prompt.
   - Gate buzzing: `canBuzz`/`handleClick` in `prompt.tsx` respect `isPaused`.
7. **Who can pause:** any player (matches the no-host philosophy; RLS already allows it).

## The one open decision — pausing _during_ a live buzz window

Everywhere except an actively-counting buzz window, resume is naturally exact. The
question is what happens if someone pauses mid-clue (ReadClue / ReadWagerableClue),
while the 5s buzz timer is running client-side:

- **Option A (MVP, recommended):** on resume, the clue is **re-read** — the buzz window
  restarts fresh for everyone. Safe, fair, no partial-timing bugs. Small, low-risk.
- **Option B (full):** freeze the live countdown and resume with the exact remaining
  milliseconds. Requires making `prompt.tsx` timers pause-aware (subtract paused time),
  freezing the `read-clue-timer` CSS animation and the numeric `Countdown`. Touches the
  competitive-timing core — more code, more risk.
- **Option C (restrict):** only allow pausing when **not** in a live buzz window
  (board / preview / reveal / wager states). Zero timing changes — the simplest possible.
  Downside: you can't pause at the moment you might most want to.

**Decision: Option C.** Pause is only allowed when there is no live clue open
(`activeClue === null` and not `GameOver`) — i.e. on the board or round preview.
This means **zero changes to `prompt.tsx`** and the buzz-timing core: while paused
there is never an open clue, so no client-side timer can desync. The pause control is
disabled whenever a clue is open.

### Refined design given Option C

- Reducer `TogglePause`: no-op at `GameOver`. When resuming, always allowed. When
  pausing, only if `activeClue === null`. On pause → `pauseClock`; on resume → `resumeClock`.
- Gate `ChooseClue` and `StartRound` (and defensively `Buzz`/`SetClueWager`/`Answer`/
  `Check`/`NextClue`) as no-ops while `isPaused`, so nobody can open a clue while paused.
- No `prompt.tsx` changes, no payload on the action (mirrors `ToggleClock`).

## Files to touch

- `app/engine/state.ts` — add `isPaused`, init.
- `app/engine/engine.ts` — `TogglePause` case + gate gameplay actions.
- `app/engine/use-game-engine.ts` — expose `isPaused`.
- `app/engine/use-engine-context.ts` — default value.
- `app/utils/offline-storage.ts` (+ test) — serialize/restore `isPaused`.
- `app/routes/room.$roomId.pause.tsx` — new route.
- `app/components/game.tsx` — pause button + render overlay.
- `app/components/prompt/prompt.tsx` — gate buzzing (+ Option B: pausable timers).
- New `app/components/paused-overlay.tsx` (or similar).
- `app/engine/engine.test.ts` — unit tests for pause/resume + gating.
- e2e: a pause spec under `e2e/`.

## Testing

- **Unit** (`engine.test.ts`): TogglePause flips state; pauses/resumes clock; gated
  actions are no-ops while paused; ignored at GameOver.
- **E2E** (Playwright): pause hides/disables board & buzzer; resume restores.
- **Manual** (phone over VPN, `http://10.8.0.1:3000`): two clients, pause on one shows
  overlay on both; buzzing blocked while paused.
