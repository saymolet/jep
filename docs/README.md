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

- [ ] Secret question (Daily Double / "Кот в мешке") — ⭐ easy
- [ ] Upload avatar — ⭐ easy
- [ ] Audio/video questions (redesign question model → `blocks[]`) — ⭐ easy
- [ ] Multiple choice questions (typed question renderer) — ⭐ easy
- [x] Pause game (`isPaused` state) — ⭐ very easy — see [features/01-pause-game.md](./features/01-pause-game.md)
- [ ] More than 5 categories (dynamic grid) — ⭐⭐ medium

### Found while playtesting

- [ ] Join race: tapping "Join game" before the realtime channel subscribes can lose the
      player's own join (it is saved, but the client never sees it). Re-fetch room events
      after the player's own action. — ⭐ easy
- [ ] "Rooms in progress" list on a game's page, so friends can join without a shared link
      (today opening a game always creates a new room). — ⭐ easy

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
