import * as React from "react";
import type { FetcherWithComponents } from "react-router";
import { Link } from "react-router";

import Button from "~/components/button";
import CopyLinkButton from "~/components/copy-link-button";
import Dialog from "~/components/dialog";
import * as DropdownMenu from "~/components/dropdown-menu";
import GameVisibilityIcon, {
  GameVisibilityTag,
} from "~/components/game-visibility-icon";
import {
  ArrowDownTray,
  ArrowTopRightOnSquare,
  ExclamationTriangle,
  Trash,
} from "~/components/icons";
import StyledLink from "~/components/link";
import LocalDate from "~/components/local-date";
import { useTranslation } from "~/i18n";
import type { DbGame, GameVisibility } from "~/models/game.server";

function ChangeVisibilityItem({
  fetcher,
  gameId,
  visibility,
}: {
  fetcher: FetcherWithComponents<never>;
  gameId: string;
  visibility: GameVisibility;
}) {
  const { t } = useTranslation();
  return (
    <DropdownMenu.Item
      asChild
      // Prevent the dropdown menu from closing
      onSelect={(e: Event) => e.preventDefault()}
    >
      <fetcher.Form method="PATCH" action={`/game/${gameId}`}>
        <input type="hidden" readOnly name="visibility" value={visibility} />
        <DropdownMenu.Action>
          <GameVisibilityIcon variant="menu" visibility={visibility} />
          <p className="pl-7">{t(`profile.makeVisibility.${visibility}`)}</p>
        </DropdownMenu.Action>
      </fetcher.Form>
    </DropdownMenu.Item>
  );
}

function DeleteGameModal({
  fetcher,
  isOpen,
  onClickClose,
  game,
}: {
  fetcher: FetcherWithComponents<never>;
  isOpen: boolean;
  onClickClose: () => void;
  game: DbGame;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen={isOpen}
      title={
        <div className="flex items-center gap-4">
          <ExclamationTriangle title={t("home.warning")} className="h-8 w-8" />
          <p>{t("profile.deleteGame")}</p>
        </div>
      }
      onClose={onClickClose}
      description={t("profile.deleteGameDescription", { title: game.title })}
    >
      <fetcher.Form method="DELETE" action={`/game/${game.id}`}>
        <Dialog.Footer>
          <Button autoFocus onClick={onClickClose} type="button">
            {t("home.cancel")}
          </Button>
          <Button variant="danger" type="submit">
            {t("profile.deleteGame")}
          </Button>
        </Dialog.Footer>
      </fetcher.Form>
    </Dialog>
  );
}

export function GameInfo({
  BASE_URL,
  game,
  fetcher,
}: {
  BASE_URL: string;
  game: DbGame;
  fetcher: FetcherWithComponents<never>;
}) {
  const { t } = useTranslation();
  const url = BASE_URL + "/game/" + game.id + "/play";

  const [showModal, setShowModal] = React.useState(false);

  return (
    <li>
      <StyledLink to={`/game/${game.id}/play`}>{game.title}</StyledLink>{" "}
      {t("profile.byAuthor", { author: game.author })}{" "}
      <span className="text-sm text-ink-500">
        <LocalDate date={game.created_at} />
      </span>
      <DeleteGameModal
        isOpen={showModal}
        fetcher={fetcher}
        onClickClose={() => setShowModal(false)}
        game={game}
      />
      <div className="ml-2 inline-flex items-center gap-1">
        <GameVisibilityTag visibility={game.visibility} />
        <CopyLinkButton url={url} />
        <DropdownMenu.Root>
          <DropdownMenu.MoreActionsTrigger />
          <DropdownMenu.Portal>
            <DropdownMenu.Content>
              <DropdownMenu.Item asChild>
                <Link
                  to={`/game/${game.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ArrowTopRightOnSquare className="absolute left-0 m-1 h-5 w-5" />
                  <p className="pl-7">{t("header.gameDetails")}</p>
                </Link>
              </DropdownMenu.Item>
              {game.visibility === "PUBLIC" ? null : (
                <ChangeVisibilityItem
                  gameId={game.id}
                  visibility="PUBLIC"
                  fetcher={fetcher}
                />
              )}
              {game.visibility === "UNLISTED" ? null : (
                <ChangeVisibilityItem
                  gameId={game.id}
                  visibility="UNLISTED"
                  fetcher={fetcher}
                />
              )}
              {game.visibility === "PRIVATE" ? null : (
                <ChangeVisibilityItem
                  gameId={game.id}
                  visibility="PRIVATE"
                  fetcher={fetcher}
                />
              )}
              <DropdownMenu.Item asChild>
                <Link to={`/game/${game.id}/json`} reloadDocument>
                  <ArrowDownTray className="absolute left-0 m-1 h-5 w-5" />
                  <p className="pl-7">{t("profile.downloadJsonFile")}</p>
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item
                asChild
                // Prevent the dropdown menu from closing
                onSelect={(e: Event) => e.preventDefault()}
              >
                <DropdownMenu.Action onClick={() => setShowModal(true)}>
                  <Trash className="absolute left-0 m-1 h-5 w-5 text-red-600 group-hover:text-red-700" />
                  <p className="pl-7">{t("profile.deleteGame")}</p>
                </DropdownMenu.Action>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </li>
  );
}
