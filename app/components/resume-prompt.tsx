import Button from "~/components/button";
import Dialog from "~/components/dialog";
import { useTranslation } from "~/i18n";

export default function ResumePrompt({
  onResume,
  onNewGame,
}: {
  onResume: () => void;
  onNewGame: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      isOpen
      title={t("common.resume.title")}
      description={t("common.resume.description")}
    >
      <Dialog.Footer>
        <Button onClick={onNewGame} type="button">
          {t("common.resume.newGame")}
        </Button>
        <Button variant="primary" onClick={onResume} type="button" autoFocus>
          {t("common.resume.resumeGame")}
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
