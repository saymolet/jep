import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Player } from "~/engine";

import { PassCluePicker, SecretClueBanner } from "./pass-clue";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const OTHERS: Player[] = [
  { userId: "2", name: "Bob", score: 400 },
  { userId: "3", name: "Cleo", score: -200 },
];

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

function buttons() {
  return Array.from(container.querySelectorAll("button"));
}

describe("SecretClueBanner", () => {
  it("shows the cat, the topic and the value", () => {
    render(<SecretClueBanner topic="Famous cats" value={500} />);
    expect(container.textContent).toContain("🐱");
    expect(container.textContent).toContain("Cat in the bag!");
    expect(container.textContent).toContain("Famous cats");
    expect(container.textContent).toContain("$500");
  });
});

describe("PassCluePicker", () => {
  it("gives the chooser one button per other player", () => {
    const onPass = vi.fn();
    render(
      <PassCluePicker
        canPass
        chooserName="Ann"
        players={OTHERS}
        onPass={onPass}
      />,
    );
    expect(container.textContent).toContain(
      "Give this question to another player",
    );
    expect(buttons().map((b) => b.textContent)).toEqual([
      expect.stringContaining("Bob"),
      expect.stringContaining("Cleo"),
    ]);
    act(() => buttons()[1].click());
    expect(onPass).toHaveBeenCalledWith("3");
  });

  it("disables the buttons while the pass is sent", () => {
    render(
      <PassCluePicker
        canPass
        chooserName="Ann"
        players={OTHERS}
        passingTo="2"
        onPass={() => null}
      />,
    );
    expect(container.textContent).toContain("Giving it to Bob...");
    expect(buttons().every((b) => b.disabled)).toBe(true);
  });

  it("tells everyone else who is choosing", () => {
    render(
      <PassCluePicker
        canPass={false}
        chooserName="Ann"
        players={OTHERS}
        onPass={() => null}
      />,
    );
    expect(buttons()).toHaveLength(0);
    expect(container.textContent).toContain(
      "Ann is choosing who gets the secret question...",
    );
  });
});
