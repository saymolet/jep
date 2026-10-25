# Feature 03 — Questions with pictures, audio and video

**Branch:** `feat/media-questions`
**Status:** ✅ implemented & tested
**Migration:** `supabase/migrations/20261025124624_clues_media.sql` (additive; must be applied
to production before deploying this branch)

## Goal

Let a question show pictures, play sound or play video — like SIGame's music and video
rounds — and optionally show a picture (or clip) when the answer is revealed. Game flow
(buzzing, self-marking) stays the same.

(In the code a question is called a "clue".)

## How to use it (game JSON)

A clue gets two optional lists of media blocks:

- `media` — shown together with the question.
- `answerMedia` — shown when the answer is revealed; it replaces the question media.

Each block is `{ "type": "image" | "audio" | "video", "src": "<https URL>", "alt"?: "text" }`.

```json
{
  "clue": "",
  "answer": "Moonlight Sonata",
  "value": 400,
  "media": [
    {
      "type": "audio",
      "src": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/Beethoven_Moonlight_1st_movement.ogg/Beethoven_Moonlight_1st_movement.ogg.mp3"
    }
  ],
  "answerMedia": [
    {
      "type": "image",
      "src": "https://example.com/beethoven.jpg",
      "alt": "Beethoven"
    }
  ]
}
```

```json
{
  "clue": "Name this short film",
  "answer": "Big Buck Bunny",
  "value": 600,
  "media": [{ "type": "video", "src": "https://youtu.be/aqz-KE-bpKQ?t=60" }]
}
```

Rules:

- `src` must be `https://` (any host — Jep! doesn't host files).
- For `"video"`, YouTube links work: `youtube.com/watch?v=ID`, `youtu.be/ID`,
  `/shorts/ID`, `/embed/ID`, `/live/ID`, `m.`/`music.` hosts, with an optional start time
  `t=90`, `t=1m30s` or `start=90`. They are rendered as a `youtube-nocookie.com` embed.
  A YouTube link with type `image`/`audio` is rejected.
- `clue` may be `""` only when the clue has `media` (or `imageSrc`). Answer media alone
  doesn't carry the question, so it doesn't count.
- At most 10 blocks per list.
- `imageSrc` (old single-picture field) keeps working and is treated as the first image
  block. Its host allowlist (j-archive / wikimedia) is gone; `http:` is still accepted there
  for old files.

Sample game: `app/static/mock-media.jep.json` (Wikimedia Commons + Blender's Big Buck Bunny),
playable solo at `/mock?game=media`. The upload help page (`/upload-help`) documents the
fields with an example; the JSON schema (`/game.schema.json`) has `media`/`answerMedia`.

## Design decisions

- **Additive blocks next to `clue`, not a full `blocks[]` redesign.** Keeps every existing
  `.jep.json` file and DB row valid, the engine untouched (it only reads `clue`, `answer`,
  `value`, `wagerable`, `longForm`), and the board/summary/replay views unchanged.
- **Any https source.** Players host files anywhere; the old allowlist made media rounds
  impossible. CSP: `img-src 'self' data: https:`, `media-src 'self' https:`,
  `frame-src https://www.youtube-nocookie.com`; everything else is unchanged. Our
  `Referrer-Policy: strict-origin-when-cross-origin` means hosts only see our origin (and
  YouTube requires a referrer for embeds, so we don't strip it).
- **Shared pure module `app/utils/media.ts`** (types, YouTube parsing, validation, read
  time) used by both the zod schema (server) and the prompt (client).
- **Layout.** Pictures stay inside the big buzz button (tapping the picture buzzes, like
  before with `imageSrc`). Audio and video controls are rendered _below_ the buzz button —
  interactive content can't be nested in a button, and tapping play must not buzz. Media is
  capped at 40dvh and the clue text at 20dvh when media is present, so the buzzer/answer
  controls stay on screen on phones.
- **Audio:** a big round play/pause button with a progress bar (no native controls).
  **Video:** native `<video controls playsInline>`. **YouTube:** privacy-enhanced embed.
- **Autoplay:** each media element tries to play **once, when it mounts**; never on
  re-render. If the browser refuses (phones without a gesture), we show "Tap to play".
  Only the first clip in a list autoplays. Mount points:
  - question opens (ReadClue / wagerable / long-form) → autoplay;
  - re-read after a wrong answer → no autoplay (controls are there to replay);
  - answer revealed → only `answerMedia` autoplays; question media shown again doesn't.
    Media stops when the prompt moves on or closes (unmount pauses it).
- **Sound settings:** the user's volume applies to audio/video elements; "mute" disables
  autoplay (an explicit tap still plays — that's a deliberate user action). YouTube can't
  follow our volume without its JS API; it only respects mute via no-autoplay.
  The long-form "think" music is skipped for clues that have their own audio/video.
- **Read time (buzzers locked).** Text clues are unchanged (1s + 60ms/char). Clues with
  pictures read at least **3s**; clues with audio/video at least **10s**, then the normal 5s
  buzz window. Simple, the same on every client (each client already times its own window),
  and the read-timer bar shows it. Players can buzz after 10s while the clip keeps playing.
  Legacy `imageSrc` clues with very short text get the 3s minimum too.
- **Tie-break seed.** Buzz ties are broken with a hash seeded by the clue text; for an empty
  text we now fall back to the answer (`getTiebreakerSeed`, used identically by the reducer
  and the client) so tie order still varies between media clues.
- **DB:** nullable `media jsonb` and `answer_media jsonb` on `clues`. Empty lists are stored
  as `NULL`; on read, rows are re-validated with the zod block schema and malformed values
  are dropped (logged), so the JSON export round-trips cleanly. RLS is row-level and
  unchanged.

## Not done / limitations

- Playback isn't synchronized across players (each device plays its own copy). Fine for
  friends in a call; a host-driven sync would need room events.
- No upload/hosting of media files; authors link to files.
- The board doesn't indicate which cells are media questions.
- Read-time minimums are constants, not per-clue configurable.
- Format support depends on the device (e.g. Ogg/WebM on older iPhones); the help page
  recommends MP3/MP4/JPEG/PNG.
- Ragged boards (categories with different numbers of clues) are not supported by the
  engine; this is pre-existing and unrelated (the sample game is rectangular).

## Files

- `app/utils/media.ts` (+ test) — types, YouTube parsing/embeds, validation, read time.
- `app/models/convert.server.ts` (+ test) — `MediaBlockSchema`, `media`/`answerMedia`,
  empty-text rule, allowlist removed.
- `supabase/migrations/20261025124624_clues_media.sql`, `app/models/database.types.ts`.
- `app/models/game.server.ts` (+ test) — `clueToDbClue` / `dbClueToClue`.
- `app/components/prompt/clue-media.tsx` (+ test) — image/audio/video/YouTube players.
- `app/components/prompt/prompt.tsx` — `ClueText` layout, media per prompt, read time.
- `app/engine/engine.ts`, `use-game-engine.ts` (+ test) — `getTiebreakerSeed`.
- `app/entry.server.tsx` — CSP.
- `app/routes/[game.schema.json].tsx`, `app/routes/upload-help.tsx` — docs/schema.
- `app/static/mock-media.jep.json`, `app/models/mock.server.ts` — sample game.
- `vitest.config.ts` — happy-dom never loads iframe pages (no network in unit tests).
- `e2e/media.spec.ts`, `e2e/media-upload.spec.ts`, `e2e/helpers.ts`,
  `playwright.config.ts` — e2e (media requests are stubbed).

## Verification

- Unit: YouTube parsing/embeds, block validation, read-time rules, schema accept/reject +
  backward compatibility (old `imageSrc` games, sample games), DB mapping round-trip,
  rendering (autoplay once, tap-to-play fallback, stop on unmount, YouTube embed, images
  inside / players outside the buzz button), tie-break seed.
- E2E: solo `/mock?game=media` audio question (play control, buzz, prompt closes → no
  audio), answer media on reveal, YouTube embed; DB project: upload the media game, JSON
  export round-trips `media`/`answerMedia`, open the audio question in a real room.
- Manual: screenshots at phone (iPhone 13) and desktop sizes with real Wikimedia/YouTube
  media; buzzer/answer controls stay on screen.

### Manual test script

1. Open `/mock?game=media`, join, start round.
2. Pictures $200: the Mona Lisa shows under the text; buzzers open after ~3s.
3. Music & Film $200 (no text): music starts (or "Tap to play audio" on a phone); the
   read bar runs ~10s; tapping play/pause doesn't buzz; buzzing works after the bar.
   Reveal → back to board: the music stops.
4. Pictures $400: text only; after "Reveal answer" the Mona Lisa appears.
5. Music & Film $400 (video) and $600 (YouTube, starts at 1:00) play inline on a phone.
6. Settings → mute: media no longer autoplays; volume changes the audio/video volume.
7. Upload `app/static/mock-media.jep.json` from the profile page, download the JSON
   export: `media`/`answerMedia` are present; play it with a friend in a room.
