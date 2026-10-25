# Feature 11 — Spectator mode + TV (presenter) mode

**Branch:** `feat/spectate-present`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** `uqr` (QR code encoder, MIT, zero dependencies)

## Goal

- **Spectators:** friends who only want to watch can open a room without joining the game,
  follow the board and the questions live, and join later if they change their mind.
- **TV / presenter mode:** a big-screen view of a room for a TV, or a laptop connected to a
  TV or projector: large board, the open question with its media, the answer once it is
  revealed, players with avatars and scores, what is happening right now — and a QR code so
  people in the room scan it with their phones to join.

## How to use it

### Watching a room

1. Open a room link (`/room/:roomName`). The **Join game** dialog now has a second button,
   **Just watch**.
2. **Just watch** closes the dialog without joining (no Join is sent). A small floating
   **👁 Watching · Join game** badge stays in the bottom-right corner; **Join game** reopens
   the join dialog.
3. Spectators see the board, the questions (with pictures/audio/video), multiple choice
   options, buzzes, the revealed answer, scores and a status line ("Ann is answering",
   "Buzzers open!", …). They have no buzzer, can't choose questions, pause, resume, toggle
   the clock or kick anyone.
4. Everyone in the room sees how many people are watching ("👁 2 watching") next to the
   clock (and on the TV screen). Only a count — no names.

### TV / presenter screen

1. In a room, open the game menu (ⓘ in the header) → **Show on TV**. It opens
   `/room/:roomName/present` in a new tab — use it on a laptop connected to the TV, or type
   / copy that address into the TV's browser.
2. The page has no site header, no join dialog and no controls. Top bar: game title and
   round, watcher count, game clock, sound (mute) and **Fullscreen**.
3. What it shows:
   - **Round preview (lobby):** a large QR code with the room's join URL
     (`BASE_URL/room/:roomName`) and the URL in text, the game title, "Round 1 of 2", the
     players who joined (big avatars), and "Round 1 is about to start · Ann chooses first"
     (or "Waiting for players to join...").
   - **Board:** the board across the whole width; "Ann is choosing a question".
   - **Question open:** category and value, the question text (fitted large), its
     pictures/audio/video, multiple choice options, buzzes, and the state: "Get ready to
     buzz..." → "Buzzers open!" → "Ann is answering" / "Ann is picking an answer" →
     "Ann got it!" / "No one got it" with the answer (and answer media) revealed.
   - **Wagers:** "Ann is placing a wager" / final: "Players are placing their wagers (1 of 2)",
     "Players are writing their answers", "Players are checking their answers" with every
     player's written answer.
   - **Cat in the bag:** the "Cat in the bag!" banner with topic and value, "Ann is choosing
     who gets the cat in the bag", then "Cat in the bag: Bob is answering".
   - **Pause:** the "Game paused" overlay (without the Resume button).
   - **Game over:** "Game over!", the winner(s) with crown and avatar ("Ann wins!" / "It's a
     tie: …") and the final standings. The TV stays on this screen (players are sent to the
     summary as before).
   - Players are always listed on the right, highest score first, the player with board
     control highlighted. During play the QR code stays small in the bottom-right corner.
4. **Fullscreen** uses the Fullscreen API (the button only appears where it is supported).
   The screen is kept awake with the Screen Wake Lock API where supported; the lock is
   re-acquired when the tab becomes visible again.
5. **Sound:** browsers block audio that starts before anyone touched the page, so the TV
   shows "🔊 Tap anywhere to turn on sound" until the first tap/click/key press (pressing
   **Fullscreen** counts).

## Design decisions

- **Read-only by construction, no forked game logic.** Both views read the same engine
  context (`useGameEngine` → `GameEngineContext`) as the players. A new
  `ViewerPromptContent` (`app/components/watch/viewer-prompt.tsx`) renders an open question
  read-only from that context, reusing the players' building blocks (`ClueText`,
  `CategoryFor`, `revealMedia`, `ConnectedChoiceList`, `Buzzes`, `SecretClueBanner`,
  `ShinyText`) — but none of the forms, buzz handlers or timers that submit actions. The
  room page uses it (in the same full-screen frame as the players' prompt) for everyone who
  is not a player; the TV uses it in its main area with a `tv` size variant.
- **"What is happening" is a pure function.** `getViewerStatus` (`watch/status.ts`) maps the
  engine state to a status (`choosing`, `buzzersOpen`, `answering`, `secretAnswering`,
  `picking`, `finalWagers`, `gameOver`, `paused`, …), translated in one place. Players'
  devices open the buzzers locally after the "read" time; viewers time it the same way
  (`useBuzzersOpen`, display only).
- **Non-players never send anything.** In the room, a visitor who is not in `players` (still
  deciding in the join dialog, or watching) gets: the read-only prompt instead of the
  players' prompt, a read-only board (`readOnly` on `ConnectedBoardComponent` — also covers
  the final's single clickable clue), no pause control, a read-only clock, the pause overlay
  without Resume, and no kick buttons (`canKick` now requires being a player). This also
  fixes an older issue: a visitor sitting on the join dialog during a question used to send
  automatic "time out" buzzes from the players' prompt.
  - Note: as before, the server does not authenticate who sends a room event (RLS lets anyone
    insert); the engine ignores actions from non-players where it matters. This feature only
    removes the UI that would send them.
- **"Just watch" is local state.** The choice lives in the room route (`watching`), so it
  lasts for the visit; a reload shows the join dialog again (a deliberate, cheap default —
  nothing is stored).
- **Spectator count with Realtime presence (count only).** `useGameEngine` takes an optional
  presence role (`player` / `spectator` / `presenter`) and announces it with
  `channel.track({ role })` on the existing room channel (same channel as the
  `postgres_changes` subscription; presence key = random UUID per connection, created in the
  effect). A `presence` `sync` listener counts metas whose role is `spectator`
  (`countWatchers`, `app/engine/presence.ts`) and the engine exposes `watchers`. The role is
  re-tracked on the live channel when it changes (a spectator joins → `player`), and
  re-announced after every (re)subscribe. TVs announce `presenter` and are not counted.
  Presence is best-effort: if it fails, only the count is wrong. Solo play has no presence
  (count 0). No names or user ids are shared.
- **QR code: `uqr`.** Small (≈80 KB unpacked, tree-shakeable ESM), zero dependencies, MIT,
  TypeScript types, maintained in the UnJS ecosystem, works the same in Node and the browser.
  The alternative `qrcode` pulls in `pngjs`, `yargs` and `dijkstrajs`, is CommonJS and mostly
  about PNG/canvas output. We only use `encode()` and draw the modules ourselves as **one SVG
  `<path>`** (`app/utils/qr.ts`, horizontal runs merged), rendered as plain JSX — no
  `innerHTML`. Error correction "M", 2-module quiet zone, white background so it scans on
  dark screens.
- **No hydration mismatch.** The QR markup depends only on the URL (server `BASE_URL` +
  room name, from the loader), so server and client render the same SVG. Fullscreen support,
  wake lock, `navigator.userActivation` and the presence key are only touched in effects;
  the Fullscreen button appears after mount. `e2e/hydration-room.spec.ts` now also loads the
  presenter page (both extreme time zones).
- **Presenter route** `app/routes/room.$roomName_.present.tsx` (`/room/:roomName/present`,
  the trailing `_` keeps it out of the room page layout, like `summary`). Its loader only
  reads the room (`getRoomByName`, extracted from the room loader), game and events — no
  session cookie, no anonymous→account transfer, no redirect at game over. The page sets
  `handle = { chromeless: true }`; `root.tsx` then skips the site header and footer.
- **Layout.** Landscape TVs (`lg` and up): main area + a 320–384 px sidebar with player
  tiles and the small QR code; the page is exactly one screen high. On narrow screens the
  sidebar moves under the main area and the page scrolls (the small QR is hidden there — a
  phone is not a TV). The board drops its 1024 px cap on the TV to use the full width.
- **Media on the TV** plays like on every other device: audio/video start automatically while
  a question is read (not again after a wrong answer), secret questions start when they reach
  their receiver, answer media starts on reveal. Players' phones also play the media (existing
  behaviour). With a TV in the room, players can mute their phones with the existing
  per-device sound setting (game menu → sound, or the speaker icon in the round dialog); the
  TV has the same mute/volume button in its top bar. Media is not synchronised between
  devices — each starts when it receives the event.

## Files

- `app/components/watch/` — `status.ts` (viewer status, winners, sorting), `viewer-prompt.tsx`
  (read-only question view, status line, `SpectatorPrompt`), `spectator-bar.tsx`
  (Watching badge, watcher count), `presenter.tsx` (TV layout), tests and
  `fixtures.test-helpers.ts` (a small game played through the real engine).
- `app/routes/room.$roomName_.present.tsx` — presenter route; `app/routes/room.$roomName.tsx`
  — `watching` state, presence role; `app/models/room.server.ts` — `getRoomByName`.
- `app/engine/presence.ts`, `app/engine/use-game-engine.ts` (presence), `use-engine-context.ts`.
- `app/components/preview/preview.tsx` (Just watch), `game.tsx`, `board/board.tsx`
  (`readOnly`), `player/player.tsx` (kick only for players), `pause.tsx` (`canResume`),
  `game-clock.tsx` (`readOnly`), `prompt/prompt.tsx` (exports, `PromptFrame`,
  `PROMPT_STATES`, `ClueText variant="tv"`), `header.tsx` (Show on TV), `root.tsx`
  (chromeless pages).
- `app/utils/qr.ts`, `app/components/qr-code.tsx`, `app/utils/use-fullscreen.ts`,
  `app/utils/use-wake-lock.ts`.
- `app/i18n/{en,uk}/watch.ts` — new message area (English + Ukrainian).

## Verification

- Unit: `qr.test.ts` (path redraws exactly the modules of `uqr`'s encoding, deterministic,
  quiet zone); `presence.test.ts` (counts spectators only, latest role wins);
  `use-game-engine.test.tsx` (tracks the role after SUBSCRIBED, re-tracks/untracks on change,
  counts from presence sync); `status.test.ts` (every GameState through a full game played
  with the real engine: lobby, board, reading/buzzers open, answering, got it / no one,
  wager, cat in the bag hand-over and receiver, multiple choice, final wagers/answers/checks,
  game over winners, pause); `presenter.test.tsx` (renders each state: QR + join URL in the
  lobby, board with sorted players and small QR, question without/with answer, wagers, cat in
  the bag without the chooser's buttons, options, final, winner and standings, pause without
  Resume, Ukrainian; and never a player control or a posted room action);
  `spectator.test.tsx` (Just watch closes the dialog and posts nothing, Join game reopens it,
  no buzz/pause/kick and no timeout buzz during a question, board clicks send nothing, pause
  without Resume, Ukrainian).
- E2E (`e2e/watch-room.spec.ts`, `db` project): (1) a spectator opens a room, clicks **Just
  watch**, the player sees "1 watching" (presence), the player opens a question and the
  spectator sees it with no buzz hint and no enabled buzz/reveal button, follows "is
  answering", and never POSTs a room action; (2) the TV page shows the QR code whose
  `data-value` is the room URL and whose SVG path equals the encoding of that URL, no header
  or dialog, then follows the player live (joined → round about to start → choosing → the
  question → is answering → got it + answer → winner at game over, staying on `/present`),
  "Show on TV" links to it, no hydration errors; (3) Ukrainian: TV ("Скануй, щоб
  приєднатися", QR label, status) and spectator ("Просто дивитися", "Глядач",
  "Приєднатися"). `e2e/hydration-room.spec.ts` also loads the presenter page.
- `jep-validate`: see the status log / PR.

### Manual test script

1. On a laptop, start a room for any game (Play with friends). Join it.
2. Game menu (ⓘ) → **Show on TV**: a new tab opens without the site header, with a big QR
   code. Press **Fullscreen**. Leave it open for a few minutes: the screen must not dim
   (Chrome/Edge/Safari 16.4+).
3. Scan the QR code with a phone: it opens the room's join dialog. Join → the TV shows the
   new player's avatar.
4. On another phone open the room link and tap **Just watch**: the Watching badge appears;
   the TV and the players show "👁 1 watching". Tap **Join game** on the badge → the dialog
   is back; tap **Just watch** again.
5. Start the round and play a few questions: the TV and the spectator follow (question,
   "Buzzers open!", "X is answering", answer and "X got it!"); the spectator can't buzz
   (tapping the question does nothing). Try a media question (upload
   `app/static/mock-media.jep.json` as a game): it plays on the TV too; mute a phone with the sound button.
6. Pause from a player: the TV and the spectator show "Game paused" without a Resume button.
7. Play a cat-in-the-bag question and a final with wagers: the TV shows the hand-over and
   the wager progress, then the written answers.
8. Finish the game: players go to the summary; the TV shows the winner and standings.
9. Switch to **УКР** on the TV tab (cookie) and reload: all TV texts are Ukrainian.
10. Phone width: the TV page stacks (players under the board), the spectator badge doesn't
    hide anything important.
