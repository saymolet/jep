import clsx from "clsx";
import * as React from "react";
import { useFetcher } from "react-router";

import type { RoomProps } from "~/components/game";
import type { Action, Player } from "~/engine";
import { useEngineContext } from "~/engine";
import { getSecretTopic } from "~/engine/state";
import { formatDollars, getPlayerColor } from "~/utils";
import useSoloAction from "~/utils/use-solo-action";
import useGameSound from "~/utils/use-sound";
import useTimeout from "~/utils/use-timeout";

import ShinyText from "./shiny-text";

const SECRET_SFX = "/sounds/wager.mp3";
const PASS_RETRY_MS = 5000;

/** SecretClueBanner is the "cat in the bag" title shown when a secret
 * question comes up. */
export function SecretClueBanner({
  topic,
  value,
}: {
  topic: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 text-center">
      <span className="text-7xl sm:text-8xl" aria-hidden>
        🐱
      </span>
      <div className="relative text-4xl sm:text-6xl">
        <ShinyText text="Cat in the bag!" />
      </div>
      <p className="text-sm text-slate-300">Кот в мешке · secret question</p>
      <p className="font-korinna text-2xl font-bold text-white uppercase text-shadow-md sm:text-4xl">
        {topic}
      </p>
      <p className="text-xl font-bold text-yellow-300 sm:text-2xl">
        {formatDollars(value)}
      </p>
    </div>
  );
}

/** PassCluePicker lets the chooser give the secret question to another
 * player: one big button per player. Everyone else waits. */
export function PassCluePicker({
  canPass,
  chooserName,
  players,
  passingTo,
  onPass,
}: {
  /** Whether this user is the chooser. */
  canPass: boolean;
  chooserName: string;
  /** The players the question can go to (everyone but the chooser). */
  players: Player[];
  /** The player the chooser already tapped, while the pass is sent. */
  passingTo?: string;
  onPass: (userId: string) => void;
}) {
  if (!canPass) {
    return (
      <p className="p-4 text-center font-bold text-white">
        {chooserName} is choosing who gets the secret question...
      </p>
    );
  }

  const passingToName = players.find((p) => p.userId === passingTo)?.name;

  return (
    <div className="mx-auto flex w-full max-w-screen-md flex-col gap-3 px-4 pb-4">
      <p className="text-center font-bold text-white">
        {passingToName
          ? `Giving it to ${passingToName}...`
          : "Give this question to another player:"}
      </p>
      <ul
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        aria-label="Players"
      >
        {players.map((player) => (
          <li key={player.userId}>
            <button
              type="button"
              disabled={passingTo !== undefined}
              onClick={() => onPass(player.userId)}
              className={clsx(
                "flex min-h-14 w-full items-center gap-3 rounded-lg bg-white px-4 py-3 text-left text-lg font-bold text-slate-900 shadow-md transition-colors",
                "hover:bg-yellow-100 focus-visible:ring-4 focus-visible:ring-yellow-300 focus-visible:outline-none",
                "disabled:cursor-not-allowed disabled:opacity-60",
                { "ring-4 ring-yellow-300": passingTo === player.userId },
              )}
            >
              <span
                className="h-6 w-6 shrink-0 rounded-full"
                style={{ backgroundColor: getPlayerColor(player) }}
                aria-hidden
              />
              <span className="min-w-0 grow truncate">{player.name}</span>
              <span className="shrink-0 text-sm font-normal text-slate-500">
                {formatDollars(player.score)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** ConnectedPassCluePrompt handles GameState.PassClue: everyone sees the
 * secret question's topic and value, and the chooser (board control) gives
 * it to another player. */
export function ConnectedPassCluePrompt({ roomId, userId }: RoomProps) {
  const {
    activeClue,
    board,
    boardControl,
    getClueValue,
    players,
    soloDispatch,
  } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const submit = fetcher.submit;
  const [passingTo, setPassingTo] = React.useState<string | undefined>();

  const [playSecretSfx] = useGameSound(SECRET_SFX);
  React.useEffect(() => {
    playSecretSfx();
  }, [playSecretSfx]);

  // If the pass hasn't arrived a while after the request finished (e.g. it
  // failed), let the chooser tap again. A successful pass closes this prompt.
  useTimeout(
    () => setPassingTo(undefined),
    passingTo !== undefined && fetcher.state === "idle" ? PASS_RETRY_MS : null,
  );

  if (!activeClue || !board) return null;

  const chooserName = boardControl
    ? (players.get(boardControl)?.name ?? "The chooser")
    : "The chooser";
  const receivers = Array.from(players.values()).filter(
    (p) => p.userId !== boardControl,
  );

  function handlePass(toUserId: string) {
    if (passingTo !== undefined || !activeClue) return;
    setPassingTo(toUserId);
    const [i, j] = activeClue;
    submit(
      { i: i.toString(), j: j.toString(), userId, toUserId },
      { method: "post", action: `/room/${roomId}/pass-clue` },
    );
  }

  return (
    <div className="flex grow flex-col items-center justify-center gap-2 overflow-y-auto">
      <SecretClueBanner
        topic={getSecretTopic(board, activeClue)}
        value={getClueValue(activeClue, userId)}
      />
      <PassCluePicker
        canPass={boardControl === userId}
        chooserName={chooserName}
        players={receivers}
        passingTo={passingTo}
        onPass={handlePass}
      />
    </div>
  );
}
