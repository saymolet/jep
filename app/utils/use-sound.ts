import * as React from "react";

import { useSoundSettings } from "~/utils/user-settings";

/** useGameSound uses the sound settings from the context to play a sound. */
export default function useGameSound(
  src: string,
): [() => void, { stop: () => void }] {
  const { volume, mute } = useSoundSettings();
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    audioRef.current = new Audio(src);
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [src]);

  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const play = React.useCallback(() => {
    const audio = audioRef.current;
    if (!audio || mute) return;
    // interrupt: restart if already playing
    audio.currentTime = 0;
    // Browsers refuse to play before the first tap on a page (e.g. a TV
    // screen nobody touched): no sound then, and no unhandled error.
    audio.play()?.catch(() => {});
  }, [mute]);

  const stop = React.useCallback(() => {
    audioRef.current?.pause();
  }, []);

  return [play, { stop }];
}
