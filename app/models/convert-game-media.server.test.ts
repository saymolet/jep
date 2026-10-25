import { describe, expect, it, vi } from "vitest";

vi.mock("varlock/env", () => ({
  ENV: { SUPABASE_URL: "http://127.0.0.1:54321" },
}));

import { isGameMediaUrl, MediaBlockSchema } from "./convert.server";

const LOCAL =
  "http://127.0.0.1:54321/storage/v1/object/public/game-media/siq/abc/0001.png";

describe("own storage media (local http Supabase)", () => {
  it("accepts http URLs of the game-media bucket on the Supabase origin", () => {
    expect(isGameMediaUrl(LOCAL)).toBe(true);
    expect(
      MediaBlockSchema.safeParse({ type: "image", src: LOCAL }).success,
    ).toBe(true);
  });

  it.each([
    "http://127.0.0.1:54321/storage/v1/object/public/other-bucket/a.png",
    "http://127.0.0.1:54321/rest/v1/games",
    "http://127.0.0.1:9999/storage/v1/object/public/game-media/a.png",
    "http://example.com/storage/v1/object/public/game-media/a.png",
    "not a url",
  ])("still rejects other http URLs: %s", (src) => {
    expect(isGameMediaUrl(src)).toBe(false);
    expect(MediaBlockSchema.safeParse({ type: "image", src }).success).toBe(
      false,
    );
  });
});
