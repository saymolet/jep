import { GlobeAmericas } from "~/components/icons";
import Link, { Anchor } from "~/components/link";
import Main from "~/components/main";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { GITHUB_URL } from "~/utils";
import { getPageMetadata } from "~/utils/seo";

import type { Route } from "./+types/about";

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = metaT(matches);
  return getPageMetadata(t("about.title"), t("common.siteDescription"));
};

export default function About() {
  const { t, rich } = useTranslation();
  return (
    <div className="max-w-full grow">
      <Main>
        <div className="mb-4 flex items-center gap-3">
          <GlobeAmericas className="h-8 w-8" />
          <h1 className="text-2xl font-semibold">{t("about.title")}</h1>
        </div>
        <p className="mb-4">{t("common.siteDescription")}</p>
        <p className="mb-4">
          {rich("about.contribute", {
            link: (c) => <Anchor href={GITHUB_URL}>{c}</Anchor>,
          })}
        </p>
        <h2 className="mt-8 mb-3 text-xl font-semibold">
          {t("about.learnMore")}
        </h2>
        <ul className="flex list-inside list-disc flex-col gap-2">
          <li>
            {rich("about.learnHowToPlay", {
              link: (c) => <Link to="/howto">{c}</Link>,
            })}
          </li>
          <li>
            {rich("about.learnUpload", {
              link: (c) => <Link to="/upload-help">{c}</Link>,
            })}
          </li>
          <li>
            {rich("about.readGuidelines", {
              link: (c) => <Link to="/community">{c}</Link>,
            })}
          </li>
        </ul>
      </Main>
    </div>
  );
}
