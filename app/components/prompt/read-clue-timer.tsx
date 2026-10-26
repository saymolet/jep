import clsx from "clsx";

import { CLUE_TIMEOUT_MS } from "~/engine/engine";

/** ReadClueTimer is a white bar which scrolls across the screen for
 * clueDurationMs, then shrinks back over the buzz window. */
export function ReadClueTimer({
  clueDurationMs,
  buzzWindowMs = CLUE_TIMEOUT_MS,
  shouldAnimate,
  wonBuzz,
}: {
  clueDurationMs: number;
  /** The room's buzz window (State.buzzWindowSec). */
  buzzWindowMs?: number;
  shouldAnimate: boolean;
  wonBuzz: boolean;
}) {
  return (
    <div
      className={clsx("mt-2 h-8 shrink-0 self-start", {
        "w-0 bg-white": shouldAnimate,
        "w-full": !shouldAnimate,
        "bg-red-600 opacity-75": !shouldAnimate && !wonBuzz,
        "bg-lime-500": !shouldAnimate && wonBuzz,
      })}
      style={{
        animation: shouldAnimate
          ? `${clueDurationMs / 1000}s linear 0s 1 growFromLeft forwards,
             ${clueDurationMs / 1000}s linear 0s 1 turnGreen forwards,
             ${buzzWindowMs / 1000}s linear ${clueDurationMs / 1000}s 1 shrinkToLeft forwards`
          : "none",
      }}
    />
  );
}
