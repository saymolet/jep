import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, type Locale } from "~/i18n";
import { ThemeProvider } from "~/theme/context";
import { parseThemeCookie, type Theme } from "~/theme/theme";
import { UserSettingsProvider } from "~/utils/user-settings";

import { ThemeSwitcher } from "./theme-switcher";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
let saved: unknown[] = [];

beforeEach(() => {
  saved = [];
  document.cookie = "theme=; Path=/; Max-Age=0";
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** App mirrors root.tsx: the theme lives in state and is rendered as
 * `data-theme` (on <html> in the real app). */
function App({ initial, loggedIn }: { initial: Theme; loggedIn: boolean }) {
  const [theme, setTheme] = React.useState(initial);
  return (
    <div data-testid="html" data-theme={theme}>
      <ThemeProvider theme={theme} onChangeTheme={setTheme}>
        <UserSettingsProvider loggedIn={loggedIn}>
          <ThemeSwitcher />
        </UserSettingsProvider>
      </ThemeProvider>
    </div>
  );
}

function render({
  initial = "classic",
  loggedIn = false,
  locale = "en",
}: { initial?: Theme; loggedIn?: boolean; locale?: Locale } = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <I18nProvider locale={locale}>
          <App initial={initial} loggedIn={loggedIn} />
        </I18nProvider>
      ),
    },
    {
      path: "/settings",
      action: async ({ request }) => {
        saved.push(await request.json());
        return { ok: true };
      },
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

function buttons() {
  return Array.from(container.querySelectorAll<HTMLButtonElement>("button"));
}

function themeAttribute() {
  return container
    .querySelector('[data-testid="html"]')
    ?.getAttribute("data-theme");
}

describe("ThemeSwitcher", () => {
  it("offers Classic, Dark and System and marks the current theme", () => {
    render({ initial: "system" });
    expect(buttons().map((b) => b.textContent)).toEqual([
      "Classic",
      "Dark",
      "System",
    ]);
    expect(buttons().map((b) => b.getAttribute("aria-pressed"))).toEqual([
      "false",
      "false",
      "true",
    ]);
  });

  it("applies the theme at once and remembers it in the cookie", () => {
    render();
    expect(themeAttribute()).toBe("classic");
    act(() => buttons()[1].click());
    expect(themeAttribute()).toBe("dark");
    expect(parseThemeCookie(document.cookie)).toBe("dark");
    expect(buttons()[1].getAttribute("aria-pressed")).toBe("true");

    act(() => buttons()[2].click());
    expect(themeAttribute()).toBe("system");
    expect(parseThemeCookie(document.cookie)).toBe("system");
  });

  it("saves the theme to the account when logged in", async () => {
    render({ loggedIn: true });
    await act(async () => {
      buttons()[1].click();
      // The settings save is debounced (500 ms).
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(saved).toEqual([{ theme: "dark" }]);
  });

  it("does not save anything when logged out", async () => {
    render();
    await act(async () => {
      buttons()[1].click();
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(saved).toEqual([]);
    expect(parseThemeCookie(document.cookie)).toBe("dark");
  });

  it("is in Ukrainian", () => {
    render({ locale: "uk" });
    expect(buttons().map((b) => b.textContent)).toEqual([
      "Класична",
      "Темна",
      "Системна",
    ]);
    expect(
      container.querySelector('[role="group"]')?.getAttribute("aria-label"),
    ).toBe("Тема");
  });
});
