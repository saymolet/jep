import type { TeamId } from "~/models/team";

import { type Player, type State, getClueValueForRound } from "./state";
import { getTeamStandings, isTeamMode } from "./teams";

/** ScoreChanges is how much each player's score changed on the most recent
 * question (userId -> signed amount). Players the question didn't touch have
 * no entry. */
export type ScoreChanges = ReadonlyMap<string, number>;

export const NO_SCORE_CHANGES: ScoreChanges = new Map();

export type ScoreChangesInput = Pick<
  State,
  "isAnswered" | "activeClue" | "round" | "game" | "wagers"
>;

/** getLastScoredClue finds "the previous question" for the score changes:
 *
 * - the open question, as soon as someone has been checked on it (a wrong
 *   answer before someone else buzzes in, or Final answers being checked one
 *   by one), so the change always explains the current score;
 * - otherwise the most recently finished question (highest answer order, in
 *   any round).
 *
 * Returns null before any question was scored. */
export function getLastScoredClue(
  state: ScoreChangesInput,
): { round: number; i: number; j: number } | null {
  if (state.activeClue) {
    const [i, j] = state.activeClue;
    const cell = state.isAnswered.at(state.round)?.at(i)?.at(j);
    if (cell && cell.answeredBy.size > 0) {
      return { round: state.round, i, j };
    }
  }

  let best: { round: number; i: number; j: number } | null = null;
  let bestOrder = 0;
  state.isAnswered.forEach((rows, round) =>
    rows.forEach((row, i) =>
      row.forEach((cell, j) => {
        if (cell.isAnswered && cell.answerOrder > bestOrder) {
          bestOrder = cell.answerOrder;
          best = { round, i, j };
        }
      }),
    ),
  );
  return best;
}

/** getScoreChanges is each player's score change on the previous question
 * (see getLastScoredClue): +value for a right answer, −value for a wrong one
 * (the wager on wagerable questions, the secret value on secret ones). The
 * score before that question is `score - change`. Check corrections and
 * guest→account transfers update the underlying checks, so they are
 * reflected too. */
export function getScoreChanges(state: ScoreChangesInput): ScoreChanges {
  const last = getLastScoredClue(state);
  if (!last) return NO_SCORE_CHANGES;
  const { round, i, j } = last;
  const cell = state.isAnswered[round][i][j];
  const changes = new Map<string, number>();
  for (const [userId, correct] of cell.answeredBy) {
    let value: number;
    try {
      value = getClueValueForRound(state, round, [i, j], userId);
    } catch {
      continue;
    }
    changes.set(
      userId,
      (changes.get(userId) ?? 0) + (correct ? value : -value),
    );
  }
  return changes;
}

/** rankByScore gives each item its standard competition rank ("1224"): the
 * highest score is 1st, ties share a rank and the next rank skips. Items are
 * returned highest first; ties keep their input order. */
export function rankByScore<T>(
  items: readonly T[],
  scoreOf: (item: T) => number,
): { item: T; rank: number }[] {
  const sorted = items
    .map((item, index) => ({ item, index, score: scoreOf(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  let rank = 0;
  let prevScore: number | undefined;
  return sorted.map(({ item, score }, n) => {
    if (score !== prevScore) {
      rank = n + 1;
      prevScore = score;
    }
    return { item, rank };
  });
}

export interface PlayerStanding {
  player: Player;
  rank: number;
  /** Score change on the previous question (0 when it didn't touch them). */
  change: number;
  hasBoardControl: boolean;
}

export interface TeamStandingRow {
  team: TeamId;
  /** Custom team name, if set. */
  name?: string;
  rank: number;
  /** Sum of current members' and leavers' scores (see engine/teams.ts). */
  score: number;
  /** Sum of the members' (and leavers') changes on the previous question. */
  change: number;
  members: Player[];
}

export interface Standings {
  /** Players in the game, ranked. Players who left are not listed (their
   * points still count for their team). */
  players: PlayerStanding[];
  /** Team totals, ranked, in team mode; null otherwise. */
  teams: TeamStandingRow[] | null;
}

export type StandingsInput = Pick<
  State,
  "players" | "leftPlayers" | "teamNames" | "boardControl"
> & { scoreChanges: ScoreChanges };

/** getStandings ranks the players (and teams, in team mode) for the live
 * standings panel. */
export function getStandings(input: StandingsInput): Standings {
  const { scoreChanges } = input;
  const changeOf = (p: Player) => scoreChanges.get(p.userId) ?? 0;

  const players = rankByScore(
    Array.from(input.players.values()),
    (p) => p.score,
  ).map(({ item, rank }) => ({
    player: item,
    rank,
    change: changeOf(item),
    hasBoardControl: item.userId === input.boardControl,
  }));

  if (!isTeamMode(input)) return { players, teams: null };

  const teams = rankByScore(getTeamStandings(input), (s) => s.score).map(
    ({ item, rank }) => ({
      team: item.team,
      ...(item.name ? { name: item.name } : {}),
      rank,
      score: item.score,
      change: [...item.members, ...item.leftMembers].reduce(
        (sum, p) => sum + changeOf(p),
        0,
      ),
      members: item.members,
    }),
  );
  return { players, teams };
}

/** scoreChangesKey identifies a set of score changes, to notice when a new
 * question changed scores (e.g. to flash the changes on the TV). Empty for
 * no changes. */
export function scoreChangesKey(
  state: ScoreChangesInput,
  changes: ScoreChanges,
): string {
  const last = getLastScoredClue(state);
  if (!last || changes.size === 0) return "";
  const parts = Array.from(changes, ([id, c]) => `${id}:${c}`).sort();
  return `${last.round},${last.i},${last.j}|${parts.join(",")}`;
}
