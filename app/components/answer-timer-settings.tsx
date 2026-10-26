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

export interface SettingsAccessProps {
  /** The visitor is logged in as the site admin (room loader). */
  isAdmin?: boolean;
}

/** mayEditSettings: in a room only the site admin may change the settings
 * (the server enforces it too); in solo play (room -1) the player may. */
export function mayEditSettings(roomId: number, isAdmin = false) {
  return isAdmin || roomId === -1;
}

/** useAnswerTimerSetting is the room's answer timer setting (showing a
 * change right away while it is being saved) and a function to change it.
 * The admin (or the solo player) can change it between questions. */
function useAnswerTimerSetting({
  roomId,
  userId,
  isAdmin,
}: RoomProps & SettingsAccessProps) {
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

  const editable = mayEditSettings(roomId, isAdmin);
  const betweenQuestions = activeClue === null && type !== GameState.GameOver;
  const canChange =
    editable &&
    betweenQuestions &&
    // The admin needn't play; in solo play the player sets it.
    (isAdmin || players.has(userId));

  const save = (next: { seconds: number; autoWrong: boolean }) =>
    fetcher.submit(
      {
        userId,
        answerTimeSec: next.seconds.toString(),
        autoWrongOnTimeout: next.autoWrong.toString(),
      },
      { method: "post", action: `/room/${roomId}/settings` },
    );

  return { seconds, autoWrong, editable, canChange, save };
}

/** AnswerTimerSettings picks the answer time (Off / 10–60 s) and whether
 * running out of time marks the answer wrong. Read-only (the current values
 * shown, controls disabled) for everyone but the admin. */
export function AnswerTimerSettings({
  roomId,
  userId,
  isAdmin = false,
}: RoomProps & SettingsAccessProps) {
  const { t } = useTranslation();
  const { seconds, autoWrong, editable, canChange, save } =
    useAnswerTimerSetting({ roomId, userId, isAdmin });
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
        {!editable
          ? t("room.answerTimeAdminOnly")
          : canChange
            ? t("room.answerTimeHelp")
            : t("room.answerTimeBetweenQuestions")}
      </p>
    </div>
  );
}

/** AnswerTimerControl is the room's header button showing the answer time
 * ("⏱ Off" / "⏱ 15 s"); it opens the answer time settings. Like Pause, it
 * is only available between questions. For everyone but the admin it only
 * shows the value ("Only the admin can change this"). */
export function AnswerTimerControl({
  roomId,
  userId,
  isAdmin = false,
}: RoomProps & SettingsAccessProps) {
  const { t } = useTranslation();
  const { answerTimeSec, activeClue, type } = useEngineContext();
  const [open, setOpen] = React.useState(false);
  const canChange = activeClue === null && type !== GameState.GameOver;
  const value =
    answerTimeSec === 0
      ? t("room.answerTimeOff")
      : t("room.answerTimeSeconds", { seconds: answerTimeSec });
  const content = (
    <>
      <span className="text-base" aria-hidden>
        {TIMER_SYMBOL}
      </span>
      <span>{value}</span>
    </>
  );

  if (!mayEditSettings(roomId, isAdmin)) {
    const label = t("room.answerTimeReadOnly", { value });
    return (
      <span
        title={label}
        data-testid="answer-time-readonly"
        className="flex cursor-default items-center gap-2 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-slate-300"
      >
        {content}
        <span className="sr-only">{t("room.answerTimeAdminOnly")}</span>
      </span>
    );
  }

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
        {content}
      </button>
      <Dialog
        isOpen={open && canChange}
        onClose={() => setOpen(false)}
        title={t("room.answerTimeSettings")}
        description={null}
      >
        <AnswerTimerSettings
          roomId={roomId}
          userId={userId}
          isAdmin={isAdmin}
        />
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
