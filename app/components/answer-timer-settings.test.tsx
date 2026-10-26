import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ANN,
  engineFor,
  play,
  STEPS,
} from "~/components/watch/fixtures.test-helpers";
import { GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

import {
  AnswerTimerControl,
  AnswerTimerSettings,
} from "./answer-timer-settings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;
let sent: [string, Record<string, FormDataEntryValue>][] = [];

beforeEach(() => {
  sent = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

interface RenderOptions {
  locale?: Locale;
  isAdmin?: boolean;
  roomId?: number;
  /** Render the header control instead of the settings. */
  control?: boolean;
  userId?: string;
}

function render(
  state: State,
  {
    locale = "en",
    isAdmin = true,
    roomId = 7,
    control = false,
    userId = ANN,
  }: RenderOptions = {},
) {
  const engine = engineFor(state);
  const Component = control ? AnswerTimerControl : AnswerTimerSettings;
  const Stub = createRoutesStub([
    {
      path: "/play",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            <Component roomId={roomId} userId={userId} isAdmin={isAdmin} />
          </GameEngineContext.Provider>
        </I18nProvider>
      ),
    },
    {
      path: "/room/:roomId/:verb",
      action: async ({ request, params }) => {
        sent.push([
          params.verb ?? "",
          Object.fromEntries(await request.formData()),
        ]);
        return null;
      },
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/play"]} />));
}

/** The answer time options (the first group of the room timers). */
function options(group = "answer-time-options") {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>(
      `[data-testid="${group}"] [role="radio"]`,
    ),
  );
}

/** The fields every settings request sends besides the changed one. */
const DEFAULTS = {
  answerTimeSec: "0",
  autoWrongOnTimeout: "true",
  readTimeSec: "auto",
  buzzWindowSec: "5",
  finalAnswerTimeSec: "30",
  wagerTimeSec: "0",
};

function checkbox() {
  return container.querySelector<HTMLInputElement>('input[type="checkbox"]');
}

describe("AnswerTimerSettings", () => {
  it("offers Off and 10-60 seconds, Off by default", () => {
    render(play(STEPS.join));
    expect(options().map((o) => o.textContent)).toEqual([
      "Off",
      "10 s",
      "15 s",
      "20 s",
      "30 s",
      "60 s",
    ]);
    expect(options()[0].getAttribute("aria-checked")).toBe("true");
    // Auto-mark only matters with a timer.
    expect(checkbox()?.disabled).toBe(true);
    expect(checkbox()?.checked).toBe(true);
  });

  it("saves a new answer time", async () => {
    render(play(STEPS.join));
    await act(async () => {
      options()[2].click();
    });
    expect(sent).toEqual([
      ["settings", { userId: ANN, ...DEFAULTS, answerTimeSec: "15" }],
    ]);
  });

  it("can't be changed while a question is open", () => {
    render(play(STEPS.join, STEPS.start, STEPS.chooseFirst));
    expect(options().every((o) => o.disabled)).toBe(true);
    expect(container.textContent).toContain(
      "The timers can be changed between questions",
    );
  });

  it("is in Ukrainian", () => {
    render(play(STEPS.join), { locale: "uk" });
    expect(container.textContent).toContain("Час на відповідь");
    expect(options()[0].textContent).toBe("Вимк.");
    expect(options()[1].textContent).toBe("10 с");
    expect(container.textContent).toContain(
      "Зараховувати як неправильну, коли час вийде",
    );
  });
});

describe("room timers", () => {
  it("offers each timer with today's defaults selected", () => {
    render(play(STEPS.join));
    const labels = (group: string) => options(group).map((o) => o.textContent);
    const selected = (group: string) =>
      options(group).find((o) => o.getAttribute("aria-checked") === "true")
        ?.textContent;
    expect(labels("read-time-settings")).toEqual([
      "Auto",
      "0 s",
      "1 s",
      "2 s",
      "3 s",
      "5 s",
      "10 s",
      "15 s",
      "20 s",
      "30 s",
      "45 s",
      "60 s",
    ]);
    expect(selected("read-time-settings")).toBe("Auto");
    expect(labels("buzz-window-settings")).toEqual([
      "3 s",
      "5 s",
      "7 s",
      "10 s",
      "15 s",
      "20 s",
    ]);
    expect(selected("buzz-window-settings")).toBe("5 s");
    expect(labels("final-answer-time-settings")).toEqual([
      "No limit",
      "15 s",
      "30 s",
      "45 s",
      "60 s",
      "90 s",
      "120 s",
    ]);
    expect(selected("final-answer-time-settings")).toBe("30 s");
    expect(labels("wager-time-settings")).toEqual([
      "No limit",
      "15 s",
      "30 s",
      "60 s",
    ]);
    expect(selected("wager-time-settings")).toBe("No limit");
  });

  it.each([
    ["read-time-settings", 1, { readTimeSec: "0" }],
    ["buzz-window-settings", 0, { buzzWindowSec: "3" }],
    ["final-answer-time-settings", 6, { finalAnswerTimeSec: "120" }],
    ["final-answer-time-settings", 0, { finalAnswerTimeSec: "0" }],
    ["wager-time-settings", 1, { wagerTimeSec: "15" }],
  ])("saves %s", async (group, index, change) => {
    render(play(STEPS.join));
    await act(async () => {
      options(group)[index].click();
    });
    expect(sent).toEqual([
      ["settings", { userId: ANN, ...DEFAULTS, ...change }],
    ]);
  });

  it("keeps the other values when one changes", async () => {
    const state = {
      ...play(STEPS.join),
      answerTimeSec: 15,
      readTimeSec: 0,
      buzzWindowSec: 3,
    };
    render(state);
    await act(async () => {
      options("wager-time-settings")[3].click();
    });
    expect(sent).toEqual([
      [
        "settings",
        {
          ...DEFAULTS,
          userId: ANN,
          answerTimeSec: "15",
          readTimeSec: "0",
          buzzWindowSec: "3",
          wagerTimeSec: "60",
        },
      ],
    ]);
  });

  it("are read-only for players, in Ukrainian", () => {
    const state = { ...play(STEPS.join), buzzWindowSec: 10, wagerTimeSec: 30 };
    render(state, { isAdmin: false, locale: "uk" });
    expect(container.textContent).toContain("Таймери кімнати");
    expect(container.textContent).toContain("Час на читання");
    expect(container.textContent).toContain("Час на ставку");
    expect(options("read-time-settings")[0].textContent).toBe("Авто");
    expect(options("wager-time-settings")[0].textContent).toBe("Без обмеження");
    const all = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    expect(all.every((o) => o.disabled)).toBe(true);
    expect(
      options("buzz-window-settings").find(
        (o) => o.getAttribute("aria-checked") === "true",
      )?.textContent,
    ).toBe("10 с");
  });
});

describe("AnswerTimerSettings for everyone but the admin", () => {
  it("shows the values read-only", () => {
    let state = play(STEPS.join);
    state = { ...state, answerTimeSec: 15, autoWrongOnTimeout: false };
    render(state, { isAdmin: false });
    expect(options().every((o) => o.disabled)).toBe(true);
    expect(options()[2].getAttribute("aria-checked")).toBe("true");
    expect(checkbox()?.disabled).toBe(true);
    expect(checkbox()?.checked).toBe(false);
    expect(container.textContent).toContain("Only the admin can change this.");
  });

  it("sends nothing on a click", async () => {
    render(play(STEPS.join), { isAdmin: false });
    await act(async () => {
      options()[2].click();
    });
    expect(sent).toEqual([]);
  });

  it("says so in Ukrainian", () => {
    render(play(STEPS.join), { isAdmin: false, locale: "uk" });
    expect(container.textContent).toContain(
      "Змінити це може лише адміністратор.",
    );
  });

  it("lets the admin change them without playing", async () => {
    render(play(STEPS.join), { userId: "admin-visitor" });
    await act(async () => {
      options()[1].click();
    });
    expect(sent).toEqual([
      [
        "settings",
        { userId: "admin-visitor", ...DEFAULTS, answerTimeSec: "10" },
      ],
    ]);
  });

  it("lets the solo player change them", async () => {
    render(play(STEPS.join), { isAdmin: false, roomId: -1 });
    expect(options().some((o) => !o.disabled)).toBe(true);
    expect(container.textContent).not.toContain("Only the admin");
  });
});

describe("AnswerTimerControl", () => {
  function readOnly() {
    return container.querySelector('[data-testid="answer-time-readonly"]');
  }

  it("is a button that opens the settings for the admin", () => {
    render(play(STEPS.join), { control: true });
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("Room timers");
    expect(button?.textContent).toContain("Off");
    expect(readOnly()).toBeNull();
  });

  it("only shows the value to everyone else", () => {
    const state = { ...play(STEPS.join), answerTimeSec: 15 };
    render(state, { control: true, isAdmin: false });
    expect(container.querySelector("button")).toBeNull();
    expect(readOnly()?.textContent).toContain("15 s");
    expect(readOnly()?.getAttribute("title")).toBe(
      "Answer time: 15 s. Only the admin can change this.",
    );
  });

  it("only shows the value in Ukrainian", () => {
    const state = { ...play(STEPS.join), answerTimeSec: 15 };
    render(state, { control: true, isAdmin: false, locale: "uk" });
    expect(readOnly()?.textContent).toContain("15 с");
    expect(readOnly()?.getAttribute("title")).toBe(
      "Час на відповідь: 15 с. Змінити це може лише адміністратор.",
    );
  });

  it("stays a button in solo play", () => {
    render(play(STEPS.join), { control: true, isAdmin: false, roomId: -1 });
    expect(container.querySelector("button")).not.toBeNull();
    expect(readOnly()).toBeNull();
  });
});
