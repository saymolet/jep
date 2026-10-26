import * as Tabs from "@radix-ui/react-tabs";

import { useTranslation } from "~/i18n";
import { WagerHintsMode } from "~/models/user-settings";
import { useWagerHintsSettings } from "~/utils/user-settings";

const WAGER_HINTS_OPTIONS = [
  { value: WagerHintsMode.Show, label: "common.wagerHints.show" },
  { value: WagerHintsMode.TapToReveal, label: "common.wagerHints.tapToReveal" },
  { value: WagerHintsMode.Never, label: "common.wagerHints.never" },
] as const;

const wagerHintsModes = new Set<string>(Object.values(WagerHintsMode));
function isWagerHintsMode(v: string): v is WagerHintsMode {
  return wagerHintsModes.has(v);
}

const themes = {
  light: {
    label: "text-sm text-ink-600",
    list: "bg-paper border border-ink-300 hover:border-blue-500",
    trigger:
      "text-ink-600 hover:bg-blue-600/20 data-[state=active]:bg-blue-600 data-[state=active]:text-white",
  },
  dark: {
    label: "text-sm text-white opacity-70",
    list: "bg-white/10 border border-white/20 hover:border-blue-500/60",
    trigger:
      "text-slate-300 hover:bg-blue-600/20 data-[state=active]:bg-blue-600 data-[state=active]:text-white",
  },
};

export default function WagerHintsControl({
  theme = "light",
}: {
  theme?: "light" | "dark";
} = {}) {
  const { wagerHints, setWagerHints } = useWagerHintsSettings();
  const { t } = useTranslation();
  const styles = themes[theme];

  return (
    <div className="flex flex-col gap-1">
      <span className={styles.label}>{t("common.wagerHints")}</span>
      <Tabs.Root
        value={wagerHints}
        onValueChange={(v) => {
          if (isWagerHintsMode(v)) setWagerHints(v);
        }}
      >
        <Tabs.List
          className={`flex w-fit overflow-hidden rounded-lg shadow-sm transition-colors ${styles.list}`}
        >
          {WAGER_HINTS_OPTIONS.map((opt) => (
            <Tabs.Trigger
              key={opt.value}
              value={opt.value}
              className={`px-3 py-1.5 text-sm transition-colors ${styles.trigger}`}
            >
              {t(opt.label)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>
    </div>
  );
}
