# Feature 04 — Multiple choice questions

**Branch:** `feat/multiple-choice`
**Status:** ✅ implemented & tested
**Migration:** `supabase/migrations/20261025131747_clues_choices.sql` (additive; must be applied
to production before deploying this branch)

## Goal

Let a question offer options (A/B/C/D) like a quiz show. Everyone sees the options while the
question is read; the player who wins the buzz taps one and Jep! checks it automatically.
There is still no host: buzzing, scoring and lockouts work exactly as for normal questions.

(In the code a question is called a "clue".)

## How to use it (game JSON)

Add an optional `choices` list to a clue:

```json
{
  "clue": "The capital of Australia",
  "answer": "Canberra",
  "value": 200,
  "choices": ["Sydney", "Canberra", "Melbourne", "Perth"]
}
```

Rules (validated on upload, in `ClueSchema` and in `/game.schema.json`):

- 2–6 options, non-empty and unique (compared after trimming, ignoring letter case).
- `answer` must equal one of the options (trimmed, ignoring case).
- Allowed on wagerable (double down) questions and together with `media`/`answerMedia`.
- **Not allowed on long-form (final) questions** — see decisions.
- Clues without `choices` are unchanged; old `.jep.json` files and DB rows keep working.

Sample game: `app/static/mock-choice.jep.json`, playable solo at `/mock?game=choice` (text
questions, a picture question with options, a wagerable question with options, and a normal
question for comparison). Documented on `/upload-help` (with an example), `/howto` and in the
JSON schema.

## How it plays

1. The question opens: everyone sees the question **and the options** (compact two-column grid)
   while it is read. The read time also counts the options' characters. Buzzing is unchanged
   (tap the question / press Enter).
2. The buzz winner sees "Pick your answer" with full-width option buttons (or presses 1–6).
   Others see the options and "Waiting for X to pick an answer...".
3. The pick is checked against the answer:
   - **right** → +value, board control, answer revealed to all (picked option green);
   - **wrong** → −value, the player is locked out, the buzzers re-open for the others; the wrong
     option is shown in red with the player's name (the right one stays hidden). If everyone is
     locked out, the answer is revealed.
4. When the answer is shown to everyone, the correct option is green and all wrong picks are red.

Wagerable questions: the board-control player wagers, buzzes and picks the same way (right →
+wager, wrong → −wager).

## Design decisions

- **The pick rides on the existing `Check` action.** The payload gets an optional
  `choice: number` (option index) next to `correct`. No new action type, no new route; old
  events have no `choice` and replay exactly as before.
- **Correctness is decided by the server, and re-derived by the engine.**
  - `room.$roomId.check` (real rooms): when `choice` is posted, it loads the game and the room's
    events, finds the clue on the current round, rejects invalid picks (400), and computes
    `correct` from the answer. A client-sent `result` is ignored for picks. The stored event
    therefore always carries the true `correct`.
  - The engine (`Check` reducer) also ignores the payload's `correct` for a multiple choice clue
    and recomputes it from `choice` and the game data, and it ignores a Check without a valid
    `choice` on such a clue. Every client derives the same result, so even a hand-crafted room
    event (anon can insert `room_events` directly via Supabase) cannot score a wrong pick as
    right.
  - Solo (roomId −1) has no server-side game, so the route returns the pick with a placeholder
    `correct` and the engine checks it.
  - While here, the check route now also requires the session user to match `userId` (like
    buzz/answer/correct-check already did), so one player can't pick for another.
- **Picks are state:** `State.choicePicks: Map<"round,i,j", Map<userId, optionIndex>>`, exposed
  to the UI as `choicePicks` for the active clue. Rebuilt by `applyRoomEventsToState` from the
  Check payloads, saved in solo persistence (`offline-storage`; old saves without it load with
  no picks), and moved by `TransferPlayer` (guest → signed-in).
- **Undo / CorrectCheck:** auto-checked results are **final**. `getCheckCorrectionForPlayer`
  returns nothing for a multiple choice clue (so the undo button never shows), and the engine
  ignores `CorrectCheck` for it. Allowing undo would let a player turn a wrong pick into a right
  one, defeating the server-side check. Normal questions keep the existing undo exactly as before.
  (If a game's answer key is wrong, that's a game-authoring fix.)
- **Long-form questions reject `choices`** (validation error "long-form clues cannot have
  choices"). Supporting them would need per-player auto-checks after the Answer phase and a
  different reveal; it doesn't fit the existing long-form flow cleanly. The DB reader also drops
  choices on long-form rows defensively.
- **Comparison ignores case and surrounding spaces** (`app/utils/choices.ts`), both for the
  uniqueness rule and for matching the answer, so "Paris"/"paris" can't both be options and an
  answer of "paris" matches "Paris".
- **Layout (mobile-first).** Read-only option lists are a compact two-column grid so the
  question (the buzz target) and media keep their room; the buzz winner's pickable options are
  full-width rows (≥48px tall) on phones, two columns on larger screens. Options are not
  upper-cased (e.g. chemical symbols). Picks are debounced for 500ms so the tap/Enter that won
  the buzz can't also pick an option.
- **DB:** nullable `choices jsonb` on `clues` (`NULL` = normal clue). On read, rows are
  re-validated (`choicesError`) and malformed values are dropped with a warning, so the JSON
  export (`GameSchema.parse`) never fails and a bad row plays as a normal clue.

### Related fix

`Check` used the raw clue text as the buzz tie-break seed while `Buzz` and the clients use
`getTiebreakerSeed` (answer fallback for empty text, added in feature 03). On a tied buzz on a
media question with no text, the winner's check could be rejected. `Check` now uses
`getTiebreakerSeed` too (test: "checking a tied buzz on a question without text").

## Not done / limitations

- No multiple choice for long-form (final) questions (rejected in validation).
- No correction of an auto-checked pick (by design, see above).
- The board doesn't mark which cells are multiple choice.
- If the pick request fails (network), the picker stays disabled for that player; there is no
  retry button (the question can't time out on its own, same as the self-check today).

## Files

- `app/utils/choices.ts` (+ test) — limits, labels, validation, correctness helpers (shared).
- `app/models/convert.server.ts` (+ test) — `choices` in `ClueSchema`, rules.
- `supabase/migrations/20261025131747_clues_choices.sql`, `app/models/database.types.ts`.
- `app/models/game.server.ts` (+ test) — `clueToDbClue` / `dbClueToClue` mapping.
- `app/engine/actions.ts`, `engine.ts`, `state.ts`, `use-game-engine.ts`,
  `use-engine-context.ts` — `choice` payload, auto-check, `choicePicks`, no corrections.
- `app/engine/engine-choices.test.ts`, `app/engine/engine.test.ts` — engine/replay tests.
- `app/routes/room.$roomId.check.tsx` (+ test) — server-side correctness, session check.
- `app/utils/offline-storage.ts` (+ test) — solo persistence of picks.
- `app/utils/media.ts` (+ test) — options count towards the read time.
- `app/components/prompt/choices.tsx` (+ test), `prompt.tsx` — option list and picker.
- `app/routes/[game.schema.json].tsx`, `upload-help.tsx`, `howto.tsx` — docs.
- `app/static/mock-choice.jep.json`, `app/models/mock.server.ts` — sample game.
- `e2e/choices.spec.ts` (solo, phone), `e2e/choices-room.spec.ts` (two players in a real room),
  `playwright.config.ts` (room spec in the `db` project).

## Verification

- Unit: option validation/labels/correctness; schema accept/reject (counts, empties, duplicates,
  answer not an option, long-form, wagerable, sample game); DB mapping round-trip + malformed
  rows; engine table cases (right pick with a lying flag, wrong pick → lockout, rebuzz and right
  pick, everyone wrong, missing/out-of-range/non-integer pick ignored, only the winner can pick,
  normal question ignores `choice`, wagerable right/wrong, no correction, TransferPlayer);
  replay of events with `choice` and old events without it; check route (server decides
  correctness both ways, rejects bad/irrelevant picks and other users' checks, normal self-check
  unchanged without loading the game, solo returns the pick); option list rendering states;
  solo save/restore of picks incl. old saves.
- E2E: solo `/mock?game=choice` (options visible while reading, no tap targets until the buzz is
  won, wrong pick → red + correct green, keyboard pick, wagerable); phone viewport 390×664 with
  a picture question (question and all options on screen, full-width ≥44px buttons, tap to buzz
  and tap to pick); DB project: upload the sample, JSON export round-trips `choices`, two
  players in a real room (host picks wrong → both see red, host locked out; guest buzzes and
  picks right → both see green, scores −$200/$200).
- Manual: screenshots at 390px width (read, pick and reveal states, with and without a picture).
- `jep-validate`: format, lint (0 errors), typecheck, 5564 unit tests, 44 e2e tests — all pass.

### Manual test script

1. Open `/mock?game=choice`, join, start round.
2. Capitals $200: the four options show under the question while it's read; they can't be
   tapped. Buzz (tap the question / Enter) → "Pick your answer" with big buttons.
3. Tap "Sydney" → it turns red with your name, "Canberra" turns green, you lose $200.
4. Capitals $400: buzz, press `3` → "Ottawa" turns green, +$400.
5. Mixed Bag $400 (picture) on a phone: picture, question and options all fit; tap to buzz and
   pick.
6. Mixed Bag $600 (wagerable): wager, buzz, pick "Au" → +wager.
7. With a friend in a room (upload `app/static/mock-choice.jep.json` from the profile page):
   one player buzzes and picks wrong → both see the red pick, the other can buzz and pick. No
   undo button appears for multiple choice questions; normal questions still have it.
