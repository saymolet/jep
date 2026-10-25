import { Dollars } from "~/components/dollars";
import {
  getTeamStandings,
  getWinningTeams,
  isTeamMode,
  type TeamsInput,
} from "~/engine/teams";
import { useTranslation } from "~/i18n";
import { TEAM_COLORS } from "~/models/team";

import { getTeamName, TeamSwatch } from "./team";

/** TeamStandings is the game summary's team result: the winning team (or the
 * tied teams) and every team's total with its players. Renders nothing when
 * no one played in a team. */
export function TeamStandings({ state }: { state: TeamsInput }) {
  const { t, intlLocale } = useTranslation();
  if (!isTeamMode(state)) return null;
  const standings = getTeamStandings(state);
  const winners = getWinningTeams(standings);
  const nameOf = (s: (typeof standings)[number]) =>
    getTeamName(t, s.team, s.name);
  const list = new Intl.ListFormat(intlLocale, { type: "conjunction" });

  return (
    <section className="flex flex-col gap-3" data-testid="team-standings">
      <p
        className="flex flex-wrap items-center gap-2 text-2xl font-bold text-yellow-300"
        data-testid="winning-team"
      >
        <span aria-hidden>🏆</span>
        {winners.length === 1
          ? t("team.winner", { name: nameOf(winners[0]) })
          : t("team.tie", { names: list.format(winners.map(nameOf)) })}
      </p>
      <h3 className="text-lg">{t("team.standings")}</h3>
      <ol className="flex flex-col gap-2">
        {standings.map((s, i) => (
          <li
            key={s.team}
            className="flex min-w-0 flex-col gap-1 rounded-2xl border-l-8 bg-white/5 px-3 py-2"
            style={{ borderColor: TEAM_COLORS[s.team] }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 text-slate-400">{i + 1}.</span>
              <TeamSwatch team={s.team} />
              <span className="min-w-0 grow truncate text-xl font-bold">
                {nameOf(s)}
              </span>
              <span className="shrink-0 text-xl">
                <Dollars amount={s.score} />
              </span>
            </div>
            <p className="text-sm text-slate-300">
              {list.format([
                ...s.members.map((p) => p.name),
                ...s.leftMembers.map((p) => `${p.name} ${t("summary.left")}`),
              ])}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
