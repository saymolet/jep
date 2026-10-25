import { Eye, EyeSlash } from "~/components/icons";
import { useTranslation } from "~/i18n";

export default function ShowPasswordButton({
  showPassword,
  onClick,
}: {
  showPassword: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={"absolute top-0.5 right-0 p-2"}
      onClick={onClick}
    >
      {showPassword ? (
        <EyeSlash className="h-5 w-5" title={t("common.hidePassword")} />
      ) : (
        <Eye className="h-5 w-5" title={t("common.showPassword")} />
      )}
    </button>
  );
}
