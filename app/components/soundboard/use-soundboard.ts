import * as React from "react";

import { PROMPT_STATES } from "~/components/prompt/prompt";
import { useEngineContext } from "~/engine";
import {
  installSoundboardAudioUnlock,
  playSoundboardSound,
  unlockSoundboardAudio,
} from "~/utils/soundboard/audio";
import { SoundboardLimiter } from "~/utils/soundboard/limiter";
import {
  parseSoundboardMessage,
  type SoundboardMessage,
  type SoundId,
} from "~/utils/soundboard/messages";
import { useSoundboardMute } from "~/utils/soundboard/mute";
import { SAMPLE_DURATION_S } from "~/utils/soundboard/samples";
import { useSoundSettings } from "~/utils/user-settings";

/** How long a "🎺 Ann" toast stays on screen. */
export const TOAST_MS = 2_500;
/** At most this many toasts are shown at once (oldest drop off). */
export const MAX_TOASTS = 3;
/** Soundboard volume while a question's audio or video may be playing, so
 * reactions don't drown out the clip. */
export const MEDIA_DUCK = 0.35;

export interface SoundboardToast {
  id: number;
  sound: SoundId;
  name: string;
  /** Whether the sound was played on this device (false: muted, too many
   * sounds at once, or audio unavailable). */
  played: boolean;
}

/** playSound is how a sound is played; tests replace it. */
export type PlaySound = (sound: SoundId, volume: number) => boolean;

/** useSoundboard listens to soundboard sounds on the room channel (plays
 * them and shows a toast) and, for a player, sends sounds. `userId` is this
 * client's user id (null on the TV). */
export function useSoundboard({
  userId,
  playSound = playSoundboardSound,
}: {
  userId: string | null;
  playSound?: PlaySound;
}) {
  const { soundboard, players, type, clue } = useEngineContext();
  const { volume, mute } = useSoundSettings();
  const [soundboardMuted] = useSoundboardMute();
  const [limiter] = React.useState(() => new SoundboardLimiter());

  const promptOpen = PROMPT_STATES.has(type);
  const clueHasClip =
    clue !== undefined &&
    [...(clue.media ?? []), ...(clue.answerMedia ?? [])].some(
      (m) => m.type === "audio" || m.type === "video",
    );
  const duck = promptOpen && clueHasClip;

  // The latest values for the channel listener (subscribed once).
  const latest = React.useRef({
    volume,
    mute,
    soundboardMuted,
    duck,
    players,
    playSound,
  });
  React.useEffect(() => {
    latest.current = {
      volume,
      mute,
      soundboardMuted,
      duck,
      players,
      playSound,
    };
  });

  const [toasts, setToasts] = React.useState<SoundboardToast[]>([]);
  const nextToastId = React.useRef(0);
  const timers = React.useRef(new Set<ReturnType<typeof setTimeout>>());
  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const showToast = React.useCallback((toast: Omit<SoundboardToast, "id">) => {
    const id = ++nextToastId.current;
    setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), { ...toast, id }]);
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
    timers.current.add(timer);
  }, []);

  /** Plays a sound on this device if the settings and limits allow it. */
  const playLocally = React.useCallback(
    (sound: SoundId) => {
      const settings = latest.current;
      if (settings.mute || settings.soundboardMuted || settings.volume <= 0) {
        return false;
      }
      const durationMs = SAMPLE_DURATION_S[sound] * 1000;
      if (!limiter.tryStartPlayback(Date.now(), durationMs)) return false;
      return settings.playSound(
        sound,
        settings.volume * (settings.duck ? MEDIA_DUCK : 1),
      );
    },
    [limiter],
  );

  // Sounds from others.
  React.useEffect(() => {
    if (!soundboard.available) return;
    return soundboard.subscribe((payload) => {
      const message = parseSoundboardMessage(payload);
      if (!message || message.userId === userId) return;
      // Only players can send sounds (spectators and TVs only listen).
      const player = latest.current.players.get(message.userId);
      if (!player) return;
      if (!limiter.tryReceive(message.userId, Date.now())) return;
      const played = playLocally(message.sound);
      showToast({ sound: message.sound, name: player.name, played });
    });
  }, [soundboard, userId, limiter, playLocally, showToast]);

  // Browsers block audio until the page is tapped: get the audio context
  // ready on the first tap so sounds from others can play.
  React.useEffect(() => {
    if (!soundboard.available) return;
    return installSoundboardAudioUnlock();
  }, [soundboard.available]);

  const me = userId ? players.get(userId) : undefined;
  const canSend = soundboard.available && me !== undefined;

  // When this device may send again (cooldown), for the UI.
  const [readyAt, setReadyAt] = React.useState(0);
  const [coolingDown, setCoolingDown] = React.useState(false);
  React.useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(
      () => setCoolingDown(false),
      Math.max(0, readyAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [coolingDown, readyAt]);

  const send = React.useCallback(
    (sound: SoundId) => {
      if (!canSend || !me || !userId) return false;
      if (!limiter.trySend(Date.now())) return false;
      setReadyAt(limiter.sendReadyAt());
      setCoolingDown(true);
      // A tap: the browser allows audio now.
      unlockSoundboardAudio();
      const message: SoundboardMessage = { sound, userId, name: me.name };
      soundboard.send(message);
      const played = playLocally(sound);
      showToast({ sound, name: me.name, played });
      return true;
    },
    [canSend, me, userId, limiter, soundboard, playLocally, showToast],
  );

  return {
    /** False in solo play: there is no soundboard. */
    available: soundboard.available,
    canSend,
    send,
    coolingDown,
    readyAt,
    toasts,
  };
}
