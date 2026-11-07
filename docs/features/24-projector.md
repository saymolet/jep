# Feature 24 — The game on a projector

**Branch:** `feat/tv-1080p`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** none

## Goal

Owner (verbatim): "I want the full game be visible on a 1920x1080 screen. So I want to plug in
the hdmi and send the video to projector so that everyone could see as a background how the
game plays."

The owner decided:

- The **host's laptop** drives the projector (extended display): the laptop screen keeps the
  host's view with the answers, and the projector shows the TV screen (feature 11), which never
  gets answers early.
- **Sound only from the projector** (its speakers or the laptop's).
- An open question takes the **whole screen**, with the players along the bottom.
- The TV screen at 1080p was cut off on the laptop: Windows display scaling (125–150%) gives
  the page 1536×864 or 1280×720 CSS pixels, and the bottom rows of a big board were cut off.

## How to use it

1. Plug the projector into the laptop. Set the display mode to **Extend**, not Duplicate.
2. Open the room and take the host seat. In the round preview, click **📽️ Open the TV
   screen**. It is also in the ⓘ menu as **Show on TV**.
   - In Chrome or Edge, the window opens on the projector. The first time, Chrome asks to
     "manage windows on all your displays": allow it.
   - In other browsers, or if you didn't allow it, drag the window to the projector.
3. On the projector window, click **▶ Click to start: fullscreen and sound** once. Esc leaves
   fullscreen.
4. While a TV screen is connected, players' phones and the host's own tab stay quiet: question
   audio/video, sound effects and soundboard sounds play only on the TV. The sound settings show
   "📺 A TV screen is connected: the sound plays there." Close the TV window and sound is back
   on every device.

## Design

- **Fit to the window:** `FitToBox` (`app/components/fit-to-box.tsx`) shrinks the board, the
  lobby and the game-over screen (CSS scale, centered, never enlarged) until they fit the
  window's height. A board with many rows on a 1280×720 window shows every row.
- **Question layout:** while a question is open, the side panel (players and QR code) is
  hidden and a one-row player strip (`presenter-player-strip`, team totals first in team mode)
  sits under the question.
- **Projector window:** `openTvWindow` (`app/utils/tv-window.ts`) opens the TV screen in a
  separate named window (`jep-tv`), not a tab, so fullscreen doesn't take over the host's
  window. When `screen.isExtended` is true and the Window Management API is available, it moves
  and resizes the window to the screen the host isn't on. The ⓘ menu item stays a real link
  (`…/present`), so its address can still be copied to a smart TV.
- **Start overlay:** until the TV page has been clicked or a key pressed, a full-screen button
  asks for that click. The click unlocks audio and requests fullscreen. It replaces the old
  "Tap anywhere to turn on sound" hint.
- **Sound on the TV only:** TV screens announce `presenter` presence; `countPresenters` feeds
  `tvScreens` in the engine context. The room page provides `SoundOnTvContext`
  (`tvScreens > 0`), and `useSoundSettings().mute` is on while it is true (`savedMute` keeps
  the device's own setting for the mute toggle). Every sound path (clue media, sound effects,
  the soundboard) already goes through `useSoundSettings`. The TV page has no such provider,
  so it plays. Tapping play on a question's audio still plays it on that device.

## Files

- `app/components/fit-to-box.tsx`, `app/components/watch/presenter.tsx`
- `app/utils/tv-window.ts`, `app/components/header.tsx`, `app/components/preview/preview.tsx`
- `app/engine/presence.ts`, `use-game-engine.ts`, `use-engine-context.ts`
- `app/utils/user-settings.tsx`, `app/components/sound/sound-control.tsx`,
  `app/routes/room.$roomName.tsx`
- i18n: `watch.openTvWindow`, `watch.openTvWindowHelp`, `watch.startTv`, `watch.startTvHelp`,
  `watch.soundOnTv` (`watch.soundHint` removed).

## Tests

- `app/components/fit-to-box.test.ts`, `app/utils/tv-window.test.ts`,
  `app/engine/presence.test.ts` (countPresenters), `app/components/prompt/clue-media.test.tsx`
  (no autoplay while the TV plays the sound).
- `e2e/presenter-fit-room.spec.ts`: at 1920×1080 and 1280×720 an 8×8 board fits without
  scrolling, an open question shows the player strip, the start overlay works, and players see
  that the sound plays on the TV.
- `e2e/host-role-room.spec.ts`: the host's **Open the TV screen** opens a `/present` window.
