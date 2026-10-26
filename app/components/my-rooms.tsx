import clsx from "clsx";
import { Link } from "react-router";

import { PlayerList } from "~/components/active-rooms";
import { Play } from "~/components/icons";
import { useTranslation } from "~/i18n";
import { formatTimeAgo } from "~/models/active-rooms";
import type { MyRoom } from "~/models/my-rooms";
import { formatDollars } from "~/utils";

/** MyRoomsList is "Your games in progress" on the home page: the rooms the
 * current user plays in that aren't over, one tap back into each. Renders
 * nothing when there are none. Light site UI, so it uses the theme tokens
 * (ink / paper / accent) and looks right in Classic and Dark. */
export function MyRoomsList({ rooms }: { rooms: MyRoom[] }) {
  const { t } = useTranslation();
  if (rooms.length === 0) return null;

  return (
    <section
      aria-labelledby="my-rooms-heading"
      className="mb-6 flex flex-col"
      data-testid="my-rooms"
    >
      <h2
        id="my-rooms-heading"
        className="mb-2 text-lg font-semibold text-ink-900"
      >
        {t("home.yourGames")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rooms.map((room) => (
          <li key={room.id}>
            <Link
              to={`/room/${room.roomName}`}
              className="flex h-full items-center gap-3 rounded-lg border border-ink-300 bg-paper p-3 text-sm shadow-sm transition-colors hover:border-accent-soft focus:ring-2 focus:ring-accent-soft focus:outline-none"
            >
              <div className="flex min-w-0 grow flex-col gap-1.5">
                <strong
                  className="truncate text-base text-ink-900"
                  title={room.gameTitle}
                >
                  {room.gameTitle}
                </strong>
                <span className="text-xs text-ink-500">
                  {t("home.yourRoomActivity", {
                    room: room.roomName,
                    ago: formatTimeAgo(room.minutesAgo, t),
                  })}
                </span>
                <div className="text-ink-700">
                  <PlayerList players={room.players} />
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="sr-only">{t("home.yourScore")}</span>
                <span
                  className={clsx(
                    "font-inter text-lg font-bold",
                    room.score < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-ink-900",
                  )}
                  data-testid="my-room-score"
                >
                  {formatDollars(room.score)}
                </span>
                {room.players.length > 1 ? (
                  <span className="text-xs text-ink-500">
                    {t("home.yourRank", {
                      rank: room.rank,
                      total: room.players.length,
                    })}
                  </span>
                ) : null}
                <span className="flex items-center gap-1 font-medium text-accent">
                  <Play className="h-4 w-4" />
                  {t("home.continue")}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
