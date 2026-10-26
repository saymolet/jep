import { describe, expect, it } from "vitest";

import {
  getClueMedia,
  getClueReadMs,
  getRoomReadMs,
  IMAGE_READ_MS,
  mediaBlockError,
  parseYouTubeUrl,
  PLAYBACK_READ_MS,
  READ_BASE_MS,
  READ_PER_CHAR_MS,
  youTubeEmbedUrl,
} from "./media";

describe("parseYouTubeUrl", () => {
  const ID = "aqz-KE-bpKQ";
  const cases: [string, ReturnType<typeof parseYouTubeUrl>][] = [
    [`https://www.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://youtube.com/watch?v=${ID}&list=abc`, { id: ID }],
    [`https://m.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://music.youtube.com/watch?v=${ID}`, { id: ID }],
    [`https://youtu.be/${ID}`, { id: ID }],
    [`https://youtu.be/${ID}?t=90`, { id: ID, start: 90 }],
    [`https://www.youtube.com/watch?v=${ID}&t=1m30s`, { id: ID, start: 90 }],
    [`https://www.youtube.com/watch?v=${ID}&t=45s`, { id: ID, start: 45 }],
    [`https://www.youtube.com/watch?v=${ID}&t=1h0m5s`, { id: ID, start: 3605 }],
    [`https://www.youtube.com/embed/${ID}?start=12`, { id: ID, start: 12 }],
    [`https://www.youtube.com/shorts/${ID}`, { id: ID }],
    [`https://www.youtube-nocookie.com/embed/${ID}`, { id: ID }],
    // Unparseable start times are ignored rather than rejected.
    [`https://youtu.be/${ID}?t=soon`, { id: ID }],
    // Not YouTube video links.
    [`http://www.youtube.com/watch?v=${ID}`, null],
    [`https://www.youtube.com/watch?v=short`, null],
    [`https://www.youtube.com/@BlenderOfficial`, null],
    [`https://www.youtube.com/playlist?list=PL123`, null],
    [`https://example.com/watch?v=${ID}`, null],
    [`not a url`, null],
  ];
  it.each(cases)("parses %s", (src, expected) => {
    expect(parseYouTubeUrl(src)).toEqual(expected);
  });
});

describe("youTubeEmbedUrl", () => {
  it("uses the privacy-enhanced domain with start and autoplay", () => {
    const url = new URL(
      youTubeEmbedUrl({ id: "aqz-KE-bpKQ", start: 30 }, { autoPlay: true }),
    );
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/aqz-KE-bpKQ");
    expect(url.searchParams.get("start")).toBe("30");
    expect(url.searchParams.get("autoplay")).toBe("1");
    expect(url.searchParams.get("playsinline")).toBe("1");
  });

  it("omits start and autoplay by default", () => {
    const url = new URL(youTubeEmbedUrl({ id: "aqz-KE-bpKQ" }));
    expect(url.searchParams.has("start")).toBe(false);
    expect(url.searchParams.has("autoplay")).toBe(false);
  });
});

describe("mediaBlockError", () => {
  it.each([
    ["image", "https://files.example.org/a.png"],
    ["audio", "https://cdn.example.com/song.mp3"],
    ["video", "https://cdn.example.com/clip.mp4"],
    ["video", "https://youtu.be/aqz-KE-bpKQ?t=10"],
  ] as const)("accepts %s %s", (type, src) => {
    expect(mediaBlockError({ type, src })).toBeNull();
  });

  it.each([
    ["image", "http://files.example.org/a.png", /https/],
    ["audio", "ftp://cdn.example.com/song.mp3", /https/],
    ["image", "javascript:alert(1)", /https/],
    ["video", "data:video/mp4;base64,AAAA", /https/],
    ["audio", "/sounds/x.mp3", /https/],
    ["audio", "https://youtu.be/aqz-KE-bpKQ", /type "video"/],
    ["video", "https://www.youtube.com/@BlenderOfficial", /YouTube/],
  ] as const)("rejects %s %s", (type, src, message) => {
    expect(mediaBlockError({ type, src })).toMatch(message);
  });
});

describe("getClueMedia", () => {
  it("treats a legacy imageSrc as the first image block", () => {
    expect(
      getClueMedia({
        clue: "Look",
        imageSrc: "https://a.example/1.png",
        media: [{ type: "audio", src: "https://a.example/1.mp3" }],
      }),
    ).toEqual([
      {
        type: "image",
        src: "https://a.example/1.png",
        alt: "Image for clue: Look",
      },
      { type: "audio", src: "https://a.example/1.mp3" },
    ]);
  });

  it("returns nothing for a text clue", () => {
    expect(getClueMedia({ clue: "Text" })).toEqual([]);
  });
});

describe("getClueReadMs", () => {
  const text = "x".repeat(10);
  const textMs = READ_BASE_MS + READ_PER_CHAR_MS * 10;

  it("is length-based for text clues", () => {
    expect(getClueReadMs({ clue: text })).toBe(textMs);
  });

  it("includes the options of a multiple choice clue", () => {
    expect(getClueReadMs({ clue: text, choices: ["abc", "de"] })).toBe(
      textMs + READ_PER_CHAR_MS * 5,
    );
  });

  it("gives pictures a minimum read time", () => {
    expect(
      getClueReadMs({
        clue: "",
        media: [{ type: "image", src: "https://a.example/1.png" }],
      }),
    ).toBe(IMAGE_READ_MS);
    expect(
      getClueReadMs({ clue: text, imageSrc: "https://a.example/1.png" }),
    ).toBe(Math.max(textMs, IMAGE_READ_MS));
  });

  it("gives audio and video a longer minimum read time", () => {
    expect(
      getClueReadMs({
        clue: "",
        media: [{ type: "audio", src: "https://a.example/1.mp3" }],
      }),
    ).toBe(PLAYBACK_READ_MS);
    const longText = "x".repeat(200);
    expect(
      getClueReadMs({
        clue: longText,
        media: [{ type: "video", src: "https://youtu.be/aqz-KE-bpKQ" }],
      }),
    ).toBe(READ_BASE_MS + READ_PER_CHAR_MS * 200);
  });

  it("ignores answer media", () => {
    expect(
      getClueReadMs({
        clue: text,
        answerMedia: [{ type: "audio", src: "https://a.example/1.mp3" }],
      }),
    ).toBe(textMs);
  });
});

describe("getRoomReadMs", () => {
  const text = { clue: "abcdefghij" }; // 1000 + 10 * 60 ms
  it.each([
    ["Auto: the estimate", text, null, {}, 1600],
    [
      "Auto: the question's hint wins",
      { ...text, readTimeSec: 8 },
      null,
      {},
      8000,
    ],
    ["Auto: a hint of 0", { ...text, readTimeSec: 0 }, null, {}, 0],
    ["fixed: beats the hint", { ...text, readTimeSec: 8 }, 3, {}, 3000],
    ["fixed 0: buzzers open at once", text, 0, {}, 0],
    ["re-read with Auto: 1 s", text, null, { reRead: true }, 1000],
    ["re-read with a fixed 0 s", text, 0, { reRead: true }, 0],
    ["re-read with a fixed 10 s: still 1 s", text, 10, { reRead: true }, 1000],
  ])("%s", (_name, clue, readTimeSec, options, expected) => {
    expect(getRoomReadMs(clue, readTimeSec, options)).toBe(expected);
  });
});
