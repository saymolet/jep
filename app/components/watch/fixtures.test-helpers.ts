import type { Action } from "~/engine";
import { ActionType, CLUE_TIMEOUT_MS, gameEngine } from "~/engine";
import { stateFromGame, type State } from "~/engine/state";
import { ConnectionState, stateToGameEngine } from "~/engine/use-game-engine";
import type { Game } from "~/models/convert.server";

/** A small game with one of each kind of question, for viewer tests. */
export const WATCH_GAME: Game = {
  title: "Watch test",
  author: "Tests",
  copyright: "",
  note: "",
  boards: [
    {
      categoryNames: ["Animals", "Mystery"],
      categories: [
        {
          name: "Animals",
          clues: [
            { clue: "This pet says meow", answer: "Cat", value: 200 },
            {
              clue: "This pet barks",
              answer: "Dog",
              value: 400,
              wagerable: true,
            },
          ],
        },
        {
          name: "Mystery",
          clues: [
            {
              clue: "The king of the jungle",
              answer: "Lion",
              value: 200,
              secret: true,
              secretTopic: "Big cats",
              secretValue: 500,
            },
            {
              clue: "The red planet",
              answer: "Mars",
              value: 400,
              choices: ["Venus", "Mars"],
            },
          ],
        },
      ],
    },
    {
      categoryNames: ["Capitals"],
      categories: [
        {
          name: "Capitals",
          clues: [
            {
              clue: "Capital of France",
              answer: "Paris",
              value: 0,
              wagerable: true,
              longForm: true,
            },
          ],
        },
      ],
    },
  ],
};

export const ANN = "u1";
export const BOB = "u2";

type Step = { type: ActionType; payload?: unknown };

const at = (userId: string, i: number, j: number) => ({ userId, i, j });

/** Steps from an empty room to the end of the game. */
export const STEPS = {
  join: [
    { type: ActionType.Join, payload: { userId: ANN, name: "Ann" } },
    { type: ActionType.Join, payload: { userId: BOB, name: "Bob" } },
  ],
  start: [{ type: ActionType.StartRound, payload: { round: 0, userId: ANN } }],
  chooseFirst: [{ type: ActionType.ChooseClue, payload: at(ANN, 0, 0) }],
  buzzFirst: [
    { type: ActionType.Buzz, payload: { ...at(ANN, 0, 0), deltaMs: 100 } },
    {
      type: ActionType.Buzz,
      payload: { ...at(BOB, 0, 0), deltaMs: CLUE_TIMEOUT_MS + 1 },
    },
  ],
  checkFirst: [
    { type: ActionType.Check, payload: { ...at(ANN, 0, 0), correct: true } },
  ],
  nextFirst: [{ type: ActionType.NextClue, payload: at(ANN, 0, 0) }],
  chooseWager: [{ type: ActionType.ChooseClue, payload: at(ANN, 1, 0) }],
  wager: [
    {
      type: ActionType.SetClueWager,
      payload: { ...at(ANN, 1, 0), wager: 150 },
    },
  ],
  finishWager: [
    { type: ActionType.Buzz, payload: { ...at(ANN, 1, 0), deltaMs: 100 } },
    { type: ActionType.Check, payload: { ...at(ANN, 1, 0), correct: true } },
    { type: ActionType.NextClue, payload: at(ANN, 1, 0) },
  ],
  chooseSecret: [{ type: ActionType.ChooseClue, payload: at(ANN, 0, 1) }],
  passSecret: [
    { type: ActionType.PassClue, payload: { ...at(ANN, 0, 1), toUserId: BOB } },
  ],
  finishSecret: [
    { type: ActionType.Check, payload: { ...at(BOB, 0, 1), correct: true } },
    { type: ActionType.NextClue, payload: at(BOB, 0, 1) },
  ],
  chooseChoice: [{ type: ActionType.ChooseClue, payload: at(BOB, 1, 1) }],
  buzzChoice: [
    { type: ActionType.Buzz, payload: { ...at(ANN, 1, 1), deltaMs: 100 } },
    {
      type: ActionType.Buzz,
      payload: { ...at(BOB, 1, 1), deltaMs: CLUE_TIMEOUT_MS + 1 },
    },
  ],
  finishChoice: [
    {
      type: ActionType.Check,
      payload: { ...at(ANN, 1, 1), correct: true, choice: 1 },
    },
    { type: ActionType.NextClue, payload: at(ANN, 1, 1) },
  ],
  startFinal: [
    { type: ActionType.StartRound, payload: { round: 1, userId: ANN } },
  ],
  chooseFinal: [{ type: ActionType.ChooseClue, payload: at(ANN, 0, 0) }],
  wagerAnnFinal: [
    {
      type: ActionType.SetClueWager,
      payload: { ...at(ANN, 0, 0), wager: 100 },
    },
  ],
  wagerBobFinal: [
    { type: ActionType.SetClueWager, payload: { ...at(BOB, 0, 0), wager: 0 } },
  ],
  answerFinal: [
    { type: ActionType.Answer, payload: { ...at(ANN, 0, 0), answer: "Paris" } },
    { type: ActionType.Answer, payload: { ...at(BOB, 0, 0), answer: "Rome" } },
  ],
  checkFinal: [
    { type: ActionType.Check, payload: { ...at(ANN, 0, 0), correct: true } },
    { type: ActionType.Check, payload: { ...at(BOB, 0, 0), correct: false } },
  ],
  finishFinal: [{ type: ActionType.NextClue, payload: at(ANN, 0, 0) }],
  pause: [{ type: ActionType.TogglePause }],
} satisfies Record<string, Step[]>;

/** playUntil plays the game in order (STEPS without "pause") up to and
 * including the named step. */
export function playUntil(name: keyof typeof STEPS): State {
  const steps: Step[][] = [];
  for (const [stepName, step] of Object.entries(STEPS)) {
    if (stepName === "pause") continue;
    steps.push(step);
    if (stepName === name) break;
  }
  return play(...steps);
}

/** play applies actions to a new game state. */
export function play(...steps: Step[][]): State {
  let state = stateFromGame(WATCH_GAME);
  let ts = 1;
  for (const step of steps.flat()) {
    const action: Action = { ...step, ts: ts++ };
    state = gameEngine(state, action);
  }
  return state;
}

/** engineFor is the engine context value for a state. */
export function engineFor(state: State) {
  return stateToGameEngine(WATCH_GAME, state, () => null, {
    connectionState: ConnectionState.CONNECTED,
  });
}
