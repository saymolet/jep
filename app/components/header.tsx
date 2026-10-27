import clsx from "clsx";
import { Link as RouterLink, useMatches } from "react-router";

import CopyLinkButton from "~/components/copy-link-button";
import * as DropdownMenu from "~/components/dropdown-menu";
import LanguageSwitcher from "~/components/language-switcher";
import Link from "~/components/link";
import SoundControl from "~/components/sound";
import { ThemeMenu } from "~/components/theme-switcher";
import WagerHintsControl from "~/components/wager-hints-control";
import { useTranslation } from "~/i18n";
import type { Game } from "~/models/game.server";

function isGameLoaderData(data: unknown): data is { game: Game } {
  return typeof data === "object" && data !== null && "game" in data;
}
import { stringToHslColor } from "~/utils";
import { useGameDefaults } from "~/utils/user-settings";

import {
  ArrowTopRightOnSquare,
  ExclamationTriangle,
  Eye,
  InformationCircle,
  ShieldCheck,
} from "./icons";

/** AdminButton leads to the password-protected admin area (`/admin`, which
 * asks for the admin password first). Filled when this browser already has an
 * admin session. */
function AdminButton({ active }: { active: boolean }) {
  const { t } = useTranslation();
  const label = active ? t("header.adminActive") : t("header.admin");
  return (
    <RouterLink
      to="/admin"
      aria-label={label}
      title={label}
      data-active={active}
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors",
        active
          ? "border-white bg-white text-blue-bright hover:bg-white/80"
          : "border-white/60 text-white hover:bg-white/20",
      )}
    >
      <ShieldCheck className="h-5 w-5" />
    </RouterLink>
  );
}

function AccountButton({ user }: { user: { id: string; email: string } }) {
  const { t } = useTranslation();
  const { playerColor } = useGameDefaults();
  const backgroundColor =
    playerColor != null ? playerColor : stringToHslColor(user.id);
  return (
    <RouterLink
      to="/profile"
      className="flex items-center justify-center rounded-full p-1 transition-colors hover:bg-blue-700"
      style={{ backgroundColor }}
      aria-label={t("header.profile")}
    >
      <div className="flex h-6 w-6 items-center justify-center text-blue-1000 uppercase">
        {user.email.slice(0, 1)}
      </div>
    </RouterLink>
  );
}

function SiteLinks({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <div className={className} aria-label={t("header.learnMore")}>
      <Link variant="inverse" to="/howto">
        {t("header.howToPlay")}
      </Link>
      <Link variant="inverse" to="/upload-help">
        {t("header.uploadGame")}
      </Link>
      <Link variant="inverse" to="/about">
        {t("header.about")}
      </Link>
    </div>
  );
}

/** ROOM_PATH matches a room page, "/room/<id>-<word>" (not its summary). */
const ROOM_PATH = /^\/room\/[^/]+$/;

function GameSettings({
  game,
  url,
  pathname,
}: {
  game: Game;
  url: string;
  pathname: string;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={`flex h-6 w-6 items-center justify-center text-white hover:text-slate-300 data-[state=open]:text-slate-300`}
          aria-label={t("header.gameMenu")}
        >
          <InformationCircle className="h-6 w-6" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content>
          <DropdownMenu.Label>
            <span className="font-bold">{game.title}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Label>
            <span className="text-slate-400">
              {game.author} &middot; {game.copyright}
            </span>
          </DropdownMenu.Label>
          {game.note && (
            <DropdownMenu.Label>
              <p className="text-sm break-words">{game.note}</p>
            </DropdownMenu.Label>
          )}
          <DropdownMenu.Label>
            <span className="text-sm text-slate-400">
              {t("header.roundCount", { count: game.boards.length })}
            </span>
          </DropdownMenu.Label>

          <DropdownMenu.Separator />

          <DropdownMenu.Item asChild>
            <RouterLink
              to={`/game/${game.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowTopRightOnSquare className="absolute left-0 m-1 h-5 w-5" />
              <p className="pl-7">{t("header.gameDetails")}</p>
            </RouterLink>
          </DropdownMenu.Item>
          {ROOM_PATH.test(pathname) ? (
            <DropdownMenu.Item asChild>
              {/* The TV view opens in a new tab: on a laptop connected to a
                  TV, or copy its address to the TV's browser. */}
              <RouterLink
                to={`${pathname}/present`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Eye className="absolute left-0 m-1 h-5 w-5" />
                <p className="pl-7">{t("watch.showOnTv")}</p>
              </RouterLink>
            </DropdownMenu.Item>
          ) : null}
          <DropdownMenu.Item
            // Prevent the dropdown menu from closing
            onSelect={(e: Event) => e.preventDefault()}
          >
            <div className="w-full">
              <SoundControl />
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={(e: Event) => e.preventDefault()}>
            <div className="w-full">
              <WagerHintsControl />
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            // Prevent the dropdown menu from closing
            onSelect={(e: Event) => e.preventDefault()}
          >
            <div className="w-full">
              <CopyLinkButton url={url} text={t("header.copyRoomLink")} />
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <RouterLink to={`/report?gameId=${game.id}`}>
              <ExclamationTriangle
                title={t("header.report")}
                className="absolute left-0 m-1 h-5 w-5"
              />
              <p className="pl-7">{t("header.reportGame")}</p>
            </RouterLink>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function Header({
  user,
  BASE_URL,
  adminEnabled = false,
  isAdmin = false,
}: {
  user?: { id: string; email: string };
  BASE_URL?: string;
  /** The admin area exists (ADMIN_PASSWORD is set). */
  adminEnabled?: boolean;
  /** This browser has a valid admin session. */
  isAdmin?: boolean;
}) {
  const { t } = useTranslation();
  const matches = useMatches();
  const gameRoute = matches.find(
    (match) =>
      match.id !== "routes/game_.$gameId_" &&
      isGameLoaderData(match.loaderData),
  );
  const game =
    gameRoute && isGameLoaderData(gameRoute.loaderData)
      ? gameRoute.loaderData.game
      : undefined;
  const pathname = matches[matches.length - 1].pathname;

  return (
    <nav className="bg-header p-4" aria-label={t("header.primaryNavigation")}>
      <div className="flex items-center justify-between">
        <RouterLink to="/">
          <h1 className="font-korinna text-2xl font-bold text-white text-shadow-md">
            Jep!
          </h1>
        </RouterLink>
        <div className="flex items-center gap-2">
          {!game && (
            <SiteLinks className="mr-4 hidden items-center gap-6 sm:flex" />
          )}
          <ThemeMenu />
          <LanguageSwitcher />
          {adminEnabled ? <AdminButton active={isAdmin} /> : null}
          {/* Accounts are hidden: there is no way to log in from the UI. An
              old account session still gets its profile (and log out). */}
          {user ? <AccountButton user={user} /> : null}
          {game && (
            <GameSettings
              game={game}
              url={BASE_URL + pathname}
              pathname={pathname}
            />
          )}
        </div>
      </div>
      {!game && (
        <SiteLinks className="mt-3 flex items-center justify-center gap-5 border-t border-blue-500 pt-3 sm:hidden" />
      )}
    </nav>
  );
}
