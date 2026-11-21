import * as React from "react";
import { useFetcher } from "react-router";

import type { Action } from "~/engine";
import { CANT_BUZZ_FLAG, GameState, useEngineContext } from "~/engine";
import { getBuzzWindowMs } from "~/engine/room-timers";
import { AFTER_FIRST_BUZZ_MS } from "~/models/buzzers";
import type { MediaBlock } from "~/utils/media";
import { getClueMedia, getRoomReadMs, parseYouTubeUrl } from "~/utils/media";
import useSoloAction from "~/utils/use-solo-action";

/* The buzzer "opener" (feature 27): one device per room decides when the
 * buzzers of the open question open and close, and the server tells
 * everyone. Players see no countdown, so they can't time their buzz. */

/** After the question is read (and its audio/video is over), the buzzers
 * open after a random extra delay in this range. */
export const RANDOM_DELAY_MIN_MS = 500;
export const RANDOM_DELAY_MAX_MS = 2500;
/** Devices that aren't the designated opener step in this much later, in
 * case the opener's device is asleep (the server ignores duplicates). */
export const FALLBACK_GRACE_MS = 4000;
/** The buzzers close this long after the first buzz was seen (near-ties
 * still count), or this long after the buzz window ran out. */
const CLOSE_AFTER_BUZZ_MS = AFTER_FIRST_BUZZ_MS + 300;
const CLOSE_AFTER_WINDOW_MS = 500;

/** useMediaDurationMs is the length of an audio/video clip, read from its
 * metadata: undefined without a clip (or for YouTube), null while loading
 * (or when it can't be read). */
export function useMediaDurationMs(block: MediaBlock | undefined) {
  const src =
    block && block.type !== "image" && !parseYouTubeUrl(block.src)
      ? block.src
      : undefined;
  const kind = block?.type === "audio" ? "audio" : "video";
  const [duration, setDuration] = React.useState<{
    src: string;
    ms: number | null;
  } | null>(null);
  React.useEffect(() => {
    if (!src) return;
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.muted = true;
    const done = (ms: number | null) => setDuration({ src, ms });
    el.onloadedmetadata = () =>
      done(Number.isFinite(el.duration) ? el.duration * 1000 : null);
    el.onerror = () => done(null);
    el.src = src;
    return () => {
      el.onloadedmetadata = null;
      el.onerror = null;
      el.removeAttribute("src");
    };
  }, [src, kind]);
  if (!src) return undefined;
  return duration?.src === src ? duration.ms : null;
}

/** useBuzzerOpener opens the buzzers of the open question once it has been
 * read — the reading time, and the end of its audio/video (a replay by the
 * host starts the clip again) — plus a random delay, and closes them when
 * the buzz time is over. `designated` is the room's opener (the host's
 * device in host mode, else the player with board control); other players'
 * devices only step in late. */
export function useBuzzerOpener({
  roomId,
  userId,
  enabled,
  designated,
  asHost = false,
}: {
  roomId: number;
  userId: string;
  enabled: boolean;
  designated: boolean;
  asHost?: boolean;
}) {
  const {
    activeClue,
    buzzes,
    buzzersOpen,
    buzzWindowSec,
    clue,
    mediaReplayCount,
    readTimeSec,
    round,
    soloDispatch,
    type,
  } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const submit = fetcher.submit;

  const reading =
    enabled && type === GameState.ReadClue && !!clue && !!activeClue;
  const cantCount = Array.from(buzzes.values()).filter(
    (b) => b === CANT_BUZZ_FLAG,
  ).length;
  const isReRead = reading && !clue.wagerable && cantCount > 0;
  // One reading per question, and again after each wrong answer.
  const key = reading ? `${round},${activeClue.join(",")}:${cantCount}` : null;

  const media = clue
    ? getClueMedia(clue).find((b) => b.type !== "image")
    : undefined;
  // A re-read doesn't play the clip again.
  const mediaMs = useMediaDurationMs(isReRead ? undefined : media);

  // When this reading started, its random delay, the last replay.
  const timing = React.useRef<{
    key: string;
    startedAt: number;
    randomMs: number;
    replayAt: number | null;
    replayCount: number;
    openedAt: number | null;
    firstBuzzSeenAt: number | null;
  } | null>(null);
  if (key !== null && timing.current?.key !== key) {
    timing.current = {
      key,
      startedAt: Date.now(),
      randomMs:
        RANDOM_DELAY_MIN_MS +
        Math.random() * (RANDOM_DELAY_MAX_MS - RANDOM_DELAY_MIN_MS),
      replayAt: null,
      replayCount: mediaReplayCount,
      openedAt: null,
      firstBuzzSeenAt: null,
    };
  }
  const t = key !== null ? timing.current : null;
  if (t && mediaReplayCount > t.replayCount) {
    t.replayCount = mediaReplayCount;
    t.replayAt = Date.now();
  }
  if (t && buzzersOpen && t.openedAt === null) {
    t.openedAt = Date.now();
  }
  const buzzWindowMs = getBuzzWindowMs({ buzzWindowSec });
  const someoneBuzzed = Array.from(buzzes.values()).some(
    (b) => b >= 0 && b <= buzzWindowMs,
  );
  if (t && someoneBuzzed && t.firstBuzzSeenAt === null) {
    t.firstBuzzSeenAt = Date.now();
  }

  const send = React.useCallback(
    (intent: "open" | "close") => {
      if (!activeClue) return;
      submit(
        {
          intent,
          userId,
          round: String(round),
          i: String(activeClue[0]),
          j: String(activeClue[1]),
          ...(asHost ? { host: "true" } : {}),
        },
        { method: "post", action: `/room/${roomId}/buzzers` },
      );
    },
    [submit, userId, round, activeClue, asHost, roomId],
  );

  const replayAt = t?.replayAt ?? null;
  const graceMs = designated ? 0 : FALLBACK_GRACE_MS;

  // Open: after the reading time and the clip, plus the random delay.
  React.useEffect(() => {
    const current = timing.current;
    if (key === null || buzzersOpen || !clue || !current) return;
    const readMs = getRoomReadMs(clue, readTimeSec, { reRead: isReRead });
    const clipStart = replayAt ?? current.startedAt;
    const mediaEnd = typeof mediaMs === "number" ? clipStart + mediaMs : 0;
    const at =
      Math.max(current.startedAt + readMs, mediaEnd) +
      current.randomMs +
      graceMs;
    const timeout = setTimeout(
      () => send("open"),
      Math.max(0, at - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [
    key,
    buzzersOpen,
    clue,
    readTimeSec,
    isReRead,
    mediaMs,
    replayAt,
    graceMs,
    send,
  ]);

  // Close: shortly after the first buzz, or when the buzz time is over.
  React.useEffect(() => {
    const current = timing.current;
    if (key === null || !buzzersOpen || !current) return;
    const at =
      (current.firstBuzzSeenAt !== null
        ? current.firstBuzzSeenAt + CLOSE_AFTER_BUZZ_MS
        : (current.openedAt ?? Date.now()) +
          buzzWindowMs +
          CLOSE_AFTER_WINDOW_MS) + graceMs;
    const timeout = setTimeout(
      () => send("close"),
      Math.max(0, at - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [key, buzzersOpen, someoneBuzzed, buzzWindowMs, graceMs, send]);
}
