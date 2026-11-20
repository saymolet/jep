import * as React from "react";

import { useEngineContext } from "~/engine";
import { formatElapsedTime } from "~/utils";

const UPDATE_INTERVAL_MS = 200;

/** ClockDisplay shows the game time. It has no pause of its own: the game's
 * Pause stops the clock too. */
export function ClockDisplay({ displayMs }: { displayMs: number }) {
  return (
    <span
      className="rounded-lg px-3 py-1.5 font-mono text-sm text-slate-300 tabular-nums"
      data-testid="game-clock"
    >
      {formatElapsedTime(displayMs)}
    </span>
  );
}

/** GameClock is the game clock connected to the engine context. */
export default function GameClock() {
  const { clockRunning, clockAccumulatedMs, clockLastResumedAt } =
    useEngineContext();

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

  return <ClockDisplay displayMs={displayMs} />;
}
