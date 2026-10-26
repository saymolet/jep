import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import * as React from "react";

import { Dollars } from "~/components/dollars";
import { XMark } from "~/components/icons";
import { PlayerIcon } from "~/components/player/player-icon";
import { getTeamName, TeamSwatch } from "~/components/team/team";
import { useEngineContext } from "~/engine";
import {
  getStandings,
  type PlayerStanding,
  type Standings,
  type TeamStandingRow,
} from "~/engine/standings";
import { useTranslation } from "~/i18n";
import type { TeamId } from "~/models/team";
import { TEAM_COLORS } from "~/models/team";
import { formatDollarsWithSign } from "~/utils";

/** formatChange is a signed amount with a real minus sign: "+$400", "−$200". */
export function formatChange(amount: number) {
  return formatDollarsWithSign(amount).replace(/^-/, "−");
}

/** ScoreChange is the score change on the previous question as a small chip:
 * green for a gain, red for a loss, a muted dash for none. Assumes a dark
 * (game) surface, which every theme keeps for the room. */
export function ScoreChange({
  amount,
  size = "md",
}: {
  amount: number;
  size?: "md" | "lg";
}) {
  const { t } = useTranslation();
  const label =
    amount === 0
      ? t("standings.noChange")
      : t("standings.change", { change: formatChange(amount) });
  return (
    <span
      className={clsx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-inter font-bold whitespace-nowrap tabular-nums",
        size === "lg" ? "px-3 py-1 text-xl lg:text-2xl" : "px-2 py-0.5 text-sm",
        amount > 0 && "bg-green-500/20 text-green-300",
        amount < 0 && "bg-red-500/20 text-red-300",
        amount === 0 && "text-slate-400",
      )}
      data-testid="score-change"
      data-change={amount}
    >
      <span aria-hidden>{amount === 0 ? "—" : formatChange(amount)}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function Rank({ rank, tied }: { rank: number; tied: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="w-8 shrink-0 text-center font-inter text-lg font-bold text-slate-300">
      <span aria-hidden>
        {tied ? "=" : null}
        {rank}
      </span>
      <span className="sr-only">
        {t("standings.rankLabel", { rank })}
        {tied ? `, ${t("standings.tied")}` : null}
      </span>
    </span>
  );
}

/** Ranks shared by more than one row. */
function tiedRanks(rows: { rank: number }[]) {
  const counts = new Map<number, number>();
  for (const { rank } of rows) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  return new Set([...counts].filter(([, n]) => n > 1).map(([rank]) => rank));
}

function TeamChip({ team, name }: { team: TeamId; name?: string }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex min-w-0 items-center gap-1 text-xs text-slate-300">
      <TeamSwatch team={team} className="h-3 w-3" />
      <span className="truncate">{getTeamName(t, team, name)}</span>
    </span>
  );
}

function TeamRows({ teams }: { teams: TeamStandingRow[] }) {
  const { t } = useTranslation();
  const tied = tiedRanks(teams);
  return (
    <section aria-labelledby="standings-teams" className="flex flex-col gap-2">
      <h3
        id="standings-teams"
        className="text-sm font-semibold tracking-wide text-slate-300 uppercase"
      >
        {t("standings.teams")}
      </h3>
      <ol className="flex flex-col gap-2" data-testid="standings-teams">
        {teams.map((s) => (
          <li
            key={s.team}
            className="flex min-w-0 items-center gap-2 rounded-xl border-l-8 bg-white/5 py-2 pr-3 pl-1"
            style={{ borderColor: TEAM_COLORS[s.team] }}
            data-testid={`standings-team-${s.team}`}
          >
            <Rank rank={s.rank} tied={tied.has(s.rank)} />
            <div className="flex min-w-0 grow flex-col">
              <span className="truncate text-lg font-bold">
                {getTeamName(t, s.team, s.name)}
              </span>
              {s.members.length > 0 ? (
                <span className="truncate text-xs text-slate-300">
                  {s.members.map((p) => p.name).join(", ")}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 text-lg">
              <Dollars amount={s.score} />
            </span>
            <ScoreChange amount={s.change} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayerRow({
  standing,
  tied,
  isYou,
  teamNames,
}: {
  standing: PlayerStanding;
  tied: boolean;
  isYou: boolean;
  teamNames: Map<TeamId, string>;
}) {
  const { t } = useTranslation();
  const { player, rank, change, hasBoardControl } = standing;
  return (
    <li
      className={clsx(
        "flex min-w-0 items-center gap-2 rounded-xl py-2 pr-3 pl-1",
        hasBoardControl ? "bg-blue-700" : "bg-white/5",
        isYou && "ring-2 ring-yellow-1000/70",
      )}
      data-testid="standings-player"
      data-user-id={player.userId}
    >
      <Rank rank={rank} tied={tied} />
      <PlayerIcon player={player} size="md" />
      <div className="flex min-w-0 grow flex-col">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-bold">{player.name}</span>
          {isYou ? (
            <span className="shrink-0 text-xs text-slate-300">
              ({t("standings.you")})
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2">
          {player.team ? (
            <TeamChip team={player.team} name={teamNames.get(player.team)} />
          ) : null}
          {hasBoardControl ? (
            <span
              className="text-xs font-semibold text-yellow-1000"
              data-testid="standings-board-control"
            >
              {t("standings.boardControl")}
            </span>
          ) : null}
        </span>
      </div>
      <span className="shrink-0 text-lg">
        <Dollars amount={player.score} />
      </span>
      <ScoreChange amount={change} />
    </li>
  );
}

/** StandingsList is the ranked list: team totals on top in team mode, then
 * every player with their score and its change on the previous question. */
export function StandingsList({
  standings,
  userId,
  teamNames,
}: {
  standings: Standings;
  userId: string;
  teamNames: Map<TeamId, string>;
}) {
  const { t } = useTranslation();
  const tied = tiedRanks(standings.players);
  return (
    <div className="flex flex-col gap-4">
      {standings.teams ? <TeamRows teams={standings.teams} /> : null}
      <section
        aria-labelledby="standings-players"
        className="flex flex-col gap-2"
      >
        <h3
          id="standings-players"
          className={clsx(
            "text-sm font-semibold tracking-wide text-slate-300 uppercase",
            !standings.teams && "sr-only",
          )}
        >
          {t("standings.players")}
        </h3>
        {standings.players.length === 0 ? (
          <p className="text-slate-300">{t("standings.noPlayers")}</p>
        ) : (
          <ol className="flex flex-col gap-2" data-testid="standings-players">
            {standings.players.map((s) => (
              <PlayerRow
                key={s.player.userId}
                standing={s}
                tied={tied.has(s.rank)}
                isYou={s.player.userId === userId}
                teamNames={teamNames}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Enter on a control in the panel must not reach the prompt's "Enter
 * buzzes" key listener on the window. */
function stopEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.stopPropagation();
}

/** StandingsButton is the 🏆 button in the room's control row. It opens the
 * live standings in a drawer (a bottom sheet on phones, a side panel on wider
 * screens) that closes with Esc, the close button or a tap on the backdrop.
 * Works for players and spectators alike: it only reads the engine state. */
export function StandingsButton({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const { players, leftPlayers, teamNames, boardControl, scoreChanges } =
    useEngineContext();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
          aria-label={t("standings.open")}
          title={t("standings.open")}
          onKeyDown={stopEnter}
          data-testid="standings-button"
        >
          <span className="text-base" aria-hidden>
            🏆
          </span>
          <span className="hidden sm:inline">{t("standings.open")}</span>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-overlay-show bg-black/60" />
        <DialogPrimitive.Content
          onKeyDown={stopEnter}
          className={clsx(
            "fixed z-50 flex animate-slide-up-and-fade flex-col bg-blue-1000 text-slate-100 shadow-2xl focus:outline-none",
            // Phones: a bottom sheet. Wider screens: a panel on the right.
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
            "sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-2xl",
          )}
          data-testid="standings-panel"
        >
          <div className="flex items-start justify-between gap-2 p-4 pb-2">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="flex items-center gap-2 text-2xl font-medium text-white">
                <span aria-hidden>🏆</span>
                {t("standings.title")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-300">
                {t("standings.description")}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                aria-label={t("common.close")}
              >
                <XMark className="h-6 w-6" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 overflow-y-auto p-4 pt-2">
            <StandingsList
              standings={getStandings({
                players,
                leftPlayers,
                teamNames,
                boardControl,
                scoreChanges,
              })}
              userId={userId}
              teamNames={teamNames}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
