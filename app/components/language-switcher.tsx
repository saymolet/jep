import clsx from "clsx";

import { LOCALE_LABELS, LOCALES, useTranslation } from "~/i18n";
import { useSetLanguage } from "~/utils/user-settings";

/** LanguageSwitcher switches the UI language ("EN / УКР"). `inverse` is for
 * the blue header, `light` for light pages such as the settings. */
export default function LanguageSwitcher({
  variant = "inverse",
}: {
  variant?: "inverse" | "light";
}) {
  const { locale, t } = useTranslation();
  const setLanguage = useSetLanguage();

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={clsx(
        "flex shrink-0 items-center overflow-hidden rounded-md border text-xs font-semibold",
        variant === "inverse"
          ? "border-white/60 text-white"
          : "w-fit border-slate-300 bg-white text-slate-600 shadow-sm",
      )}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            title={LOCALE_LABELS[option].name}
            onClick={() => {
              if (!active) setLanguage(option);
            }}
            className={clsx(
              "min-h-8 min-w-10 px-2 py-1 transition-colors",
              active
                ? variant === "inverse"
                  ? "bg-white text-blue-bright"
                  : "bg-blue-600 text-white"
                : variant === "inverse"
                  ? "hover:bg-white/20"
                  : "hover:bg-blue-600/20",
            )}
          >
            {LOCALE_LABELS[option].short}
          </button>
        );
      })}
    </div>
  );
}
