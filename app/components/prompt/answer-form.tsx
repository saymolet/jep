import * as React from "react";
import { useFetcher } from "react-router";

import Button from "~/components/button";
import type { RoomProps } from "~/components/game";
import Input from "~/components/input";
import type { Action } from "~/engine";
import { useEngineContext } from "~/engine";
import { useTranslation } from "~/i18n";
import useSoloAction from "~/utils/use-solo-action";

import { type StepTimerState, useOnceWhenTimeUp } from "./step-timers";

const NO_TIMER: StepTimerState = {
  startedAt: null,
  durationSec: 0,
  status: null,
};

function AnswerForm({
  submittedAnswer,
  loading,
  timed,
  timeUp,
}: {
  submittedAnswer?: string;
  loading: boolean;
  /** The room's Final answer time runs. */
  timed: boolean;
  /** …and has run out: the answer can't be changed any more. */
  timeUp: boolean;
}) {
  const { t, rich } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2 p-2">
      {submittedAnswer ? (
        <>
          <p className="font-bold text-white">
            {rich("play.answer.youAnswered", {
              answer: (
                <span className="font-handwriting text-xl font-bold">
                  {submittedAnswer}
                </span>
              ),
            })}
          </p>
          {timeUp ? null : (
            <p className="text-sm text-slate-300">
              {t("play.answer.canChange")}
            </p>
          )}
        </>
      ) : null}
      {/* Stays in the page when the time is up (read-only), so what the
          player typed can still be read and sent. */}
      <div className="flex gap-2">
        <div className="min-w-48 flex-1">
          <Input
            variant="game"
            type="text"
            id="answer"
            name="answer"
            placeholder={t("play.answer.placeholder")}
            required
            readOnly={timeUp}
          />
        </div>
        <Button
          variant="primary"
          type="submit"
          loading={loading}
          disabled={timeUp}
        >
          {t("play.answer.submit")}
        </Button>
      </div>
      {timeUp ? (
        <p className="font-bold text-white" data-testid="answer-time-up">
          {t("play.answer.timeUpSent")}
        </p>
      ) : timed ? (
        <p className="text-center text-sm text-slate-300">
          {t("play.answer.timerHint")}
        </p>
      ) : null}
    </div>
  );
}

/** ConnectedAnswerForm is the player's own Final answer form. With the
 * room's Final answer time (`timer`), this device sends what the player
 * typed (possibly nothing) when the time runs out — once, and not if they
 * already sent an answer (that one stands). */
export function ConnectedAnswerForm({
  roomId,
  userId,
  timer = NO_TIMER,
}: RoomProps & { timer?: StepTimerState }) {
  const { activeClue, answers, soloDispatch } = useEngineContext();
  const fetcher = useFetcher<Action>();
  useSoloAction(fetcher, soloDispatch);
  const loading = fetcher.state === "loading";
  const formRef = React.useRef<HTMLFormElement>(null);

  const [i, j] = activeClue ?? [-1, -1];
  const submittedAnswer = answers.get(userId);
  const submit = fetcher.submit;
  const timeUp = useOnceWhenTimeUp(
    timer,
    submittedAnswer !== undefined || fetcher.state !== "idle",
    () => {
      const input = formRef.current?.elements.namedItem("answer");
      const answer =
        input instanceof HTMLInputElement ? input.value.trim() : "";
      submit(
        { userId, i: i.toString(), j: j.toString(), answer },
        { method: "post", action: `/room/${roomId}/answer` },
      );
    },
  );

  if (!activeClue) {
    throw new Error("No active clue");
  }

  return (
    <fetcher.Form method="POST" action={`/room/${roomId}/answer`} ref={formRef}>
      <input type="hidden" value={userId} name="userId" />
      <input type="hidden" value={i} name="i" />
      <input type="hidden" value={j} name="j" />
      <AnswerForm
        submittedAnswer={submittedAnswer}
        loading={loading}
        timed={timer.startedAt !== null}
        timeUp={timeUp}
      />
    </fetcher.Form>
  );
}
