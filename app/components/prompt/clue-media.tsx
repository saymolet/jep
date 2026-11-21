import clsx from "clsx";
import * as React from "react";

import { Pause, Play, SadFile } from "~/components/icons";
import { useTranslation } from "~/i18n";
import type { MediaBlock } from "~/utils/media";
import { parseYouTubeUrl, youTubeEmbedUrl } from "~/utils/media";
import { useSoundSettings } from "~/utils/user-settings";

/** MediaSize is how much of the screen a picture or video gets:
 * - "screen": the player's prompt. 40dvh keeps the clue text and the
 *   buzzer/answer controls below on screen on desktops; phones (with the
 *   big BUZZ bar) get 32dvh, so multiple choice options still fit.
 * - "choices": the player's prompt of a multiple choice question: on
 *   phones the options need the room, so pictures are smaller there.
 * - "host": the host's question, which shares the screen with the answer
 *   and the judge buttons.
 * - "answer": the pictures in the host's answer box.
 * - "tv" / "tvLarge": the TV (presenter) screen, which has no controls;
 *   "tvLarge" when the question has little text. */
export type MediaSize =
  | "screen"
  | "choices"
  | "host"
  | "answer"
  | "tv"
  | "tvLarge";

/** MEDIA_HEIGHT gives pictures and videos a definite height, not just a
 * maximum: small files (SIGame packs often have 300 px pictures and 240p
 * videos) scale up to fill it and big ones shrink to fit. `max-w-full` with
 * `object-contain` keeps the aspect ratio on narrow screens. */
const MEDIA_HEIGHT: Record<MediaSize, string> = {
  screen: "h-[40dvh] buzzbar:h-[32dvh]",
  choices: "h-[40dvh] buzzbar:h-[20dvh]",
  host: "h-[30dvh]",
  answer: "h-[22dvh]",
  tv: "h-[50dvh]",
  tvLarge: "h-[60dvh]",
};

/** YOUTUBE_WIDTH sizes YouTube embeds (which size by width) to the same
 * height as other videos. */
const YOUTUBE_WIDTH: Record<MediaSize, string> = {
  screen:
    "w-[min(100%,calc(40dvh*16/9))] buzzbar:w-[min(100%,calc(32dvh*16/9))]",
  choices:
    "w-[min(100%,calc(40dvh*16/9))] buzzbar:w-[min(100%,calc(20dvh*16/9))]",
  host: "w-[min(100%,calc(30dvh*16/9))]",
  answer: "w-[min(100%,calc(22dvh*16/9))]",
  tv: "w-[min(100%,calc(50dvh*16/9))]",
  tvLarge: "w-[min(100%,calc(60dvh*16/9))]",
};

function isTvSize(size: MediaSize) {
  return size === "tv" || size === "tvLarge";
}

function MediaError({ block }: { block: MediaBlock }) {
  return (
    <div className="flex items-center justify-center border border-white p-4 text-white">
      <SadFile className="h-10 w-10" title={block.src} />
    </div>
  );
}

/** mediaDataAttrs tags each block so tests (and debugging) can find it
 * regardless of whether the file actually loaded. */
function mediaDataAttrs(block: MediaBlock) {
  return {
    "data-testid": "clue-media",
    "data-media-type": block.type,
    "data-src": block.src,
  };
}

/** useInitialPlay tries to start playback once, when the element mounts.
 * Browsers (especially on phones) may refuse playback without a user
 * gesture; onBlocked is then called so we can show a tap-to-play control.
 * Playback is never restarted on re-render, and is stopped on unmount (when
 * the clue closes or the prompt moves on). */
function useInitialPlay(
  ref: React.RefObject<HTMLMediaElement | null>,
  autoPlay: boolean,
  onBlocked: () => void,
) {
  const { mute } = useSoundSettings();
  // Capture the decision at mount so later setting/prop changes never
  // re-trigger playback.
  const shouldPlay = React.useRef(autoPlay && !mute);
  const onBlockedRef = React.useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shouldPlay.current) {
      try {
        const result = el.play();
        if (result) result.catch(() => onBlockedRef.current());
      } catch {
        onBlockedRef.current();
      }
    }
    return () => {
      try {
        el.pause();
      } catch {
        // Some environments (and detached elements) don't implement pause.
      }
    };
  }, [ref]);
}

/** useReplay restarts the clip from the start each time `replayNonce` goes
 * up after the element mounted (the host's replay, feature 23). The value
 * at mount never replays, so a prompt that remounts doesn't restart media. */
function useReplay(
  ref: React.RefObject<HTMLMediaElement | null>,
  replayNonce: number,
  onBlocked: () => void,
) {
  const { mute } = useSoundSettings();
  const seen = React.useRef(replayNonce);
  const onBlockedRef = React.useRef(onBlocked);
  onBlockedRef.current = onBlocked;

  React.useEffect(() => {
    if (replayNonce <= seen.current) return;
    seen.current = replayNonce;
    const el = ref.current;
    if (!el) return;
    try {
      el.currentTime = 0;
      if (mute) return;
      const result = el.play();
      if (result) result.catch(() => onBlockedRef.current());
    } catch {
      onBlockedRef.current();
    }
  }, [ref, replayNonce, mute]);
}

/** useMediaVolume applies the user's volume setting to a media element. */
function useMediaVolume(ref: React.RefObject<HTMLMediaElement | null>) {
  const { volume } = useSoundSettings();
  React.useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [ref, volume]);
}

export function ClueImage({
  block,
  size = "screen",
}: {
  block: MediaBlock;
  size?: MediaSize;
}) {
  const { t } = useTranslation();
  const [error, setError] = React.useState(false);
  const ref = React.useRef<HTMLImageElement>(null);

  // Detect broken images that fail without firing onError (e.g. CSP blocks in
  // Safari).
  React.useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0 && img.currentSrc) {
      setError(true);
    }
  }, [block.src]);

  return (
    <span {...mediaDataAttrs(block)} className="flex min-h-0 justify-center">
      {error ? (
        <MediaError block={block} />
      ) : (
        <img
          ref={ref}
          src={block.src}
          alt={block.alt ?? t("play.media.clueImage")}
          className={`${MEDIA_HEIGHT[size]} w-auto max-w-full object-contain`}
          onError={() => setError(true)}
        />
      )}
    </span>
  );
}

function formatTime(sec: number) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function AudioPlayer({
  block,
  autoPlay,
  replayNonce = 0,
}: {
  block: MediaBlock;
  autoPlay: boolean;
  /** Goes up when the host replays the clip (feature 23). */
  replayNonce?: number;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [time, setTime] = React.useState({ current: 0, duration: 0 });

  useMediaVolume(ref);
  useInitialPlay(ref, autoPlay, () => setBlocked(true));
  useReplay(ref, replayNonce, () => setBlocked(true));

  function toggle() {
    const audio = ref.current;
    if (!audio) return;
    if (audio.paused) {
      setBlocked(false);
      audio.play()?.catch(() => setBlocked(true));
    } else {
      audio.pause();
    }
  }

  const label = playing
    ? t("play.media.pauseAudio")
    : t("play.media.playAudio");
  const progress =
    time.duration > 0 ? Math.min(100, (100 * time.current) / time.duration) : 0;

  return (
    <div
      {...mediaDataAttrs(block)}
      className="flex w-full max-w-md flex-col items-center gap-2"
    >
      {/* No native controls: the big button below is easier to hit on phones. */}
      <audio
        ref={ref}
        src={block.src}
        preload="auto"
        aria-label={block.alt ?? t("play.media.clueAudio")}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setError(true)}
        onTimeUpdate={(e) =>
          setTime({
            current: e.currentTarget.currentTime,
            duration: e.currentTarget.duration,
          })
        }
        onLoadedMetadata={(e) =>
          setTime({
            current: e.currentTarget.currentTime,
            duration: e.currentTarget.duration,
          })
        }
      />
      {error ? (
        <MediaError block={block} />
      ) : (
        <>
          <button
            type="button"
            onClick={toggle}
            // Enter is the buzz key; don't let it toggle playback when the
            // button happens to have focus.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            aria-label={label}
            title={label}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-blue-bright shadow-lg transition-transform hover:scale-105 focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:outline-none active:scale-95"
          >
            {playing ? (
              <Pause className="h-10 w-10" />
            ) : (
              <Play className="ml-1 h-10 w-10" />
            )}
          </button>
          {blocked ? (
            <p className="text-sm font-bold text-white">
              {t("play.media.tapToPlayAudio")}
            </p>
          ) : null}
          <div className="flex w-full items-center gap-2 text-xs text-slate-200">
            <span className="w-10 text-right tabular-nums">
              {formatTime(time.current)}
            </span>
            <div className="h-1.5 grow overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="w-10 tabular-nums">
              {formatTime(time.duration)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

export function VideoPlayer({
  block,
  autoPlay,
  replayNonce = 0,
  size = "screen",
}: {
  block: MediaBlock;
  autoPlay: boolean;
  /** Goes up when the host replays the clip (feature 23). */
  replayNonce?: number;
  size?: MediaSize;
}) {
  const { t } = useTranslation();
  const ref = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState(false);
  const [blocked, setBlocked] = React.useState(false);

  useMediaVolume(ref);
  useInitialPlay(ref, autoPlay, () => setBlocked(true));
  useReplay(ref, replayNonce, () => setBlocked(true));

  return (
    <div
      {...mediaDataAttrs(block)}
      className="flex min-h-0 w-full flex-col items-center gap-1"
    >
      {error ? (
        <MediaError block={block} />
      ) : (
        <video
          ref={ref}
          src={block.src}
          controls
          playsInline
          preload="metadata"
          aria-label={block.alt ?? t("play.media.clueVideo")}
          onPlay={() => setBlocked(false)}
          onError={() => setError(true)}
          className={`${MEDIA_HEIGHT[size]} w-auto max-w-full bg-black object-contain`}
        />
      )}
      {blocked && !error ? (
        <p className="text-sm font-bold text-white">
          {t("play.media.tapPlayToStart")}
        </p>
      ) : null}
    </div>
  );
}

export function YouTubePlayer({
  block,
  autoPlay,
  size = "screen",
}: {
  block: MediaBlock;
  autoPlay: boolean;
  size?: MediaSize;
}) {
  const { t } = useTranslation();
  const { mute } = useSoundSettings();
  const video = parseYouTubeUrl(block.src);
  // Freeze the URL at mount: changing an iframe's src reloads the player.
  const [src] = React.useState(() =>
    video ? youTubeEmbedUrl(video, { autoPlay: autoPlay && !mute }) : null,
  );

  return (
    <div {...mediaDataAttrs(block)} className="flex w-full justify-center">
      {src ? (
        <iframe
          src={src}
          title={block.alt ?? t("play.media.youTubeVideo")}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className={`aspect-video ${YOUTUBE_WIDTH[size]} border-0`}
        />
      ) : (
        <MediaError block={block} />
      )}
    </div>
  );
}

/** PlayableMedia renders audio and video blocks (not images, which live in
 * the buzz button so tapping a picture still buzzes in). */
export function PlayableMedia({
  blocks,
  autoPlay,
  replayNonce = 0,
  size = "screen",
}: {
  blocks: MediaBlock[];
  autoPlay: boolean;
  /** Goes up when the host replays the question's clip (feature 23): the
   * first clip restarts, like the one that started by itself. */
  replayNonce?: number;
  /** How big videos are (audio players don't change). */
  size?: MediaSize;
}) {
  // The replay count when this list mounted: a YouTube player is remounted
  // (its iframe can't be told to restart) only for later replays.
  const [mountNonce] = React.useState(replayNonce);
  const playable = blocks.filter((b) => b.type !== "image");
  if (playable.length === 0) return null;
  return (
    <div
      className={clsx(
        "flex w-full flex-col items-center gap-3 px-4",
        // The TV lets videos use the whole width of a big screen.
        isTvSize(size) ? "max-w-none" : "max-w-screen-lg",
      )}
    >
      {playable.map((block, i) => {
        const key = `${i}-${block.type}-${block.src}`;
        // Only the first clip starts by itself; overlapping sound is useless.
        const props = { block, autoPlay: autoPlay && i === 0, size };
        const replay = i === 0 ? replayNonce : 0;
        if (block.type === "audio") {
          return <AudioPlayer key={key} {...props} replayNonce={replay} />;
        }
        if (parseYouTubeUrl(block.src)) {
          const replayed = replay > mountNonce;
          return (
            <YouTubePlayer
              key={replayed ? `${key}-replay-${replay}` : key}
              {...props}
              autoPlay={props.autoPlay || replayed}
            />
          );
        }
        return <VideoPlayer key={key} {...props} replayNonce={replay} />;
      })}
    </div>
  );
}
