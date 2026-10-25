import { useTranslation } from "~/i18n";

/** WatcherCount shows how many people watch the room without playing
 * (Realtime presence). Hidden when nobody does. */
export function WatcherCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <span className={className} data-testid="watcher-count">
      <span aria-hidden>👁 </span>
      {t("watch.watchers", { count })}
    </span>
  );
}

/** SpectatorBar is shown to a visitor who chose "Just watch": a small
 * "Watching" badge and a button to join the game after all. It floats above
 * the board and the question so it is always reachable. */
export function SpectatorBar({
  onJoin,
  watchers,
}: {
  onJoin: () => void;
  watchers: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full bg-blue-1000/90 py-1 pr-1 pl-3 text-sm text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm"
      data-testid="spectator-bar"
      title={t("watch.spectatorHint")}
    >
      <span className="flex items-center gap-1 font-semibold">
        <span aria-hidden>👁</span>
        {t("watch.watching")}
      </span>
      <WatcherCount
        count={watchers}
        className="hidden text-slate-300 sm:inline"
      />
      <button
        type="button"
        onClick={onJoin}
        className="rounded-full bg-yellow-1000 px-3 py-1.5 font-semibold text-blue-1000 transition-colors hover:bg-yellow-300 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
      >
        {t("room.joinGame")}
      </button>
    </div>
  );
}
