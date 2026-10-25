# Feature 12 — Mobile-first buzzer

**Branch:** `feat/mobile-buzzer`
**Status:** ✅ implemented & tested
**Migration:** none

## Goal

On phones, buzzing in must be fast, obvious and reachable with a thumb — without changing
anything for desktop players or the fairness of the buzz.

## How it works (for players)

While a question is read (`ReadClue`), phones, tablets and narrow windows show a big
**BUZZ** button pinned to the bottom of the screen (full width, at least 72px tall, above the
iPhone home indicator). Its colour and text show the buzzer state:

| State                                                                            | Colour       | English                                          | Українська                                                  |
| -------------------------------------------------------------------------------- | ------------ | ------------------------------------------------ | ----------------------------------------------------------- |
| Question being read (tapping now locks you out); the read-timer fills the button | slate        | **Wait…** · Tapping now locks you out            | **Чекай…** · Натиснеш зараз — кнопку заблокує               |
| Buzzers open                                                                     | green (glow) | **BUZZ!**                                        | **ТИСНИ!**                                                  |
| Tapped too early (250ms lockout)                                                 | red          | **Too early!** · Locked out for a moment         | **Зарано!** · Кнопку заблоковано на мить                    |
| Already tried this question (re-read after a wrong answer)                       | dark         | **Locked out** · You already tried this question | **Заблоковано** · Твою спробу на це питання вже використано |
| Nobody buzzed in time                                                            | dark         | **Time's up** · You didn't buzz in time          | **Час вийшов** · Кнопку не натиснуто вчасно                 |
| Someone else was faster                                                          | grey         | **Ann was faster** · Wait for their answer       | **Швидше за всіх: Ann** · Чекай на відповідь                |
| You won the buzz                                                                 | gold         | **Your turn — answer!**                          | **Твоя черга — відповідай!**                                |

The header hint changes from "Click or press Enter to buzz in" to "Tap the button below when
it turns green" ("Тисни кнопку внизу, коли вона стане зеленою"). Desktop is unchanged: click
the question or press Enter.

When the buzz is won the game moves on to the answer step (reveal answer / multiple choice
options) and the button disappears, so it never sits on top of the answer controls or the
options.

## Design decisions

- **Shown with CSS, not JS.** A Tailwind custom variant `buzzbar` =
  `@media (pointer: coarse), (max-width: 639.98px)` (in `app/styles.css`) shows the button and
  swaps the hint. Server and browser render identical markup — no hydration mismatch, no UA
  sniffing. `BUZZ_BAR_MEDIA` in `buzz-button.tsx` is the same query for event-time checks.
- **Touch taps on the question no longer buzz while the button is shown.** Long questions,
  pictures and media controls are scrolled, read and tapped; accidental buzzes (and early
  lockouts) from that were a real problem. The dedicated button is the one control. Mouse
  clicks on the question and Enter still buzz everywhere (a narrow desktop window keeps
  click-to-buzz), and a touch laptop with a wide screen and a fine pointer has no button, so
  its touch taps on the question still buzz. Implemented by remembering the `pointerType` of
  the press on the question and checking `matchMedia(BUZZ_BAR_MEDIA)` at click time
  (`ClueText`'s `touchBuzz={false}` in `ReadCluePrompt` only).
- **`pointerdown`, not click.** Buzzes on the first touch, without waiting for the finger to
  lift (~100ms+ faster on phones). Protection:
  - only the primary pointer (a second finger is ignored) and the main mouse button;
  - the `click` that follows a tap is ignored; a click with `detail === 0` (Space/Enter on
    the focused button, screen readers) does buzz;
  - presses within 100ms of the previous one are ignored (double fire);
  - presses in the first 400ms after the button appears are ignored, so the tap that opened
    the question (a double tap on the board) or closed a dialog can't land on it as an early
    buzz;
  - `touch-action: manipulation` (no double-tap zoom), `user-select: none`, no iOS callout,
    no tap highlight, context menu (long press) suppressed.
- **Fairness unchanged.** The button calls the same `handleClick(Date.now())` as the question
  and Enter: same lockout check, same `Buzz` action and `deltaMs` computation. The button
  state is derived from the prompt's state by the pure `getBuzzButtonState()`.
- **Haptics** (`app/utils/haptics.ts`): a short tick (20ms) when a buzz is sent and a double
  buzz (60-50-60ms) on an early lockout, where `navigator.vibrate` exists (Android; iOS
  Safari and desktops have no Vibration API — feature-detected, errors swallowed). Haptics
  follow the **sound mute** setting: muted means "keep quiet", and a vibrating phone on a table
  is audible.
- **Doesn't cover content.** The button is `position: sticky` at the bottom of the prompt's
  scroll container, so it takes its own space in the layout instead of floating over the
  content: the last thing in the prompt (options, buzz list) is always above it. The invisible
  placeholder that reserves the answer-form space on desktop is dropped on phones (the button
  takes that place). On phones the question area no longer shrinks below its content, so on a
  short landscape screen the prompt scrolls instead of squeezing media under the countdown.
  The safe-area inset is used when the page is laid out under the home indicator
  (`env(safe-area-inset-bottom)`, falls back to 0.5rem).
- **Read progress inside the button.** While waiting, a lighter fill grows across the button
  over the read time (same `growFromLeft` keyframes as the read timer at the top) and keeps
  running through a lockout, so players can see when it will open.
- **Scope.** Only regular questions (`ReadClue`). Wagered questions (`ReadWagerableClue`) are
  answered by the board-control player without a race; tapping the question still works there.
  Spectator and TV views are unchanged (they never had a buzzer).
- **"Your turn" is short-lived.** It shows from the moment the buzz is accepted locally until
  the game moves to the answer step (instant in solo, a round trip in a room).

## Files

- `app/components/prompt/buzz-button.tsx` — `BuzzButton`, `getBuzzButtonState`,
  `BUZZ_BAR_MEDIA`, `isBuzzBarShown`.
- `app/components/prompt/prompt.tsx` — button in `ReadCluePrompt`; `ClueText` `touchBuzz`
  prop and `data-testid="clue-buzz-area"`; hints swapped/hidden on phones.
- `app/utils/haptics.ts` — feature-detected `vibrate()`.
- `app/styles.css` — `buzzbar` variant.
- `app/i18n/{en,uk}/play.ts` — `play.tapHint`, `play.buzzer.*`.
- Tests: `buzz-button.test.tsx`, `haptics.test.ts`, `e2e/mobile-buzzer.spec.ts`; `openClue`
  helper waits for the hint _or_ the button; the phone test in `e2e/choices.spec.ts` buzzes
  with the button and checks it doesn't cover the options.

## Verification

- Unit: every button state (EN + UK), progress bar lifetime, aria-disabled, pointerdown vs
  click, keyboard activation, multi-touch, double fire, arm delay, haptics (and mute,
  unsupported browsers); `getBuzzButtonState` table.
- e2e on an iPhone 13 viewport with touch (Chromium): the button is at the bottom, ≥72px,
  full width; tapping while waiting locks out; tapping the question doesn't buzz; tapping when
  open wins and the multiple choice options appear above where the button was; tapping the
  audio play control doesn't buzz or lock out; Ukrainian labels. Desktop: no button, clicking
  the question buzzes.
- `jep-validate` passes.

### Manual test

1. On a phone open `/mock?game=choice`, join, start the round, tap a $200 question.
2. The bottom button says **Wait…** with a fill growing; tap it → red **Too early!** (and a
   vibration on Android unless sound is muted).
3. When it turns green (**BUZZ!**) tap it → options appear, button gone. Pick one.
4. Tap the question text while it's green on another question → nothing happens.
5. `/mock?game=media` → audio question: tap play/pause → no lockout. Rotate to landscape → the
   button stays at the bottom, the prompt scrolls.
6. Switch to УКР → **Чекай…** / **ТИСНИ!**.
7. On a desktop: no button, clicking the question or Enter buzzes as before.
