import { useFetcher } from "react-router";

import type { RoomProps } from "~/components/game";
import type { Action } from "~/engine";
import { GameState, useEngineContext } from "~/engine";
import useSoloAction from "~/utils/use-solo-action";

const PAUSE_SYMBOL = "⏸"; // ⏸
const PLAY_SYMBOL = "▶"; // ▶

/** usePauseToggle returns a submit function that toggles the game's paused
 * state via a room event (or a local dispatch in solo play). */
function usePauseToggle(roomId: number) {
  const { soloDispatch } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);

  return () =>
    fetcher.submit(null, {
      method: "post",
      action: `/room/${roomId}/pause`,
    });
}

/** PauseControl is the header button to pause or resume the game. Pausing is
 * only available when no clue is open (see engine `TogglePause`). */
export function PauseControl({ roomId }: Pick<RoomProps, "roomId">) {
  const { isPaused, activeClue, type } = useEngineContext();
  const toggle = usePauseToggle(roomId);

  const canPause = activeClue === null && type !== GameState.GameOver;
  const disabled = !isPaused && !canPause;

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      aria-label={isPaused ? "Resume game" : "Pause game"}
      className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
      title={
        isPaused
          ? "Resume game"
          : canPause
            ? "Pause game"
            : "Pause is available between clues"
      }
    >
      <span className="text-base">{isPaused ? PLAY_SYMBOL : PAUSE_SYMBOL}</span>
      <span>{isPaused ? "Resume" : "Pause"}</span>
    </button>
  );
}

/** PausedOverlay covers the screen for everyone while the game is paused. */
export function PausedOverlay({ roomId }: Pick<RoomProps, "roomId">) {
  const { isPaused } = useEngineContext();
  const toggle = usePauseToggle(roomId);

  if (!isPaused) return null;

  return (
    <div
      data-testid="paused-overlay"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-blue-1000/95 text-center backdrop-blur-sm"
    >
      <span className="text-7xl text-white">{PAUSE_SYMBOL}</span>
      <h2 className="text-3xl font-bold text-white">Game paused</h2>
      <button
        onClick={toggle}
        aria-label="Resume game"
        className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-lg font-semibold text-blue-1000 transition-colors hover:bg-slate-200"
      >
        <span>{PLAY_SYMBOL}</span>
        Resume
      </button>
    </div>
  );
}
