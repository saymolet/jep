# Feature 15 — Soundboard (F12b)

**Branch:** `feat/soundboard`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** none

## Goal

Party vibe: players tap fun reaction sounds (applause, drumroll, ta-da, air horn…) that play
on every device in the room — the other players' phones, spectators and the TV — with a
small "🎺 Ann" toast so everyone sees who it was. Nothing is stored: the soundboard has no
effect on the game, its replay or the summary.

## How to use it

1. **In a room, as a player:** a round **🎺** button floats at the bottom left (above the big
   BUZZ button when a question is open on a phone). Tap it to open the soundboard: a 3×3
   grid of big emoji buttons — 👏 Applause, 🥁 Drumroll, 🎺 Ta-da!, ❌ Wrong!, 📯 Air horn,
   😂 Ha-ha, 😮 Ooh!, 🦗 Crickets, 🔔 Ding!. Tap a sound: it plays on your device and on
   everyone else's, and everyone sees "👏 Ann" at the top of the screen for 2.5 s. The
   panel stays open for more taps; tap outside it (or Escape) to close.
2. **One sound every 2 seconds:** after a tap the buttons are dimmed, a yellow bar runs out
   and the hint says "One sound every 2 seconds".
3. **Spectators** ("Just watch") and the **TV page** hear the sounds and see the toasts
   (bigger, top right on the TV) but have no soundboard button.
4. **Muting:** the game's mute button / volume apply to soundboard sounds too. On top of
   that, **Mute soundboard on this device** (in the soundboard panel, the game menu's sound
   settings and on the profile page) silences only the soundboard, only on this device —
   e.g. keep reactions on the TV but not on every phone. Toasts still show.
5. **Ukrainian:** **Звукова панель**, "Натисни на звук — його почують усі в кімнаті.",
   **Оплески**, **Барабанний дріб**, **Та-дам!**, **Мимо!**, **Гудок**, **Ха-ха**, **Ого-о!**,
   **Цвіркуни**, **Дзень!**, **Вимкнути звукову панель на цьому пристрої**.

The soundboard is not shown in solo play, and not while the round preview dialog (join /
Start round) is open, because that dialog is modal.

## Design decisions

- **Realtime broadcast, not room events.** A sound is an ephemeral broadcast (event
  `soundboard`, payload `{ sound, userId, name }`) on the existing room channel
  `realtime:roomId:<id>` — the one already used for `postgres_changes` and presence. No DB
  write, no migration, nothing in the replay or summary. `useGameEngine` registers one more
  `.on("broadcast", { event: "soundboard" })` handler on the same channel object, so the
  subscribe / reconnect / staleness logic is untouched (covered by the existing
  `use-game-engine.test.tsx` plus new cases). Listeners live in a set owned by the hook, so
  they keep working across reconnects (new channel instances). `engine.soundboard`
  (`RoomBroadcast`: `available`, `send`, `subscribe`) is `NO_BROADCAST` in solo play.
  `send` drops the message while the channel is not joined (no REST fallback, no queue).
  Broadcast `self` is off (Supabase default), so the sender plays its own sound locally.
- **Sounds are synthesized** with the Web Audio API (`app/utils/soundboard/synth.ts`): no
  audio files to license or host. Each effect is a few oscillators / filtered noise bursts
  with envelopes, ≤ 2 s:
  applause = band-passed noise "claps" over a noise bed swelling in and out; drumroll =
  crescendo of high-passed noise snare strokes + a triangle body, ending in a cymbal crash
  and a kick; ta-da = two brass chords (detuned saws through an opening low-pass, vibrato on
  the long one); wrong = raspy low square+saw buzz with a pitch drop; air horn = three
  distorted detuned saw blasts (short, short, long) with a pitch bend; ha-ha = five
  falling "ha" syllables (saw through "a" formant filters + breath noise); ooh = six-voice
  crowd through "oo" formants rising then falling; crickets = two crickets of triple sine
  pulses at 4.4 / 4.75 kHz; ding = two-strike bell from inharmonic sine partials.
- **Loudness normalization:** every sound was rendered with an `OfflineAudioContext` in
  headless Chromium and its per-sound gain (`SOUND_LEVEL`) set so the loudest 30 % of the
  sound is ≈ −16 dBFS RMS (crickets −20 because high-pitched sounds seem louder; drumroll
  −19.5 so its crash stays below clipping), with every peak < 1 at volume 1. Live playback
  also goes through a `DynamicsCompressor` limiter so overlapping sounds don't clip. The
  user's game volume scales it (default 0.5).
- **Autoplay policies:** the `AudioContext` is created lazily — on the first tap/click/key
  press on the page (a capture listener installed while a room/TV page is open), or when a
  sound is played after the page was interacted with (`navigator.userActivation`). Before
  any interaction nothing is created (no console warnings) and the sound is skipped; the TV
  page already shows "tap to turn on sound".
- **Abuse / annoyance limits** (`SoundboardLimiter`):
  - sender: one sound per **2 s** (buttons dimmed while cooling down);
  - receivers ignore a sender's sounds arriving less than **1.7 s** apart (a bit below 2 s so
    network jitter doesn't drop honest sounds, but a modified client can't spam);
  - at most **3 sounds overlap** on a device; more are skipped (the toast still shows);
  - receivers accept sounds only from **current players** of the room (by `userId`); the
    toast shows the name from the room's player list, not the payload. Spectators and the
    TV can't send in the UI, and a forged message from a non-player is ignored. (Broadcast
    messages are not authenticated, so a malicious client could claim another player's
    id; the impact is at most one sound per 1.7 s per player id.)
  - unknown sound ids and malformed payloads are dropped (`parseSoundboardMessage`).
- **During questions:** allowed — it's a party, and reactions to an answer ("Wrong!",
  applause) are the main use. But while a question with **audio or video** (question or
  answer media) is on screen, soundboard sounds play at **35 %** volume (ducking) so they
  don't drown out the clip.
- **"Mute soundboard"** is per device in `localStorage` (`jep-soundboard-mute`), read with
  `useSyncExternalStore` (server snapshot `false`, so SSR and hydration match), synced across
  tabs via the `storage` event. It is not an account setting on purpose: the same account
  may want reactions on the TV but not on the phone.
- **Placement:** a floating button (fixed, bottom left, `z-30`) is the only spot reachable
  both on the board and inside the full-screen question, without covering the BUZZ button
  (lifted above it and the countdown on phones via the `buzzbar` CSS variant, so server and
  client render the same HTML). Players get a 4 rem spacer at the end of the page so it
  never covers the last row of the scoreboard. Enter on soundboard controls doesn't reach the
  prompt's "Enter buzzes" listener.
- **Test hook:** each toast has `data-sound` and `data-played` ("true" when the sound was
  actually handed to the synthesizer on this device), which e2e tests use to check mute
  without listening to audio.

## Files

- `app/utils/soundboard/messages.ts` — sound list (ids, emoji, label keys), event name,
  `parseSoundboardMessage`.
- `app/utils/soundboard/limiter.ts` — `SoundboardLimiter` (send / receive cooldowns,
  overlap cap).
- `app/utils/soundboard/synth.ts` — the nine synthesized sounds, durations, levels,
  `scheduleSound`.
- `app/utils/soundboard/audio.ts` — lazy `AudioContext` + limiter bus, unlock on gesture,
  `playSoundboardSound`.
- `app/utils/soundboard/mute.ts` — per-device "Mute soundboard".
- `app/engine/room-broadcast.ts` (new) — `RoomBroadcast`, `NO_BROADCAST`, listener set;
  `use-game-engine.ts` (broadcast handler + `soundboard` in the engine), `use-engine-context.ts`.
- `app/components/soundboard/` (new) — `useSoundboard` hook, `Soundboard`, panel, toasts,
  mute toggle.
- `app/components/game.tsx` (button + toasts for players / spectators),
  `watch/presenter.tsx` (TV: listen only), `sound/sound-control.tsx` (mute toggle in the
  sound settings).
- `app/styles.css` — cooldown bar animation.
- i18n: `app/i18n/{en,uk}/soundboard.ts` (new area `soundboard.*`).
- `e2e/soundboard-room.spec.ts`, `playwright.config.ts` (db project).

## Verification

- Unit: `app/utils/soundboard/messages.test.ts` (sound list; valid / trimmed / extra fields;
  null, string, array, unknown id, prototype key, missing / empty / huge userId, non-string
  name), `limiter.test.ts` (send cooldown, ready time, refused presses don't extend it,
  per-sender receive throttle and jitter margin, spam can't extend it, overlap cap and slot
  release), `synth.test.ts` (every sound schedules on a mocked `AudioContext` without
  throwing — the mock throws like the browser on exponential ramps to 0 — every source
  starts now and stops within its duration ≤ 2 s, all automation inside the window, output
  gain = volume × level, volume clamped, scheduling later).
- Engine: `app/engine/room-broadcast.test.ts`; `use-game-engine.test.tsx` — sends only while
  joined, listeners receive broadcasts and survive a reconnect, room events still arrive.
- Components: `app/components/soundboard/soundboard.test.tsx` — grid of 9 and sending (payload,
  local play at the user's volume, toast, toast expiry), 2 s cooldown, receiving with toast
  and screen-reader text, malformed / unknown / non-player / own-echo ignored, fast sender
  ignored, soundboard mute (toast but no playback), mute from the panel stored per device,
  game mute, ducking during a question with audio, spectator and TV listen only, nothing in
  solo play, Ukrainian, toggle in the sound settings only in the full control.
- E2E: `e2e/soundboard-room.spec.ts` — host + guest + spectator: no button for the
  spectator; host taps Applause → guest sees "👏 <host name>" and it played, the spectator
  sees it too; guest mutes the soundboard → host's Ding! shows on the guest with
  `data-played="false"`, stored in localStorage; the muted guest can still send (host hears
  Crickets).
- Manually checked screenshots (phone 390×844 with touch, desktop, TV 1280×720): the button
  sits above the BUZZ button and countdown, the panel fits a phone, toasts on all three.
- Loudness table (offline render, volume 1, after `SOUND_LEVEL`): peaks 0.31–0.95, loud RMS
  −15.8 … −16.1 dBFS (crickets −20.2, drumroll −19.5).

### Manual test script

1. Open a room on a laptop, join; open it on a phone, join; open **Show on TV** in another
   window and click it once (sound on). Start the round.
2. On the phone tap **🎺** → **Applause**: the phone, the laptop and the TV play applause and
   show "👏 <phone name>". Tap another sound right away: nothing (dimmed, "One sound every 2
   seconds"); after 2 s it works.
3. Try every sound once and judge if they're recognisable and about equally loud (they are
   synthesized — tweak `synth.ts` if one is off).
4. Open a question: on the phone the 🎺 button is above the BUZZ button; play "Drumroll"
   while it's read, then "Wrong!" / "Applause" after an answer.
5. On the laptop tick **Mute soundboard on this device** (in the panel or the game menu):
   phone sounds still show toasts on the laptop but are silent there; the TV still plays.
   The game's mute button silences both game sounds and the soundboard.
6. "Just watch" in a third browser: no 🎺 button, but toasts and sounds arrive.
7. Switch to УКР: labels and toasts in Ukrainian.
