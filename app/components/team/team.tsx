import clsx from "clsx";
import * as React from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Dialog from "~/components/dialog";
import { Dollars } from "~/components/dollars";
import { Check } from "~/components/icons";
import type { Action, Player } from "~/engine";
import { GameState, useEngineContext } from "~/engine";
import { countTeamMembers } from "~/engine/teams";
import { type TFunction, useTranslation } from "~/i18n";
import {
  MAX_TEAM_NAME_LENGTH,
  TEAM_COLORS,
  TEAM_IDS,
  type TeamId,
} from "~/models/team";
import useSoloAction from "~/utils/use-solo-action";

/** getTeamName is a team's custom name, or else its translated default name
 * ("Red team" / "Червоні"). */
export function getTeamName(t: TFunction, team: TeamId, customName?: string) {
  return customName || t(`team.name.${team}`);
}

/** TeamSwatch is a team's color as a small square (dashed for "no team"). */
export function TeamSwatch({
  team,
  className = "h-4 w-4",
}: {
  team?: TeamId;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={clsx(
        "inline-block shrink-0 rounded-md",
        team ? null : "border-2 border-dashed border-slate-400",
        className,
      )}
      style={team ? { backgroundColor: TEAM_COLORS[team] } : undefined}
    />
  );
}

/** TeamPicker shows the four teams (and "No team") as big tappable chips with
 * each team's name and how many players are on it. */
export function TeamPicker({
  value,
  onChange,
  players,
  teamNames,
  disabled = false,
}: {
  value: TeamId | null;
  onChange: (team: TeamId | null) => void;
  players: Map<string, Player>;
  teamNames: Map<TeamId, string>;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const options: (TeamId | null)[] = [...TEAM_IDS, null];
  return (
    <div
      role="radiogroup"
      aria-label={t("team.team")}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {options.map((team) => {
        const selected = value === team;
        const name = team
          ? getTeamName(t, team, teamNames.get(team))
          : t("team.noTeam");
        const count = team ? countTeamMembers(players, team) : 0;
        return (
          <button
            key={team ?? "none"}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(team)}
            className={clsx(
              "flex min-h-14 min-w-0 items-center gap-2 rounded-xl border-2 px-3 py-2 text-left text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "bg-white/15"
                : "border-white/10 bg-white/5 hover:bg-white/10",
            )}
            style={
              selected
                ? { borderColor: team ? TEAM_COLORS[team] : "#94a3b8" }
                : undefined
            }
          >
            <TeamSwatch team={team ?? undefined} className="h-8 w-8" />
            <span className="flex min-w-0 grow flex-col">
              <span className="line-clamp-2 font-bold break-words">{name}</span>
              {team && count > 0 ? (
                <span className="text-xs text-slate-300">
                  {t("common.playerCount", { count })}
                </span>
              ) : null}
            </span>
            {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** TeamButton is the team pill on your own tile: it opens the team dialog. */
export function TeamButton({
  team,
  name,
  onClick,
}: {
  team?: TeamId;
  name: string;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${t("team.changeTeam")}: ${name}`}
      className="flex max-w-full min-w-0 items-center gap-2 self-start rounded-lg bg-white/10 px-2 py-1 text-sm text-slate-200 hover:bg-white/15"
      data-testid="team-button"
    >
      <TeamSwatch team={team} />
      <span className="truncate">{name}</span>
    </button>
  );
}

/** TeamHeader heads a team's group of tiles: color, name and total. */
export function TeamHeader({
  team,
  name,
  score,
  leftCount = 0,
}: {
  team?: TeamId;
  name: string;
  /** Undefined for the "No team" group (no total). */
  score?: number;
  leftCount?: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-2 border-b-4 pb-1",
        team ? null : "border-white/10",
      )}
      style={team ? { borderColor: TEAM_COLORS[team] } : undefined}
    >
      <TeamSwatch team={team} className="h-5 w-5" />
      <h3 className="min-w-0 truncate text-lg font-bold text-white sm:text-xl">
        {name}
      </h3>
      {leftCount > 0 ? (
        <span className="shrink-0 text-xs text-slate-400">
          {t("team.leftCount", { count: leftCount })}
        </span>
      ) : null}
      {score !== undefined ? (
        <span className="ml-auto shrink-0 text-xl sm:text-2xl">
          <Dollars amount={score} />
        </span>
      ) : null}
    </div>
  );
}

/** TeamDialog lets a player change their own team and rename it. Teams are
 * changed between questions (the engine ignores changes while a question is
 * open); renaming works any time before game over. */
export function TeamDialog({
  roomId,
  userId,
  isOpen,
  onClose,
}: {
  roomId: number;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { players, teamNames, activeClue, type, soloDispatch } =
    useEngineContext();

  const teamFetcher = useFetcher<Action>();
  useSoloAction(teamFetcher, soloDispatch);
  const nameFetcher = useFetcher<Action>();
  useSoloAction(nameFetcher, soloDispatch);

  const player = players.get(userId);
  // Show the picked team right away, before the event comes back.
  const [pending, setPending] = React.useState<TeamId | null | undefined>();
  React.useEffect(() => setPending(undefined), [player?.team]);
  const team = pending !== undefined ? pending : (player?.team ?? null);

  const locked = activeClue !== null || type === GameState.GameOver;

  function pick(next: TeamId | null) {
    if (next === team) return;
    setPending(next);
    teamFetcher.submit(
      { userId, team: next ?? "" },
      { method: "POST", action: `/room/${roomId}/team` },
    );
  }

  const ownTeam = player?.team;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("team.chooseTeam")}
      description={t("team.chooseTeamDescription")}
    >
      <div className="flex flex-col gap-4">
        <TeamPicker
          value={team}
          onChange={pick}
          players={players}
          teamNames={teamNames}
          disabled={locked}
        />
        {activeClue !== null ? (
          <p className="text-sm text-slate-300">{t("team.betweenQuestions")}</p>
        ) : null}
        {ownTeam && type !== GameState.GameOver ? (
          <nameFetcher.Form
            // Reset the field when the team or its name changes.
            key={`${ownTeam}:${teamNames.get(ownTeam) ?? ""}`}
            method="POST"
            action={`/room/${roomId}/team-name`}
            className="flex flex-col gap-2"
          >
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="team" value={ownTeam} />
            <label
              htmlFor="team-name"
              className="flex items-center gap-2 text-sm text-slate-300"
            >
              <TeamSwatch team={ownTeam} />
              {t("team.teamName")}
            </label>
            <div className="flex gap-2">
              <input
                id="team-name"
                name="name"
                type="text"
                defaultValue={teamNames.get(ownTeam) ?? ""}
                placeholder={t(`team.name.${ownTeam}`)}
                maxLength={MAX_TEAM_NAME_LENGTH}
                autoComplete="off"
                className="block w-full min-w-0 flex-1 rounded-lg border border-ink-300 bg-ink-50 p-2 font-handwriting text-xl font-bold text-ink-900 placeholder:font-sans placeholder:text-sm placeholder:font-normal focus:border-blue-500 focus:ring-blue-500"
              />
              <div className="shrink-0">
                <Button type="submit">{t("team.saveName")}</Button>
              </div>
            </div>
          </nameFetcher.Form>
        ) : null}
      </div>
    </Dialog>
  );
}
