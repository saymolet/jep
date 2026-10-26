import { CANT_BUZZ_FLAG } from "~/engine/engine";
import { getBuzzWindowMs } from "~/engine/room-timers";
import type { Player } from "~/engine/state";
import { GameState, isSecretClue } from "~/engine/state";
import type { useEngineContext } from "~/engine/use-engine-context";
import { hasChoices } from "~/utils/choices";

type Engine = ReturnType<typeof useEngineContext>;

/** ViewerStatus is what is happening in the game, as shown to people who
 * watch it without playing: spectators and the TV (presenter) screen. */
export type ViewerStatus =
  | { kind: "paused" }
  | { kind: "waitingForPlayers" }
  | { kind: "roundStarting"; round: number; name?: string }
  | { kind: "choosing"; name: string }
  | { kind: "final" }
  | { kind: "wagering"; name: string }
  | { kind: "finalWagers"; done: number; total: number }
  | { kind: "passing"; name: string }
  | { kind: "reading" }
  | { kind: "buzzersOpen" }
  | { kind: "answering"; name: string }
  | { kind: "secretAnswering"; name: string }
  | { kind: "picking"; name: string }
  | { kind: "writing" }
  | { kind: "checking" }
  | { kind: "gotIt"; name: string }
  | { kind: "noOneAnswered" }
  | { kind: "answer" }
  | { kind: "gameOver"; winners: string[] };

export type ViewerStatusInput = Pick<
  Engine,
  | "type"
  | "isPaused"
  | "players"
  | "boardControl"
  | "board"
  | "round"
  | "numAnswered"
  | "clue"
  | "activeClue"
  | "buzzes"
  | "wagers"
  | "winningBuzzer"
  | "answeredBy"
> &
  /** The room's buzz window (default 5 s). */
  Partial<Pick<Engine, "buzzWindowSec">>;

/** isSingleLongFormBoard is a final round: one category with one long-form
 * question. */
export function isSingleLongFormBoard(board: Engine["board"]) {
  return (
    board !== undefined &&
    board.categories.length === 1 &&
    board.categories[0].clues.length === 1 &&
    Boolean(board.categories[0].clues[0].longForm)
  );
}

/** getWinners are the players with the highest score (several on a tie). */
export function getWinners(players: Map<string, Player>): Player[] {
  const all = Array.from(players.values());
  if (all.length === 0) return [];
  const best = Math.max(...all.map((p) => p.score));
  return all.filter((p) => p.score === best);
}

/** sortByScore sorts players from the highest to the lowest score (stable,
 * so ties keep their join order). */
export function sortByScore(players: Map<string, Player>): Player[] {
  return Array.from(players.values()).sort((a, b) => b.score - a.score);
}

/** getViewerStatus describes the current game state for viewers.
 * `buzzersOpen` is whether the question has been "read" long enough for the
 * buzzers to open (players' devices time this locally, so viewers do too). */
export function getViewerStatus(
  engine: ViewerStatusInput,
  { buzzersOpen = false, unknownName = "?" } = {},
): ViewerStatus {
  const { type, players, boardControl, clue } = engine;
  const nameOf = (userId: string | null | undefined) =>
    (userId ? players.get(userId)?.name : undefined) ?? unknownName;

  if (engine.isPaused && type !== GameState.GameOver) {
    return { kind: "paused" };
  }

  switch (type) {
    case GameState.PreviewRound:
      if (players.size === 0) return { kind: "waitingForPlayers" };
      return {
        kind: "roundStarting",
        round: engine.round + 1,
        name:
          boardControl && !isSingleLongFormBoard(engine.board)
            ? nameOf(boardControl)
            : undefined,
      };
    case GameState.ShowBoard:
      if (isSingleLongFormBoard(engine.board)) return { kind: "final" };
      return { kind: "choosing", name: nameOf(boardControl) };
    case GameState.WagerClue: {
      if (!clue?.longForm) {
        return { kind: "wagering", name: nameOf(boardControl) };
      }
      const cantWager = Array.from(engine.buzzes.values()).filter(
        (b) => b === CANT_BUZZ_FLAG,
      ).length;
      return {
        kind: "finalWagers",
        done: engine.wagers.size,
        total: Math.max(0, players.size - cantWager),
      };
    }
    case GameState.PassClue:
      return { kind: "passing", name: nameOf(boardControl) };
    case GameState.ReadClue: {
      const someoneBuzzed = Array.from(engine.buzzes.values()).some(
        (b) => b !== CANT_BUZZ_FLAG && b <= getBuzzWindowMs(engine),
      );
      return buzzersOpen || someoneBuzzed
        ? { kind: "buzzersOpen" }
        : { kind: "reading" };
    }
    case GameState.ReadWagerableClue:
      return { kind: "answering", name: nameOf(boardControl) };
    case GameState.ReadLongFormClue:
      return { kind: "writing" };
    case GameState.RevealAnswerToBuzzer: {
      const name = nameOf(engine.winningBuzzer);
      if (clue && isSecretClue(clue)) return { kind: "secretAnswering", name };
      if (clue && hasChoices(clue)) return { kind: "picking", name };
      return { kind: "answering", name };
    }
    case GameState.RevealAnswerLongForm:
      return { kind: "checking" };
    case GameState.RevealAnswerToAll: {
      if (clue?.longForm || !engine.activeClue) return { kind: "answer" };
      const [i, j] = engine.activeClue;
      const correct = Array.from(players.values()).find(
        (p) => engine.answeredBy(i, j, p.userId) === true,
      );
      if (correct) return { kind: "gotIt", name: correct.name };
      return { kind: "noOneAnswered" };
    }
    case GameState.GameOver:
      return {
        kind: "gameOver",
        winners: getWinners(players).map((p) => p.name),
      };
  }
}
