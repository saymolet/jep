# Feature 07 — Player avatars

**Branch:** `feat/avatars`
**Status:** ✅ implemented & tested
**Migration:** none

## Goal

Let each player pick an avatar — a fun emoji or their own photo — shown in their player bubble
instead of the first letter of their name. No file hosting.

## How to use it

- **Joining a room:** the "Join game?" dialog has a grid of 28 emoji, an **Upload photo** button
  and **Remove**. The big bubble at the top previews the choice. Picking is optional.
- **In game:** the 🙂 button next to your name (score box, and the round preview dialog) opens
  **Choose your avatar**; picking an emoji/photo or Remove applies it at once for everybody.
- **Profile (logged in):** the 🙂 button in the defaults box opens **Default avatar**, saved to
  the account like the default name and color, and pre-selected when joining a game.
- Guests (and logged-in players without a default) get the avatar they last picked on this
  device pre-selected.
- Without an avatar the bubble is the initial letter on the player color, as before.

## Design decisions

### Representation

An avatar is one string, so it fits in room event payloads and user settings as-is
(`app/models/avatar.ts`):

- `"emoji:🦊"` — an emoji (1–16 code points, emoji characters only, at least one pictograph).
- `"data:image/(webp|jpeg|png);base64,…"` — a photo, at most **24 KB** in total, with a valid
  base64 body. SVG, GIF, remote URLs etc. are rejected.

### Photos: no hosting, resized in the browser

`app/utils/avatar-image.ts` decodes the picked file (`createImageBitmap`, falling back to
`<img>`), crops the largest centered square, draws it at **96×96** on a canvas (white
background, so transparent pictures don't turn black as JPEG) and encodes it as **WebP**. When
the browser can't encode WebP (`toDataURL` silently returns PNG, e.g. older Safari) it uses
**JPEG**. Quality steps down (0.85 → 0.3) until the result fits the cap. A 96×96 photo is
usually a few KB. The data URL travels inside the Join/ChangeName payload (`avatar`), is stored
in `room_events` and reaches other players over realtime like any other event — no Storage
bucket, no new table.

The file input is `accept="image/*"` without `capture`: on phones that already offers "Take
photo" next to the gallery, while `capture` would hide the gallery on Android. iOS converts HEIC
to JPEG when handing the file to the browser.

### Validation (defense in depth)

- **Route** (`room.$roomId.player.tsx`, zod `PlayerFormPayload`): `avatar` must be a valid avatar
  or `""` (remove), otherwise **400**.
- **Engine** (`PlayerPayload` in `actions.ts`): an invalid avatar in a stored event (events can be
  inserted directly) is dropped, not fatal — the Join/ChangeName still applies, just without
  the avatar. Old events without `avatar` work unchanged.
- **Rendering** (`PlayerIcon`) parses the avatar again and falls back to the initial letter.
- **Settings** (`gameDefaults.playerAvatar`): an invalid stored value is dropped without
  invalidating the rest of the settings.
- CSP already allows it: `img-src 'self' data: https:` in `entry.server.tsx`.

### Engine semantics

- `Join` with a valid `avatar` sets it; `""`/invalid/missing → no avatar.
- `ChangeName` **without** `avatar` keeps the current avatar (renaming sends no avatar, so it
  doesn't re-send a photo on every rename); a valid avatar replaces it; `""` removes it; an
  invalid one is ignored. Avatar changes use their own fetcher so they don't cancel a rename in
  flight.

### Persistence

- Every pick (join dialog or in game) is remembered in `localStorage["jep-avatar"]`.
- Logged-in players additionally have `settings.gameDefaults.playerAvatar` (schema extended
  compatibly; no migration — `accounts.settings` is jsonb), set on the profile page only — like
  name and color, an in-game change does not overwrite the account default.
- The join dialog pre-selects: the account default, otherwise the device's last pick.

### Where avatars show

- `PlayerIcon` (`app/components/player/player-icon.tsx`, moved out of `player.tsx`, now with
  sizes `sm`/`md`/`lg`): emoji large on the player color; photo as a round image with the player
  color as a ring. Used by the score boxes, round preview, buzzer list, kick/leave menu, join
  dialog player list (new), profile, and the summary page (score boxes + replay score chips).
- Rooms-in-progress list: **emoji avatars only**; photos keep the colored dot. That list is in the
  loader data of the game page (up to 8 rooms × N players) and is only a glance, so it shouldn't
  carry several KB per photo.
- The tiny buzz dots on the summary replay board stay letters (too small for a picture).

## Not done / limitations

- A photo adds a few KB to each Join/ChangeName event that carries it; every client downloads
  the room's events, so a player who changes photos many times grows the room's history a bit
  (24 KB cap per event).
- A logged-in player's default photo is part of the settings sent with every page load (root
  loader) and re-posted with every settings change — a few KB.
- No cropping UI: photos are center-cropped.
- The rooms-in-progress list doesn't show photos (see above).

## Files

- `app/models/avatar.ts` (+ test) — format, presets, `isValidAvatar`, `normalizeAvatar`,
  `parseAvatar`, zod `AvatarInput`.
- `app/utils/avatar-image.ts` (+ test) — crop/resize/encode; `app/utils/avatar-storage.ts` —
  localStorage + `useJoinAvatar`.
- `app/engine/state.ts` (`Player.avatar`), `actions.ts` (`PlayerPayload`, `PlayerFormPayload`),
  `engine.ts` (Join/ChangeName); `engine.test.ts`, `player-payload.test.ts` (new).
- `app/routes/room.$roomId.player.tsx` — validation, pass-through.
- `app/models/user-settings.ts` (+ new test), `app/utils/user-settings.tsx` — `playerAvatar`.
- `app/components/player/player-icon.tsx` (new, + test), `avatar-picker.tsx` (new),
  `player.tsx`, `edit-player.tsx`, `kick-player.tsx`; `app/components/icons/face-smile.tsx`.
- `app/components/preview/preview.tsx` — picker in the join dialog.
- `app/routes/profile/route.tsx` — default avatar dialog.
- `app/models/active-rooms.ts` (+ test), `app/components/active-rooms.tsx`.
- `app/routes/room.$roomName_.summary/replay-board.tsx`.
- `e2e/avatars.spec.ts`, `e2e/avatars-room.spec.ts`, `e2e/assets/avatar.png`,
  `e2e/helpers.ts` (`pickEmoji`), `playwright.config.ts` (db project).

## Verification

- Unit: avatar accept/reject table (emoji, compound emoji, flag, png/webp/jpeg, at the 24 KB cap;
  empty, no prefix, text, too long, SVG, GIF, non-base64, bad base64/padding, http/javascript
  URLs, over the cap, non-strings); route payload accepts/rejects with 400; engine Join with
  emoji / photo / invalid / empty, ChangeName set / keep / remove / invalid ignored, replay of
  stored events with old events, valid avatars and directly inserted invalid ones; settings keep a
  valid avatar and drop an invalid one without losing other settings; resize crop math,
  WebP→JPEG fallback, quality step-down and give-up; `PlayerIcon` letter fallback (also for an
  invalid avatar), emoji, photo on the player color; picker selects/removes, file input accepts
  images; rooms list includes emoji but not photos.
- E2E: solo `/mock` — pick 🦊, join, see it; change to 🐙 from the score box; reload → 🐙
  pre-selected. Room — upload a 40×30 PNG fixture in the join dialog → a 96×96
  `data:image/webp` image; join and see it; a second (guest) player sees the photo in the join
  dialog, joins with 🐸, sees the photo in the scores; the first player sees 🐸. Profile — default
  avatar saved, survives reload, removed again.
- Manual: phone-size (iPhone 13) screenshots of the join dialog, round preview, board and the
  change-avatar dialog.
- `jep-validate`: see the report (format, lint 0 errors / 2 pre-existing warnings, typecheck,
  5724 unit tests, 52 e2e tests).

### Manual test script

1. Phone: open a room link, pick an emoji in the join dialog, join — your bubble shows it.
2. Tap 🙂 next to your name → **Upload photo** → take a selfie or pick a photo → your bubble
   becomes the round photo with your color as a ring.
3. On a second device join the same room: the join dialog lists you with your photo; pick another
   emoji and join; both devices show both avatars. Tap 🙂 → **Remove**: back to the letter.
4. Leave the room and open another one on the same device: your last avatar is pre-selected.
5. Logged in: profile → 🙂 → pick a default avatar; join a new room → it is pre-selected.
6. Game page with a room in progress: players with emoji avatars show the emoji in the list.
7. Finish a game: the summary shows avatars in the score boxes and the replay score chips.
