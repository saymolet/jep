import { CheckCircle, MinusCircle } from "~/components/icons";
import { useTranslation } from "~/i18n";

export default function SolveIcon({ solved }: { solved: boolean }) {
  const { t } = useTranslation();
  return solved ? (
    <CheckCircle
      className="inline h-5 w-5 text-slate-400"
      title={t("common.solved")}
    />
  ) : (
    <MinusCircle
      className="inline h-5 w-5 text-yellow-600"
      title={t("common.inProgress")}
    />
  );
}
