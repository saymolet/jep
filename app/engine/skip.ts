import { GameState, type State, clueIsPlayable } from "./state";

/** OPEN_QUESTION_STATES are the states of an open question before its
 * answer is shown to everyone: the site admin may skip it (SkipClue). */
export const OPEN_QUESTION_STATES: ReadonlySet<GameState> = new Set([
  GameState.WagerClue,
  GameState.PassClue,
  GameState.ReadClue,
  GameState.ReadWagerableClue,
  GameState.ReadLongFormClue,
  GameState.RevealAnswerToBuzzer,
  GameState.RevealAnswerLongForm,
]);

/** canSkipClue is true when the site admin may skip question (i, j) of the
 * current round (ActionType.SkipClue): it is the open question and its answer
 * isn't shown to everyone yet, or the board shows and it is an unplayed
 * question. */
export function canSkipClue(
  state: Pick<State, "type" | "round" | "game" | "isAnswered" | "activeClue">,
  i: number,
  j: number,
) {
  if (i < 0 || j < 0) return false;
  const clue = state.game.boards.at(state.round)?.categories.at(j)?.clues.at(i);
  const cell = state.isAnswered.at(state.round)?.at(i)?.at(j);
  if (!clue || !cell || cell.isAnswered) return false;
  if (state.type === GameState.ShowBoard) {
    return clueIsPlayable(clue);
  }
  return (
    OPEN_QUESTION_STATES.has(state.type) &&
    state.activeClue?.[0] === i &&
    state.activeClue?.[1] === j
  );
}
