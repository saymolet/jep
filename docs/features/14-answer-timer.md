# Feature 14 — Answer timer (F12a)

**Branch:** `feat/answer-timer`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** none

## Goal

Until now the only timers were the read time before the buzzers open and the 5-second buzz
window. Once a player won the buzz they could take forever to answer and mark themselves.
The answer timer is an optional per-room limit on that turn. There is still **no host**:
players keep marking their own answers, and when the time runs out it is the answering
player's own device that marks the answer wrong.

## How to use it

1. **Round preview dialog** (before every round): **Answer time** — **Off** (default) /
   **10 s** / **15 s** / **20 s** / **30 s** / **60 s**, and the checkbox **Mark wrong when
   time runs out** (on by default; greyed out while the timer is Off). Any player can change
   it; everyone sees the change at once; the last change wins.
2. **Between questions:** the header next to **Pause** shows **⏱ Off** / **⏱ 15 s**; tapping
   it opens the same settings. It is disabled while a question is open (like Pause).
3. **During a turn** (the buzz winner, the receiver of a cat-in-the-bag question, the player
   answering a Double Down, the buzz winner picking a multiple choice option): everyone —
   the answering player, the other players, spectators and the TV page — sees a yellow bar
   that shrinks and "12 seconds left" (red and pulsing in the last 3 s). The answering
   player also sees "When the time runs out, your answer counts as wrong."
4. **Time's up:** with auto-mark on, the answering player's device sends the normal
   "incorrect" check (−value; other players can buzz in as usual) and everyone sees
   "**Time's up!** Ann ran out of time." plus the `times-up.mp3` sound (respecting mute).
   With auto-mark off, everyone sees "Time's up!" on the bar, the answering player sees
   "Mark your answer now." and nothing is sent — the turn waits for them as before.
5. Ukrainian: **Час на відповідь** — **Вимк.** / **10 с** …, **Зараховувати як
   неправильну, коли час вийде**, "Залишилося 12 секунд", **Час вийшов!**, "Ann: час на
   відповідь вийшов."

## Design decisions

- **Room event `set_settings`** `{ userId, answerTimeSec, autoWrongOnTimeout }` — route
  `POST /room/:roomId/settings` (zod form parsing, `requireSessionUserId`, must be a player,
  409 while a question is open / after game over, 400 for values not offered, returns the
  Action for solo roomId −1). The engine re-validates on replay: unknown values, non-players,
  an open question (`activeClue !== null`, same rule as Pause and team changes) and game over
  are ignored. Last write wins. Allowed while paused and in the round preview.
  `answerTimeSec` 0 means Off (one number instead of a nullable + flag).
- **State:** `answerTimeSec` (0), `autoWrongOnTimeout` (true), `answerStartedAt`
  (timestamp of the event that started the current answer turn, else null) and
  `answerTimedOut` (`{ userId, startedAt }` of the last turn on the active question that
  ran out of time). Old saved solo games load with the timer Off; a turn restored from a
  save has no timer (its start was in another session).
- **Timer start = event `ts`**, recorded by the engine when the state enters
  `RevealAnswerToBuzzer`: the deciding Buzz (the last buzz in or timeout), `PassClue`
  (secret question), `ChooseClue` (secret question in solo play). A wrong answer and a new
  buzz winner start a new turn with the new buzz's `ts`. Because it is part of the replayed
  state, late joiners and reloads see the same time left.
- **Clock skew** (`app/utils/server-clock.ts`): timestamps are on the server's clock, the
  countdown runs on the device. Each device keeps the smallest `local time − server time`
  seen over samples: every live Realtime room event (`ts` vs. arrival time), the room and
  TV loaders' `serverNow` (for a reload mid-turn) and solo actions (stamped by the server).
  That is the device's offset plus the smallest message delay, so the estimate errs towards
  _more_ time left — a device never runs out before the server would agree; at worst the
  auto-mark is sent a fraction of a second late. No sample yet → the device clock is trusted.
  (A device clock changed by hand mid-game keeps the older offset until a smaller sample
  arrives.)
- **Authority stays with the player:** only the answering player's own device submits the
  timeout, as the regular `check` (`result=incorrect`) with `timedOut=true`. It is sent once
  per turn (keyed by the turn's start), never after the player marked or picked themselves,
  and the answer buttons are replaced by "Your answer counts as wrong." once the time is up
  (no racing manual click). The countdown ticks every 250 ms and re-checks on
  `visibilitychange`/`focus`, so a phone in the background sends it when the browser runs its
  timers again and at the latest when the tab is visible. If the answering player's device
  is offline or closed, nothing is sent and the game waits, exactly as without a timer.
  Like any self-check, a timed-out answer can be fixed with the existing **undo**.
- **Multiple choice:** the server and engine decide picks from the game data and ignore a
  check without a pick, so a timeout needs its own path: `check` with `timedOut: true` and
  no `choice` is accepted on a multiple choice question **only while the room timer is on**,
  is always wrong (a forged `correct: true` is ignored) and records no pick. Old events never
  carry `timedOut`, so replays of existing rooms are unchanged. A pick sent with the flag is
  still checked as a pick.
- **Telling everyone:** with auto-mark on, the timed-out check moves the question on
  immediately (other players can buzz, or the answer is shown), so the countdown's own
  "Time's up!" would flash for an instant or never appear on devices whose clock estimate
  lags. The engine therefore records `answerTimedOut` and every screen shows a
  "Time's up! <name> ran out of time." notice in the following ReadClue / answer screens,
  cleared when the next turn starts or on the next question. The sound plays once per turn
  per page (countdown or notice, whichever comes first) and not for a timeout more than 5 s
  old (e.g. after a reload).
- **Without a timer nothing changes:** the old 5-second hint bars and sound for the buzz
  winner remain when the timer is Off.
- **Long-form (final) questions are excluded.** Their answers are typed (slow on phones)
  by everyone at once, then each player self-checks, and the screen already has its own
  30-second countdown. Auto-submitting a half-typed answer is not "marking wrong" and would
  mix two meanings into one setting; documented as a possible follow-up.
- **Pause** is still blocked while a question is open, so it can't freeze a running timer.
- **Hydration:** the time left depends on the device clock, so nothing time-dependent is
  rendered on the server: the bar renders full without text until the first client tick.

## Files

- `app/engine/answer-timer.ts` — options, `isAnswerTimeSec`, `getAnswerTimerStatus` (pure).
- `app/engine/{engine,actions,state,use-game-engine,use-engine-context}.ts` — `SetSettings`,
  `timedOut` on Check, new state and context fields.
- `app/routes/room.$roomId.settings.tsx` (new), `room.$roomId.check.tsx` (`timedOut`),
  `room.$roomName.tsx` / `room.$roomName_.present.tsx` (`serverNow`).
- `app/utils/server-clock.ts` (new), `use-solo-action.ts` (sample), `use-sound.ts` (a
  refused autoplay no longer throws), `offline-storage.ts`.
- `app/components/prompt/answer-timer.tsx` (new: `useAnswerTimer`, `AnswerTimerBar`,
  `ConnectedAnswerTimer`, `useAutoWrongOnTimeout`, `TimesUpNotice`), `prompt.tsx`,
  `check-form.tsx` / `choices.tsx` (`onSubmit` / `onPick`), `watch/viewer-prompt.tsx`.
- `app/components/answer-timer-settings.tsx` (new: settings + header button),
  `preview/preview.tsx`, `game.tsx`.
- i18n: `play.answerTimer.*` and `room.answerTime*` in `app/i18n/{en,uk}/{play,room}.ts`.

## Verification

- Engine: `app/engine/engine-answer-timer.test.ts` — settings table (defaults, last write
  wins, Off again, invalid values, non-player, allowed on the board and while paused,
  blocked while a question is open and allowed again after), malformed payload, replay from
  room events; turn start from the deciding buzz, reset on marking and restart for the next
  winner, secret pass and solo secret; multiple choice timeout (wrong without a pick,
  forged correct ignored, ignored with the timer off, pick still needed without the flag);
  `answerTimedOut` lifecycle; `getAnswerTimerStatus` math table.
- Server clock: `app/utils/server-clock.test.ts`.
- Routes: `app/routes/room.$roomId.settings.test.ts` (save, Off, invalid values, someone
  else, not playing, question open, solo), `room.$roomId.check.test.ts` (timeout → wrong
  without a pick, solo).
- Components: `app/components/prompt/answer-timer.test.tsx` (bar states EN/UK incl.
  Ukrainian plurals; answering player auto-marks once, late return marks at once, no mark
  after a manual mark, no mark with auto-mark off, other players send nothing (UK), no timer
  when Off, multiple choice timeout; TV countdown; time's-up notice EN/UK),
  `app/components/answer-timer-settings.test.tsx` (options, saving, locked during a
  question, Ukrainian).
- E2E: `e2e/answer-timer-room.spec.ts` — two players; 10 s + auto-mark: the setting syncs,
  the host wins the buzz, both see the countdown, then "Time's up!" and −$200 on both;
  auto-mark off: "Time's up!" on both, "Mark your answer now.", nothing sent (still the
  host's turn, no −$200).

### Manual test script

1. Open a game in a room on a laptop and on a phone, join with both. In the round preview
   on the phone pick **10 s**: the laptop's dialog shows 10 s selected and **Mark wrong when
   time runs out** ticked.
2. Start the round, open a question, win the buzz on the laptop. Both show the yellow bar
   and "10 seconds left"; the laptop also says the answer will count as wrong.
3. Wait: at 0 both show "Time's up! … ran out of time." with the sound, the laptop's score
   is −value, and the phone can buzz in.
4. Lock the phone while it is answering a question, unlock it after the time ran out: the
   answer is marked wrong right away.
5. Open ⓘ → **Show on TV**: the countdown and the notice appear there too.
6. Between questions tap **⏱ 10 s** → untick auto-mark. Win a buzz and wait: "Time's up!"
   and "Mark your answer now." — nothing happens until you mark yourself.
7. A multiple choice question with the timer: don't pick; at 0 it counts as wrong with no
   option marked, and the other player can buzz.
8. Switch to УКР: "Час на відповідь", "Залишилося 8 секунд", "Час вийшов!".
