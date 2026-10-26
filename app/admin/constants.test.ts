import { describe, expect, it } from "vitest";

import { pagePath } from "./constants";

describe("pagePath", () => {
  it.each([
    ["http://x/admin/games.data?q=E2E&page=2", "/admin/games?q=E2E&page=2"],
    [
      "http://x/admin/rooms.data?delete=4&_routes=routes%2Fx",
      "/admin/rooms?delete=4",
    ],
    ["http://x/admin/games?index", "/admin/games"],
    ["http://x/admin/reports", "/admin/reports"],
  ])("%s → %s", (url, path) => {
    expect(pagePath(url)).toBe(path);
  });
});
