import * as React from "react";
import { Link } from "react-router";

import Button from "~/components/button";
import Dialog from "~/components/dialog";
import * as DropdownMenu from "~/components/dropdown-menu";
import {
  ArrowDownTray,
  ExclamationTriangle,
  LoadingSpinner,
  Play,
  Trash,
} from "~/components/icons";
import { useTranslation } from "~/i18n";
import type { DbGame } from "~/models/game.server";

export type DownloadStatus = "none" | "downloading" | "downloaded";

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

export default function OfflineMenu({
  game,
  downloadStatus,
  onDownload,
  onRemove,
}: {
  game: DbGame;
  downloadStatus: DownloadStatus;
  onDownload: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const [showRemoveModal, setShowRemoveModal] = React.useState(false);

  return (
    <>
      <RemoveDownloadModal
        isOpen={showRemoveModal}
        onClickClose={() => setShowRemoveModal(false)}
        onConfirm={() => {
          setShowRemoveModal(false);
          onRemove();
        }}
        gameTitle={game.title}
      />
      <DropdownMenu.Root>
        <DropdownMenu.MoreActionsTrigger onClick={(e) => e.stopPropagation()} />
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            {downloadStatus === "downloaded" ? (
              <>
                <DropdownMenu.Item asChild>
                  <Link
                    to={`/game/${game.id}/solo`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Play className="absolute left-0 m-1 h-5 w-5" />
                    <p className="pl-7">{t("home.playOffline")}</p>
                  </Link>
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  asChild
                  onSelect={(e: Event) => e.preventDefault()}
                >
                  <DropdownMenu.Action
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRemoveModal(true);
                    }}
                  >
                    <Trash className="absolute left-0 m-1 h-5 w-5 text-red-600 group-hover:text-red-700" />
                    <p className="pl-7">{t("home.removeDownload")}</p>
                  </DropdownMenu.Action>
                </DropdownMenu.Item>
              </>
            ) : (
              <DropdownMenu.Item
                asChild
                onSelect={(e: Event) => e.preventDefault()}
              >
                <DropdownMenu.Action
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload();
                  }}
                  disabled={downloadStatus === "downloading"}
                >
                  {downloadStatus === "downloading" ? (
                    <LoadingSpinner className="absolute left-0 m-1 text-white" />
                  ) : (
                    <ArrowDownTray className="absolute left-0 m-1 h-5 w-5" />
                  )}
                  <p className="pl-7">{t("home.downloadOffline")}</p>
                </DropdownMenu.Action>
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
}
