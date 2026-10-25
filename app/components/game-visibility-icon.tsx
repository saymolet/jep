import { Eye, EyeSlash } from "~/components/icons";
import { useTranslation } from "~/i18n";
import type { GameVisibility } from "~/models/game.server";

export function GameVisibilityTag({
  visibility,
}: {
  visibility: GameVisibility;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex items-center rounded-md border border-slate-200 bg-slate-100 px-1 text-slate-500`}
    >
      <span className="text-xs">{t(`common.visibility.${visibility}`)}</span>
      <GameVisibilityIcon variant="tag" visibility={visibility} />
    </div>
  );
}

export default function GameVisibilityIcon({
  variant,
  visibility,
}: {
  variant: "tag" | "menu";
  visibility: GameVisibility;
}) {
  const { t } = useTranslation();
  const className =
    variant === "tag"
      ? "m-1 inline-block h-3 w-3"
      : "absolute left-0 m-1 h-5 w-5";
  switch (visibility) {
    case "PUBLIC":
      return (
        <Eye
          className={"text-green-600 group-hover:text-green-700 " + className}
          title={t("common.visibility.PUBLIC")}
        />
      );
    case "PRIVATE":
      return (
        <EyeSlash
          className={className}
          title={t("common.visibility.PRIVATE")}
        />
      );
    case "UNLISTED":
      return (
        <Eye className={className} title={t("common.visibility.UNLISTED")} />
      );
  }
}
