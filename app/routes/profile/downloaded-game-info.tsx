import * as React from "react";

import Button from "~/components/button";
import Dialog from "~/components/dialog";
import * as DropdownMenu from "~/components/dropdown-menu";
import { ExclamationTriangle, Trash } from "~/components/icons";
import StyledLink from "~/components/link";
import LocalDate from "~/components/local-date";
import { useTranslation } from "~/i18n";
import type { CachedGame } from "~/utils/offline-storage";
import {
  deleteCachedGame,
  deleteSavedSoloState,
} from "~/utils/offline-storage";

function RemoveDownloadModal({
  isOpen,
  onClickClose,
  onConfirm,
  gameTitle,
}: {
  isOpen: boolean;
  onClickClose: () => void;
  onConfirm: () => void;
  gameTitle: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen={isOpen}
      title={
        <div className="flex items-center gap-4">
          <ExclamationTriangle title={t("home.warning")} className="h-8 w-8" />
          <p>{t("home.removeDownload")}</p>
        </div>
      }
      onClose={onClickClose}
      description={t("home.removeDownloadDescription", { title: gameTitle })}
    >
      <Dialog.Footer>
        <Button onClick={onClickClose} type="button">
          {t("home.cancel")}
        </Button>
        <Button variant="danger" onClick={onConfirm} type="button">
          {t("home.removeDownload")}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}

export function DownloadedGameInfo({
  cachedGame,
  onRemoved,
}: {
  cachedGame: CachedGame;
  onRemoved: () => void;
}) {
  const { t } = useTranslation();
  const [showModal, setShowModal] = React.useState(false);

  async function handleRemove() {
    setShowModal(false);
    await deleteCachedGame(cachedGame.id);
    await deleteSavedSoloState(cachedGame.id);
    onRemoved();
  }

  return (
    <li>
      <StyledLink to={`/game/${cachedGame.id}/solo`}>
        {cachedGame.title}
      </StyledLink>{" "}
      {t("profile.byAuthor", { author: cachedGame.author })}{" "}
      <span className="text-sm text-slate-500">
        {/* Downloads are read from IndexedDB after hydration, so this is the
            viewer's local date. */}
        <LocalDate date={cachedGame.cachedAt} />
      </span>
      <RemoveDownloadModal
        isOpen={showModal}
        onClickClose={() => setShowModal(false)}
        onConfirm={handleRemove}
        gameTitle={cachedGame.title}
      />
      <div className="ml-2 inline-flex items-center gap-1 align-middle">
        <DropdownMenu.Root>
          <DropdownMenu.MoreActionsTrigger />
          <DropdownMenu.Portal>
            <DropdownMenu.Content>
              <DropdownMenu.Item
                asChild
                onSelect={(e: Event) => e.preventDefault()}
              >
                <DropdownMenu.Action onClick={() => setShowModal(true)}>
                  <Trash className="absolute left-0 m-1 h-5 w-5 text-red-600 group-hover:text-red-700" />
                  <p className="pl-7">{t("home.removeDownload")}</p>
                </DropdownMenu.Action>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </li>
  );
}
