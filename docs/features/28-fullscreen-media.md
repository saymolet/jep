# Feature 28 — Pictures and videos fill the screen

**Branch:** `fix/fullscreen-media`
**Status:** ✅ implemented & tested
**Migration:** none · **New dependencies:** none

## Goal

Feedback after the second game night (2026-11-27, verbatim): "треба щоб коли питання з фото чи
відео, щоб відео було на весь екран, а то воно не дуже і на нього налазять слова. І коли
відповідь там де є фото відео, щоб тож було великим." In short: when a question has a photo or
video it should be full screen, because now it's small and words overlap it; answer
photos/videos should be big too.

Most questions in the group's SIGame pack are a video (often 538×360) with **no text**, and many
answers are pictures. With feature 26's fixed heights (e.g. 60dvh on the TV), the answer text
plus the picture didn't fit the TV's prompt. The status line ("Zenya got it!") ended up on top of
the picture, and a question with no text still kept an empty text block above the video.

## What changed

- New media sizes in `app/components/prompt/clue-media.tsx`:
  - **`fill`** (the TV): the picture or video box takes all the height the prompt has left
    (`flex-1 min-h-0`). The element is `h-full w-full object-contain`, so small files scale up
    to the screen and never overflow.
  - **`fillScreen`** (players on desktops/laptops): the same, while phones (the `buzzbar:`
    variant) keep the fixed 32dvh that leaves room for the BUZZ button.
  - Multiple choice keeps `choices` (options need the room on phones); the host's view keeps
    `host` / `answer`.
- `ClueText` (`app/components/prompt/prompt.tsx`):
  - The question/answer text is a strip above the media (`max-h-[14dvh]`), never over it.
  - With no text to show (a media-only question before the answer), the text block is hidden.
  - When the media is a video, the buzz area shrinks to that strip and the video gets the
    space. Clicking the question or pressing Enter still buzzes.
- The TV no longer depends on the text length (`TV_SHORT_CLUE_CHARS` is gone).

## Tests

- `app/components/prompt/clue-media.test.tsx`: fill classes on desktops and the TV, a fixed
  height on phones, no empty text block for media-only questions.
- Checked visually at 1920×1080 (TV), 1440×900 (laptop player), 390×844 (phone) and 1400×900
  (host) with the group's pack's media: a video-only question, a picture question, a text +
  video question, and their picture answers.
