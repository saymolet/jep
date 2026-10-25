import { describe, expect, it, vi } from "vitest";

import { MAX_AVATAR_LENGTH } from "~/models/avatar";

import { encodeAvatar, fitAvatar, squareCrop } from "./avatar-image";

describe("squareCrop", () => {
  it.each([
    [100, 100, { sx: 0, sy: 0, size: 100 }],
    [400, 300, { sx: 50, sy: 0, size: 300 }],
    [300, 401, { sx: 0, sy: 50, size: 300 }],
  ])("crops %ix%i", (w, h, expected) => {
    expect(squareCrop(w, h)).toEqual(expected);
  });
});

/** fakeCanvas mimics toDataURL: a browser that can't encode a type returns a
 * PNG instead. `bodyLength` maps quality to the base64 body length. */
function fakeCanvas(
  supported: string[],
  bodyLength: (quality: number) => number = () => 8,
) {
  return {
    toDataURL: vi.fn((type: string, quality: number) => {
      const actual = supported.includes(type) ? type : "image/png";
      return `data:${actual};base64,${"A".repeat(bodyLength(quality))}`;
    }),
  };
}

describe("encodeAvatar", () => {
  it("prefers WebP", () => {
    const canvas = fakeCanvas(["image/webp", "image/jpeg"]);
    expect(encodeAvatar(canvas, 0.8)).toMatch(/^data:image\/webp;base64,/);
  });

  it("falls back to JPEG when WebP encoding is unsupported", () => {
    const canvas = fakeCanvas(["image/jpeg"]);
    expect(encodeAvatar(canvas, 0.8)).toMatch(/^data:image\/jpeg;base64,/);
    expect(canvas.toDataURL).toHaveBeenLastCalledWith("image/jpeg", 0.8);
  });
});

describe("fitAvatar", () => {
  it("returns the first encoding that fits", () => {
    const canvas = fakeCanvas(["image/webp"], () => 400);
    expect(fitAvatar(canvas)).toMatch(/^data:image\/webp;base64,A{400}$/);
    expect(canvas.toDataURL).toHaveBeenCalledTimes(1);
  });

  it("lowers the quality until the photo is small enough", () => {
    const canvas = fakeCanvas(["image/webp"], (q) =>
      q > 0.6 ? MAX_AVATAR_LENGTH : 1000,
    );
    expect(fitAvatar(canvas)).toMatch(/^data:image\/webp;base64,A{1000}$/);
    expect(canvas.toDataURL).toHaveBeenCalledWith("image/webp", 0.5);
  });

  it("gives up when nothing fits", () => {
    const canvas = fakeCanvas(["image/webp"], () => MAX_AVATAR_LENGTH);
    expect(fitAvatar(canvas)).toBeUndefined();
  });
});
