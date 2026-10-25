import * as React from "react";
import { useFetcher } from "react-router";

import type { RoomProps } from "~/components/game";
import type { Action } from "~/engine";
import { useEngineContext } from "~/engine";
import { useTranslation } from "~/i18n";
import { formatElapsedTime } from "~/utils";
import useSoloAction from "~/utils/use-solo-action";

const UPDATE_INTERVAL_MS = 200;
const PAUSE_SYMBOL = "\u23F8"; // ⏸
const PLAY_SYMBOL = "\u25B6"; // ▶

/** ClockDisplay is the presentational component for the game clock.
 * Use this directly when you need a static (non-interactive) clock display. */
export function ClockDisplay({
  displayMs,
  running = false,
  disabled = false,
  onToggle,
}: {
  displayMs: number;
  running?: boolean;
  disabled?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none"
      title={running ? t("room.pauseClock") : t("room.resumeClock")}
    >
      <span className="text-base">{running ? PAUSE_SYMBOL : PLAY_SYMBOL}</span>
      <span className="font-mono tabular-nums">
        {formatElapsedTime(displayMs)}
      </span>
    </button>
  );
}

/** GameClock is the interactive clock connected to the engine context. */
export default function GameClock({
  roomId,
  readOnly = false,
}: Pick<RoomProps, "roomId"> & {
  /** Show the time without the pause/resume toggle (spectators, TV). */
  readOnly?: boolean;
}) {
  const { clockRunning, clockAccumulatedMs, clockLastResumedAt, soloDispatch } =
    useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);

  const [displayMs, setDisplayMs] = React.useState(clockAccumulatedMs);

  React.useEffect(() => {
    if (!clockRunning || clockLastResumedAt === null) {
      setDisplayMs(clockAccumulatedMs);
      return;
    }

    let animationFrameId: number;
    let lastUpdate = 0;

    const tick = () => {
      const now = Date.now();
      if (now - lastUpdate >= UPDATE_INTERVAL_MS) {
        const liveDelta = now - clockLastResumedAt;
        setDisplayMs(clockAccumulatedMs + Math.max(0, liveDelta));
        lastUpdate = now;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [clockRunning, clockAccumulatedMs, clockLastResumedAt]);

  function handleToggle() {
    fetcher.submit(null, {
      method: "post",
      action: `/room/${roomId}/toggle-clock`,
    });
  }

  return (
    <ClockDisplay
      displayMs={displayMs}
      running={clockRunning}
      disabled={readOnly}
      onToggle={readOnly ? undefined : handleToggle}
    />
  );
}
