import * as Tabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import * as React from "react";

import { Category } from "~/components/board/category";
import {
  BoardScroller,
  ClueValue,
  getCellPaddingClassName,
  useIsWideBoard,
} from "~/components/board/layout";
import Button from "~/components/button";
import CluePopoverContent from "~/components/clue-popover-content";
import Popover from "~/components/popover";
import type { Action } from "~/engine";
import { clueIsPlayable, State } from "~/engine";
import type { Player } from "~/engine/state";
import { useTranslation } from "~/i18n";
import type { Board, Clue, Game } from "~/models/convert.server";
import { generateGrid, getPlayerColor } from "~/utils";

import ReplayPlayer from "./replay-player";

interface Props {
  clue: Clue;
  state: State;
  round: number;
  i: number;
  j: number;
}

function PostGameClue({ clue, state, round, i, j }: Props) {
  const { t } = useTranslation();
  const wide = useIsWideBoard();
  const clueAnswer = state.isAnswered[round][i][j];
  const clueValue =
    clue.wagerable && clueAnswer.isAnswered
      ? clue.longForm
        ? t("summary.final")
        : t("summary.doubleDownShort")
      : clue.value;

  if (!clueAnswer.isAnswered) {
    return (
      <td className="h-full sm:p-1">
        <div
          className={`h-full w-full bg-slate-800 ${getCellPaddingClassName(wide)}`}
        >
          <p
            className={`flex items-center justify-center font-inter font-bold text-white opacity-75 transition-opacity text-shadow-md group-hover:opacity-100 sm:text-shadow-lg`}
          >
            <ClueValue
              value={clueValue}
              showDollar={!(clue.wagerable && clueAnswer.isAnswered)}
            />
          </p>
        </div>
      </td>
    );
  }

  const playable = clueIsPlayable(clue);

  const winningPlayers = Array.from(clueAnswer.answeredBy.entries()).filter(
    ([, correct]) => correct,
  );

  const winnerUserId = winningPlayers.length ? winningPlayers[0][0] : undefined;
  const winnerPlayer = winnerUserId
    ? (state.players.get(winnerUserId) ?? state.leftPlayers.get(winnerUserId))
    : undefined;
  const backgroundColor = winnerPlayer
    ? getPlayerColor(winnerPlayer)
    : undefined;

  return (
    <td className="h-full sm:p-1">
      <Popover
        content={
          <CluePopoverContent
            clue={clue}
            state={state}
            round={round}
            i={i}
            j={j}
          />
        }
      >
        <button
          disabled={!playable}
          className={clsx(
            "group h-full w-full bg-blue-1000 transition-colors hover:bg-blue-700",
            getCellPaddingClassName(wide),
            {
              "bg-slate-800": !playable,
            },
          )}
          style={{ backgroundColor }}
        >
          <p
            className={`flex items-center justify-center font-inter font-bold text-white opacity-75 transition-opacity text-shadow-md group-hover:opacity-100 sm:text-shadow-lg`}
          >
            <ClueValue value={clueValue} showDollar={!clue.wagerable} />
          </p>
        </button>
      </Popover>
    </td>
  );
}

function PostGameBoard({
  board,
  state,
  round,
}: {
  board: Board;
  state: State;
  round: number;
}) {
  // Transpose the clues so we can render them in a table.
  const numRows = Math.max(...board.categories.map((c) => c.clues.length));
  const numCols = board.categories.length;

  const rows = generateGrid<Clue | undefined>(numRows, numCols, undefined);

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const clue = board.categories.at(j)?.clues.at(i);
      if (clue) {
        rows[i][j] = clue;
      }
    }
  }

  const roundRevealed = state.round >= round;

  return (
    <BoardScroller columns={numCols}>
      <table className="h-1 w-full table-fixed border-spacing-3 text-white">
        <thead>
          <tr className="h-1">
            {board.categories.map((category) => (
              <Category
                key={category.name}
                name={roundRevealed ? category.name : "?"}
                note={category.note}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((category, i) => (
            <tr key={i}>
              {category.map((clue, j) =>
                clue ? (
                  <PostGameClue
                    round={round}
                    i={i}
                    j={j}
                    key={`clue-${i}-${j}`}
                    clue={clue}
                    state={state}
                  />
                ) : (
                  <td key={`clue-${i}-${j}`} />
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </BoardScroller>
  );
}

function RoundButtons({
  round,
  setRound,
  numRounds,
}: {
  round: number;
  setRound: (round: number) => void;
  numRounds: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        onClick={() => setRound((numRounds + round - 1) % numRounds)}
        variant="inverse"
      >
        &larr;
      </Button>
      <p className="text-white">
        {t("summary.roundOf", { round: round + 1, total: numRounds })}
      </p>
      <Button
        onClick={() => setRound((round + 1) % numRounds)}
        variant="inverse"
      >
        &rarr;
      </Button>
    </div>
  );
}

export default function Summary({
  game,
  state,
  actions,
  allPlayers,
}: {
  game: Game;
  state: State;
  actions: Action[];
  allPlayers: Player[];
}) {
  const { t } = useTranslation();
  const [round, setRound] = React.useState(0);
  const board = game.boards[round];

  return (
    <Tabs.Root defaultValue="replay">
      <Tabs.List className="flex items-center justify-center gap-1 py-2">
        <Tabs.Trigger
          value="replay"
          className="rounded px-3 py-1 text-sm text-slate-400 transition-colors hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
        >
          {t("summary.replay")}
        </Tabs.Trigger>
        <Tabs.Trigger
          value="summary"
          className="rounded px-3 py-1 text-sm text-slate-400 transition-colors hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white"
        >
          {t("summary.summary")}
        </Tabs.Trigger>
      </Tabs.List>

      <Tabs.Content value="replay">
        <ReplayPlayer game={game} actions={actions} allPlayers={allPlayers} />
      </Tabs.Content>
      <Tabs.Content value="summary">
        {game.boards.length > 1 ? (
          <RoundButtons
            round={round}
            setRound={setRound}
            numRounds={game.boards.length}
          />
        ) : null}
        <PostGameBoard board={board} state={state} round={round} />
      </Tabs.Content>
    </Tabs.Root>
  );
}
