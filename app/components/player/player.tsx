import clsx from "clsx";
import * as React from "react";

import { Dollars } from "~/components/dollars";
import Popover from "~/components/popover";
import { ScoreChange } from "~/components/standings/standings";
import { getTeamName, TeamHeader } from "~/components/team/team";
import { UndoArmingContext, UndoCheckConfirm } from "~/components/undo-check";
import type { Player } from "~/engine";
import { GameState, isGameUnderway, useEngineContext } from "~/engine";
import { getTeamStandings, isTeamMode } from "~/engine/teams";
import { useTranslation } from "~/i18n";
import { TEAM_COLORS } from "~/models/team";

import { RoomProps } from "../game";
import { EditPlayerForm } from "./edit-player";
import { KickablePlayerIcon } from "./kick-player";
import { PlayerIcon } from "./player-icon";

export { PlayerIcon };

/** ScorePulse marks a score that just changed due to a check correction. */
export type ScorePulse = "up" | "down";

/** PlayerScoreBox is a player's tile: their avatar as a large square, with
 * their name (children) and score next to it. */
export function PlayerScoreBox({
  player,
  hasBoardControl,
  children,
  winning,
  icon,
  scorePopover,
  scorePopoverKey,
  scorePopoverAutoOpen,
  pulse,
  scoreChange,
}: {
  player: Player;
  hasBoardControl: boolean;
  children: React.ReactNode;
  winning: boolean;
  icon?: React.ReactNode;
  /** When set, the score becomes a popover trigger (used to undo a check on
   * the latest clue). */
  scorePopover?: React.ReactNode;
  /** Changes when the correction is applied, closing the popover. */
  scorePopoverKey?: boolean;
  /** Open the popover without a tap — used when an armed undo confirmation
   * from the reveal screen follows the player to the board. */
  scorePopoverAutoOpen?: boolean;
  pulse?: ScorePulse;
  /** A score change to show next to the score (the TV, after a question). */
  scoreChange?: number;
}) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const { setArmed } = React.useContext(UndoArmingContext);
  const onPopoverOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    // Closing the popover abandons any armed-but-uncommitted correction
    // (which, at game over, releases the held summary navigation).
    if (!open) {
      setArmed(false);
    }
  };
  React.useEffect(() => {
    setPopoverOpen(false);
  }, [scorePopoverKey]);
  React.useEffect(() => {
    if (scorePopoverAutoOpen) {
      setPopoverOpen(true);
    }
  }, [scorePopoverAutoOpen]);

  const score = (
    <Dollars
      amount={player.score}
      variant={scorePopover ? "interactiveScore" : "score"}
    />
  );
  return (
    <div
      className={clsx(
        "flex min-w-0 items-center gap-2 rounded-2xl p-2 sm:gap-3 sm:p-3",
        {
          "bg-white/5": !hasBoardControl,
          "bg-blue-700": hasBoardControl,
          "animate-score-pulse-green": pulse === "up",
          "animate-score-pulse-red": pulse === "down",
          // Team mode: a stripe in the team's color.
          "border-l-4": player.team,
        },
      )}
      style={
        player.team ? { borderColor: TEAM_COLORS[player.team] } : undefined
      }
      data-team={player.team}
    >
      {icon ?? <PlayerIcon player={player} size="tile" />}
      <div className="flex min-w-0 grow flex-col justify-center gap-1">
        {children}
        <div className="flex flex-wrap items-center gap-x-2 text-lg sm:text-xl">
          {scorePopover ? (
            <Popover
              content={scorePopover}
              open={popoverOpen}
              onOpenChange={onPopoverOpenChange}
            >
              <button
                type="button"
                className="cursor-pointer focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {score}
              </button>
            </Popover>
          ) : (
            score
          )}
          {winning && <span>👑</span>}
          {scoreChange !== undefined ? (
            <ScoreChange amount={scoreChange} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** PlayerScore is a presentational component showing the player's icon, name,
 * and score.
 */
export function PlayerScore({
  player,
  hasBoardControl,
  winning,
  icon,
  scorePopover,
  scorePopoverKey,
  scorePopoverAutoOpen,
  pulse,
  scoreChange,
}: {
  player: Player;
  hasBoardControl: boolean;
  winning: boolean;
  icon?: React.ReactNode;
  scorePopover?: React.ReactNode;
  scorePopoverKey?: boolean;
  scorePopoverAutoOpen?: boolean;
  pulse?: ScorePulse;
  scoreChange?: number;
}) {
  return (
    <PlayerScoreBox
      scoreChange={scoreChange}
      hasBoardControl={hasBoardControl}
      player={player}
      winning={winning}
      icon={icon}
      scorePopover={scorePopover}
      scorePopoverKey={scorePopoverKey}
      scorePopoverAutoOpen={scorePopoverAutoOpen}
      pulse={pulse}
    >
      <p className="truncate font-handwriting text-xl font-bold text-slate-300 sm:text-2xl">
        {player.name}
      </p>
    </PlayerScoreBox>
  );
}

/** PLAYER_TILE_GRID lays out player tiles: two per row on phones and
 * tablets, three on wide screens. */
export const PLAYER_TILE_GRID = "grid grid-cols-2 gap-2 lg:grid-cols-3";

function getMaxScore(others: Player[], you?: Player) {
  const bestOther = others.at(0);
  if (bestOther && you) {
    return Math.max(bestOther.score, you.score);
  } else if (bestOther) {
    return bestOther.score;
  } else if (you) {
    return you.score;
  }
  return 0;
}

/** useCorrectionPulses watches the check-correction record and reports which
 * players' scores just changed because a check was corrected (as opposed to
 * ordinary scoring). Corrections flip the value of an existing check; new
 * checks on the same clue add entries instead.
 */
function useCorrectionPulses() {
  const { players, checkCorrection } = useEngineContext();
  const [pulses, setPulses] = React.useState<Map<string, ScorePulse>>(
    new Map(),
  );
  const prevRef = React.useRef<{
    scores: Map<string, number>;
    checksKey: string;
    checks: Map<string, boolean>;
  } | null>(null);

  const checksKey = checkCorrection
    ? `${checkCorrection.round},${checkCorrection.i},${checkCorrection.j}`
    : "";

  React.useEffect(() => {
    const scores = new Map(
      Array.from(players.values(), (p) => [p.userId, p.score]),
    );
    const checks = checkCorrection
      ? new Map(checkCorrection.checks)
      : new Map<string, boolean>();
    const prev = prevRef.current;
    prevRef.current = { scores, checksKey, checks };

    if (!prev || !checkCorrection || prev.checksKey !== checksKey) {
      return;
    }
    const flipped =
      checks.size === prev.checks.size &&
      Array.from(checks).some(
        ([uid, correct]) =>
          prev.checks.has(uid) && prev.checks.get(uid) !== correct,
      );
    if (!flipped) {
      return;
    }

    const changed = new Map<string, ScorePulse>();
    for (const [uid, score] of scores) {
      const prevScore = prev.scores.get(uid);
      if (prevScore !== undefined && prevScore !== score) {
        changed.set(uid, score > prevScore ? "up" : "down");
      }
    }
    if (changed.size) {
      setPulses(changed);
    }
  }, [players, checkCorrection, checksKey]);

  // Remove the pulse classes once the animation has played so a later
  // correction can re-trigger them.
  React.useEffect(() => {
    if (!pulses.size) {
      return;
    }
    const timeout = setTimeout(() => setPulses(new Map()), 1700);
    return () => clearTimeout(timeout);
  }, [pulses]);

  return pulses;
}

/** PlayerScores is a connected component that:
 * - Lets the current player edit their name
 * - Shows each player's name and score
 * - Lets the current player undo their check on the latest clue by tapping
 *   their score
 */
export function PlayerScores({
  roomId,
  userId,
  isAdmin = false,
}: RoomProps & {
  /** The site admin (admin session): may kick players during the game. */
  isAdmin?: boolean;
}) {
  const {
    players,
    leftPlayers,
    teamNames,
    boardControl,
    type,
    round,
    numAnswered,
    getCheckCorrection,
  } = useEngineContext();
  const { t } = useTranslation();

  const yourPlayer = players.get(userId);

  const pulses = useCorrectionPulses();

  // If the player armed the undo confirmation on the reveal screen and
  // another player advanced before they committed, re-open the confirmation
  // here so it isn't yanked away mid-decision. This includes game over: the
  // correction record survives it, and staying armed holds this client's
  // navigation to the summary until the popover closes or commits.
  const { armed: undoArmed, setArmed: setUndoArmed } =
    React.useContext(UndoArmingContext);
  const pickUpArmedUndo =
    undoArmed && (type === GameState.ShowBoard || type === GameState.GameOver);
  React.useEffect(() => {
    if (undoArmed && type === GameState.ShowBoard) {
      setUndoArmed(false);
    }
  }, [undoArmed, type, setUndoArmed]);

  // sort all other players from highest to lowest score
  const sortedOtherPlayers = Array.from(players.values())
    .filter((p) => p.userId !== userId)
    .sort((a, b) => b.score - a.score);

  const maxScore = getMaxScore(sortedOtherPlayers, yourPlayer);

  const editable =
    type !== GameState.GameOver &&
    (type !== GameState.PreviewRound || round !== 0);

  const onBoard =
    type === GameState.ShowBoard || type === GameState.PreviewRound;

  // Kick others: players only before the game is underway (seats are
  // locked once the first question was opened); the site admin any time
  // the board or round preview shows, playing or not. Solo play has no
  // admin rule (roomId -1, nobody else to protect the seat from).
  const canKick =
    onBoard &&
    players.size > 1 &&
    (isAdmin ||
      (yourPlayer !== undefined &&
        !isGameUnderway({ type, round, numAnswered })));

  // Leave self: any time the board or round preview is showing
  const canLeave = onBoard && players.size > 1;

  const kickIcon = (player: Player, isSelf: boolean) =>
    (isSelf ? canLeave : canKick) ? (
      <KickablePlayerIcon player={player} roomId={roomId} isSelf={isSelf} />
    ) : undefined;

  // Your score is tappable while your check on the latest clue can still be
  // corrected.
  const correction = getCheckCorrection(userId);
  const scorePopover = correction ? (
    <UndoCheckConfirm
      roomId={roomId}
      userId={userId}
      prompt={t("room.undoLastCheck")}
      commitType="secondary"
    />
  ) : undefined;

  const yourTile = yourPlayer ? (
    // Your own tile has the name input and buttons, so it gets a wider slot.
    <div key={yourPlayer.userId} className="col-span-2 min-w-0">
      {editable ? (
        <EditPlayerForm
          roomId={roomId}
          userId={userId}
          winning={yourPlayer.score === maxScore}
          icon={kickIcon(yourPlayer, true)}
          scorePopover={scorePopover}
          scorePopoverKey={correction?.correct}
          scorePopoverAutoOpen={pickUpArmedUndo}
          pulse={pulses.get(yourPlayer.userId)}
        />
      ) : (
        <PlayerScore
          player={yourPlayer}
          hasBoardControl={yourPlayer.userId === boardControl}
          winning={yourPlayer.score === maxScore}
          icon={kickIcon(yourPlayer, true)}
          scorePopover={scorePopover}
          scorePopoverKey={correction?.correct}
          scorePopoverAutoOpen={pickUpArmedUndo}
          pulse={pulses.get(yourPlayer.userId)}
        />
      )}
    </div>
  ) : null;
  const otherTile = (p: Player) => (
    <PlayerScore
      key={p.userId}
      player={p}
      hasBoardControl={p.userId === boardControl}
      winning={p.score === maxScore}
      icon={kickIcon(p, false)}
      pulse={pulses.get(p.userId)}
    />
  );

  if (!isTeamMode({ players, leftPlayers })) {
    return (
      <div className={PLAYER_TILE_GRID}>
        {yourTile}
        {sortedOtherPlayers.map(otherTile)}
      </div>
    );
  }

  // Team mode: tiles grouped under their team, teams with the highest total
  // first, then the players without a team. Your tile leads its group.
  const tilesFor = (members: Player[]) => (
    <div className={PLAYER_TILE_GRID}>
      {members.some((p) => p.userId === userId) ? yourTile : null}
      {members.filter((p) => p.userId !== userId).map(otherTile)}
    </div>
  );
  const soloPlayers = Array.from(players.values())
    .filter((p) => !p.team)
    .sort((a, b) => b.score - a.score);
  return (
    <div className="flex flex-col gap-4" data-testid="team-scores">
      {getTeamStandings({ players, leftPlayers, teamNames }).map((s) => (
        <section
          key={s.team}
          className="flex flex-col gap-2"
          data-testid={`team-${s.team}`}
        >
          <TeamHeader
            team={s.team}
            name={getTeamName(t, s.team, s.name)}
            score={s.score}
            leftCount={s.leftMembers.length}
          />
          {s.members.length > 0 ? tilesFor(s.members) : null}
        </section>
      ))}
      {soloPlayers.length > 0 ? (
        <section className="flex flex-col gap-2" data-testid="team-none">
          <TeamHeader name={t("team.noTeam")} />
          {tilesFor(soloPlayers)}
        </section>
      ) : null}
    </div>
  );
}
