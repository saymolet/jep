# Feature 10 — Random board generator

**Branch:** `feat/random-board`
**Status:** ✅ implemented & tested
**Migration:** `20261025194229_random_board_candidates.sql` (two new read-only SQL functions;
no table changes)
**New dependencies:** none

## Goal

Friends can start a fresh game instantly by mixing categories from the games already on the
site, without preparing or uploading anything.

## How to use it

- Home page → **Random board** (under the upload box), or open `/random-board` directly.
- Choose **categories per round** (3–8, default 5), **rounds** (1 or 2) and optionally
  **Add a final question (if there is one)**.
- **Generate and play with friends** creates the game and opens a new room
  (`/game/:id/play?new` → `/room/…`); **Generate and play solo** opens `/game/:id/solo`.
- The new game is called "Random board · 25 Oct 2026" ("Випадкова гра · 25 жовт. 2026 р." in
  Ukrainian — written in the creator's language at creation time), author "Jep! random", and its
  note lists the source game titles. It is **unlisted**: it does not appear in the public list,
  but anyone with the link (e.g. the room link) can play it; logged-in players find it on their
  profile.
- If there are not enough suitable categories, the form says so ("Not enough public games to
  build this board: it needs 10 categories … only 4 were found. Upload more games or choose
  fewer categories.").

## Design decisions

- **Only PUBLIC games are sources (privacy).** Candidates come from two SQL functions
  (`random_board_categories`, `random_final_clues`) that filter `games.visibility = 'PUBLIC'`.
  They are `SECURITY INVOKER` and the server calls them — and fetches the picked categories'
  questions — with the **anonymous** Supabase client, so row-level security (anon sees only
  public games and their categories/clues) is a second guard: UNLISTED and PRIVATE games can
  never leak into a generated board, not even the creator's own.
- **Efficient queries.** The functions return only metadata (category id, name, game id/title,
  number of regular questions) of up to 200 random candidates (`order by random() limit`,
  filtered in SQL to categories with ≥ 3 regular questions). The server then loads the
  questions of just the picked categories (≤ 16) in one query, and one row for the final.
  `order by random()` scans the public categories once per generation; fine at our size (it can
  be swapped for `TABLESAMPLE` later without changing the API). A migration was needed because
  PostgREST cannot order randomly.
- **Selection rules** (`pickRandomBoard` in `app/models/random-board.ts`, pure, tested with a
  seeded RNG): a category qualifies with ≥ 3 regular questions; no source category twice; no two
  categories with the same name anywhere in the game (case and spacing ignored — the schema also
  requires unique names per board, and `createGame` matches categories by name); categories
  from games not used yet are taken first, so a board mixes as many games as possible; the
  board order is random. A too-small pool returns how many distinct-name categories exist.
- **Questions are kept as they are**: text, media, answer media, choices, secret
  (topic/value), wagerable flags and **values** (also in round 2). Doubling round 2 would
  only make sense for a standard ladder, and many games (SIGame packs, custom values) don't use
  one; keeping the source values is predictable and the form says so.
- **Long-form questions only go to the final.** They are dropped from board categories (and not
  counted for the ≥ 3 rule). With "Add a final question", one random long-form question of a
  public game becomes a last round with its own category name; if the pool has none, the game
  simply has no final (the option says "if there is one").
- **Invalid old rows are skipped.** Picked categories are validated with the game schema
  (`CategorySchema`/`ClueSchema`) after loading; invalid ones are removed from the pool and the
  pick is retried (up to 3 times). An invalid final is replaced by another sampled one.
- **Creating the game** uses the existing `createGame` with visibility **UNLISTED** so generated
  boards don't flood the public list. Logged-in players own the game (`uploaded_by` = user, RLS
  with their token, so they can delete it from their profile). Guests get `uploaded_by = null`;
  their insert runs with the service-role client (new `asAdmin` option of `createGame`) because
  the anon role cannot read back an UNLISTED game it inserted (and the categories/clues insert
  policies require the game to be visible). The content is built entirely by the server, so
  nothing user-supplied goes through that client except the validated counts.
- **A page, not a dialog.** `/random-board` is a small form page: it works without JavaScript,
  is easy to link, and fits phones (big touch targets: segmented 3–8 and 1/2 round choices).
  The home page links to it.
- **Two entry points after generation**: a new room (the default, "with friends") and solo play.
- The title date is formatted with `Intl` in the creator's language, in UTC.

## Files

- `supabase/migrations/20261025194229_random_board_candidates.sql` — SQL functions;
  `app/models/database.types.ts` regenerated.
- `app/models/random-board.ts` — options schema, limits, `pickRandomBoard`, `buildRandomGame`,
  `seededRng`; `app/models/random-board.server.ts` — `generateRandomGame` (sampling, loading,
  validation, retry), `RandomBoardPoolError`.
- `app/models/game.server.ts` — `createGame(…, { asAdmin })`.
- `app/routes/random-board.tsx` — page and action; `app/routes/_index/route.tsx` — home button.
- `app/i18n/{en,uk}/random.ts` — new message area.

## Verification

- Unit (`random-board.test.ts`, seeded RNG): counts for 1 and 2 rounds, no reused ids,
  unique names (case/spacing), skips categories with < 3 questions, prefers different games,
  fills from one game, insufficient pool (needed/available), final picked only when asked and
  available, deterministic per seed; form option parsing/limits; `buildRandomGame` keeps
  secret/choices/wager/media, drops long-form from boards, adds the final round, passes
  `GameSchema`.
- Unit (`random-board.server.test.ts`, fake Supabase client): uses only the anonymous client,
  builds rounds + final, replaces an invalid category, pool error.
- Unit (route, `random-board.test.ts`): guest → UNLISTED via `asAdmin` + redirect to
  `/game/:id/play?new`; logged in → owned by the user + solo redirect; title/note in Ukrainian
  with `Accept-Language: uk`; pool error → 422 with the message; invalid counts → 400.
- SQL checked on the local DB: 0 non-public categories returned; as `anon` the function works.
- E2E (`e2e/random-board.spec.ts`, `db` project): a guest uploads two public games with unique
  category names → home **Random board** → 3 categories + final → lands in a room whose title is
  "Random board · …" and whose board has 3 columns. In Ukrainian (cookie): the page shows
  "Випадкова гра", 4 categories × 2 rounds → solo play → "Випадкова гра · …", 4 columns.
- `jep-validate`: format, lint (0 errors, 2 pre-existing warnings), typecheck, 5931 unit tests,
  86 e2e tests — all pass.

### Manual test script

1. Make sure a few public games exist (upload 2–3 games as a guest, or use existing ones).
2. Home → **Random board** → leave 5 categories, 1 round → **Generate and play with friends**:
   you land in a new room; the board has 5 categories from different games, the title is
   "Random board · <today>". Open the game page: the note lists the source games.
3. Back → choose 8 categories, 2 rounds, tick **Add a final question** → **Generate and play
   solo**: round 1 and round 2 have 8 different categories each, followed by a final if any
   public game has one. Media, multiple choice and cat-in-the-bag questions behave as in their
   source game.
4. Switch to **УКР** → the page and the error/title are Ukrainian.
5. On a fresh database (or with only one small public game) choose 8 × 2 → the "Not enough
   public games…" message.
6. Make one of your games UNLISTED with a uniquely named category and generate several boards:
   that category never appears.
7. Phone width: the number buttons wrap, both buttons are full width.
