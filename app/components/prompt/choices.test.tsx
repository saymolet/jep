import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Player } from "~/engine";

import { ChoiceList } from "./choices";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CHOICES = ["Sydney", "Canberra", "Perth"];
const PLAYERS = new Map<string, Player>([
  ["1", { userId: "1", name: "Ann", score: 0 }],
  ["2", { userId: "2", name: "Bob", score: 0 }],
]);

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

function render(ui: React.ReactNode) {
  act(() => root.render(ui));
}

function statuses() {
  return Array.from(container.querySelectorAll("li")).map((li) => [
    li.dataset.choice,
    li.dataset.status,
  ]);
}

describe("ChoiceList", () => {
  it("labels the options A, B, C and hides the answer", () => {
    render(<ChoiceList choices={CHOICES} correctIndex={1} />);
    expect(statuses()).toEqual([
      ["A", "neutral"],
      ["B", "neutral"],
      ["C", "neutral"],
    ]);
    expect(container.textContent).toContain("Canberra");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("marks wrong picks with who made them, without revealing the answer", () => {
    render(
      <ChoiceList
        choices={CHOICES}
        correctIndex={1}
        picks={new Map([["1", 0]])}
        players={PLAYERS}
      />,
    );
    expect(statuses()).toEqual([
      ["A", "wrong"],
      ["B", "neutral"],
      ["C", "neutral"],
    ]);
    expect(container.querySelector('[data-choice="A"]')?.textContent).toContain(
      "Ann",
    );
  });

  it("reveals the correct option", () => {
    render(
      <ChoiceList
        choices={CHOICES}
        correctIndex={1}
        picks={new Map([["1", 2]])}
        players={PLAYERS}
        revealCorrect
      />,
    );
    expect(statuses()).toEqual([
      ["A", "neutral"],
      ["B", "correct"],
      ["C", "wrong"],
    ]);
  });

  it("lets the player tap an option that wasn't already picked", () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        choices={CHOICES}
        correctIndex={1}
        picks={new Map([["2", 0]])}
        players={PLAYERS}
        onPick={onPick}
      />,
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].disabled).toBe(true);
    act(() => buttons[2].click());
    expect(onPick).toHaveBeenCalledWith(2);
    expect(buttons[2].getAttribute("aria-label")).toBe("C: Perth");
  });

  it("disables every option while a pick is submitted", () => {
    const onPick = vi.fn();
    render(
      <ChoiceList
        choices={CHOICES}
        correctIndex={1}
        onPick={onPick}
        disabled
      />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons.every((b) => b.disabled)).toBe(true);
  });
});
