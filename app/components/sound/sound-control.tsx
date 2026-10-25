import * as React from "react";

import { useTranslation } from "~/i18n";
import { useSoundSettings } from "~/utils/user-settings";

import { MuteToggle } from "./mute-toggle";
import { VolumeSlider } from "./volume-slider";

export function SoundControl({
  showLabel = true,
  showSlider = true,
}: {
  showLabel?: boolean;
  showSlider?: boolean;
}) {
  const { t } = useTranslation();
  const sound = useSoundSettings();

  // Local state for responsive slider — writes through to context
  const [volume, setLocalVolume] = React.useState(sound.volume);
  const [mute, setLocalMute] = React.useState(sound.mute);

  function setVolume(v: number) {
    setLocalVolume(v);
    sound.setVolume(v);
  }

  function setMute(m: boolean) {
    setLocalMute(m);
    sound.setMute(m);
  }

  return (
    <div className="flex flex-col gap-1">
      {showLabel && (
        <span className="text-sm opacity-70">{t("common.gameSounds")}</span>
      )}
      <form className="group flex grow items-center gap-2">
        <MuteToggle
          pressed={mute}
          onPressChange={(pressed) => setMute(pressed)}
        />
        {showSlider && (
          <VolumeSlider
            value={volume}
            onValueChange={(value) => {
              setVolume(value);
              if (value === 0) {
                setMute(true);
              } else {
                setMute(false);
              }
            }}
          />
        )}
      </form>
    </div>
  );
}
