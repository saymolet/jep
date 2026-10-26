import * as DialogPrimitive from "@radix-ui/react-dialog";
import clsx from "clsx";
import * as React from "react";
import { useFetcher } from "react-router";

import { Dollars } from "~/components/dollars";
import { XMark } from "~/components/icons";
import { PlayerIcon } from "~/components/player/player-icon";
import { PROMPT_STATES } from "~/components/prompt/prompt";
import {
  GameState,
  getWagerRange,
  type Player,
  useEngineContext,
} from "~/engine";
import type { AdminStep } from "~/engine/admin";
import { getNoBuzzMs } from "~/engine/room-timers";
import { clueIsPlayable } from "~/engine/state";
import { useTranslation } from "~/i18n";
import { formatDollars } from "~/utils";
import { choiceLabel } from "~/utils/choices";

/** Enter in the panel must not reach the prompt's "Enter buzzes" key
 * listener on the window (the admin may also be playing). */
function stopEnter(e: React.KeyboardEvent) {
  if (e.key === "Enter") e.stopPropagation();
}

const ACTION_BUTTON =
  "inline-flex min-h-10 touch-manipulation items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY = clsx(ACTION_BUTTON, "bg-blue-600 text-white hover:bg-blue-700");
const SECONDARY = clsx(
  ACTION_BUTTON,
  "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20",
);
const DANGER = clsx(ACTION_BUTTON, "bg-red-600 text-white hover:bg-red-700");
const GOOD = clsx(ACTION_BUTTON, "bg-green-700 text-white hover:bg-green-800");
const NUMBER_INPUT =
  "w-28 min-w-0 rounded-lg border border-white/20 bg-white/10 px-2 py-2 text-sm text-white placeholder:text-slate-400 focus:border-blue-400 focus:ring-blue-400";

type Fields = Record<string, string>;

/** useAdminFetcher submits an admin intervention and exposes the error the
 * admin route may answer with. */
function useAdminFetcher() {
  const fetcher = useFetcher<{ error?: string } | null>();
  const error =
    fetcher.state === "idle" && fetcher.data && "error" in fetcher.data
      ? fetcher.data.error
      : undefined;
  return { fetcher, error, busy: fetcher.state !== "idle" };
}

/** usePlayerStep sends a player's own action for them: the same route the
 * player's device would call, with `admin=true` (see authorizeRoomActor). */
function usePlayerStep(roomId: number, path: string) {
  const { fetcher, busy } = useAdminFetcher();
  const send = (fields: Fields) =>
    fetcher.submit(
      { ...fields, admin: "true" },
      { method: "post", action: `/room/${roomId}/${path}` },
    );
  return { send, busy };
}

function Section({
  title,
  children,
  testId,
}: {
  title: string;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section
      className="flex flex-col gap-2 rounded-xl bg-white/5 p-3"
      data-testid={testId}
    >
      <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm text-red-300">
      {error}
    </p>
  );
}

/** CellPicker lists the round's unplayed questions by category; a tap picks
 * one. */
function CellPicker({
  onPick,
  disabled,
  testId,
}: {
  onPick: (i: number, j: number) => void;
  disabled: boolean;
  testId: string;
}) {
  const { t } = useTranslation();
  const { board, isAnswered } = useEngineContext();
  if (!board) return null;
  return (
    <div className="flex flex-col gap-2" data-testid={testId}>
      {board.categories.map((category, j) => {
        const cells = category.clues
          .map((clue, i) => ({ clue, i }))
          .filter(({ clue, i }) => !isAnswered(i, j) && clueIsPlayable(clue));
        if (cells.length === 0) return null;
        const name = board.categoryNames.at(j) ?? "";
        return (
          <div key={j} className="flex flex-col gap-1">
            <span className="text-xs text-slate-300">{name}</span>
            <div className="flex flex-wrap gap-1">
              {cells.map(({ clue, i }) => (
                <button
                  key={i}
                  type="button"
                  className={SECONDARY}
                  disabled={disabled}
                  aria-label={t("room.admin.cell", {
                    category: name,
                    value: formatDollars(clue.value),
                  })}
                  onClick={() => onPick(i, j)}
                >
                  {formatDollars(clue.value)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function nameOf(players: Map<string, Player>, userId: string) {
  return players.get(userId)?.name ?? userId;
}

function StartForPlayer({
  roomId,
  userId,
}: {
  roomId: number;
  userId: string;
}) {
  const { t } = useTranslation();
  const { players, round } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "start");
  return (
    <button
      type="button"
      className={PRIMARY}
      disabled={busy}
      onClick={() => send({ userId, round: String(round) })}
    >
      {t("room.admin.startFor", { name: nameOf(players, userId) })}
    </button>
  );
}

function ChooseForPlayer({
  roomId,
  userId,
}: {
  roomId: number;
  userId: string;
}) {
  const { t } = useTranslation();
  const { players } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "choose-clue");
  return (
    <>
      <p className="text-sm font-semibold">
        {t("room.admin.chooseFor", { name: nameOf(players, userId) })}
      </p>
      <CellPicker
        testId="admin-choose-picker"
        disabled={busy}
        onPick={(i, j) => send({ userId, i: String(i), j: String(j) })}
      />
    </>
  );
}

function WagerForPlayer({
  roomId,
  userId,
}: {
  roomId: number;
  userId: string;
}) {
  const { t } = useTranslation();
  const { activeClue, board, clue, players } = useEngineContext();
  const fetcher = useFetcher();
  const player = players.get(userId);
  if (!activeClue || !clue || !player) return null;
  const { min, max } = getWagerRange(board, clue, player.score);
  const name = player.name;
  return (
    <fetcher.Form
      method="POST"
      action={`/room/${roomId}/wager`}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="admin" value="true" />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="i" value={activeClue[0]} />
      <input type="hidden" name="j" value={activeClue[1]} />
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">
          {t("room.admin.wagerFor", { name })}
        </span>
        <span className="text-xs text-slate-300">
          {t("room.admin.wagerRange", {
            min: formatDollars(min),
            max: formatDollars(max),
          })}
        </span>
        <input
          type="number"
          name="wager"
          required
          min={min}
          max={max}
          step={1}
          inputMode="numeric"
          className={NUMBER_INPUT}
        />
      </label>
      <button
        type="submit"
        className={PRIMARY}
        disabled={fetcher.state !== "idle"}
      >
        {t("room.admin.placeWager")}
      </button>
    </fetcher.Form>
  );
}

function PassForPlayer({
  roomId,
  userId,
  receivers,
}: {
  roomId: number;
  userId: string;
  receivers: string[];
}) {
  const { t } = useTranslation();
  const { activeClue, players } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "pass-clue");
  if (!activeClue) return null;
  return (
    <>
      <p className="text-sm font-semibold">
        {t("room.admin.giveCat", { name: nameOf(players, userId) })}
      </p>
      <div className="flex flex-wrap gap-2">
        {receivers.map((toUserId) => (
          <button
            key={toUserId}
            type="button"
            className={SECONDARY}
            disabled={busy}
            onClick={() =>
              send({
                userId,
                i: String(activeClue[0]),
                j: String(activeClue[1]),
                toUserId,
              })
            }
          >
            {nameOf(players, toUserId)}
          </button>
        ))}
      </div>
    </>
  );
}

function BuzzForPlayer({ roomId, userId }: { roomId: number; userId: string }) {
  const { t } = useTranslation();
  const { activeClue, players, buzzWindowSec } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "buzz");
  if (!activeClue) return null;
  const name = nameOf(players, userId);
  const buzz = (deltaMs: number) =>
    send({
      userId,
      i: String(activeClue[0]),
      j: String(activeClue[1]),
      deltaMs: String(deltaMs),
    });
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={SECONDARY}
        disabled={busy}
        onClick={() => buzz(0)}
      >
        {t("room.admin.buzzIn", { name })}
      </button>
      <button
        type="button"
        className={SECONDARY}
        disabled={busy}
        onClick={() => buzz(getNoBuzzMs({ buzzWindowSec }))}
      >
        {t("room.admin.passBuzz", { name })}
      </button>
    </div>
  );
}

function AnswerForPlayer({
  roomId,
  userId,
}: {
  roomId: number;
  userId: string;
}) {
  const { t } = useTranslation();
  const { activeClue, players } = useEngineContext();
  const fetcher = useFetcher();
  if (!activeClue) return null;
  return (
    <fetcher.Form
      method="POST"
      action={`/room/${roomId}/answer`}
      className="flex flex-wrap items-end gap-2"
    >
      <input type="hidden" name="admin" value="true" />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="i" value={activeClue[0]} />
      <input type="hidden" name="j" value={activeClue[1]} />
      <label className="flex min-w-0 grow flex-col gap-1 text-sm">
        <span className="font-semibold">
          {t("room.admin.answerFor", { name: nameOf(players, userId) })}
        </span>
        <input
          type="text"
          name="answer"
          placeholder={t("room.admin.answerPlaceholder")}
          className={clsx(NUMBER_INPUT, "w-full")}
        />
      </label>
      <button
        type="submit"
        className={PRIMARY}
        disabled={fetcher.state !== "idle"}
      >
        {t("room.admin.submitAnswer")}
      </button>
    </fetcher.Form>
  );
}

function CheckForPlayer({
  roomId,
  userId,
  choices,
}: {
  roomId: number;
  userId: string;
  choices: boolean;
}) {
  const { t } = useTranslation();
  const { activeClue, clue, players } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "check");
  if (!activeClue || !clue) return null;
  const name = nameOf(players, userId);
  const base = {
    userId,
    i: String(activeClue[0]),
    j: String(activeClue[1]),
  };
  if (choices && clue.choices) {
    // The server decides whether the option is right (as for the player).
    return (
      <>
        <p className="text-sm font-semibold">
          {t("room.admin.pickFor", { name })}
        </p>
        <div className="flex flex-col gap-1">
          {clue.choices.map((choice, k) => (
            <button
              key={k}
              type="button"
              className={clsx(SECONDARY, "justify-start text-left")}
              disabled={busy}
              onClick={() => send({ ...base, choice: String(k) })}
            >
              {choiceLabel(k)}. {choice}
            </button>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <p className="text-sm font-semibold">
        {t("room.admin.markFor", { name })}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={GOOD}
          disabled={busy}
          onClick={() => send({ ...base, result: "correct" })}
        >
          {t("room.admin.right")}
        </button>
        <button
          type="button"
          className={DANGER}
          disabled={busy}
          onClick={() => send({ ...base, result: "incorrect" })}
        >
          {t("room.admin.wrong")}
        </button>
      </div>
    </>
  );
}

function NextForPlayer({
  roomId,
  userId,
  label,
}: {
  roomId: number;
  userId: string;
  label: string;
}) {
  const { activeClue } = useEngineContext();
  const { send, busy } = usePlayerStep(roomId, "next-clue");
  if (!activeClue) return null;
  return (
    <button
      type="button"
      className={PRIMARY}
      disabled={busy}
      onClick={() =>
        send({ userId, i: String(activeClue[0]), j: String(activeClue[1]) })
      }
    >
      {label}
    </button>
  );
}

/** stepStatus says what the game waits for, in words. */
function stepStatus(
  step: AdminStep,
  players: Map<string, Player>,
  t: ReturnType<typeof useTranslation>["t"],
) {
  switch (step.kind) {
    case "start":
      return t("room.admin.waitingStart", {
        name: nameOf(players, step.userId),
      });
    case "choose":
      return t("room.admin.waitingChoose", {
        name: nameOf(players, step.userId),
      });
    case "wager":
      return t("room.admin.waitingWagers");
    case "pass":
      return t("room.admin.waitingPass", {
        name: nameOf(players, step.userId),
      });
    case "buzz":
      return t("room.admin.waitingBuzzes");
    case "answer":
      return t("room.admin.waitingAnswers");
    case "reveal":
      return t("room.admin.waitingReveal");
    case "check":
      return t("room.admin.waitingCheck", {
        name: nameOf(players, step.userId),
      });
    case "checks":
      return t("room.admin.waitingChecks");
    case "next":
      return t("room.admin.waitingNext", {
        name: nameOf(players, step.userId),
      });
    case "none":
      return t("room.admin.waitingNothing");
  }
}

/** StepActions: the stuck step, done for the player it waits on. */
function StepActions({ roomId, step }: { roomId: number; step: AdminStep }) {
  const { t } = useTranslation();
  const { players } = useEngineContext();
  switch (step.kind) {
    case "start":
      return <StartForPlayer roomId={roomId} userId={step.userId} />;
    case "choose":
      return <ChooseForPlayer roomId={roomId} userId={step.userId} />;
    case "wager":
      return (
        <>
          {step.userIds.map((userId) => (
            <WagerForPlayer key={userId} roomId={roomId} userId={userId} />
          ))}
        </>
      );
    case "pass":
      return (
        <PassForPlayer
          roomId={roomId}
          userId={step.userId}
          receivers={step.receivers}
        />
      );
    case "buzz":
      return (
        <>
          {step.userIds.map((userId) => (
            <BuzzForPlayer key={userId} roomId={roomId} userId={userId} />
          ))}
        </>
      );
    case "answer":
      return (
        <>
          {step.userIds.map((userId) => (
            <AnswerForPlayer key={userId} roomId={roomId} userId={userId} />
          ))}
        </>
      );
    case "reveal":
      return (
        <NextForPlayer
          roomId={roomId}
          userId={step.userId}
          label={t("room.admin.revealAnswer")}
        />
      );
    case "check":
      return (
        <CheckForPlayer
          roomId={roomId}
          userId={step.userId}
          choices={step.choices}
        />
      );
    case "checks":
      return (
        <>
          {step.userIds.map((userId) => (
            <CheckForPlayer
              key={userId}
              roomId={roomId}
              userId={userId}
              choices={false}
            />
          ))}
        </>
      );
    case "next":
      return (
        <NextForPlayer
          roomId={roomId}
          userId={step.userId}
          label={t("room.admin.nextFor", {
            name: nameOf(players, step.userId),
          })}
        />
      );
    case "none":
      return null;
  }
}

/** SkipQuestion: skip the open question (with a confirmation), or an
 * unplayed question on the board. */
function SkipQuestion({ roomId }: { roomId: number }) {
  const { t } = useTranslation();
  const { activeClue, canSkipOpenClue, type } = useEngineContext();
  const { fetcher, error, busy } = useAdminFetcher();
  const [confirming, setConfirming] = React.useState(false);
  const skip = (i: number, j: number) => {
    setConfirming(false);
    fetcher.submit(
      { intent: "skip", i: String(i), j: String(j) },
      { method: "post", action: `/room/${roomId}/admin` },
    );
  };

  if (canSkipOpenClue && activeClue) {
    return (
      <Section title={t("room.admin.question")} testId="admin-skip">
        <p className="text-sm text-slate-300">{t("room.admin.skipHelp")}</p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {t("room.admin.skipConfirm")}
            </span>
            <button
              type="button"
              className={DANGER}
              disabled={busy}
              onClick={() => skip(activeClue[0], activeClue[1])}
            >
              {t("room.admin.skipYes")}
            </button>
            <button
              type="button"
              className={SECONDARY}
              onClick={() => setConfirming(false)}
            >
              {t("room.admin.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={clsx(DANGER, "self-start")}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            ⏭ {t("room.admin.skip")}
          </button>
        )}
        <ErrorText error={error} />
      </Section>
    );
  }

  if (type === GameState.ShowBoard) {
    return (
      <Section title={t("room.admin.skipFromBoard")} testId="admin-skip">
        <p className="text-sm text-slate-300">
          {t("room.admin.skipFromBoardHelp")}
        </p>
        <CellPicker testId="admin-skip-picker" disabled={busy} onPick={skip} />
        <ErrorText error={error} />
      </Section>
    );
  }
  return null;
}

function ScoreRow({ roomId, player }: { roomId: number; player: Player }) {
  const { t } = useTranslation();
  const { fetcher, error, busy } = useAdminFetcher();
  return (
    <li
      className="flex flex-col gap-2 rounded-lg bg-white/5 p-2"
      data-testid="admin-score-row"
      data-user-id={player.userId}
    >
      <div className="flex min-w-0 items-center gap-2">
        <PlayerIcon player={player} size="sm" />
        <span className="min-w-0 grow truncate font-bold">{player.name}</span>
        <Dollars amount={player.score} />
      </div>
      <fetcher.Form
        method="POST"
        action={`/room/${roomId}/admin`}
        className="flex flex-wrap items-center gap-1"
      >
        <input type="hidden" name="intent" value="score" />
        <input type="hidden" name="userId" value={player.userId} />
        <input
          type="number"
          name="amount"
          required
          step={1}
          inputMode="numeric"
          defaultValue={100}
          aria-label={t("room.admin.amountFor", { name: player.name })}
          className={NUMBER_INPUT}
        />
        <button
          type="submit"
          name="op"
          value="add"
          className={SECONDARY}
          disabled={busy}
          aria-label={`${t("room.admin.add")}: ${player.name}`}
        >
          + {t("room.admin.add")}
        </button>
        <button
          type="submit"
          name="op"
          value="subtract"
          className={SECONDARY}
          disabled={busy}
          aria-label={`${t("room.admin.subtract")}: ${player.name}`}
        >
          − {t("room.admin.subtract")}
        </button>
        <button
          type="submit"
          name="op"
          value="set"
          className={SECONDARY}
          disabled={busy}
          aria-label={`${t("room.admin.setScore")}: ${player.name}`}
        >
          = {t("room.admin.setScore")}
        </button>
      </fetcher.Form>
      <ErrorText error={error} />
    </li>
  );
}

/** AdminPanel is the content of the admin controls sheet. */
export function AdminPanel({ roomId }: { roomId: number }) {
  const { t } = useTranslation();
  const { adminStep, isPaused, players } = useEngineContext();
  return (
    <div className="flex flex-col gap-3">
      <Section title={t("room.admin.now")} testId="admin-step">
        <p className="text-sm" data-testid="admin-step-status">
          {isPaused
            ? t("room.admin.paused")
            : stepStatus(adminStep, players, t)}
        </p>
        {isPaused ? null : <StepActions roomId={roomId} step={adminStep} />}
      </Section>
      <SkipQuestion roomId={roomId} />
      <Section title={t("room.admin.scores")} testId="admin-scores">
        <p className="text-sm text-slate-300">{t("room.admin.scoresHelp")}</p>
        {players.size === 0 ? (
          <p className="text-sm text-slate-300">{t("room.admin.noPlayers")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {Array.from(players.values()).map((player) => (
              <ScoreRow key={player.userId} roomId={roomId} player={player} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/** AdminControls is the site admin's 🛡 button in a game room (only rendered
 * for the admin, see the room loader's `isAdmin`): it opens the admin
 * controls in a sheet (a bottom sheet on phones, a side panel on wider
 * screens), over the board or an open question alike. */
export function AdminControls({
  roomId,
  raised = false,
}: {
  roomId: number;
  /** Lift the button above the spectator bar. */
  raised?: boolean;
}) {
  const { t } = useTranslation();
  const { type } = useEngineContext();
  const [open, setOpen] = React.useState(false);
  const promptOpen = PROMPT_STATES.has(type);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={t("room.admin.open")}
          title={t("room.admin.open")}
          data-testid="admin-controls-button"
          onKeyDown={stopEnter}
          className={clsx(
            "fixed right-3 z-30 flex h-12 w-12 touch-manipulation items-center justify-center rounded-full bg-blue-925/90 text-2xl shadow-lg ring-1 ring-white/30 transition hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 focus:outline-none",
            // Above the question's countdown and the BUZZ button on phones,
            // and above the spectator bar.
            promptOpen
              ? "bottom-20 buzzbar:bottom-[calc(7.75rem+env(safe-area-inset-bottom))]"
              : raised
                ? "bottom-[calc(4.5rem+env(safe-area-inset-bottom))]"
                : "bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
            open && "bg-blue-600",
          )}
        >
          <span aria-hidden>🛡</span>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 animate-overlay-show bg-black/60" />
        <DialogPrimitive.Content
          onKeyDown={stopEnter}
          // The question behind the sheet moves focus on its own (autofocus
          // as its steps change); that must not close the sheet.
          onFocusOutside={(e) => e.preventDefault()}
          className={clsx(
            "fixed z-50 flex animate-slide-up-and-fade flex-col bg-blue-1000 text-slate-100 shadow-2xl focus:outline-none",
            "inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
            "sm:inset-x-auto sm:top-0 sm:right-0 sm:bottom-0 sm:max-h-none sm:w-[28rem] sm:rounded-none sm:rounded-l-2xl",
          )}
          data-testid="admin-panel"
        >
          <div className="flex items-start justify-between gap-2 p-4 pb-2">
            <div className="flex flex-col gap-1">
              <DialogPrimitive.Title className="flex items-center gap-2 text-2xl font-medium text-white">
                <span aria-hidden>🛡</span>
                {t("room.admin.title")}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="text-sm text-slate-300">
                {t("room.admin.description")}
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
            <AdminPanel roomId={roomId} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
