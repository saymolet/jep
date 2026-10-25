import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AvatarPicker } from "./avatar-picker";
import { PlayerIcon } from "./player-icon";

// React only enables act() warnings handling when this flag is set.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

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

const PLAYER = { name: "Zoe", userId: "u1", color: "#7a8ae0" };

describe("PlayerIcon", () => {
  it("falls back to the first letter of the name", () => {
    render(<PlayerIcon player={PLAYER} />);
    expect(container.textContent).toBe("Z");
    expect(container.querySelector("img")).toBeNull();
  });

  it("falls back to the first letter for an invalid avatar", () => {
    render(
      <PlayerIcon player={{ ...PLAYER, avatar: "javascript:alert(1)" }} />,
    );
    expect(container.textContent).toBe("Z");
    expect(container.querySelector("img")).toBeNull();
  });

  it("shows an emoji avatar", () => {
    render(<PlayerIcon player={{ ...PLAYER, avatar: "emoji:🦊" }} />);
    expect(container.textContent).toBe("🦊");
  });

  it("shows a photo avatar on the player color", () => {
    render(<PlayerIcon player={{ ...PLAYER, avatar: TINY_PNG }} />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(TINY_PNG);
    const bubble = container.querySelector<HTMLElement>(
      "[data-testid=player-icon]",
    );
    expect(bubble?.title).toBe("Zoe");
    expect(bubble?.style.backgroundColor).not.toBe("");
  });
});

describe("AvatarPicker", () => {
  it("picks an emoji and removes it", () => {
    const onChange = vi.fn();
    render(<AvatarPicker value={undefined} onChange={onChange} />);
    const remove = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Remove",
    );
    expect(remove?.disabled).toBe(true);

    const fox = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Avatar 🦊"]',
    );
    act(() => fox?.click());
    expect(onChange).toHaveBeenLastCalledWith("emoji:🦊");

    render(<AvatarPicker value="emoji:🦊" onChange={onChange} />);
    expect(fox?.getAttribute("aria-pressed")).toBe("true");
    expect(remove?.disabled).toBe(false);
    act(() => remove?.click());
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });

  it("offers a photo upload that accepts images", () => {
    render(<AvatarPicker value={undefined} onChange={() => null} />);
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input?.accept).toBe("image/*");
    expect(container.textContent).toContain("Upload photo");
  });
});
