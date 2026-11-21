# Feature 27 — Buzzers like SIGame, host multipliers, a calmer soundboard

**Branch:** `feat/buzzer-flow`
**Status:** ✅ implemented & tested
**Migration:** none. There are new room event types (`open_buzzers`, `close_buzzers`) and new
optional payload fields (`check.multiplier`, `set_settings.soundboard`); room events are
inserted only by the server.
**New dependencies:** none

## Goal

Feedback from the first real game night (2026-11-20), in the owner's words:

- "Саундбар прибрати. Або запропонувати як ого покращити щоб це не заважало грі" (remove the
  soundboard, or improve it so it doesn't disturb the game).
- "На відео вопросах можна отвічать тільки після того як відео закончиться" (on video questions,
  answering only after the video ends).
- "Нада шоб люди не знали коли начнем отвічать" (people shouldn't know when buzzing opens).
- "Хост не може пропустити поки всі не пропустили, потрібно привязуватися до таймеру питання а
  не до людей" (the host can't move on until everyone has passed; follow the question's timer,
  not the people).
- "0.5х 2х очки на вопроси" (half and double points).

The owner's decisions: the soundboard works only between questions; buzzing opens with no
countdown, plus a random delay and an early-press penalty; both audio and video delay the
buzzers; the host picks ×0.5 / ×2 when judging.

## How it plays

- While a question is read there is **no countdown** on any screen (no growing bar, no fill on
  the phone's BUZZ button). The buzzers open once the question is read **and** its audio/video
  is over, plus a **random 0.5–2.5 s**. The bar then turns green and shrinks over the buzz
  window, and "Buzzers open!" shows on the TV and for spectators.
- **Pressing too early** locks that player out for **1 s**. It used to be 250 ms, and only
  during the reading time.
- **The timer decides, not the phones.** When the buzz time is over, or about a second after
  the first buzz, the buzzers close. Players whose phone hasn't reported count as not buzzing.
  The host gets Right/Wrong right away even if a phone is asleep or lagging.
- **Host:** next to ✗ Wrong / ✓ Right there are **✓ ×½** and **✓ ×2**. They give half or
  double the question's value for a right answer (rounded). A wrong answer is the normal
  penalty.
- **Soundboard:** works only between questions (board, round preview, answer shown, game
  over). Sounds that arrive during a question are dropped and the button is hidden. It plays at
  half the game volume, one sound per 3 s per player, at most 2 at once. In the room settings
  panel (host / admin), **Soundboard** switches it off for the whole room.
- **Admin panel:** while the game waits for buzzes, **Open the buzzers now** / **Close the
  buzzers now** handle a stuck opener device.

## Design

- **Opener device:** in host mode, the host's device (`useBuzzerOpener` in `HostPromptContent`,
  tagged `host: true`). Otherwise the device of the player with board control. Other players'
  devices step in **4 s later** if the opener's device is asleep. The server ignores duplicates
  (`app/components/prompt/use-buzzer-opener.ts`).
  - **Open time:** `max(reading time, end of the clue's first audio/video) + random`. The clip's
    length comes from its metadata (a hidden, muted media element), so it also works when the
    host's own tab is muted because the TV plays the sound (feature 24). A host replay (feature 23) before the buzzers open restarts the wait from the replay. YouTube clips have no known
    length and fall back to the reading time. A re-read after a wrong answer uses the short
    re-read time and doesn't wait for the clip.
  - **Close time:** 1.3 s after the first buzz is seen, or buzz window + 0.5 s after opening.
- **Route** `POST /room/:roomId/buzzers` (`intent` open | close, `round`, `i`, `j`, `userId`):
  - **Who:** in host mode only the host or the admin; otherwise a player or the admin.
  - **Ignored, not an error:** requests for a question that already moved on, buzzers already
    opened or closed, and a player's close that comes too early (`mayCloseBuzzersYet` in
    `app/models/buzzers.ts` checks the event timestamps, with 1.5 s clock tolerance).
  - **Solo play** (room -1) gets the action back for the in-browser engine.
- **Engine:**
  - `state.buzzersOpen` is reset whenever a question is (re-)read (a wrapper around the
    reducer).
  - `open_buzzers` sets it.
  - `close_buzzers` fills every missing buzz with "didn't buzz" (window + 1 ms) and resolves the
    question like the last buzz used to (`resolveBuzzes`).
  - The engine doesn't gate `buzz` on `buzzersOpen`; devices do, so old rooms replay exactly as
    before.
- **Multiplier:** the check route accepts `multiplier` 0.5 | 2 only from the host or the admin,
  only on a right answer. The engine stores it in `ClueAnswer.multipliers`, and
  `getScoreChanges` uses it so the "+$X" chips match.
- **Players' devices:**
  - `ReadCluePrompt` opens its buzzer when `buzzersOpen` arrives and measures buzz times from
    that moment (fair to each phone's network delay).
  - It still sends its own "didn't buzz" after the window.
  - Spectators and the TV show "Buzzers open!" from the state.
- **Soundboard setting:**
  - Stored as `set_settings.soundboard` → `state.soundboardOff`; the engine context exposes
    `soundboardEnabled`.
  - The panel checkbox is `soundboard-setting`.
  - The admin's remembered new-room settings include it.

## Files

- Engine: `app/engine/engine.ts`, `actions.ts`, `state.ts`, `standings.ts`,
  `use-game-engine.ts`, `use-engine-context.ts`.
- Routes and models: `app/routes/room.$roomId.buzzers.tsx`, `app/models/buzzers.ts`,
  `app/routes/room.$roomId.check.tsx`.
- Devices: `app/components/prompt/use-buzzer-opener.ts`, `prompt.tsx`, `buzz-button.tsx`,
  `app/components/host/host-prompt.tsx`, `app/components/watch/viewer-prompt.tsx`,
  `app/components/admin-room/admin-panel.tsx`.
- Soundboard and settings: `app/components/soundboard/use-soundboard.ts`,
  `app/utils/soundboard/limiter.ts`, `app/utils/room-timers-form.ts`,
  `app/components/answer-timer-settings.tsx`.

## Tests

- `app/engine/engine-buzzers.test.ts`: who opens, re-read resets, close resolves with missing
  phones, ×0.5 / ×2 and the score chips.
- `app/models/buzzers.test.ts`: close timing.
- `app/routes/room.host-role.test.ts`: the buzzers route.
- `app/components/prompt/step-timers.test.tsx`: the opener's timing; no-buzz after the window.
- Soundboard and settings tests: between questions only, the room switch, volume.
