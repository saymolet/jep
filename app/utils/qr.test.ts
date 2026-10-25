import { encode } from "uqr";
import { describe, expect, it } from "vitest";

import { qrSvg } from "./qr";

/** darkModules redraws the path into a grid of dark modules. */
function darkModules(path: string, size: number) {
  const grid = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false),
  );
  for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let i = 0; i < Number(w); i++) {
      grid[Number(y)][Number(x) + i] = true;
    }
  }
  return grid;
}

describe("qrSvg", () => {
  const url = "https://jep.example/room/42-apple";

  it("draws exactly the modules of the QR code for the text", () => {
    const { size, path } = qrSvg(url);
    const { data } = encode(url, { ecc: "M", border: 2 });
    expect(size).toBe(data.length);
    expect(darkModules(path, size)).toEqual(data);
  });

  it("is deterministic (same markup on the server and the client)", () => {
    expect(qrSvg(url)).toEqual(qrSvg(url));
  });

  it("encodes different URLs differently", () => {
    expect(qrSvg(url).path).not.toBe(qrSvg(url + "x").path);
  });

  it("keeps a light quiet zone around the code", () => {
    const { size, path } = qrSvg(url);
    const grid = darkModules(path, size);
    for (const i of [0, 1, size - 2, size - 1]) {
      expect(grid[i].some(Boolean)).toBe(false);
      expect(grid.some((row) => row[i])).toBe(false);
    }
  });
});
