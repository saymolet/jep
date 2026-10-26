import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";

import { Check, ComputerDesktop, Moon, Sun } from "~/components/icons";
import { useTranslation } from "~/i18n";
import { useTheme } from "~/theme/context";
import { THEMES, type Theme } from "~/theme/theme";
import { useSetTheme } from "~/utils/user-settings";

const THEME_ICONS: Record<Theme, typeof Sun> = {
  classic: Sun,
  dark: Moon,
  system: ComputerDesktop,
};

function useThemeLabels() {
  const { t } = useTranslation();
  return {
    classic: t("common.theme.classic"),
    dark: t("common.theme.dark"),
    system: t("common.theme.system"),
  } satisfies Record<Theme, string>;
}

/** ThemeSwitcher picks the color theme with three buttons (Classic / Dark /
 * System), for light pages such as the settings. */
export function ThemeSwitcher() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const setTheme = useSetTheme();
  const labels = useThemeLabels();

  return (
    <div
      role="group"
      aria-label={t("common.theme")}
      className="flex w-fit max-w-full shrink-0 items-center overflow-hidden rounded-md border border-ink-300 bg-paper text-sm font-medium text-ink-600 shadow-sm"
    >
      {THEMES.map((option) => {
        const active = option === theme;
        const Icon = THEME_ICONS[option];
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              if (!active) setTheme(option);
            }}
            className={clsx(
              "flex min-h-10 items-center gap-1.5 px-3 py-1 transition-colors",
              active ? "bg-blue-600 text-white" : "hover:bg-blue-600/20",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

/** ThemeMenu is the compact theme switcher for the blue header: an icon
 * button showing the current theme, opening a menu with the three themes. */
export function ThemeMenu() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const setTheme = useSetTheme();
  const labels = useThemeLabels();
  const Icon = THEME_ICONS[theme];

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("common.themeCurrent", { name: labels[theme] })}
          title={t("common.theme")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/60 text-white transition-colors hover:bg-white/20 data-[state=open]:bg-white/20"
        >
          <Icon className="h-5 w-5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={5}
          className="z-50 w-44 rounded-md bg-blue-1000 p-1 text-white shadow-md will-change-[opacity,transform] data-[side=bottom]:animate-slide-up-and-fade data-[side=top]:animate-slide-down-and-fade"
        >
          <DropdownMenu.Label className="px-2 py-1 text-xs text-slate-300">
            {t("common.theme")}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup
            value={theme}
            onValueChange={(value) => {
              const next = THEMES.find((option) => option === value);
              if (next && next !== theme) setTheme(next);
            }}
          >
            {THEMES.map((option) => {
              const OptionIcon = THEME_ICONS[option];
              return (
                <DropdownMenu.RadioItem
                  key={option}
                  value={option}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-200 outline-none select-none data-[highlighted]:bg-white/10 data-[state=checked]:text-white"
                >
                  <OptionIcon className="h-5 w-5 shrink-0" />
                  <span className="grow">{labels[option]}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check className="h-4 w-4" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Arrow className="fill-blue-1000" />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
