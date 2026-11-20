# Feature 26 — Bigger media, no QR on the TV, who answers for the host

**Branch:** `feat/media-visuals`
**Status:** ✅ implemented & unit tested (e2e updated, not run)
**Migration:** none
**New dependencies:** none

Owner, after the first real game night (verbatim, Ukrainian): "Чогось картінки після вопроса
дуже малі" (pictures after a question are very small) / "В загальному відоси не розтягуються на
фул екран" (videos don't stretch to the full screen) / "На тв прибрать qr код, він там не нада"
(remove the QR code from the TV, it isn't needed there) / "У хоста немає на екрані хто
відповідає" (the host doesn't see on screen who is answering).

- **Pictures and videos scale up.** They had only a maximum height (`max-h-[40dvh]`), so a
  300 px picture or a 240p video from a SIGame pack stayed tiny. They now get a definite height
  (`h-[…dvh] w-auto max-w-full object-contain`): small files grow to fill it, big ones shrink
  to fit, the aspect ratio is kept. The size depends on where they are (`MediaSize` in
  `clue-media.tsx`):
  - `screen` (players' and spectators' prompt): 40dvh, as before the cap, so the buzz button
    and answer controls below stay on a phone's screen.
  - `host` (the host's question): 30dvh — it shares the screen with the answer and the judge
    buttons.
  - `answer` (pictures and videos in the host's answer box): 22dvh (was a 160 px box).
  - `tv` (presenter): 50dvh; `tvLarge`: 60dvh when the question has at most 60 characters of
    text (`TV_SHORT_CLUE_CHARS`, e.g. SIGame picture questions), with the text box reduced to
    18dvh. On the TV the videos may use the whole width.
  - YouTube embeds (sized by width) use the matching `calc(Hdvh*16/9)` width. Native video
    controls stay.
- **No QR code on the TV.** The presenter's lobby no longer shows the big QR code and play no
  longer shows the small one in the sidebar. The lobby shows the join link as small text
  ("To join, open https://…", `presenter-join-url`, i18n `watch.joinAt`). The `watch.scanToJoin`,
  `watch.orOpen` and `watch.qrLabel` strings are gone. `QrCode` (`app/components/qr-code.tsx`)
  and `app/utils/qr.ts` are now unused but kept.
- **The host sees who answers.** While a player answers (`RevealAnswerToBuzzer`, also the cat in
  the bag's receiver), a banner at the top of the host's screen, under the category, shows the
  player's avatar and "Ann is answering" / "Cat in the bag: Ann is answering" in big type
  (`host-answering`, moved here from under the answer). The buzz order (`Buzzes`,
  `host-buzzes`) also moved from the bottom to the top of the host's screen.

## Files

`app/components/prompt/clue-media.tsx`, `app/components/prompt/prompt.tsx` (`ClueText`
`mediaSize`), `app/components/host/host-prompt.tsx`, `app/components/watch/presenter.tsx`,
`app/i18n/{en,uk}/watch.ts`.

## Tests

- Unit: `clue-media.test.tsx` ("media size (feature 26)": definite heights, TV sizes, the host
  size); `host-role.test.tsx` (the answering banner with the avatar is above the question and
  the answer, the buzz order is at the top); `presenter.test.tsx` (no QR code, the join link in
  the lobby only, in English and Ukrainian).
- e2e (updated, not run here): `watch-room.spec.ts` and `hydration-room.spec.ts` check the join
  link instead of the QR code.
