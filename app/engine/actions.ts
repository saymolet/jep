import { z } from "zod";

import { type Avatar, AvatarInput, normalizeAvatar } from "~/models/avatar";
import {
  coercePlayerColor,
  PLAYER_COLOR_HEX_REGEX,
  type PlayerColor,
} from "~/models/player-color";
import { isTeamId, TEAM_IDS, type TeamId } from "~/models/team";

import type { Action } from "./engine";
import { ActionType } from "./engine";
import type { State } from "./state";

const CluePayload = z.object({
  userId: z.string(),
  i: z.number(),
  j: z.number(),
});

const ClueWagerPayload = CluePayload.extend({ wager: z.number() });
export const PlayerPayload = z.object({
  userId: z.string(),
  name: z.string(),
  color: z
    .preprocess(
      (value) => coercePlayerColor(value),
      z.string().regex(PLAYER_COLOR_HEX_REGEX),
    )
    .optional(),
  /** The player's avatar (see models/avatar.ts), or "" to remove it. Older
   * events have none. Invalid avatars (events can be inserted directly) are
   * dropped here rather than failing the whole action. */
  avatar: z.preprocess(
    (value) => (value === "" ? "" : normalizeAvatar(value)),
    z.string().optional(),
  ),
  /** The team picked when joining (team mode). Older events have none; an
   * unknown team is dropped rather than failing the whole action. */
  team: z.preprocess(
    (value) => (isTeamId(value) ? value : undefined),
    z.enum(TEAM_IDS).optional(),
  ),
});
/** PlayerFormPayload validates a Join/ChangeName request from a client.
 * Unlike PlayerPayload (used on replay, where bad avatars are ignored), an
 * invalid avatar is rejected so the client hears about it. */
export const PlayerFormPayload = PlayerPayload.extend({
  avatar: AvatarInput.optional(),
});
const RoundPayload = z.object({ round: z.number(), userId: z.string() });
const BuzzPayload = CluePayload.extend({ deltaMs: z.number() });
const AnswerPayload = CluePayload.extend({ answer: z.string() });
const CheckPayload = CluePayload.extend({
  correct: z.boolean(),
  /** Index of the option picked on a multiple choice clue. Older events have
   * none. The engine validates the index against the clue. */
  choice: z.number().optional(),
  /** Sent by the answering player's own device when their answer time ran
   * out (answer timer). On a multiple choice clue it marks the answer wrong
   * without a pick. Older events have none. */
  timedOut: z.boolean().optional(),
});
const CorrectCheckPayload = CluePayload.extend({
  correct: z.boolean(),
  round: z.number(),
});
const PassCluePayload = CluePayload.extend({
  /** The player who gets the secret clue. */
  toUserId: z.string(),
});
const SetTeamPayload = z.object({
  userId: z.string(),
  /** null leaves the player's team (they play solo). */
  team: z.enum(TEAM_IDS).nullable(),
});
const RenameTeamPayload = z.object({
  userId: z.string(),
  team: z.enum(TEAM_IDS),
  /** The new name ("" resets the default). The engine validates it. */
  name: z.string(),
});
const SetSettingsPayload = z.object({
  userId: z.string(),
  /** Seconds for the answer timer, 0 = off. The engine validates the value
   * (see ANSWER_TIME_OPTIONS). */
  answerTimeSec: z.number(),
  autoWrongOnTimeout: z.boolean(),
  /** Set by the server when the site admin made the change (only the server
   * can insert set_settings events into a room, see the settings route). */
  admin: z.literal(true).optional(),
});
const TransferPlayerPayload = z.object({
  oldUserId: z.string(),
  newUserId: z.string(),
});
const RestorePayload = z.object({
  type: z.string(),
  players: z.instanceof(Map),
  round: z.number(),
  game: z.record(z.string(), z.unknown()),
});

export function isClueAction(action: Action): action is {
  type: ActionType.ChooseClue | ActionType.NextClue;
  payload: { userId: string; i: number; j: number };
  ts: number;
} {
  return (
    (action.type === ActionType.ChooseClue ||
      action.type === ActionType.NextClue) &&
    CluePayload.safeParse(action.payload).success
  );
}

export function isClueWagerAction(action: Action): action is {
  type: ActionType.SetClueWager;
  payload: { userId: string; i: number; j: number; wager: number };
  ts: number;
} {
  return (
    action.type === ActionType.SetClueWager &&
    ClueWagerPayload.safeParse(action.payload).success
  );
}

export function isPlayerAction(action: Action): action is {
  type:
    | ActionType.Join
    | ActionType.ChangeName
    | ActionType.Kick
    | ActionType.Leave;
  payload: {
    userId: string;
    name: string;
    color?: PlayerColor;
    avatar?: Avatar | "";
    team?: TeamId;
  };
  ts: number;
} {
  const parsed = PlayerPayload.safeParse(action.payload);
  if (!parsed.success) {
    return false;
  }
  action.payload = parsed.data;
  return (
    action.type === ActionType.Join ||
    action.type === ActionType.ChangeName ||
    action.type === ActionType.Kick ||
    action.type === ActionType.Leave
  );
}

export function isRoundAction(action: Action): action is {
  type: ActionType.StartRound;
  payload: { round: number; userId: string };
  ts: number;
} {
  return (
    action.type === ActionType.StartRound &&
    RoundPayload.safeParse(action.payload).success
  );
}

export function isBuzzAction(action: Action): action is {
  type: ActionType.Buzz;
  payload: { userId: string; i: number; j: number; deltaMs: number };
  ts: number;
} {
  return (
    action.type === ActionType.Buzz &&
    BuzzPayload.safeParse(action.payload).success
  );
}

export function isAnswerAction(action: Action): action is {
  type: ActionType.Answer;
  payload: { userId: string; i: number; j: number; answer: string };
  ts: number;
} {
  return (
    action.type === ActionType.Answer &&
    AnswerPayload.safeParse(action.payload).success
  );
}

export function isCheckAction(action: Action): action is {
  type: ActionType.Check;
  payload: {
    userId: string;
    i: number;
    j: number;
    correct: boolean;
    choice?: number;
    timedOut?: boolean;
  };
  ts: number;
} {
  return (
    action.type === ActionType.Check &&
    CheckPayload.safeParse(action.payload).success
  );
}

export function isCorrectCheckAction(action: Action): action is {
  type: ActionType.CorrectCheck;
  payload: {
    round: number;
    userId: string;
    i: number;
    j: number;
    correct: boolean;
  };
  ts: number;
} {
  return (
    action.type === ActionType.CorrectCheck &&
    CorrectCheckPayload.safeParse(action.payload).success
  );
}

export function isPassClueAction(action: Action): action is {
  type: ActionType.PassClue;
  payload: { userId: string; i: number; j: number; toUserId: string };
  ts: number;
} {
  return (
    action.type === ActionType.PassClue &&
    PassCluePayload.safeParse(action.payload).success
  );
}

export function isSetTeamAction(action: Action): action is {
  type: ActionType.SetTeam;
  payload: { userId: string; team: TeamId | null };
  ts: number;
} {
  return (
    action.type === ActionType.SetTeam &&
    SetTeamPayload.safeParse(action.payload).success
  );
}

export function isRenameTeamAction(action: Action): action is {
  type: ActionType.RenameTeam;
  payload: { userId: string; team: TeamId; name: string };
  ts: number;
} {
  return (
    action.type === ActionType.RenameTeam &&
    RenameTeamPayload.safeParse(action.payload).success
  );
}

export function isSetSettingsAction(action: Action): action is {
  type: ActionType.SetSettings;
  payload: {
    userId: string;
    answerTimeSec: number;
    autoWrongOnTimeout: boolean;
    admin?: true;
  };
  ts: number;
} {
  return (
    action.type === ActionType.SetSettings &&
    SetSettingsPayload.safeParse(action.payload).success
  );
}

export function isTransferPlayerAction(action: Action): action is {
  type: ActionType.TransferPlayer;
  payload: { oldUserId: string; newUserId: string };
  ts: number;
} {
  return (
    action.type === ActionType.TransferPlayer &&
    TransferPlayerPayload.safeParse(action.payload).success
  );
}

export function isRestoreAction(action: Action): action is {
  type: ActionType.Restore;
  payload: State;
  ts: number;
} {
  return (
    action.type === ActionType.Restore &&
    RestorePayload.safeParse(action.payload).success
  );
}
