# Feature 06 — More (or fewer) than 5 categories, and uneven categories

**Branch:** `feat/dynamic-board`
**Status:** ✅ implemented & tested
**Migration:** none

## Goal

Play boards with any number of categories from 1 to 12 (SIGame packs often have 6–8 themes),
and boards whose categories have different numbers of questions — on phones and on desktops/TVs.

(In the code a question is called a "clue".)

## How to use it (game JSON)

Nothing new to write: list as many categories as you want (1–12) and give each category as many
questions as you want (at least 1). Example of an uneven board:

```json
{
  "categoryNames": ["Short", "Full", "Middle"],
  "categories": [
    { "name": "Short", "clues": [ 3 clues ] },
    { "name": "Full", "clues": [ 5 clues ] },
    { "name": "Middle", "clues": [ 4 clues ] }
  ]
}
```

- More than 12 categories is rejected: "a board can have at most 12 categories" (zod
  `BoardSchema` and `maxItems: 12` in `/game.schema.json`; `minItems: 1` there too, matching
  zod). Documented on `/upload-help`.
- A category with fewer questions leaves empty (dark, not clickable) cells at the bottom of its
  column. The round ends when every existing question has been played.
- Old `.jep.json` files and DB rows are unchanged.

Sample games: `app/static/mock-8x5.jep.json` (`/mock?game=8x5`, 8 categories × 5) and
`app/static/mock-ragged.jep.json` (`/mock?game=ragged`; round 1: 3 / 5 / 4 questions with the
short category first, round 2: 2 / 1).

## Design decisions

### Engine & data

- **The bug:** `stateFromGame` sized the `isAnswered` grid from the first category, so a board
  whose first category was shorter than another crashed on `isAnswered[round][i][j]` as soon as
  a question in a missing row was played. Now the grid has as many rows as the longest category
  (`getBoardSize` / `newAnswerGrid` in `state.ts`); cells of missing questions exist but are
  never answered. Each cell is its own object (it used to be one shared object, which only
  worked thanks to Immer copy-on-write).
- **Round end** already counted only existing, playable questions (`getNumCluesInBoard`), and
  `ChooseClue` already ignored cells without a question — both now covered by tests. The board,
  summary and replay grids were already sized from the longest category.
- **Solo saves** (`offline-storage`): restoring lays the saved cells over a grid of the game's
  shape, so a save made with the old (too small) grid can't crash.
- **DB order:** `getGame` now orders categories by `created_at, id` and clues by `value, id`.
  All categories of a game are inserted in one statement, so they share `created_at`; clues can
  share a value. Without the id tiebreaker Postgres may return ties in any order, and players
  in the same room load the game separately — they must get the same grid. Clues are still
  sorted by value (kept for backward compatibility: games uploaded with unsorted values keep
  the layout they've always had).
- **Wager / secret / multiple choice** flows only index the grid by `(round, i, j)`; table-driven
  tests run each of them in short columns and extra rows.

### Layout

Boards with up to 5 categories render exactly as before (max 1024px wide, same classes).
Boards with 6+ categories ("wide"):

- **Big screens:** the board may grow to 200px per column (8 → 1600px, 12 → full width on a
  1920px TV) instead of staying at 1024px.
- **Text scales with the column width:** the board container is a CSS size container and the
  dollar values use `clamp(0.75rem, (100cqw / columns − 0.25rem) / 3.1, 3rem)` — a 4-digit value
  always fits its cell. Cell padding shrinks on narrow screens.
- **Phones: shrink to fit, then scroll.** Columns may shrink down to **44px** (the usual minimum
  tap target), so 8 categories fit a 390px phone without scrolling (≈46×44px cells), which is
  better for play than scrolling: the whole board is visible at once and every cell is a
  finger-sized target. Boards whose columns would be narrower than 44px (9+ categories on a
  390px phone) scroll sideways inside the board container instead of shrinking further (the
  page itself never scrolls sideways). No sticky headers: the board is short enough to fit
  vertically, so the category names never scroll out of view vertically, and on horizontal
  scroll they move with their column.
- **Category names** are still fitted to their cell (`useFitText`). In narrow columns a long
  word would shrink to unreadable size; if whole words only fit below 9px, words may break
  anywhere at up to 12px (`breakWordsBelow` / `maxBrokenFontSize`).
- **Empty cells** are dark (the page background) with the grid border, `aria-hidden`, and have
  no button. Arrow keys / WASD skip them.
- **Board fill animation** shows one category per frame; wide boards speed up so the fill still
  takes about 2 seconds (`getFrameIntervalMs`).
- The summary board and replay board use the same sizing (`BoardScroller`, `ClueValue`).

## Not done / limitations

- 12-category boards on a phone need sideways scrolling (by design, see above).
- Category names in 8+ columns on a phone are small (9–12px); tap a finished category to see
  its full name (existing popover).
- The game page's empty preview board still shows a full rectangle (it only knows the number
  of rows and columns).
- Clues of an uploaded game are still sorted by value (see above), unlike solo mock games
  which keep file order.

## Files

- `app/engine/state.ts` — `getBoardSize`, `newAnswerGrid`; `engine-board.test.ts` (new).
- `app/utils/offline-storage.ts` (+ test) — reshape restored grid.
- `app/models/convert.server.ts` (+ test) — `MAX_CATEGORIES`, bounds; `[game.schema.json].tsx`
  (+ new test); `upload-help.tsx`.
- `app/models/game.server.ts` (+ test) — stable order.
- `app/static/mock-8x5.jep.json`, `app/static/mock-ragged.jep.json`, `app/models/mock.server.ts`.
- `app/components/board/layout.tsx` — `BoardScroller`, `ClueValue`, `EmptyCell`,
  `useIsWideBoard`, `getCellPaddingClassName`; `board.tsx` (+ new `board.test.tsx`),
  `category.tsx`, `clue.tsx`, `use-board-fill.ts`; `app/utils/use-fit-text.ts`.
- `app/routes/room.$roomName_.summary/summary.tsx`, `replay-board.tsx`.
- `e2e/dynamic-board.spec.ts`.

## Verification

- Unit: engine table for ragged boards (grid size, choosing the last question of a short first
  column, a question in a row other columns lack, missing cell / past last row ignored, round
  continues at 11/12 and ends at 12/12, next uneven round to game over, all 40 questions of an
  8-category board, wagerable in a one-question column, secret in an extra row, multiple choice
  in a middle column) + replay from stored room events; schema accepts 1/5/6/8/10/12 categories
  and uneven categories, rejects 13 with the message, still rejects an empty category; JSON
  Schema bounds match; `getGame` order and uneven board mapping; old solo save reshaped; board
  component renders empty cells in the right places, taps the right clue, classic layout for
  ≤5 columns, wide layout for 8; board fill timing.
- E2E (`e2e/dynamic-board.spec.ts`, solo): plays the whole first round of `/mock?game=ragged`
  (12 questions, 3 empty cells) and gets the round 2 preview, then round 2's 2 columns with 1
  empty cell; 8 categories at 390×844 (touch): page and board don't scroll sideways, board ≤
  viewport, every cell ≥ 44×44px, bottom-right cell opens with a tap (screenshot attached to the
  report); 8 categories at 1920px use 1500–1600px.
- Manual screenshots: 8 categories at 390 / 1280 / 1920px, 12 categories at 390 (scrolls) and
  1280px, ragged at 390px; 5-category board measured identical to before at 390 and 1280px.
- `jep-validate`: format, lint (0 errors, 2 pre-existing warnings), typecheck, 5661 unit tests,
  49 e2e tests — all pass.

### Manual test script

1. Phone (or devtools at 390px): open `/mock?game=8x5`, join, start. All 8 columns are visible
   without scrolling; tap any cell — it opens. Long names (GEOGRAPHY) wrap instead of becoming
   tiny.
2. Desktop/TV: same game — the board is wider than before and the values are big.
3. `/mock?game=ragged`: "Short" has 3 questions, "Full" 5, "Middle" 4; empty cells are dark.
   Play all 12 questions → "Start round 2 of 2". Round 2 has 2 columns and 1 empty cell; play
   both → game over.
4. Upload a game with 13 categories → "a board can have at most 12 categories".
5. Upload `app/static/mock-ragged.jep.json` and play it in a room with a friend.
