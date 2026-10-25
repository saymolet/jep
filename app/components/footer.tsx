import { useMatches } from "react-router";

import Link from "~/components/link";
import { useTranslation } from "~/i18n";

export default function Footer() {
  const { t } = useTranslation();
  const matches = useMatches();
  const isInGame = matches.some(
    (match) =>
      match.id !== "routes/game_.$gameId_" &&
      match.loaderData &&
      typeof match.loaderData === "object" &&
      "game" in match.loaderData,
  );

  if (!isInGame) return null;

  return (
    <footer className="flex justify-center bg-blue-1000 py-4">
      <div className="flex items-center gap-2 text-slate-300">
        <Link
          variant="inverse"
          to="/about"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("header.about")}
        </Link>
        <span>&middot;</span>
        <Link
          variant="inverse"
          to="/howto"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("header.howToPlay")}
        </Link>
        <span>&middot;</span>
        <Link
          variant="inverse"
          to="/community"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t("header.communityGuidelines")}
        </Link>
      </div>
    </footer>
  );
}
