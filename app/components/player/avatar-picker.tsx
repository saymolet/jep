import clsx from "clsx";
import * as React from "react";

import { LoadingSpinner } from "~/components/icons";
import { useTranslation } from "~/i18n";
import {
  type Avatar,
  AVATAR_EMOJI,
  emojiAvatar,
  parseAvatar,
} from "~/models/avatar";
import { imageFileToAvatar } from "~/utils/avatar-image";

/** AvatarPicker lets a player choose an emoji from a preset grid or upload a
 * photo (cropped, resized and encoded in the browser), or remove their
 * avatar. Meant for dark backgrounds. */
export function AvatarPicker({
  value,
  onChange,
}: {
  value: Avatar | undefined;
  onChange: (avatar: Avatar | undefined) => void;
}) {
  const { t } = useTranslation();
  const inputId = React.useId();
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = parseAvatar(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Reset so picking the same file again still fires a change event.
    input.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      onChange(await imageFileToAvatar(file));
    } catch {
      setError(t("room.avatarPhotoError"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid grid-cols-7 gap-1"
        role="group"
        aria-label={t("room.emojiAvatars")}
      >
        {AVATAR_EMOJI.map((emoji) => {
          const isSelected =
            selected?.kind === "emoji" && selected.emoji === emoji;
          return (
            <button
              key={emoji}
              type="button"
              aria-label={t("room.avatarEmoji", { emoji })}
              aria-pressed={isSelected}
              onClick={() => {
                setError(null);
                onChange(emojiAvatar(emoji));
              }}
              className={clsx(
                "flex aspect-square min-h-9 cursor-pointer items-center justify-center rounded-lg text-2xl transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none",
                isSelected
                  ? "bg-blue-600 ring-2 ring-white"
                  : "bg-white/10 hover:bg-white/20",
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className={clsx(
            "inline-flex cursor-pointer items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 focus-within:ring-2 focus-within:ring-blue-500",
            { "pointer-events-none opacity-50": processing },
          )}
        >
          {processing ? <LoadingSpinner className="h-4 w-4" /> : null}
          {selected?.kind === "image"
            ? t("room.changePhoto")
            : t("room.uploadPhoto")}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={processing}
            onChange={handleFile}
          />
        </label>
        <button
          type="button"
          disabled={!value || processing}
          onClick={() => {
            setError(null);
            onChange(undefined);
          }}
          className="cursor-pointer rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {t("room.removeAvatar")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
