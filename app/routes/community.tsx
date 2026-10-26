import { ButtonLink } from "~/components/button";
import { Anchor } from "~/components/link";
import Main from "~/components/main";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getPageMetadata } from "~/utils/seo";

import type { Route } from "./+types/community";

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = metaT(matches);
  return getPageMetadata(
    t("community.metaTitle"),
    t("community.metaDescription"),
  );
};

const SPORCLE = "https://www.sporcle.com/community/";

const INAPPROPRIATE_ITEMS = [
  "community.item.nsfw",
  "community.item.discrimination",
  "community.item.misinformation",
  "community.item.spam",
  "community.item.attacks",
  "community.item.reportAbuse",
  "community.item.selfHarm",
  "community.item.violence",
  "community.item.children",
] as const;

export default function Login() {
  const { t, rich } = useTranslation();
  return (
    <div className="max-w-full grow">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">{t("community.title")}</h1>
        <h2 className="mt-8 mb-4 text-xl font-semibold">
          {t("community.summary")}
        </h2>
        <p className="mb-4">
          {t("community.bePolite")}
          <br className="mb-1" />
          {t("community.reportHow")}
        </p>
        <ButtonLink to="/report" variant="primary">
          {t("community.reportGame")}
        </ButtonLink>
        <h2 className="mt-8 mb-4 text-xl font-semibold">
          {t("community.moderationTitle")}
        </h2>
        <p className="mb-2">{t("community.gameContent")}</p>
        <ul className="list-inside list-disc">
          <li>
            {rich("community.rule.noInappropriate", {
              em: (c) => <em>{c}</em>,
            })}
          </li>
          <li>{t("community.rule.remove")}</li>
          <li>{t("community.rule.ban")}</li>
        </ul>
        <h3 className="mt-8 mb-4 text-lg font-semibold">
          {t("community.inappropriateTitle")}
        </h3>
        <p className="mb-2">{t("community.inappropriateIntro")}</p>
        <ul className="mb-4 list-inside list-disc">
          {INAPPROPRIATE_ITEMS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="text-sm text-ink-500">
          {rich("community.basedOn", {
            link: (c) => <Anchor href={SPORCLE}>{c}</Anchor>,
          })}
        </p>
      </Main>
    </div>
  );
}
