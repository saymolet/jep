/** Team mode: players can optionally join one of four fixed teams. A team is
 * identified by its color; its name defaults to a translated "Red team" etc.
 * and any member can rename it. Scoring stays per player: a team's score is
 * the sum of its members' scores (see engine/teams.ts). */

export const TEAM_IDS = ["red", "blue", "green", "yellow"] as const;

export type TeamId = (typeof TEAM_IDS)[number];

/** Each team's color (Tailwind red-500, blue-500, green-500, yellow-400). */
export const TEAM_COLORS: Record<TeamId, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#facc15",
};

/** Longest custom team name, in characters (code points). */
export const MAX_TEAM_NAME_LENGTH = 24;

export function isTeamId(value: unknown): value is TeamId {
  return TEAM_IDS.some((team) => team === value);
}

/** normalizeTeamName trims and collapses whitespace. Returns "" for a blank
 * name (which resets the team to its default name) and undefined for a name
 * that is too long or not a string. */
export function normalizeTeamName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value.replace(/\s+/g, " ").trim();
  if ([...name].length > MAX_TEAM_NAME_LENGTH) return undefined;
  return name;
}
