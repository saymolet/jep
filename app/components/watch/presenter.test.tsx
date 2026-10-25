import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

import {
  engineFor,
  play,
  playUntil,
  STEPS,
  WATCH_GAME,
} from "./fixtures.test-helpers";
import { Presenter } from "./presenter";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const JOIN_URL = "http://localhost:3000/room/7-apple";

let container: HTMLDivElement;
let root: Root;
/** Any room action the page sends (it must never send one). */
const roomAction = vi.fn(() => null);

beforeEach(() => {
  vi.useFakeTimers();
  roomAction.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render(state: State, locale: Locale = "en") {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/present",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            <Presenter game={WATCH_GAME} joinUrl={JOIN_URL} />
          </GameEngineContext.Provider>
        </I18nProvider>
      ),
    },
    { path: "/room/:roomId/:verb", action: roomAction },
  ]);
  act(() => root.render(<Stub initialEntries={["/present"]} />));
  // Let timers (read time, board fill) run, as on a real screen.
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
}

function text() {
  return container.textContent ?? "";
}

function status() {
  return container.querySelector('[data-testid="viewer-status"]')?.textContent;
}

function qr() {
  return container.querySelector('svg[data-testid="join-qr"]');
}

/** Controls a player would use. The presenter must have none of them. */
function expectNoPlayerControls() {
  // (The sound control is a local form that posts nothing.)
  expect(container.querySelector("form[method], form[action]")).toBeNull();
  const enabled = Array.from(container.querySelectorAll("button")).filter(
    (b) => !b.disabled,
  );
  for (const button of enabled) {
    expect(button.textContent ?? "").not.toMatch(
      /buzz|reveal|correct|start round|join|resume|pause|back to board|submit/i,
    );
  }
  expect(roomAction).not.toHaveBeenCalled();
}

describe("Presenter", () => {
  it("shows a big QR code to join in the lobby", () => {
    render(play());
    expect(qr()?.getAttribute("data-value")).toBe(JOIN_URL);
    expect(qr()?.getAttribute("aria-label")).toBe("QR code to join the game");
    expect(text()).toContain("Scan to join");
    expect(text()).toContain(`or open ${JOIN_URL}`);
    expect(status()).toBe("Waiting for players to join...");
    expect(text()).toContain("No players yet");
    expectNoPlayerControls();
  });

  it("lists who joined and who starts", () => {
    render(playUntil("join"));
    expect(status()).toBe("Round 1 is about to start · Ann chooses first");
    expect(text()).toContain("Round 1 of 2");
    expect(qr()).not.toBeNull();
    expectNoPlayerControls();
  });

  it("shows the board, the chooser and the players sorted by score", () => {
    render(playUntil("finishSecret"));
    expect(container.querySelector("table")).not.toBeNull();
    expect(status()).toBe("Bob is choosing a question");
    const tiles = container.querySelector('[data-testid="presenter-players"]');
    // Bob ($500) above Ann ($350).
    expect(tiles?.textContent).toMatch(/Bob.*\$500.*Ann.*\$350/);
    // The QR code stays, small, in the corner.
    expect(qr()).not.toBeNull();
    expectNoPlayerControls();
  });

  it("shows the question being read, without the answer", () => {
    render(playUntil("chooseFirst"));
    expect(text()).toContain("This pet says meow");
    expect(status()).toBe("Buzzers open!");
    const answer = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Cat",
    );
    expect(answer?.className).toContain("invisible");
    expectNoPlayerControls();
  });

  it("shows who is answering", () => {
    render(playUntil("buzzFirst"));
    expect(status()).toBe("Ann is answering");
    expectNoPlayerControls();
  });

  it("reveals the answer and who got it", () => {
    render(playUntil("checkFirst"));
    expect(status()).toBe("Ann got it!");
    const answer = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Cat",
    );
    expect(answer?.className).not.toContain("invisible");
    expectNoPlayerControls();
  });

  it("shows a wager in progress", () => {
    render(playUntil("chooseWager"));
    expect(status()).toBe("Ann is placing a wager");
    expect(text()).toMatch(/double down/i);
    expectNoPlayerControls();
  });

  it("shows the cat in the bag hand-over without the chooser's buttons", () => {
    render(playUntil("chooseSecret"));
    expect(text()).toContain("Cat in the bag!");
    expect(text()).toContain("Big cats");
    expect(text()).toContain("$500");
    expect(status()).toBe("Ann is choosing who gets the cat in the bag");
    expectNoPlayerControls();

    render(playUntil("passSecret"));
    expect(status()).toBe("Cat in the bag: Bob is answering");
    expect(text()).toContain("The king of the jungle");
  });

  it("shows multiple choice options", () => {
    render(playUntil("buzzChoice"));
    expect(status()).toBe("Ann is picking an answer");
    const options = container.querySelector('[aria-label="Options"]');
    expect(options?.textContent).toContain("Venus");
    expect(options?.textContent).toContain("Mars");
    expectNoPlayerControls();
  });

  it("follows the final: wagers, answers, checks", () => {
    render(playUntil("startFinal"));
    expect(status()).toBe("Final round");

    render(playUntil("wagerAnnFinal"));
    expect(status()).toBe("Players are placing their wagers (1 of 2)");

    render(playUntil("wagerBobFinal"));
    expect(status()).toBe("Players are writing their answers");
    expect(text()).toContain("Capital of France");

    render(playUntil("answerFinal"));
    expect(status()).toBe("Players are checking their answers");
    expect(text()).toContain("Rome");
    expectNoPlayerControls();
  });

  it("shows the winner and the final standings at game over", () => {
    render(playUntil("finishFinal"));
    expect(
      container.querySelector('[data-testid="presenter-winner"]')?.textContent,
    ).toBe("Ann wins!");
    expect(text()).toContain("Game over!");
    expect(text()).toMatch(/1\. Ann.*\$850.*2\. Bob.*\$500/);
    expectNoPlayerControls();
  });

  it("shows the pause without a Resume button", () => {
    render(play(STEPS.join, STEPS.start, STEPS.pause));
    expect(
      container.querySelector('[data-testid="paused-overlay"]'),
    ).not.toBeNull();
    expectNoPlayerControls();
  });

  it("is translated into Ukrainian", () => {
    render(play(), "uk");
    expect(text()).toContain("Скануй, щоб приєднатися");
    expect(status()).toBe("Чекаємо на гравців...");

    render(playUntil("chooseSecret"), "uk");
    expect(status()).toBe("Ann вирішує, кому дістанеться кіт у мішку");
  });
});
