import * as Collapsible from "@radix-ui/react-collapsible";
import * as React from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import { Dollars } from "~/components/dollars";
import type { RoomProps } from "~/components/game";
import Input from "~/components/input";
import Popover from "~/components/popover";
import type { Action, Player } from "~/engine";
import {
  CANT_BUZZ_FLAG,
  getHighestClueValue,
  getWagerRange,
  useEngineContext,
} from "~/engine";
import { useTranslation } from "~/i18n";
import { WagerHintsMode } from "~/models/user-settings";
import { formatDollars } from "~/utils";
import useSoloAction from "~/utils/use-solo-action";
import { useWagerHintsSettings } from "~/utils/user-settings";
import type {
  WagerReasonKey,
  WagerRecommendation,
} from "~/utils/wager-strategy";
import { getFinalClueStrategy } from "~/utils/wager-strategy";

import { type StepTimerState, useOnceWhenTimeUp } from "./step-timers";

const NO_TIMER: StepTimerState = {
  startedAt: null,
  durationSec: 0,
  status: null,
};

type PlayerAndCanWager = Player & { canWager: boolean; hasWager: boolean };

function PlayerScores({
  players,
  userId,
}: {
  players: PlayerAndCanWager[];
  userId: string;
}) {
  const { t } = useTranslation();
  // Sort from highest to lowest score.
  const playerScores = players.sort((a, b) => b.score - a.score);

  return (
    <div className="flex w-full gap-2 self-start overflow-x-scroll text-sm text-slate-300 text-shadow">
      {playerScores.map((p, i) => (
        <div
          className="relative flex flex-col items-center justify-between"
          key={`player-${i}`}
        >
          <p className="text-center">
            <span className="font-handwriting text-xl font-bold">{p.name}</span>
            {p.userId === userId ? <span> {t("play.wager.you")}</span> : null}
            {p.canWager ? (
              <span className="ml-1"> {p.hasWager ? "☑️" : "💭"}</span>
            ) : (
              <span> {t("play.wager.cantWager")}</span>
            )}
          </p>
          <p>
            <Dollars amount={p.score} />
          </p>
        </div>
      ))}
    </div>
  );
}

function WhyButton({ reason }: { reason: WagerReasonKey }) {
  const { t } = useTranslation();
  return (
    <Popover content={<p>{t(reason)}</p>}>
      <button
        type="button"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-500 text-xs text-slate-400 transition-colors hover:border-white hover:text-white"
      >
        ?
      </button>
    </Popover>
  );
}

function SuggestedDrawer({
  allInReason,
  recommendations,
  onSelectAmount,
  defaultOpen,
}: {
  allInReason?: WagerReasonKey;
  recommendations: WagerRecommendation[];
  onSelectAmount: (amount: number) => void;
  defaultOpen: boolean;
}) {
  const { t } = useTranslation();
  const totalCount = recommendations.length + (allInReason ? 1 : 0);
  if (totalCount === 0) return null;

  return (
    <Collapsible.Root defaultOpen={defaultOpen} className="w-full">
      <Collapsible.Trigger className="group flex items-center gap-1.5 text-sm text-slate-300 transition-colors hover:text-white">
        <span>{t("play.wager.suggestions")}</span>
        <span className="rounded-full bg-slate-700 px-1.5 text-xs text-slate-400">
          {totalCount}
        </span>
        <span className="text-xs transition-transform group-data-[state=open]:rotate-90">
          ›
        </span>
      </Collapsible.Trigger>
      <Collapsible.Content className="flex flex-wrap items-center gap-2 pt-2">
        {allInReason ? (
          <div className="flex items-center gap-1">
            <span className="text-sm text-slate-300">
              {t("play.wager.allIn")}
            </span>
            <WhyButton reason={allInReason} />
          </div>
        ) : null}
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-center gap-1">
            <Button
              variant="primary"
              onClick={() => onSelectAmount(rec.amount)}
            >
              {t(rec.label)}:{" "}
              <span className="font-handwriting font-bold">
                {formatDollars(rec.amount)}
              </span>
            </Button>
            <WhyButton reason={rec.reason} />
          </div>
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

function WagerForm({
  highestClueValue,
  score,
  loading,
  longForm,
  players,
  userId,
  strategy,
  wagerHints,
}: {
  highestClueValue: number;
  score: number;
  loading: boolean;
  longForm: boolean;
  players: PlayerAndCanWager[];
  userId: string;
  strategy?: { recommendations: WagerRecommendation[] };
  wagerHints: string;
}) {
  const { t, rich } = useTranslation();
  const maxWager = longForm ? score : Math.max(score, highestClueValue);
  const [wagerValue, setWagerValue] = React.useState("");

  // Split recommendations: All-in reason vs other chips
  const allInRec = strategy?.recommendations.find((r) => r.amount === maxWager);
  const otherRecs = React.useMemo(() => {
    if (!strategy) return [];
    return strategy.recommendations.filter((r) => r.amount !== maxWager);
  }, [strategy, maxWager]);

  const hasAnySuggestion =
    (allInRec || otherRecs.length > 0) && wagerHints !== WagerHintsMode.Never;

  return (
    <div className="flex flex-col items-center gap-4 p-2">
      <div className="flex w-full flex-col items-center gap-2">
        <p className="font-bold text-white">{t("play.wager.howMuch")}</p>
        <p className="text-center text-sm text-slate-300">
          {t("play.wager.upTo", { amount: formatDollars(maxWager) })}
        </p>
        <PlayerScores players={players} userId={userId} />
      </div>

      {/* Input + submit row */}
      <div className="flex w-full items-center gap-2">
        <Input
          variant="game"
          type="number"
          min={longForm ? 0 : 5}
          max={maxWager}
          id="wager"
          name="wager"
          value={wagerValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setWagerValue(e.target.value)
          }
          placeholder={t("play.wager.placeholder")}
          required
        />
        <Button type="submit" loading={loading}>
          {t("play.wager.submit")}
        </Button>
      </div>

      {/* All-in button */}
      <Button
        variant="primary"
        onClick={() => setWagerValue(maxWager.toString())}
      >
        {rich("play.wager.allInAmount", {
          amount: (
            <span className="font-handwriting font-bold">
              {formatDollars(maxWager)}
            </span>
          ),
        })}
      </Button>

      {/* Suggestions drawer */}
      {hasAnySuggestion ? (
        <SuggestedDrawer
          allInReason={allInRec?.reason}
          recommendations={otherRecs}
          onSelectAmount={(amount) => setWagerValue(amount.toString())}
          defaultOpen={wagerHints === WagerHintsMode.Show}
        />
      ) : null}
    </div>
  );
}

/** ConnectedWagerForm is the player's own wager form. With the room's wager
 * time (`timer`), this device places the smallest allowed wager for the
 * player when the time runs out ($0 on the Final, $5 on a Double Down; see
 * getWagerRange) — once per wager step, and not if they already wagered. */
export function ConnectedWagerForm({
  roomId,
  userId,
  timer = NO_TIMER,
}: RoomProps & { timer?: StepTimerState }) {
  const { activeClue, buzzes, board, clue, players, soloDispatch, wagers } =
    useEngineContext();
  const { t, rich } = useTranslation();
  const { wagerHints } = useWagerHintsSettings();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const loading = fetcher.state === "loading";

  const [i, j] = activeClue ? activeClue : [-1, -1];

  const score = players.get(userId)?.score ?? 0;

  const highestClueValue = React.useMemo(
    () => getHighestClueValue(board),
    [board],
  );

  const wager = wagers.get(userId);
  const minWager = clue ? getWagerRange(board, clue, score).min : 0;
  const submit = fetcher.submit;
  const timeUp = useOnceWhenTimeUp(timer, wager !== undefined, () => {
    submit(
      {
        userId,
        i: i.toString(),
        j: j.toString(),
        wager: minWager.toString(),
      },
      { method: "post", action: `/room/${roomId}/wager` },
    );
  });
  const playersList = Array.from(players.values()).map((p) => ({
    ...p,
    canWager: buzzes.get(p.userId) !== CANT_BUZZ_FLAG,
    hasWager: wagers.has(p.userId),
  }));

  const longForm = clue?.longForm ?? false;

  const strategy = React.useMemo(() => {
    if (wagerHints === "never") return undefined;
    if (!longForm || score <= 0) return undefined;

    const otherScores = Array.from(players.values())
      .filter(
        (p) => p.userId !== userId && buzzes.get(p.userId) !== CANT_BUZZ_FLAG,
      )
      .map((p) => p.score);

    return getFinalClueStrategy(score, otherScores);
  }, [wagerHints, longForm, score, players, buzzes, userId]);

  if (wager !== undefined) {
    return (
      <div className="flex flex-col items-center gap-4 p-2">
        <p className="font-bold text-white">
          {rich("play.wager.yourWager", {
            amount: (
              <span className="font-handwriting text-xl font-bold">
                {formatDollars(wager)}
              </span>
            ),
          })}
          <br />
        </p>
        <p className="text-sm text-slate-300">
          {t("play.wager.waitingForOthers")}
        </p>
        <PlayerScores players={playersList} userId={userId} />
      </div>
    );
  }

  if (timeUp) {
    return (
      <div className="flex flex-col items-center gap-4 p-2">
        <p className="font-bold text-white" data-testid="wager-time-up">
          {t("play.wager.timeUp", { amount: formatDollars(minWager) })}
        </p>
        <PlayerScores players={playersList} userId={userId} />
      </div>
    );
  }

  return (
    <fetcher.Form method="POST" action={`/room/${roomId}/wager`}>
      <input type="hidden" value={userId} name="userId" />
      <input type="hidden" value={i} name="i" />
      <input type="hidden" value={j} name="j" />
      <WagerForm
        highestClueValue={highestClueValue}
        loading={loading}
        players={playersList}
        score={score}
        userId={userId}
        longForm={longForm}
        strategy={strategy}
        wagerHints={wagerHints}
      />
      {timer.startedAt !== null ? (
        <p className="pb-2 text-center text-sm text-slate-300">
          {t("play.wager.timerHint", { amount: formatDollars(minWager) })}
        </p>
      ) : null}
    </fetcher.Form>
  );
}
