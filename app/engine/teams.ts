import { TEAM_IDS, type TeamId } from "~/models/team";

import type { Player, State } from "./state";

/** TeamStanding is one team's total and members. */
export interface TeamStanding {
  team: TeamId;
  /** The custom name set by a member, if any (else show the default name). */
  name?: string;
  /** Sum of the scores of its current members and of players who left the
   * game while on this team. */
  score: number;
  /** Current members, highest score first. */
  members: Player[];
  /** Players who left the game while on this team. */
  leftMembers: Player[];
}

export type TeamsInput = Pick<State, "players" | "leftPlayers"> & {
  teamNames?: State["teamNames"];
};

/** isTeamMode is true as soon as anyone in the room has a team. */
export function isTeamMode({ players, leftPlayers }: TeamsInput) {
  for (const p of players.values()) if (p.team) return true;
  for (const p of leftPlayers.values()) if (p.team) return true;
  return false;
}

/** getTeamStandings lists the teams that have (or had) members, highest
 * total first; ties keep the fixed team order (red, blue, green, yellow).
 *
 * Points stay with the player: a player who switches teams takes their score
 * along. A player who leaves the game keeps counting for the team they were
 * on when they left, so leaving can't erase (or dump) a team's points. */
export function getTeamStandings(input: TeamsInput): TeamStanding[] {
  const standings = new Map<TeamId, TeamStanding>();
  const standingFor = (team: TeamId) => {
    let standing = standings.get(team);
    if (!standing) {
      const name = input.teamNames?.get(team);
      standing = {
        team,
        ...(name ? { name } : {}),
        score: 0,
        members: [],
        leftMembers: [],
      };
      standings.set(team, standing);
    }
    return standing;
  };

  for (const p of input.players.values()) {
    if (!p.team) continue;
    const standing = standingFor(p.team);
    standing.members.push(p);
    standing.score += p.score;
  }
  for (const p of input.leftPlayers.values()) {
    if (!p.team) continue;
    const standing = standingFor(p.team);
    standing.leftMembers.push(p);
    standing.score += p.score;
  }

  for (const standing of standings.values()) {
    standing.members.sort((a, b) => b.score - a.score);
  }
  return TEAM_IDS.flatMap((team) => standings.get(team) ?? []).sort(
    (a, b) => b.score - a.score,
  );
}

/** getWinningTeams are the teams with the highest total (several on a tie). */
export function getWinningTeams(standings: TeamStanding[]): TeamStanding[] {
  if (standings.length === 0) return [];
  const best = Math.max(...standings.map((s) => s.score));
  return standings.filter((s) => s.score === best);
}

/** countTeamMembers counts a team's current members. */
export function countTeamMembers(
  players: Map<string, Player>,
  team: TeamId,
): number {
  let n = 0;
  for (const p of players.values()) if (p.team === team) n++;
  return n;
}
