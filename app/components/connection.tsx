import clsx from "clsx";
import * as React from "react";

import { ConnectionState } from "~/engine/use-game-engine";
import { type TFunction, useTranslation } from "~/i18n";
import useDebounce from "~/utils/use-debounce";

import Popover from "./popover";

const DURATION_UPDATE_INTERVAL_MS = 500;

/** How long the state must be DISCONNECTED before showing the prominent banner. */
const BANNER_DELAY_MS = 5000;

export function getHumanReadableDuration(diffMs: number, t: TFunction): string {
  if (diffMs < 1000) {
    return t("room.time.justNow");
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) {
    return t("room.time.fewSeconds");
  } else if (seconds < 10) {
    return t("room.time.under10Seconds");
  } else if (seconds < 20) {
    return t("room.time.under20Seconds");
  } else if (seconds < 40) {
    return t("room.time.halfMinute");
  } else if (seconds < 60) {
    return t("room.time.underMinute");
  } else if (seconds < 90) {
    return t("room.time.aboutMinute");
  }

  const minutes = Math.floor(diffMs / (60 * 1000));
  if (diffMs < 60 * 60 * 1000) {
    return t("room.time.minutesAgo", { count: minutes });
  } else {
    const hours = Math.floor(diffMs / (60 * 60 * 1000));
    return t("room.time.hoursAgo", { count: hours });
  }
}

/** Renders a human-readable duration with a popover showing the exact time. */
function DurationLabel({
  label,
  timestamp,
  durationMsg,
  decorationColor,
}: {
  label: string;
  timestamp: number;
  durationMsg: string;
  decorationColor: string;
}) {
  const { intlLocale } = useTranslation();
  return (
    <div>
      {label}{" "}
      <Popover content={new Date(timestamp).toLocaleTimeString(intlLocale)}>
        <button className={`underline ${decorationColor} decoration-dashed`}>
          {durationMsg}
        </button>
      </Popover>
    </div>
  );
}

export default function Connection({
  state,
  lastMessageAt,
  reconnect,
}: {
  state: ConnectionState;
  lastMessageAt?: number;
  reconnect?: () => void;
}) {
  const { t, intlLocale } = useTranslation();
  const debouncedState = useDebounce(state, 500);

  const isConnected = debouncedState === ConnectionState.CONNECTED;

  // Track the first moment we left CONNECTED, persisting through retries.
  // Cleared when we return to CONNECTED.
  const [disconnectedSince, setDisconnectedSince] = React.useState<
    number | undefined
  >();
  // Track when we became CONNECTED (for "Connected since" display).
  const [connectedSince, setConnectedSince] = React.useState<
    number | undefined
  >(isConnected ? Date.now() : undefined);

  React.useEffect(() => {
    if (isConnected) {
      setDisconnectedSince(undefined);
      setConnectedSince(Date.now());
    } else {
      setConnectedSince(undefined);
      // Only set if not already set — preserves the original disconnect time
      setDisconnectedSince((prev) => prev ?? Date.now());
    }
  }, [isConnected]);

  const [durationMsg, setDurationMsg] = React.useState<string | undefined>(
    lastMessageAt
      ? getHumanReadableDuration(Date.now() - lastMessageAt, t)
      : undefined,
  );
  const [disconnectedMsg, setDisconnectedMsg] = React.useState<
    string | undefined
  >(
    disconnectedSince
      ? getHumanReadableDuration(Date.now() - disconnectedSince, t)
      : undefined,
  );
  const [connectedMsg, setConnectedMsg] = React.useState<string | undefined>(
    connectedSince
      ? getHumanReadableDuration(Date.now() - connectedSince, t)
      : undefined,
  );

  // Track how long we've been in DISCONNECTED state for banner escalation.
  const [showBanner, setShowBanner] = React.useState(false);
  React.useEffect(() => {
    if (debouncedState === ConnectionState.DISCONNECTED) {
      const id = setTimeout(() => setShowBanner(true), BANNER_DELAY_MS);
      return () => clearTimeout(id);
    }
    setShowBanner(false);
  }, [debouncedState]);

  React.useEffect(() => {
    function update() {
      setDurationMsg(
        lastMessageAt
          ? getHumanReadableDuration(Date.now() - lastMessageAt, t)
          : undefined,
      );
      setDisconnectedMsg(
        disconnectedSince
          ? getHumanReadableDuration(Date.now() - disconnectedSince, t)
          : undefined,
      );
      setConnectedMsg(
        connectedSince
          ? getHumanReadableDuration(Date.now() - connectedSince, t)
          : undefined,
      );
    }
    update();
    const id = setInterval(update, DURATION_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [lastMessageAt, disconnectedSince, connectedSince, t]);

  const isRetrying = debouncedState === ConnectionState.RECONNECTING;

  // Prominent banner for sustained connection problems (gave up retrying).
  if (showBanner && debouncedState === ConnectionState.DISCONNECTED) {
    return (
      <div className="flex items-center gap-3 rounded-md bg-red-900/50 px-4 py-3 text-sm text-red-200">
        <div className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
        <div className="flex grow flex-col gap-1">
          <span className="font-medium text-red-100">
            {reconnect
              ? t("room.connection.lost")
              : t("room.connection.offline")}
          </span>
          {disconnectedSince && disconnectedMsg && (
            <span className="text-red-300">
              {t("room.connection.disconnected")}{" "}
              <Popover
                content={new Date(disconnectedSince).toLocaleTimeString(
                  intlLocale,
                )}
              >
                <button className="underline decoration-red-500 decoration-dashed">
                  {disconnectedMsg}
                </button>
              </Popover>
            </span>
          )}
          {durationMsg && lastMessageAt && (
            <span className="text-red-300">
              {t("room.connection.lastEvent")}{" "}
              <Popover
                content={new Date(lastMessageAt).toLocaleTimeString(intlLocale)}
              >
                <button className="underline decoration-red-500 decoration-dashed">
                  {durationMsg}
                </button>
              </Popover>
            </span>
          )}
        </div>
        {reconnect ? (
          <button
            onClick={reconnect}
            className="shrink-0 rounded bg-red-700 px-3 py-1 text-sm font-medium text-red-100 transition-colors hover:bg-red-600"
          >
            {t("room.connection.reconnect")}
          </button>
        ) : null}
      </div>
    );
  }

  // Inline reconnecting indicator with attempt count.
  if (isRetrying) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-300">
        <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-yellow-500" />
        <span>{t("room.connection.reconnecting")}</span>
      </div>
    );
  }

  // Default compact indicator for healthy / initial connection states.
  const isDisconnected = debouncedState === ConnectionState.DISCONNECTED;
  const disconnectedLabel = reconnect
    ? t("room.connection.disconnected")
    : t("room.connection.offline");

  const message = isConnected
    ? t("room.connection.connected")
    : debouncedState === ConnectionState.CONNECTING
      ? t("room.connection.connecting")
      : disconnectedLabel;

  // Pick the best timestamp to display:
  // - Connected with last event → "Connected · last event [time]"
  // - Connected without events  → "Connected [time] (i.e. since)"
  // - Disconnected              → "Disconnected [time] (i.e. since)"
  let timeLabel: React.ReactNode = null;
  if (isConnected && durationMsg && lastMessageAt) {
    timeLabel = (
      <DurationLabel
        label={t("room.connection.connectedLastEvent")}
        timestamp={lastMessageAt}
        durationMsg={durationMsg}
        decorationColor="decoration-slate-500"
      />
    );
  } else if (isConnected && connectedSince && connectedMsg) {
    timeLabel = (
      <DurationLabel
        label={t("room.connection.connected")}
        timestamp={connectedSince}
        durationMsg={connectedMsg}
        decorationColor="decoration-slate-500"
      />
    );
  } else if (isDisconnected && disconnectedSince && disconnectedMsg) {
    timeLabel = (
      <DurationLabel
        label={disconnectedLabel}
        timestamp={disconnectedSince}
        durationMsg={disconnectedMsg}
        decorationColor="decoration-slate-500"
      />
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <div
        className={clsx("h-2 w-2 shrink-0 rounded-full", {
          "bg-yellow-500": debouncedState === ConnectionState.CONNECTING,
          "bg-green-500": debouncedState === ConnectionState.CONNECTED,
          "bg-red-500": isDisconnected,
        })}
      />
      {timeLabel ?? message}
      {isDisconnected && reconnect && (
        <button
          onClick={reconnect}
          className="shrink-0 rounded bg-slate-700 px-3 py-1 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-600"
        >
          {t("room.connection.reconnect")}
        </button>
      )}
    </div>
  );
}
