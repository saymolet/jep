/** Multiple choice questions: a clue may list `choices`, one of which is the
 * answer. The player who wins the buzz picks an option and it is checked
 * automatically.
 *
 * Shared by the server (validation, checking picks) and the client
 * (rendering, the engine), so it must stay free of server-only imports.
 */

export const MIN_CHOICES = 2;
export const MAX_CHOICES = 6;

/** The subset of a clue needed to check a pick. */
export interface ClueWithChoices {
  answer: string;
  choices?: string[];
}

/** choiceLabel is the letter shown next to an option: A, B, C... */
export function choiceLabel(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

function normalize(text: string) {
  return text.trim().toLowerCase();
}

/** choicesError validates a clue's options against its answer. Options are
 * compared ignoring surrounding spaces and letter case. */
export function choicesError(choices: string[], answer: string): string | null {
  if (choices.length < MIN_CHOICES || choices.length > MAX_CHOICES) {
    return `choices must have ${MIN_CHOICES} to ${MAX_CHOICES} options`;
  }
  const normalized = choices.map(normalize);
  if (normalized.some((c) => c.length === 0)) {
    return "choices must not be empty";
  }
  if (new Set(normalized).size !== normalized.length) {
    return "choices must be unique";
  }
  if (!normalized.includes(normalize(answer))) {
    return "answer must be one of the choices";
  }
  return null;
}

/** getCorrectChoiceIndex is the index of the option matching the answer, or -1
 * if the clue has no (valid) options. */
export function getCorrectChoiceIndex(clue: ClueWithChoices): number {
  if (!clue.choices) return -1;
  const answer = normalize(clue.answer);
  return clue.choices.findIndex((c) => normalize(c) === answer);
}

/** isChoiceIndex checks that `choice` points at one of the clue's options. */
export function isChoiceIndex(clue: ClueWithChoices, choice: number): boolean {
  return (
    clue.choices !== undefined &&
    Number.isInteger(choice) &&
    choice >= 0 &&
    choice < clue.choices.length
  );
}

/** isCorrectChoice checks whether the picked option is the answer. */
export function isCorrectChoice(
  clue: ClueWithChoices,
  choice: number,
): boolean {
  return isChoiceIndex(clue, choice) && getCorrectChoiceIndex(clue) === choice;
}

/** hasChoices is true for multiple choice clues. */
export function hasChoices(clue: ClueWithChoices | undefined): boolean {
  return (clue?.choices?.length ?? 0) > 0;
}
