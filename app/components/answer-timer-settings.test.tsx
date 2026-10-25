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

import { AnswerTimerSettings } from "./answer-timer-settings";

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

function render(state: State, locale: Locale = "en") {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/play",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            <AnswerTimerSettings roomId={7} userId={ANN} />
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

function options() {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
  );
}

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
      [
        "settings",
        { userId: ANN, answerTimeSec: "15", autoWrongOnTimeout: "true" },
      ],
    ]);
  });

  it("can't be changed while a question is open", () => {
    render(play(STEPS.join, STEPS.start, STEPS.chooseFirst));
    expect(options().every((o) => o.disabled)).toBe(true);
    expect(container.textContent).toContain(
      "The answer time can be changed between questions",
    );
  });

  it("is in Ukrainian", () => {
    render(play(STEPS.join), "uk");
    expect(container.textContent).toContain("Час на відповідь");
    expect(options()[0].textContent).toBe("Вимк.");
    expect(options()[1].textContent).toBe("10 с");
    expect(container.textContent).toContain(
      "Зараховувати як неправильну, коли час вийде",
    );
  });
});
