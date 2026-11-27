import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { engineFor, playUntil } from "~/components/watch/fixtures.test-helpers";
import { GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";

import { Buzzes } from "./buzz";

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

function render(state: State, buzzes?: Map<string, number>) {
  act(() =>
    root.render(
      <GameEngineContext.Provider value={engineFor(state)}>
        <Buzzes buzzes={buzzes} />
      </GameEngineContext.Provider>,
    ),
  );
  return container.querySelector('[data-testid="buzz-order"]');
}

describe("Buzzes (feature 29)", () => {
  it("keeps the order secret until the game decided who answers", () => {
    const reading = playUntil("openFirst");
    // Even this device's own (optimistic) buzz isn't ranked yet.
    const order = render(reading, new Map([["u2", 120]]));
    expect(order?.children).toHaveLength(0);
  });

  it("shows it once someone answers", () => {
    const order = render(playUntil("buzzFirst"));
    expect(order?.children.length).toBeGreaterThan(0);
  });

  it("never forces a scrollbar", () => {
    const order = render(playUntil("buzzFirst"));
    expect(order?.className).toContain("overflow-x-auto");
    expect(order?.className).not.toContain("overflow-x-scroll");
  });
});
