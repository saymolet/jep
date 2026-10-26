import * as PopoverPrimitive from "@radix-ui/react-popover";
import clsx from "clsx";
import * as React from "react";

import { PROMPT_STATES } from "~/components/prompt/prompt";
import { useEngineContext } from "~/engine";
import { useTranslation } from "~/i18n";
import { getSound, SOUNDS, type SoundId } from "~/utils/soundboard/messages";
import { useSoundboardMute } from "~/utils/soundboard/mute";

import {
  type PlaySound,
  type SoundboardToast,
  useSoundboard,
} from "./use-soundboard";

/** Enter on a soundboard control must not reach the prompt's "Enter buzzes"
 * key listener on the window. */
function stopEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.stopPropagation();
}

/** SoundboardMuteToggle mutes soundboard sounds on this device (game sounds
 * are not affected). */
export function SoundboardMuteToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [muted, setMuted] = useSoundboardMute();
  return (
    <label className={clsx("flex items-center gap-2 text-sm", className)}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-blue-600"
        checked={muted}
        onChange={(e) => setMuted(e.target.checked)}
      />
      {t("soundboard.mute")}
    </label>
  );
}

/** SoundboardPanel is the grid of sound buttons. */
export function SoundboardPanel({
  onPlay,
  coolingDown,
  readyAt,
}: {
  onPlay: (sound: SoundId) => void;
  coolingDown: boolean;
  /** When the cooldown ends (Date.now() ms), for the progress bar. */
  readyAt: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2" data-testid="soundboard-panel">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{t("soundboard.title")}</h2>
        <p className="text-xs text-slate-300">
          {coolingDown ? t("soundboard.wait") : t("soundboard.hint")}
        </p>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
        {coolingDown ? (
          <div
            key={readyAt}
            className="h-full origin-left animate-soundboard-cooldown bg-yellow-1000"
          />
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SOUNDS.map((sound) => (
          <button
            key={sound.id}
            type="button"
            aria-disabled={coolingDown}
            onClick={() => {
              if (!coolingDown) onPlay(sound.id);
            }}
            onKeyDown={stopEnter}
            className={clsx(
              "flex min-h-16 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg bg-white/10 px-1 py-2 transition select-none hover:bg-white/20 focus:ring-2 focus:ring-blue-400 focus:outline-none active:scale-95",
              coolingDown && "cursor-wait opacity-50",
            )}
          >
            <span className="text-3xl leading-none" aria-hidden>
              {sound.emoji}
            </span>
            <span className="text-xs leading-tight">{t(sound.labelKey)}</span>
          </button>
        ))}
      </div>
      <SoundboardMuteToggle className="pt-1 text-slate-300" />
    </div>
  );
}

/** SoundboardToasts shows who played which sound ("🎺 Ann"), briefly. */
export function SoundboardToasts({
  toasts,
  variant = "room",
}: {
  toasts: SoundboardToast[];
  variant?: "room" | "tv";
}) {
  const { t } = useTranslation();
  return (
    <div
      aria-live="polite"
      className={clsx(
        "pointer-events-none fixed z-50 flex flex-col gap-1",
        variant === "tv"
          ? "top-16 right-4 items-end"
          : "inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] items-center",
      )}
    >
      {toasts.map((toast) => {
        const sound = getSound(toast.sound);
        return (
          <p
            key={toast.id}
            data-testid="soundboard-toast"
            data-sound={toast.sound}
            data-played={toast.played}
            className={clsx(
              "max-w-[90vw] animate-fade-scale-in truncate rounded-full bg-black/75 text-white shadow-lg",
              variant === "tv"
                ? "px-5 py-2 text-2xl lg:text-3xl"
                : "px-4 py-1.5 text-base",
            )}
          >
            <span aria-hidden>{sound.emoji} </span>
            <span aria-hidden>{toast.name}</span>
            <span className="sr-only">
              {t("soundboard.played", {
                name: toast.name,
                sound: t(sound.labelKey),
              })}
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** SoundboardButton is the floating 🎺 button that opens the soundboard.
 * Bottom left, above the big BUZZ button when a question is open on phones,
 * so it never covers the buzzer. */
function SoundboardButton({
  onPlay,
  coolingDown,
  readyAt,
}: {
  onPlay: (sound: SoundId) => void;
  coolingDown: boolean;
  readyAt: number;
}) {
  const { t } = useTranslation();
  const { type } = useEngineContext();
  const promptOpen = PROMPT_STATES.has(type);
  const [open, setOpen] = React.useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={t("soundboard.open")}
          title={t("soundboard.title")}
          data-testid="soundboard-button"
          onKeyDown={stopEnter}
          className={clsx(
            "fixed left-3 z-30 flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-blue-925/90 text-2xl shadow-lg ring-1 ring-white/30 transition hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:outline-none",
            // Above the question's countdown, and the BUZZ button on phones.
            promptOpen
              ? "bottom-20 buzzbar:bottom-[calc(7.75rem+env(safe-area-inset-bottom))]"
              : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
            open && "bg-blue-600",
          )}
        >
          <span aria-hidden>🎺</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-40 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl bg-blue-925 p-3 text-white shadow-xl ring-1 ring-white/20 data-[state=open]:animate-fade-scale-in"
        >
          <SoundboardPanel
            onPlay={onPlay}
            coolingDown={coolingDown}
            readyAt={readyAt}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

/** Soundboard: players tap reaction sounds that play on every device in the
 * room, with a "🎺 Ann" toast. Spectators and the TV (`userId` null) only
 * listen. Renders nothing in solo play. */
export function Soundboard({
  userId,
  variant = "room",
  playSound,
}: {
  userId: string | null;
  variant?: "room" | "tv";
  /** Replaces the synthesizer (tests). */
  playSound?: PlaySound;
}) {
  const { available, canSend, send, coolingDown, readyAt, toasts } =
    useSoundboard({ userId, playSound });
  if (!available) return null;
  return (
    <>
      <SoundboardToasts toasts={toasts} variant={variant} />
      {canSend && variant === "room" ? (
        <SoundboardButton
          onPlay={send}
          coolingDown={coolingDown}
          readyAt={readyAt}
        />
      ) : null}
    </>
  );
}
