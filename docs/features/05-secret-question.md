# Feature 05 — Secret question (cat in the bag / Кот в мешке)

**Branch:** `feat/secret-question`
**Status:** ✅ implemented & tested
**Migration:** `supabase/migrations/20261025135101_clues_secret.sql` (additive; must be applied
to production before deploying this branch)

## Goal

SIGame's "Кот в мешке": a question hidden on the board that the chooser can't answer
themselves. Whoever picks it must hand it to another player, who answers it alone. There is
still no host: the receiver marks their own answer (or picks an option, checked automatically).

(In the code a question is called a "clue".)

## How to use it (game JSON)

Add `secret: true` to a clue, optionally with a topic and a value:

```json
{
  "clue": "The author who created The Cat in the Hat",
  "answer": "Dr. Seuss",
  "value": 400,
  "secret": true,
  "secretTopic": "Famous cats",
  "secretValue": 500
}
```

- `secretTopic` (optional, non-empty) is shown on the hand-over screen; default: the category
  name.
- `secretValue` (optional, positive whole number) is what the question is worth; default: the
  cell `value`. The board still shows the cell value (surprise).
- Allowed with `media`/`answerMedia` and `choices`. **Not allowed with `wagerable` or
  `longForm`** ("secret clues cannot be wagerable or long-form"). `secretTopic`/`secretValue`
  without `secret: true` are rejected too ("secretTopic and secretValue need secret: true").
- Clues without `secret` are unchanged; old `.jep.json` files and DB rows keep working.

Validated in `ClueSchema` and described in `/game.schema.json`, `/upload-help` (with an example)
and `/howto`. Sample game: `app/static/mock-secret.jep.json`, solo at `/mock?game=secret`
(Animals $400 = secret text question on "Famous cats" worth $500; Science $200 = secret
multiple choice; Science $600 = secret picture question on "Art" worth $1,000; the rest normal).

## How it plays

1. The board-control player chooses a cell; it is secret. Everyone sees **"Cat in the bag!"**
   with a 🐱, "Кот в мешке · secret question", the topic and the value, plus the double down
   sound.
2. The chooser gets one big button per other player (name, color, score; full-width on phones,
   two columns on larger screens) and taps one. Everyone else sees "X is choosing who gets the
   secret question...". Playing alone, the question goes straight to the chooser.
3. The receiver sees "Your secret question! Only you answer it." with the question (text,
   media, options). There is no buzzing and no 5-second countdown/"time's up" sound (they need
   time to read it). They reveal the answer and mark it, or tap an option on a multiple choice
   question. Others see "Secret question for X" and wait.
4. Right → receiver +value and board control. Wrong → receiver −value, board control stays
   with the chooser. The answer is shown to everyone and the game goes back to the board as
   usual.

## Design decisions

- **Engine: one new state, one new action, then the existing reveal/check flow.**
  - `GameState.PassClue` — a secret clue was chosen and is waiting to be handed over.
  - `ActionType.PassClue = "pass_clue"`, payload `{ userId, i, j, toUserId }`. Accepted only in
    `PassClue`, for the active clue, from the board-control player, to a current player other
    than the chooser (the chooser only if they're the only player). Anything else is ignored.
  - Passing sets `buzzes` to `receiver → 0`, everyone else → `CANT_BUZZ_FLAG`, and moves to
    `RevealAnswerToBuzzer`. The receiver is then exactly "the winning buzzer", so the existing
    Check path (self-check, multiple choice auto-check, scoring, `answeredBy`, replay, undo)
    applies without duplication — the same trick the wagerable flow uses to restrict answering to
    one player (everyone else locked out). Wagerable code paths are untouched.
  - Check on a secret clue always ends it (`RevealAnswerToAll`) — right or wrong — and only a
    right answer moves board control. (A player who joined mid-question can't reopen buzzers.)
  - `getClueValueForRound` returns `secretValue ?? value` for secret clues, so scoring, the
    prompt header, "+$X" score deltas and corrections all use the secret value.
  - No new state fields: the chooser is `boardControl`, the receiver is the only valid buzz.
    Solo saves (`offline-storage`) need no change.
- **Alone → automatic.** `ChooseClue` with a single player skips `PassClue` and gives the
  question to the chooser.
- **Route `room.$roomId.pass-clue`** (zod form, `requireSessionUserId`; roomId −1 returns the
  action for solo). For real rooms it also rebuilds the room state from the events (like the
  multiple choice check route) and rejects a pass that the engine would ignore: 400 if the
  question isn't being passed or the target isn't another player in the game, 403 if the user
  doesn't have board control. The engine still validates every event on every client (anon can
  insert `room_events` directly).
- **Leaving / kicking during the secret flow:** the engine already only allows Leave on the
  board/round preview and Kick before the game starts, so neither the chooser nor the receiver
  can disappear mid-question through the game (tests cover that the flow continues). The one
  way a player can vanish mid-question is `TransferPlayer` retiring a guest entry into an
  account that's already playing (same person, another tab): a pending answer moves to that
  account, and if only one player is left while passing, it goes to them. A plain rename moves
  board control / the receiver's buzz as before.
- **Pause:** unchanged — `TogglePause` is ignored while a clue is open, including `PassClue`.
- **Undo / CorrectCheck:** a self-checked secret answer can be corrected like any normal
  question (the receiver is the only checker). Board control follows the correction:
  wrong→right gives it to the receiver, right→wrong returns it to the chooser (recorded as
  `boardControlBefore` at check time). Multiple choice secret questions are final, as in
  feature 04.
- **Summary / replay:** `pass_clue` events replay through the engine; the replay counts the
  receiver as the clue's participant (Buzzed frame), and the replay label shows the secret
  value. Board cells in the summary still show the cell value.
- **DB:** nullable `secret boolean`, `secret_topic text`, `secret_value bigint` on `clues`
  (`NULL` = normal clue / defaults). On read, values the schema would reject (secret on a
  wagerable/long-form row, non-positive value, blank topic) are dropped, so the JSON export never
  fails. No RLS change (same policies as the other `clues` columns).
- **Sound:** the existing double down sound (`wager.mp3`) plays for everyone when the cat
  appears.
- **Text:** English UI with the Russian name as a subtitle, since the group knows it from
  SIGame.

## Not done / limitations

- If the chooser or receiver closes their tab, the game waits for them (same as a buzz winner
  who never checks today); there is no timeout or host override.
- The board doesn't mark secret cells (by design) and the summary board shows the cell value.
- If a pass request fails, the chooser's buttons unlock again after 5 seconds.

## Files

- `app/models/convert.server.ts` (+ test) — `secret`, `secretTopic`, `secretValue` and rules.
- `supabase/migrations/20261025135101_clues_secret.sql`, `app/models/database.types.ts`.
- `app/models/game.server.ts` (+ test) — DB mapping, defensive read.
- `app/static/mock-secret.jep.json`, `app/models/mock.server.ts` — sample game.
- `app/engine/state.ts`, `actions.ts`, `engine.ts` — `PassClue` state/action, value,
  `isSecretClue`, `getSecretTopic`.
- `app/engine/engine-secret.test.ts` — table-driven engine cases and replay.
- `app/routes/room.$roomId.pass-clue.tsx` (+ test).
- `app/components/prompt/pass-clue.tsx` (+ test), `prompt.tsx` — hand-over screen, receiver
  prompt.
- `app/routes/room.$roomName_.summary/replay.ts` (+ test), `replay-player.tsx`.
- `app/routes/[game.schema.json].tsx`, `upload-help.tsx`, `howto.tsx` — docs.
- `e2e/secret.spec.ts` (solo), `e2e/secret-room.spec.ts` (two players in a real room),
  `playwright.config.ts` (room spec in the `db` project).

## Verification

- Unit: schema accept/reject (defaults, trimming, with choices/media, wagerable/long-form,
  blank topic, non-positive value, fields without `secret`, sample game); DB mapping
  round-trip, nulls, malformed rows; engine table (choose → PassClue, pass → only receiver
  answers, right/wrong scoring and board control, three players, alone → automatic, invalid
  passes ignored: not board control / to self / to left or unknown player / wrong clue / normal
  clue / second pass, no buzz or check while passing, only receiver checks, pause blocked,
  leave/kick ignored and flow continues, sign-in transfer of chooser/receiver, retired receiver,
  last player left while passing, late joiner, undo both ways, secret multiple choice
  wrong/right/no pick and no undo, secret value and topic defaults); replay from stored events;
  route (pass, other user's session 403, no board control 403, to self/unknown 400, wrong
  clue/state 400, solo returns the action); hand-over component; summary replay frames.
- E2E: solo `/mock?game=secret` (secret text question answered alone for $500, secret multiple
  choice picked right); DB project: upload the sample, JSON export round-trips the secret
  fields, two players in a real room (host chooses, guest sees "is choosing", host taps the
  only other player, only the guest can reveal, wrong → −$500 and host keeps control; secret
  multiple choice passed to the guest, right pick → guest takes control).
- Manual: screenshots at 390px width with three players (chooser, waiting, receiver, others).
- `jep-validate`: format, lint (0 errors), typecheck, 5627 unit tests, 46 e2e tests — all pass.

### Manual test script

1. Solo: open `/mock?game=secret`, join, start. Tap Animals $400 → "Your secret question!",
   "Famous cats for $500", no buzzing. Reveal, mark correct → +$500.
2. Science $200 → options appear right away; tap "B: Fe" → green, +$200.
3. Room: upload `app/static/mock-secret.jep.json` from the profile page, play with a friend (or
   a second browser). The board-control player taps Animals $400: both see the cat screen; the
   friend sees "… is choosing who gets the secret question…". Tap the friend's button.
4. Only the friend can reveal/mark; you see "Secret question for …". Wrong → they lose $500 and
   you choose next. Right → they win $500 and choose next.
5. Try Science $600 (picture) on a phone: the picture shows for the receiver, the buttons are
   easy to tap.
