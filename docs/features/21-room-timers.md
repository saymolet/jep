# Feature 21 — Room timers

**Branch:** `feat/room-timers`
**Status:** ✅ implemented & tested
**Migration:** `20261026192800_clues_read_time_sec.sql` (additive nullable
`clues.read_time_sec smallint`, check 0–60)
**New dependencies:** none

## Goal

The owner asked (verbatim): "Timer Adjustments: Ensure the game's time limits (for answering,
displaying questions, etc.) can be fully configured or overridden by the host when
creating/managing a room, rather than relying strictly on the defaults pulled from .siq
packs." Asked which limits: "Honestly it should be set from the .siq pack, is it not? If not,
then all of the above should be configurable when creating a room" — reading time before the
buzzers open, buzz window, Final answer time, wager time (the answer time after winning the
buzz already existed, feature 14).

**Do SIGame packs set these limits?** No. Checked against SIGame's schemas
(`VladimirKhil/SI/assets/ygpackage3.1.xsd` and `siq_5.xsd`): the reading, buzz, answer and
stake times are settings of the SIGame _application_, not of the pack. The only time data in
a pack is a per-fragment display time: v4 `<atom type="…" time="5">` (seconds, decimal) and
v5 `<item … duration="00:00:05">` (hh:mm:ss). Jep! now imports those as a per-question
reading time hint (`readTimeSec`), used when the room's reading time is "Auto". Most real
packs have none, so the room settings are what matters.

## How to use it

1. **Creating a room (admin):** log in at `/admin`, then open a game's **Play** (or "start a
   new room" from the rooms-in-progress chooser, or **Play with friends** on a random board).
   Instead of going straight into a room, the admin sees the **Room timers** panel, filled with
   the timers of their last room (or the defaults) → **Create the room** (one tap) or **Use
   the defaults**. The room opens with those timers. Everyone else creating a room gets the
   defaults right away, as before (no extra step).
2. **Round preview** (before every round) and the **⏱** header button (admin only, between
   questions): the same **Room timers** panel:

   | Timer                                  | Options                                        | Default  |
   | -------------------------------------- | ---------------------------------------------- | -------- |
   | Answer time (feature 14)               | Off / 10 / 15 / 20 / 30 / 60 s (+ mark wrong)  | Off      |
   | Reading time (before the buzzers open) | Auto / 0, 1, 2, 3, 5, 10, 15, 20, 30, 45, 60 s | Auto     |
   | Time to buzz in (buzz window)          | 3 / 5 / 7 / 10 / 15 / 20 s                     | 5 s      |
   | Final answer time                      | 15 / 30 / 45 / 60 / 90 / 120 s                 | 30 s     |
   | Wager time                             | No limit / 15 / 30 / 60 s                      | No limit |

   Players and spectators see the values read-only ("Only the admin can change this."). In solo
   play the player changes them.

3. **In play:**
   - The question shows for the reading time, then the buzzers stay open for the buzz window
     (the white bar, the BUZZ button on phones, the "no buzz" each device sends, the time's-up
     sound, the TV status "Buzzers open").
   - **Wager** (Double Down / Final) with a wager time: everyone (and the TV) sees the yellow
     countdown; the wagering player sees "When the time runs out, you wager $5." At 0 their
     own device places the minimum wager ("Time's up! Your wager: $5.").
   - **Final answers:** everyone sees the countdown of the Final answer time; the player sees
     "When the time runs out, what you typed is sent." At 0 their own device sends what is in
     the box (possibly nothing) and the box locks ("Time's up! Your answer was sent."). A
     player who already sent an answer keeps it.
4. **Game JSON:** optional `"readTimeSec": 8` (whole seconds 0–60) on a question — that question
   is shown for exactly that long before the buzzers open when the room's reading time is
   Auto. Documented on `/upload-help` (EN/UK) and in `/game.schema.json`; exported by
   **Download JSON**.

   ```json
   {
     "clue": "Look at the picture",
     "answer": "Mona Lisa",
     "value": 400,
     "readTimeSec": 8
   }
   ```

5. Ukrainian: **Таймери кімнати**, **Час на читання (до відкриття кнопок)** — **Авто**,
   **Час, щоб натиснути кнопку**, **Час на відповідь у фіналі**, **Час на ставку** — **Без
   обмеження**, "Час вийшов! Твоя ставка: $5.", "Час вийшов! Твою відповідь надіслано.",
   **Створити кімнату**.

## Design decisions

### Settings and the engine

- **One settings event.** The four timers are new optional fields of the existing
  `set_settings` payload: `readTimeSec` (number or `null` = Auto), `buzzWindowSec`,
  `finalAnswerTimeSec`, `wagerTimeSec`. A field left out keeps its current value, so every
  event already in the database (answer time only) replays exactly as before, and a room
  without any settings event plays with today's values (`DEFAULT_ROOM_TIMERS`). One invalid
  field ignores the whole event (never throws). Same rules as feature 14: in rooms only the
  site admin (route → `admin: true`, server-inserted; the browser key can't insert any event
  since feature 20), between questions only (`activeClue === null`), not after game over,
  last write wins. Validated in the route (zod, 400) and again in the engine.
- **Where each value is used:**
  - **Buzz window** decides which buzzes count — in the engine (`getWinningBuzzer(buzzes,
seed, buzzWindowMs)` in Buzz and Check, the admin step, the engine context's winning
    buzzer) and on every device (the "no buzz" sent at window + 1 ms, the shrinking bar, the
    buzz chips, the BUZZ button's state, the TV status, the admin's "passes"). It is part of
    the replayed state and only changes between questions (when no buzzes exist), so every
    client and every replay judge the same buzzes the same way: deterministic. Old events
    carry 5001 for "no buzz", which is still "no buzz" with the default 5 s window. With a
    window over 5 s an old-style 5001 would count as a buzz — impossible in practice since the
    window can only change between questions and every device sends window + 1.
  - **Reading time** is local to each device as before (`getRoomReadMs`): a fixed value, or
    Auto = the question's `readTimeSec` hint, else today's estimate (text length, ≥ 3 s with
    pictures, ≥ 10 s with audio/video). A re-read after a wrong answer stays 1 s (or the fixed
    reading time when that is shorter, so 0 s means 0 s). The TV computes the same.
  - **Wager time / Final answer time** run from the timestamp of the event that started the
    step (new state `wagerStartedAt` — the ChooseClue that opened the wager; `longFormStartedAt`
    — the last wager, or the ChooseClue when nobody could wager), on the server clock like the
    answer timer (`useCountdownStatus`, shared with it), so all devices and late joiners show
    the same time left. Cleared when the step ends (and by a skip).
- **Authority stays with the player** (same model as the answer timer's auto-mark): only the
  player's own form sends the timeout action, once per step (keyed by the step's start), not
  if they already acted. An offline/closed device sends nothing and the game waits — the admin
  can act for them (feature 20). Nothing new in the engine: a timeout wager is a normal wager,
  a timeout answer a normal answer.
- **Minimum wager** = `getWagerRange(...).min`, the existing rule: **$0 on the Final**, **$5 on a
  Double Down** (the engine/route reject anything below). It's what a player who doesn't
  decide risks least.
- **Final answer time is now enforced** (it was a cosmetic 30-second bar that started on each
  device at mount and did nothing at 0). Default stays 30 s; the countdown now runs from the
  server timestamp. At 0 the player's device sends what was typed (trimmed; may be empty). This
  changes behaviour in rooms with defaults: a Final no longer waits forever for someone who
  stopped typing. Deliberate — that's what a "Final answer time" means — but easy to revisit
  (e.g. an "Off" option) if the owner prefers the old open-ended Final.
- **The old 5 s hint** for the buzz winner without an answer timer (sound + red bars) is not a
  buzz window; it stays 5 s (`ANSWER_HINT_MS`).
- **Solo play** saves/restores the timers (`offline-storage.ts`; old saves get the defaults; a
  step restored from a save has no countdown, like the answer turn).

### Creating a room

- `GET /game/:id/play` for the **admin** (valid admin session, `getAdmin`) renders the create
  step instead of inserting a room (still shows the rooms-in-progress chooser first when there
  are any). `POST /game/:id/play` (admin only, 403 otherwise; values validated, 400) creates
  the room, inserts the settings as its first event (`createRoomEventAsServer`, `admin: true`)
  and redirects. No CSRF token, as for the settings route: the admin session cookie is
  `SameSite=Lax`.
- **Last-used settings** are stored in the (signed, httpOnly) session cookie (`roomSettings`)
  when the admin creates a room and pre-filled next time; invalid stored values fall back to
  the defaults per field. A cookie, not an account setting: the admin isn't a Supabase account.
- **Hydration:** the create step renders from loader data only; countdowns render a full bar
  without text until the first client tick (as the answer timer). Nothing reads the device
  clock during SSR.

### SIQ import

- `parse.ts` records `displayTimeSec` per question: the sum of the time hints of the
  question-part fragments (v4 atoms before the marker, v5 `question` items); undefined when
  none has a hint. `convert.ts` maps it to `readTimeSec` (rounded, capped at 60), not for Final
  questions (no reading phase there).
- New nullable column `clues.read_time_sec` (check 0–60), mapped in `game.server.ts` (invalid
  stored values dropped), zod `ClueSchema.readTimeSec` (int 0–60) and the JSON Schema.

### UI

- One `RoomTimersFields` component (`answer-timer-settings.tsx`): radio "chips" per timer,
  used by the create step (local state + hidden form fields), and by `AnswerTimerSettings`
  (round preview, ⏱ sheet; saves on every change, optimistic while saving). Dark panel palette
  shared by both themes. The ⏱ button keeps showing the answer time; its label/tooltip is now
  "Room timers".
- New `step-timers.tsx`: `useWagerTimer`, `useFinalAnswerTimer`, `WagerTimer`,
  `FinalAnswerTimer` (reuse `AnswerTimerBar` with their own test ids and labels, plus the
  time's-up sound once per step), `useOnceWhenTimeUp`.

## Files

- Migration `supabase/migrations/20261026192800_clues_read_time_sec.sql`, `database.types.ts`.
- Engine: `app/engine/room-timers.ts` (new), `engine.ts`, `actions.ts`, `state.ts`, `admin.ts`,
  `use-game-engine.ts`, `use-engine-context.ts`.
- Server: `app/routes/room.$roomId.settings.tsx`, `app/routes/game_.$gameId.play.tsx`,
  `app/utils/room-timers-form.ts` (new), `app/session.server.ts`, `app/models/game.server.ts`,
  `app/models/convert.server.ts`, `app/models/siq/{parse,convert}.ts`,
  `app/routes/[game.schema.json].tsx`, `app/routes/upload-help.tsx`.
- UI: `app/components/answer-timer-settings.tsx`, `prompt/{prompt,answer-timer,step-timers,
wager-form,answer-form,read-clue-timer,buzz,buzz-button}.tsx`, `watch/{status.ts,
viewer-prompt.tsx}`, `admin-room/admin-panel.tsx`, `app/utils/media.ts`,
  `app/utils/offline-storage.ts`.
- i18n: `room.timers.*`, `room.create.*`, `play.stepTimer.*`, `play.wager.timerHint/timeUp`,
  `play.answer.timerHint/timeUpSent`, `uploadHelp.readTime*`; changed `room.answerTimeSettings`
  ("Room timers"), `room.answerTimeHelp`, `room.answerTimeBetweenQuestions`,
  `room.error.settingsAdminOnly` (EN/UK).

## Verification

- Engine `app/engine/engine-room-timers.test.ts`: defaults; the admin sets every timer; before
  anyone joined (room creation); any whole reading time 0–60 and back to Auto; left-out fields
  keep values; invalid values (each timer, mixed) ignore the change; non-player without the flag
  ignored, player (solo/old events) accepted; blocked while a question is open; buzz window
  table (4 s with 5 s / 3 s window, old 5001 with a 10 s window, 20001 with 20 s), applied to the
  check; replay deterministic; old events → defaults; wager/Final step starts and clears;
  minimum wagers accepted; Final with no wagers starts its answer time.
- Routes: `room.$roomId.settings.test.ts` (saves the timers, Auto → null, ranges → 400,
  non-admin → 403), `game_.$gameId.play.test.ts` (non-admin → room right away; admin → create
  step with defaults / last-used (invalid → defaults); chooser first; action 403 for
  non-admins, creates the room + first settings event + cookie, 400 for invalid values).
- Models: zod and DB mapping of `readTimeSec`; SIQ v4 `time` / v5 `duration` parsing and import
  (rounded, capped, none without hints).
- Components: `prompt/step-timers.test.tsx` (wager timeout: $5 Double Down once, others send
  nothing (UK), Off = no timer, $0 on the Final for the player who hasn't wagered (UK), TV
  countdown; Final: sends what was typed once and locks the box, empty answer on a late return
  (UK), nothing for a player who already answered, 90 s on the TV; 0 s reading + 3 s window
  sends "no buzz" 3001, default 5001, fixed 10 s reading); `answer-timer-settings.test.tsx`
  (options and defaults of each timer, saving each, other values kept, read-only in Ukrainian);
  `utils/media.test.ts` (`getRoomReadMs`).
- E2E `e2e/room-timers-room.spec.ts` (`db` project): the admin creates a room with reading 0 s,
  buzz window 3 s, wager 15 s in the create step; host and guest see the values (guest
  read-only); nobody buzzes and the answer shows within 5.5 s on both; on the Double Down both
  see the wager countdown and the host's device wagers $5 after 15 s. A non-admin's Play opens
  a room right away with the defaults (read-only) and the create action answers 403.
  `answer-timer-room.spec.ts` now goes through the admin's create step; `admin-timer-room`
  uses the new "Room timers" label.
- `jep-validate` green.

### Manual test script

1. Laptop: log in at `/admin`, open a game → **Play**: the **Room timers** page appears with
   the defaults. Pick reading **0 s**, buzz window **3 s**, wager **15 s** → **Create the room**.
2. Phone: open the room link, join. The round preview shows the same timers greyed out. Start
   the round on the laptop.
3. Open a $200 question: the buzzers open at once; don't buzz — after ~3 s the answer shows on
   both.
4. Open a Double Down (if the game has one): both see the yellow countdown; don't wager — after
   15 s the wager is $5 and the question is read.
5. Final: wait out the countdown with something typed on the phone — it is sent and the box
   locks; on the laptop "Time's up! Your answer was sent.".
6. Between questions tap **⏱** on the laptop and set the buzz window to 10 s: the phone shows it
   at once. During a question the ⏱ button is disabled.
7. Laptop: **Play** again on any game — the page now shows your last timers ("Your last room's
   timers are filled in."); **Use the defaults** resets them.
8. Switch to УКР and the Dark theme: the panel and countdowns are translated and readable.
9. Without the admin login, **Play** goes straight into a room with the defaults.
10. Upload a `.jep.json` with `"readTimeSec": 8` on a question: with Auto reading it stays
    8 s before the buzzers open.
