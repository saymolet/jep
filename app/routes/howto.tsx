import * as React from "react";

import Button from "~/components/button";
import { ErrorMessage, SuccessMessage } from "~/components/error";
import HowToPlay from "~/components/how-to-play";
import { Anchor } from "~/components/link";
import Main from "~/components/main";
import { Kbd } from "~/components/prompt/kbd";
import { Lockout } from "~/components/prompt/lockout";
import { ReadClueTimer } from "~/components/prompt/read-clue-timer";
import { CLUE_TIMEOUT_MS } from "~/engine";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getPageMetadata } from "~/utils/seo";
import useKeyPress from "~/utils/use-key-press";
import useTimeout from "~/utils/use-timeout";

import type { Route } from "./+types/howto";

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = metaT(matches);
  return getPageMetadata(t("howto.metaTitle"), t("howto.metaDescription"));
};

const CLUE_DURATION_MS = 5000;
const LOCKOUT_MS = 250;

const FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  fractionalSecondDigits: 3,
};

export default function HowTo() {
  const { t, rich, intlLocale } = useTranslation();
  // Times are only formatted after mount (see clueShownAt), so the viewer's
  // locale and time zone can't cause a hydration mismatch.
  const formatter = React.useMemo(
    () => new Intl.DateTimeFormat(intlLocale, FORMAT_OPTIONS),
    [intlLocale],
  );
  // Set after mount: reading Date.now() during render would make the server
  // and client render different "Clue shown at" times (a hydration mismatch).
  const [clueShownAt, setClueShownAt] = React.useState<number | undefined>();
  React.useEffect(() => {
    setClueShownAt(Date.now());
  }, []);
  const [buzzedAt, setBuzzedAt] = React.useState<number | undefined>();
  const [buzzerOpenAt, setBuzzerOpenAt] = React.useState<number | undefined>();
  const [lockout, setLockout] = React.useState(false);
  const [hadLockout, setHadLockout] = React.useState(false);
  const [msLeft, setMsLeft] = React.useState<number | undefined>();

  const buzzDurationMs =
    buzzedAt !== undefined && buzzerOpenAt !== undefined
      ? buzzedAt - buzzerOpenAt
      : null;

  // Open the buzzers after the clue is done being "read".
  useTimeout(
    () => setBuzzerOpenAt(Date.now()),
    buzzedAt === undefined ? CLUE_DURATION_MS : null,
  );

  // Remove the lockout after 500ms.
  useTimeout(() => setLockout(false), lockout ? LOCKOUT_MS : null);

  // If the contestant doesn't buzz for 5 seconds, close the buzzer and send a
  // 5-second "non-buzz" buzz to the server.
  useTimeout(
    () => {
      setBuzzedAt(Date.now());
    },
    buzzerOpenAt !== undefined && buzzedAt === undefined
      ? CLUE_TIMEOUT_MS + 1
      : null,
  );

  function handleClick(clickedAtMs: number) {
    if (lockout || buzzedAt !== undefined) {
      return;
    }

    if (
      clueShownAt === undefined ||
      clickedAtMs - clueShownAt < CLUE_DURATION_MS
    ) {
      setHadLockout(true);
      return setLockout(true);
    }

    setBuzzedAt(clickedAtMs);
  }

  useKeyPress("Enter", () => handleClick(Date.now()));

  function handleReset() {
    setClueShownAt(Date.now());
    setBuzzedAt(undefined);
    setBuzzerOpenAt(undefined);
    setLockout(false);
    setHadLockout(false);
    setMsLeft(undefined);
  }

  React.useEffect(() => {
    let requestId: number;

    const animate = (timeMs: number) => {
      const elapsedMs = Date.now() - timeMs;
      const newMsLeft = Math.max(CLUE_DURATION_MS - elapsedMs, 0);
      setMsLeft(newMsLeft);

      if (newMsLeft > 0) {
        requestId = requestAnimationFrame(() => animate(timeMs));
      }
    };

    if (buzzerOpenAt !== undefined && buzzedAt === undefined) {
      requestId = requestAnimationFrame(() => animate(buzzerOpenAt));
    }

    return () => cancelAnimationFrame(requestId);
  }, [buzzerOpenAt, buzzedAt]);

  return (
    <div className="max-w-full grow">
      <Main>
        <HowToPlay />
        <h1 className="mb-4 text-2xl font-semibold">{t("howto.noTyping")}</h1>
        <p className="mb-4">{t("howto.partyGame")}</p>
        <p className="mb-4">{t("howto.speakAloud")}</p>
        <p className="mb-4">{t("howto.trust")}</p>
        <div className="p-2">
          <img src="/images/card.jpg" alt={t("howto.photoAlt")} />
          <p className="text-center text-sm">
            {rich("howto.photoCredit", {
              author: (c) => (
                <Anchor href="https://unsplash.com/fr/@samgoh_">{c}</Anchor>
              ),
              site: (c) => (
                <Anchor href="https://unsplash.com/photos/Wfe_gWCpciU">
                  {c}
                </Anchor>
              ),
            })}
          </p>
        </div>
        <p className="mb-4">{t("howto.wrong")}</p>
        <p className="mb-4">{t("howto.choices")}</p>
        <p className="mb-4">{t("howto.secret")}</p>
        <p className="mb-4">{t("howto.right")}</p>
        <p className="mb-4">{t("howto.noBuzz")}</p>

        <h1 className="mb-4 text-2xl font-semibold">{t("howto.practice")}</h1>
        <button
          className="relative w-full bg-blue-1000 py-2"
          onClick={() => handleClick(Date.now())}
        >
          <ReadClueTimer
            clueDurationMs={CLUE_DURATION_MS}
            shouldAnimate={buzzedAt === undefined}
            wonBuzz={buzzedAt !== undefined && buzzedAt <= CLUE_TIMEOUT_MS}
          />
          <div className="flex flex-col p-2">
            <div className="flex justify-between p-4">
              <div className="text-white">
                {rich("howto.demoCategory", {
                  b: (c) => <span className="font-bold">{c}</span>,
                  value: "$200",
                })}
              </div>
              <span className="text-sm text-slate-300">
                {rich("howto.demoHint", { kbd: (c) => <Kbd>{c}</Kbd> })}
              </span>
            </div>
            <p className="font-korinna text-xl font-bold text-white uppercase text-shadow-md">
              {t("howto.demoClue")}
            </p>
            <Lockout active={lockout} />
          </div>
        </button>
        <div className="bg-slate-200 p-2">
          <table className="w-full table-fixed font-mono">
            <tbody>
              <tr>
                <td>{t("howto.clueShownAt")}</td>
                <td className="text-right">
                  {clueShownAt ? formatter.format(clueShownAt) : "null"}
                </td>
              </tr>
              <tr>
                <td>{t("howto.buzzerOpenAt")}</td>
                <td className="text-right">
                  {buzzerOpenAt ? formatter.format(buzzerOpenAt) : "null"}
                </td>
              </tr>
              <tr>
                <td>{t("howto.timeRemaining")}</td>
                <td className="text-right">
                  {msLeft !== undefined
                    ? t("howto.ms", { ms: msLeft })
                    : "null"}
                </td>
              </tr>
              <tr>
                <td>{t("howto.buzzedAt")}</td>
                <td className="text-right">
                  {buzzedAt ? formatter.format(buzzedAt) : "null"}
                </td>
              </tr>
              <tr>
                <td>{t("howto.buzzDuration")}</td>
                <td className="text-right">
                  {buzzDurationMs !== null && buzzDurationMs <= CLUE_TIMEOUT_MS
                    ? t("howto.ms", { ms: buzzDurationMs })
                    : "null"}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="my-4 w-full border-b border-b-slate-400" />
          <div className="flex flex-col gap-2">
            {hadLockout ? (
              <ErrorMessage>
                {t("howto.lockedOut", { ms: LOCKOUT_MS })}
              </ErrorMessage>
            ) : null}
            {buzzDurationMs && buzzDurationMs > CLUE_TIMEOUT_MS ? (
              <ErrorMessage>
                {t("howto.tooSlow", { seconds: CLUE_TIMEOUT_MS / 1000 })}
              </ErrorMessage>
            ) : null}
            {buzzedAt !== undefined &&
            buzzDurationMs &&
            buzzDurationMs <= CLUE_TIMEOUT_MS ? (
              <SuccessMessage>
                {t("howto.success", { ms: buzzDurationMs })}
              </SuccessMessage>
            ) : null}
            <div className="flex">
              <Button onClick={handleReset}>{t("howto.reset")}</Button>
            </div>
          </div>
        </div>
      </Main>
    </div>
  );
}
