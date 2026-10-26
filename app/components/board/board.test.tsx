import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getMockGame } from "~/models/mock.server";

import { BoardComponent } from "./board";
import { getFrameIntervalMs } from "./use-board-fill";

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

async function renderBoard(
  name: string,
  isAnswered: (i: number, j: number) => boolean = () => false,
  { busy }: { busy?: boolean } = {},
) {
  const game = await getMockGame(name);
  const onClickClue = vi.fn();
  act(() =>
    root.render(
      <BoardComponent
        board={game.boards[0]}
        busy={busy}
        hasBoardControl
        isAnswered={isAnswered}
        isCategoryRevealed={() => true}
        isClueRevealed={() => true}
        onClickClue={onClickClue}
        onFocusClue={() => null}
        onKeyDownClue={() => null}
        tbodyRef={React.createRef()}
      />,
    ),
  );
  return { onClickClue };
}

/** The grid as text: the value of each clue, "-" for an empty cell. */
function grid() {
  return Array.from(container.querySelectorAll("tbody tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td")).map((td) =>
      td.dataset.testid === "empty-cell"
        ? "-"
        : (td.textContent ?? "").replace("$", ""),
    ),
  );
}

describe("BoardComponent", () => {
  it("marks the board busy while it isn't ready to play", async () => {
    await renderBoard("default", undefined, { busy: true });
    expect(container.querySelector("table")?.getAttribute("aria-busy")).toBe(
      "true",
    );

    await renderBoard("default", undefined, { busy: false });
    expect(container.querySelector("table")?.getAttribute("aria-busy")).toBe(
      "false",
    );
  });

  it("renders empty cells below shorter categories", async () => {
    // Short (3 questions), Full (5), Middle (4).
    await renderBoard("ragged");
    expect(grid()).toEqual([
      ["200", "200", "200"],
      ["400", "400", "400"],
      ["600", "600", "600"],
      ["-", "800", "800"],
      ["-", "1000", "-"],
    ]);
    const empty = container.querySelectorAll('[data-testid="empty-cell"]');
    expect(empty).toHaveLength(3);
    for (const td of empty) {
      expect(td.getAttribute("aria-hidden")).toBe("true");
      expect(td.querySelector("button")).toBeNull();
    }
  });

  it("chooses the clue under the tapped cell in a ragged board", async () => {
    const { onClickClue } = await renderBoard("ragged");
    const rows = container.querySelectorAll("tbody tr");
    const fullLast = rows[4].querySelectorAll("td")[1].querySelector("button");
    act(() => fullLast?.click());
    expect(onClickClue).toHaveBeenCalledWith(4, 1);
  });

  it("completes a short category when its own questions are answered", async () => {
    await renderBoard("ragged", (i, j) => j === 0 && i < 3);
    expect(
      container.querySelector('[aria-label="Show completed category"]'),
    ).not.toBeNull();
  });

  it("keeps the classic layout for 5 or fewer categories", async () => {
    await renderBoard("ragged");
    const sized = container.querySelector("[data-columns]");
    expect(sized?.getAttribute("data-columns")).toBe("3");
    expect(sized?.className).toContain("max-w-screen-lg");
  });

  it("lets a wide board grow and keeps 44px tap targets", async () => {
    await renderBoard("8x5");
    expect(container.querySelectorAll("thead th")).toHaveLength(8);
    expect(container.querySelectorAll("tbody button")).toHaveLength(40);
    const sized = container.querySelector<HTMLElement>("[data-columns]");
    expect(sized?.className).not.toContain("max-w-screen-lg");
    expect(sized?.style.minWidth).toBe(`${8 * 44}px`);
    expect(sized?.style.maxWidth).toBe(`${8 * 200}px`);
    expect(container.querySelector("tbody button")?.className).toContain(
      "min-h-11",
    );
  });
});

describe("getFrameIntervalMs", () => {
  it("keeps the fill speed up to 5 categories and speeds up wider boards", () => {
    expect(getFrameIntervalMs(3)).toBe(400);
    expect(getFrameIntervalMs(5)).toBe(400);
    expect(getFrameIntervalMs(8)).toBe(250);
    expect(getFrameIntervalMs(10)).toBe(200);
  });
});
