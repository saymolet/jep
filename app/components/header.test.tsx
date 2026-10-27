import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, type Locale } from "~/i18n";
import { ThemeProvider } from "~/theme/context";
import { UserSettingsProvider } from "~/utils/user-settings";

import Header from "./header";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render({
  adminEnabled = true,
  isAdmin = false,
  user,
  locale = "en",
}: {
  adminEnabled?: boolean;
  isAdmin?: boolean;
  user?: { id: string; email: string };
  locale?: Locale;
} = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <I18nProvider locale={locale}>
          <ThemeProvider theme="classic" onChangeTheme={() => {}}>
            <UserSettingsProvider loggedIn={!!user}>
              <Header
                user={user}
                adminEnabled={adminEnabled}
                isAdmin={isAdmin}
              />
            </UserSettingsProvider>
          </ThemeProvider>
        </I18nProvider>
      ),
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

function adminLink() {
  return container.querySelector<HTMLAnchorElement>('a[href="/admin"]');
}

function links() {
  return Array.from(container.querySelectorAll<HTMLAnchorElement>("a"));
}

describe("Header", () => {
  it("links to the admin area with a label and a tooltip", () => {
    render();
    const link = adminLink();
    expect(link?.getAttribute("aria-label")).toBe("Admin");
    expect(link?.getAttribute("title")).toBe("Admin");
    expect(link?.dataset.active).toBe("false");
  });

  it("shows the active state for a logged-in admin", () => {
    render({ isAdmin: true });
    const link = adminLink();
    expect(link?.getAttribute("aria-label")).toBe("Admin panel");
    expect(link?.getAttribute("title")).toBe("Admin panel");
    expect(link?.dataset.active).toBe("true");
  });

  it("hides the admin button when the admin area is off", () => {
    render({ adminEnabled: false, isAdmin: false });
    expect(adminLink()).toBeNull();
  });

  it("has no way to log in or sign up", () => {
    render();
    const targets = links().map((a) => a.getAttribute("href") ?? "");
    expect(targets.some((href) => /\/(login|signup)/.test(href))).toBe(false);
    expect(container.textContent).not.toMatch(/log in|sign up/i);
  });

  it("keeps the profile menu for an already logged-in account", () => {
    render({ user: { id: "u1", email: "player@example.com" } });
    expect(
      container.querySelector('a[href="/profile"]')?.getAttribute("aria-label"),
    ).toBe("Profile");
  });

  it("is in Ukrainian", () => {
    render({ locale: "uk" });
    expect(adminLink()?.getAttribute("aria-label")).toBe("Адміністратор");
    expect(container.textContent).not.toContain("Увійти");

    act(() => root.unmount());
    root = createRoot(container);
    render({ locale: "uk", isAdmin: true });
    expect(adminLink()?.getAttribute("aria-label")).toBe(
      "Панель адміністратора",
    );
  });
});
