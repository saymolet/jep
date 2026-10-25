import clsx from "clsx";
import * as React from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import Dialog from "~/components/dialog";
import type { RoomProps } from "~/components/game";
import type { Action } from "~/engine";
import { GameState, useEngineContext } from "~/engine";
import { ANSWER_TIME_OPTIONS } from "~/engine/answer-timer";
import { useTranslation } from "~/i18n";
import useSoloAction from "~/utils/use-solo-action";

const TIMER_SYMBOL = "⏱"; // ⏱

/** useAnswerTimerSetting is the room's answer timer setting (showing a
 * change right away while it is being saved) and a function to change it.
 * Any player can change it between questions. */
function useAnswerTimerSetting({ roomId, userId }: RoomProps) {
  const {
    activeClue,
    answerTimeSec,
    autoWrongOnTimeout,
    players,
    soloDispatch,
    type,
  } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);

  const pending = fetcher.formData;
  const seconds = pending
    ? Number(pending.get("answerTimeSec"))
    : answerTimeSec;
  const autoWrong = pending
    ? pending.get("autoWrongOnTimeout") === "true"
    : autoWrongOnTimeout;

  const canChange =
    players.has(userId) && activeClue === null && type !== GameState.GameOver;

  const save = (next: { seconds: number; autoWrong: boolean }) =>
    fetcher.submit(
      {
        userId,
        answerTimeSec: next.seconds.toString(),
        autoWrongOnTimeout: next.autoWrong.toString(),
      },
      { method: "post", action: `/room/${roomId}/settings` },
    );

  return { seconds, autoWrong, canChange, save };
}

/** AnswerTimerSettings picks the answer time (Off / 10–60 s) and whether
 * running out of time marks the answer wrong. */
export function AnswerTimerSettings({ roomId, userId }: RoomProps) {
  const { t } = useTranslation();
  const { seconds, autoWrong, canChange, save } = useAnswerTimerSetting({
    roomId,
    userId,
  });
  const labelId = React.useId();

  return (
    <div className="flex flex-col gap-2" data-testid="answer-timer-settings">
      <span id={labelId} className="text-sm text-white opacity-70">
        {t("room.answerTime")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-1"
      >
        {ANSWER_TIME_OPTIONS.map((option) => {
          const selected = option === seconds;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!canChange}
              onClick={() => {
                if (!selected) save({ seconds: option, autoWrong });
              }}
              className={clsx(
                "min-w-12 rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                selected
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-white/20 bg-white/10 text-slate-300 hover:bg-blue-600/20",
              )}
            >
              {option === 0
                ? t("room.answerTimeOff")
                : t("room.answerTimeSeconds", { seconds: option })}
            </button>
          );
        })}
      </div>
      <label
        className={clsx(
          "flex items-center gap-2 text-sm text-slate-300",
          seconds === 0 && "opacity-50",
        )}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-blue-600"
          checked={autoWrong}
          disabled={!canChange || seconds === 0}
          onChange={(e) => save({ seconds, autoWrong: e.target.checked })}
        />
        {t("room.answerTimeAutoWrong")}
      </label>
      <p className="text-xs text-slate-400">
        {canChange
          ? t("room.answerTimeHelp")
          : t("room.answerTimeBetweenQuestions")}
      </p>
    </div>
  );
}

/** AnswerTimerControl is the room's header button showing the answer time
 * ("⏱ Off" / "⏱ 15 s"); it opens the answer time settings. Like Pause, it
 * is only available between questions. */
export function AnswerTimerControl({ roomId, userId }: RoomProps) {
  const { t } = useTranslation();
  const { answerTimeSec, activeClue, type } = useEngineContext();
  const [open, setOpen] = React.useState(false);
  const canChange = activeClue === null && type !== GameState.GameOver;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!canChange}
        aria-label={t("room.answerTimeSettings")}
        title={
          canChange
            ? t("room.answerTimeSettings")
            : t("room.answerTimeBetweenQuestions")
        }
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40"
      >
        <span className="text-base" aria-hidden>
          {TIMER_SYMBOL}
        </span>
        <span>
          {answerTimeSec === 0
            ? t("room.answerTimeOff")
            : t("room.answerTimeSeconds", { seconds: answerTimeSec })}
        </span>
      </button>
      <Dialog
        isOpen={open && canChange}
        onClose={() => setOpen(false)}
        title={t("room.answerTimeSettings")}
        description={null}
      >
        <AnswerTimerSettings roomId={roomId} userId={userId} />
        <div className="mt-4">
          <Dialog.Footer>
            <Button type="button" onClick={() => setOpen(false)}>
              {t("common.close")}
            </Button>
          </Dialog.Footer>
        </div>
      </Dialog>
    </>
  );
}
