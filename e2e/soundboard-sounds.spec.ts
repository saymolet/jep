import { expect, test } from "@playwright/test";

const SOUND_IDS = [
  "applause",
  "drumroll",
  "tada",
  "wrong",
  "airhorn",
  "laugh",
  "ooh",
  "crickets",
  "ding",
];

test.describe("soundboard sound files", () => {
  test("every sample is served as audio/mpeg", async ({ request }) => {
    for (const id of SOUND_IDS) {
      const response = await request.get(`/sounds/soundboard/${id}.mp3`);
      expect(response.status(), id).toBe(200);
      expect(response.headers()["content-type"], id).toMatch(/^audio\/mpeg/);
      const body = await response.body();
      expect(body.length, id).toBeGreaterThan(10_000);
      expect(body.length, id).toBeLessThan(48_000);
    }
  });
});
