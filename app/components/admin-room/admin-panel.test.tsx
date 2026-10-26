import * as ToastPrimitive from "@radix-ui/react-toast";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GameComponent from "~/components/game";
import {
  ANN,
  BOB,
  engineFor,
  play,
  playUntil,
  STEPS,
  WATCH_GAME,
} from "~/components/watch/fixtures.test-helpers";
import { ActionType, GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** The admin only watches the room. */
const VISITOR = "admin-visitor";

let container: HTMLDivElement;
let root: Root;
/** Every room request the page sends: [path, form fields]. */
let posted: [string, Record<string, FormDataEntryValue>][] = [];
let setRoomState: (state: State) => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  posted = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function Room({ initial, isAdmin }: { initial: State; isAdmin: boolean }) {
  const [state, setState] = React.useState(initial);
  setRoomState = setState;
  return (
    <GameEngineContext.Provider value={engineFor(state)}>
      <GameComponent
        game={WATCH_GAME}
        isAdmin={isAdmin}
        name="Visitor"
        roomId={7}
        roomName="7-apple"
        userId={VISITOR}
        url="http://localhost:3000/room/7-apple"
        watching
        onWatchingChange={() => {}}
      />
    </GameEngineContext.Provider>
  );
}

function render(state: State, isAdmin = true, locale: Locale = "en") {
  const Stub = createRoutesStub([
    {
      path: "/room/:roomName",
      Component: () => (
        <ToastPrimitive.Provider>
          <ToastPrimitive.Viewport />
          <I18nProvider locale={locale}>
            <Room initial={state} isAdmin={isAdmin} />
          </I18nProvider>
        </ToastPrimitive.Provider>
      ),
    },
    {
      path: "/room/:roomId/:verb",
      action: async ({ request }) => {
        posted.push([
          new URL(request.url).pathname,
          Object.fromEntries(await request.formData()),
        ]);
        return null;
      },
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/room/7-apple"]} />));
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
}

const query = (testId: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

/** Radix dialogs render in a portal on document.body. */
function button(name: RegExp, within: ParentNode = document.body) {
  return Array.from(within.querySelectorAll("button")).find((b) =>
    name.test((b.textContent ?? "").trim()),
  );
}

async function click(el: HTMLElement | undefined | null) {
  expect(el).toBeTruthy();
  await act(async () => {
    el!.click();
    await vi.advanceTimersByTimeAsync(500);
  });
}

async function openPanel() {
  await click(query("admin-controls-button"));
  expect(query("admin-panel")).not.toBeNull();
}

describe("admin controls in a room", () => {
  it("non-admins never see them", () => {
    render(playUntil("start"), false);
    expect(query("admin-controls-button")).toBeNull();
  });

  it("the admin watching picks a question for the board-control player", async () => {
    render(playUntil("start"));
    await openPanel();
    expect(query("admin-step-status")?.textContent).toBe(
      "Waiting for Ann to choose a question.",
    );
    const picker = query("admin-choose-picker")!;
    await click(
      picker.querySelector<HTMLElement>('[aria-label="Animals, $200"]'),
    );
    expect(posted).toEqual([
      ["/room/7/choose-clue", { userId: ANN, i: "0", j: "0", admin: "true" }],
    ]);
  });

  it("marks the buzz winner's answer for them", async () => {
    render(playUntil("buzzFirst"));
    await openPanel();
    expect(query("admin-step-status")?.textContent).toBe(
      "Waiting for Ann to mark their answer.",
    );
    await click(button(/^Right$/, query("admin-panel")!));
    expect(posted).toEqual([
      [
        "/room/7/check",
        { userId: ANN, i: "0", j: "0", result: "correct", admin: "true" },
      ],
    ]);
  });

  it("picks a multiple choice option for them", async () => {
    render(
      play(
        STEPS.join,
        STEPS.start,
        [{ type: ActionType.ChooseClue, payload: { userId: ANN, i: 1, j: 1 } }],
        STEPS.buzzChoice,
      ),
    );
    await openPanel();
    expect(query("admin-step")?.textContent).toContain(
      "Pick an option for Ann:",
    );
    await click(button(/^B\. Mars$/, query("admin-panel")!));
    expect(posted).toEqual([
      [
        "/room/7/check",
        { userId: ANN, i: "1", j: "1", choice: "1", admin: "true" },
      ],
    ]);
  });

  it("passes on the buzzer for a player who is away", async () => {
    render(
      play(STEPS.join, STEPS.start, STEPS.chooseFirst, [
        {
          type: ActionType.Buzz,
          payload: { userId: ANN, i: 0, j: 0, deltaMs: 100 },
        },
      ]),
    );
    await openPanel();
    await click(button(/^Bob passes$/, query("admin-panel")!));
    expect(posted).toEqual([
      [
        "/room/7/buzz",
        { userId: BOB, i: "0", j: "0", deltaMs: "5001", admin: "true" },
      ],
    ]);
  });

  it("gives the cat in the bag away for the chooser", async () => {
    render(play(STEPS.join, STEPS.start, STEPS.chooseSecret));
    await openPanel();
    expect(query("admin-step")?.textContent).toContain(
      "Give the cat in the bag (for Ann) to:",
    );
    await click(button(/^Bob$/, query("admin-step")!));
    expect(posted).toEqual([
      [
        "/room/7/pass-clue",
        { userId: ANN, i: "0", j: "1", toUserId: BOB, admin: "true" },
      ],
    ]);
  });

  it("skips the open question after a confirmation", async () => {
    render(playUntil("buzzFirst"));
    await openPanel();
    await click(button(/Skip this question$/, query("admin-skip")!));
    expect(posted).toEqual([]);
    expect(query("admin-skip")?.textContent).toContain("Skip this question?");
    await click(button(/^Yes, skip$/, query("admin-skip")!));
    expect(posted).toEqual([
      ["/room/7/admin", { intent: "skip", i: "0", j: "0" }],
    ]);
  });

  it("skips a question on the board", async () => {
    render(playUntil("start"));
    await openPanel();
    await click(
      query("admin-skip-picker")!.querySelector<HTMLElement>(
        '[aria-label="Mystery, $400"]',
      ),
    );
    expect(posted).toEqual([
      ["/room/7/admin", { intent: "skip", i: "1", j: "1" }],
    ]);
  });

  it("changes a score", async () => {
    render(playUntil("start"));
    await openPanel();
    const row = document.body.querySelector<HTMLElement>(
      `[data-testid="admin-score-row"][data-user-id="${BOB}"]`,
    )!;
    const input = row.querySelector<HTMLInputElement>('input[name="amount"]')!;
    expect(input.value).toBe("100");
    await click(row.querySelector<HTMLElement>('button[value="add"]'));
    expect(posted).toEqual([
      [
        "/room/7/admin",
        { intent: "score", userId: BOB, amount: "100", op: "add" },
      ],
    ]);
  });

  it("everyone sees the admin's score change", async () => {
    const state = playUntil("start");
    render(state, false);
    expect(query("admin-toast")).toBeNull();
    await act(async () => {
      setRoomState(
        play(STEPS.join, STEPS.start, [
          {
            type: ActionType.AdjustScore,
            payload: { userId: BOB, delta: 500, admin: true },
          },
        ]),
      );
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(query("admin-toast")?.textContent).toContain("Admin: Bob +$500");
  });

  it("is translated into Ukrainian", async () => {
    render(playUntil("start"), true, "uk");
    await openPanel();
    expect(query("admin-panel")?.textContent).toContain(
      "Керування адміністратора",
    );
    expect(query("admin-step-status")?.textContent).toBe(
      "Чекаємо, поки Ann обере питання.",
    );
    expect(query("admin-scores")?.textContent).toContain("Додати");
  });
});
