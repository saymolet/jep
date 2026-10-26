import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider, type Locale } from "~/i18n";
import type { MyRoom } from "~/models/my-rooms";

import { MyRoomsList } from "./my-rooms";

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

const ROOM: MyRoom = {
  id: 42,
  roomName: "42-apple",
  gameTitle: "Space trivia",
  players: [
    { name: "Ann", color: "#ef4444", emoji: "🦊" },
    { name: "Bob", color: "#3b82f6" },
  ],
  score: -200,
  rank: 2,
  minutesAgo: 3 * 24 * 60,
};

function render(rooms: MyRoom[], locale: Locale = "en", theme = "classic") {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <div data-theme={theme}>
          <I18nProvider locale={locale}>
            <MyRoomsList rooms={rooms} />
          </I18nProvider>
        </div>
      ),
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

describe("MyRoomsList", () => {
  it("renders nothing without rooms", () => {
    render([]);
    expect(container.querySelector('[data-testid="my-rooms"]')).toBeNull();
  });

  for (const theme of ["classic", "dark"]) {
    it(`links back into each room (English, ${theme})`, () => {
      render([ROOM], "en", theme);
      const section = container.querySelector('[data-testid="my-rooms"]')!;
      expect(section.querySelector("h2")?.textContent).toBe(
        "Your games in progress",
      );
      const link = section.querySelector("a")!;
      expect(link.getAttribute("href")).toBe("/room/42-apple");
      const text = link.textContent ?? "";
      expect(text).toContain("Space trivia");
      expect(text).toContain("Room 42-apple · active 3 days ago");
      expect(text).toContain("Ann");
      expect(text).toContain("Your score");
      expect(text).toContain("-$200");
      expect(text).toContain("#2 of 2");
      expect(text).toContain("Continue");
      expect(text).not.toMatch(/home\./);
    });

    it(`is translated into Ukrainian (${theme})`, () => {
      render([ROOM], "uk", theme);
      const text = container.textContent ?? "";
      expect(text).toContain("Ваші незакінчені ігри");
      expect(text).toContain("Кімната 42-apple · активність 3 дні тому");
      expect(text).toContain("Ваш рахунок");
      expect(text).toContain("2 місце з 2");
      expect(text).toContain("Продовжити");
      expect(text).not.toMatch(/home\./);
    });
  }
});
