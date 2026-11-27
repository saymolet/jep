# Feature 29 — TV and buzz-order polish

**Branch:** `fix/tv-polish`
**Status:** ✅ implemented & tested
**Migration:** none · **New dependencies:** none

Owner's test session (2026-11-27), verbatim:

1. "When 2x or 0.5x is granted it still shows the original value that the question had, not the
   factual amount granted"
2. "Let's obscure the position in answering … only show it when the calculation runs"
3. "I can see some kind of a scrollbar present on the TV screen under 'Готуйтеся тиснути на
   кнопку...'"
4. "'Готуйтеся тиснути на кнопку...' is absolutely not needed … Remove it so we can have more
   space for content"
5. "'Бургери за $400' … can be in the header row, not on the content screen"

## What changed

1. The summary after a question (`NextClueForm`, "+$X" under each answerer) uses the host's
   multiplier. The engine context has `answerMultiplier(i, j, userId)`, read from
   `ClueAnswer.multipliers` (feature 27). The score chips already used it.
2. `Buzzes` (`app/components/prompt/buzz.tsx`) shows no order while the buzzers decide
   (`ReadClue`, `ReadWagerableClue`), not even this device's own optimistic buzz. It shows the
   order once someone answers or the answer is shown.
3. That row used `overflow-x-scroll`, which always draws a scrollbar track. It is now
   `overflow-x-auto` with the scrollbar hidden. The TV's question panel is `overflow-hidden`.
4. On the TV, the "reading" and "buzzers open" status lines aren't shown (players see their
   own buzzer). Other statuses ("Ann is answering", "Ann got it!", …) stay.
5. On the TV, "<category> for $<value>" moves into the top bar (`ViewerClueTitle`, test id
   `tv-clue-title`). The question panel no longer has a header row, so media gets that room.

## Tests

- `app/components/prompt/buzz.test.tsx`: the order is hidden while deciding and shown after; no
  forced scrollbar.
- `app/engine/engine-buzzers.test.ts`: `answerMultiplier`.
- `app/components/watch/presenter.test.tsx`: no reading status on the TV; the title is in the
  bar.
- Checked visually at 1920×1080 and 1280×720 (TV) and on a laptop player with the group's
  pack's media.
