# Jep! — Project Docs

Working notes for our fork of [Jep!](https://github.com/cmnord/jep) (origin: `saymolet/jep`).
We keep everything here so we can pick up across long sessions without losing context.

## Goal

Add features for playing with friends, evolving Jep! into something that surpasses
SIGame / Своя Игра for our group. Fork-and-extend, not rewrite.

## How we work

- **Git:** one feature branch + PR per feature (PRs target `saymolet/jep`). Ask before any commit/push.
- **Stack:** React Router v7, Tailwind v4, Radix UI, Supabase (Postgres + Realtime), Zod, Vitest + Playwright.
- **Validation:** `pnpm validate` (lint, format, typecheck, unit, e2e). See `AGENTS.md`.

## Index

| Doc                                  | What's in it                                                       |
| ------------------------------------ | ------------------------------------------------------------------ |
| `SESSION-STATE.md` _(local only)_    | **Start here** — current state, git status, how to resume          |
| `dev-environment.md` _(local only)_  | How the dev server/hosting is set up + runbook to bring it back up |
| [architecture.md](./architecture.md) | How the app is structured: data model, game engine, rooms/realtime |
| [features/](./features/)             | One doc per feature: plan, decisions, status                       |

_Local only_ docs describe the host machine and are kept out of this public repo
(`.git/info/exclude`).

## Feature backlog

Difficulty estimates from the original planning discussion.

### Core requested features

- [x] Secret question ("Кот в мешке" / cat in the bag) — `secret` on a question; the chooser
      must hand it to another player, who answers it alone (right → +value and board control,
      wrong → −value) — see [features/05-secret-question.md](./features/05-secret-question.md)
      — ⭐ easy
- [x] Upload avatar — emoji from a preset grid or your own photo (cropped and resized to 96×96
      in the browser, sent inline as a data URL — no file hosting), remembered per device and as
      an account default — see [features/07-avatars.md](./features/07-avatars.md) — ⭐ easy
- [x] Audio/video questions — pictures, audio, video and YouTube clips with the question
      (`media`) and with the answer (`answerMedia`); additive, no full `blocks[]` redesign —
      see [features/03-media-questions.md](./features/03-media-questions.md) — ⭐ easy
- [x] Multiple choice questions — optional `choices` (2–6 options) on a question; everyone
      sees them while it's read, the buzz winner taps one and it's checked automatically on the
      server — see [features/04-multiple-choice.md](./features/04-multiple-choice.md) — ⭐ easy
- [x] Pause game (`isPaused` state) — ⭐ very easy — see [features/01-pause-game.md](./features/01-pause-game.md)
- [x] More than 5 categories (dynamic grid) — 1 to 12 categories, categories with different
      numbers of questions; wide boards use big screens and still fit a phone — see
      [features/06-dynamic-board.md](./features/06-dynamic-board.md) — ⭐⭐ medium

### Found while playtesting

- [x] Join race: tapping "Join game" before the realtime channel subscribes can lose the
      player's own join (it is saved, but the client never sees it). Fixed by merging the
      revalidated loader snapshot + correct catch-up — see
      [features/02-join-sync-and-rooms-list.md](./features/02-join-sync-and-rooms-list.md) — ⭐ easy
- [x] "Rooms in progress" list on a game's page (and on "Play with friends" when rooms
      are running), so friends can join without a shared link — see
      [features/02-join-sync-and-rooms-list.md](./features/02-join-sync-and-rooms-list.md) — ⭐ easy

### Nice-to-haves (while touching the code)

Import/export JSON · import SIQ packs · random board generator · question search ·
team mode · spectator mode · admin panel · Discord login · keyboard shortcuts ·
fullscreen presenter mode · OBS/browser-source mode · mobile-first buzzer ·
auto-reconnect · host controls from phone · game save/resume · live scoreboard ·
per-question timer · soundboard · themes (Classic / Своя Игра / Dark).

## Status log

- **2026-07-10** — Dev environment brought up (Docker, Supabase, dev server).
- **2026-07-11** — Feature 01 (Pause) implemented & tested.
- **2026-10-25** — Fork synced to upstream (28 commits: pnpm, Varlock env, undo); Pause re-applied
  on `feat/pause-and-public-hosting`. Self-hosted: production build behind nginx/TLS with
  hosted Supabase; first multiplayer playtest (phone + desktop) works.
- **2026-10-25** — Feature 02 on `feat/join-sync-and-rooms-list`: join race fixed (client
  converges via loader snapshots + correct catch-up; reconnect escalation fixes) and
  "Rooms in progress" list on the game page / Play chooser. No migration.
- **2026-10-25** — Feature 03 on `feat/media-questions`: questions with pictures, audio, video
  and YouTube (`media` / `answerMedia`), any https host, sample game `/mock?game=media`.
  Migration `20261025124624_clues_media.sql` (additive jsonb columns on `clues`).
- **2026-10-25** — Feature 04 on `feat/multiple-choice`: multiple choice questions (`choices`),
  auto-checked picks decided server-side and re-derived by the engine, sample game
  `/mock?game=choice`. Migration `20261025131747_clues_choices.sql` (additive jsonb column on
  `clues`).
- **2026-10-25** — Feature 05 on `feat/secret-question`: secret questions ("cat in the bag",
  `secret` / `secretTopic` / `secretValue`), handed over with the new `pass_clue` action and
  answered by the receiver alone; sample game `/mock?game=secret`. Migration
  `20261025135101_clues_secret.sql` (additive nullable columns on `clues`).
- **2026-10-25** — Feature 06 on `feat/dynamic-board`: boards with 1–12 categories and uneven
  categories (engine grid sized by the longest category — fixes the crash), wide-board layout for
  phones and TVs, stable category/clue order from the DB, sample games `/mock?game=8x5` and
  `/mock?game=ragged`. No migration.
- **2026-10-25** — Feature 07 on `feat/avatars`: player avatars (emoji or photo resized in the
  browser to a ≤24 KB data URL in the Join/ChangeName payload), validated in the route and
  ignored on replay when invalid; remembered in localStorage and `gameDefaults.playerAvatar`.
  No migration.
