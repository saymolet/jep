import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GameComponent from "~/components/game";
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

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const VISITOR = "visitor";

let container: HTMLDivElement;
let root: Root;
/** Any room action the page sends. */
const roomAction = vi.fn(() => null);
let watchingChanges: boolean[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  roomAction.mockClear();
  watchingChanges = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function Room({
  state,
  initialWatching,
}: {
  state: State;
  initialWatching: boolean;
}) {
  const [watching, setWatching] = React.useState(initialWatching);
  return (
    <GameEngineContext.Provider value={engineFor(state)}>
      <GameComponent
        game={WATCH_GAME}
        name="Visitor"
        roomId={7}
        roomName="7-apple"
        userId={VISITOR}
        url="http://localhost:3000/room/7-apple"
        watching={watching}
        onWatchingChange={(w) => {
          watchingChanges.push(w);
          setWatching(w);
        }}
      />
    </GameEngineContext.Provider>
  );
}

function render(state: State, initialWatching = false, locale: Locale = "en") {
  const Stub = createRoutesStub([
    {
      path: "/room/:roomName",
      Component: () => (
        <I18nProvider locale={locale}>
          <Room state={state} initialWatching={initialWatching} />
        </I18nProvider>
      ),
    },
    { path: "/room/:roomId/:verb", action: roomAction },
  ]);
  act(() => root.render(<Stub initialEntries={["/room/7-apple"]} />));
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
}

/** Radix dialogs render in a portal on document.body. */
function button(name: RegExp) {
  return Array.from(document.body.querySelectorAll("button")).find((b) =>
    name.test(b.textContent ?? ""),
  );
}

function spectatorBar() {
  return document.body.querySelector('[data-testid="spectator-bar"]');
}

describe("spectators", () => {
  it('"Just watch" closes the join dialog without joining', async () => {
    render(playUntil("start"));
    expect(button(/^Join game$/)).toBeDefined();
    const justWatch = button(/^Just watch$/);
    expect(justWatch).toBeDefined();

    await act(async () => {
      justWatch!.click();
      await vi.advanceTimersByTimeAsync(2_000);
    });

    expect(watchingChanges).toEqual([true]);
    expect(roomAction).not.toHaveBeenCalled();
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    expect(spectatorBar()?.textContent).toContain("Watching");
  });

  it('"Join game" on the bar reopens the join dialog', async () => {
    render(playUntil("start"), true);
    expect(document.body.querySelector('[role="dialog"]')).toBeNull();
    const join = spectatorBar()?.querySelector("button");
    await act(async () => {
      join!.click();
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(watchingChanges).toEqual([false]);
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(roomAction).not.toHaveBeenCalled();
  });

  it("can't buzz, choose, pause or kick", async () => {
    render(playUntil("chooseFirst"), true);
    // The question is shown read-only: no enabled buzz button, no timeout
    // buzz sent after the read time.
    expect(document.body.textContent).toContain("This pet says meow");
    const enabled = Array.from(document.body.querySelectorAll("button"))
      .filter((b) => !b.disabled)
      .map((b) => b.textContent ?? "");
    for (const label of enabled) {
      expect(label).not.toMatch(/buzz|reveal|correct|pause|kick/i);
    }
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(roomAction).not.toHaveBeenCalled();
    expect(
      document.body.querySelector('[data-testid="viewer-status"]')?.textContent,
    ).toBe("Buzzers open!");
  });

  it("clicking the board as a spectator sends nothing", async () => {
    render(playUntil("start"), true);
    const clue = document.body.querySelector<HTMLButtonElement>("td button");
    expect(clue).toBeDefined();
    await act(async () => {
      clue!.click();
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(roomAction).not.toHaveBeenCalled();
  });

  it("sees the pause without a Resume button", () => {
    render(play(STEPS.join, STEPS.start, STEPS.pause), true);
    expect(
      document.body.querySelector('[data-testid="paused-overlay"]'),
    ).not.toBeNull();
    expect(button(/resume/i)).toBeUndefined();
  });

  it("is translated into Ukrainian", () => {
    render(playUntil("start"), false, "uk");
    expect(button(/^Просто дивитися$/)).toBeDefined();
    act(() => root.unmount());
    root = createRoot(container);
    render(playUntil("start"), true, "uk");
    expect(spectatorBar()?.textContent).toContain("Глядач");
  });
});
