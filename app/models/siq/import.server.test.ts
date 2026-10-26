import { describe, expect, it, vi } from "vitest";

import { GameSchema, type Clue, type Game } from "~/models/convert.server";
import { buildSiq, zipFiles } from "~/test-fixtures/siq/build";

import { DEFAULT_ARCHIVE_LIMITS } from "./archive";
import { SiqImportError } from "./errors";
import { importSiq, type MediaStore } from "./import.server";

const BASE = "https://storage.test/game-media/siq/test";

function fakeStore(options: { fail?: (name: string) => boolean } = {}) {
  const files = new Map<string, { bytes: Uint8Array; contentType: string }>();
  const store: MediaStore & { files: typeof files } = {
    files,
    upload: vi.fn(
      async (name: string, bytes: Uint8Array, contentType: string) => {
        if (options.fail?.(name)) throw new Error("storage is down");
        files.set(name, { bytes, contentType });
        return `${BASE}/${name}`;
      },
    ),
    removeAll: vi.fn(async () => {
      files.clear();
    }),
  };
  return store;
}

function clue(game: Game, round: number, category: number, i: number): Clue {
  return game.boards[round].categories[category].clues[i];
}

function v5Xml(questions: string, roundAttrs = "") {
  return `<package name="P" version="5"><rounds><round name="R"${roundAttrs}><themes><theme name="T"><questions>${questions}</questions></theme></themes></round></rounds></package>`;
}

function v5Question(items: string, extra = "", attrs = 'price="100"') {
  return `<question ${attrs}><params><param name="question" type="content">${items}</param>${extra}</params><right><answer>A</answer></right></question>`;
}

describe("importSiq (v5 fixture)", async () => {
  const store = fakeStore();
  const { game, summary } = await importSiq(buildSiq("v5"), {
    fileName: "test.siq",
    store,
  });

  it("passes GameSchema", () => {
    expect(GameSchema.safeParse(game).success).toBe(true);
  });

  it("maps package info", () => {
    expect(game.title).toBe("Test pack v5");
    expect(game.author).toBe("Jep tester, Second author");
    expect(game.note).toBe("A tiny synthetic pack for tests.");
    expect(game.copyright).toBe("");
  });

  it("maps rounds to boards and themes to categories", () => {
    expect(game.boards.map((b) => b.categoryNames)).toEqual([
      ["Pictures", "Sounds & video", "Options"],
      ["Final A"],
    ]);
  });

  it("maps text and a picture", () => {
    expect(clue(game, 0, 0, 0)).toEqual({
      clue: "What color is this dot?",
      answer: "Red",
      value: 100,
      media: [{ type: "image", src: `${BASE}/0001.png` }],
    });
  });

  it("maps answer media and joins right answers", () => {
    expect(clue(game, 0, 0, 1)).toMatchObject({
      clue: "",
      answer: "Cat / Kitten",
      value: 200,
      media: [{ type: "image", src: expect.stringMatching(/\.png$/) }],
      answerMedia: [{ type: "image", src: expect.stringMatching(/\.png$/) }],
    });
  });

  it("maps secret questions", () => {
    expect(clue(game, 0, 0, 2)).toMatchObject({
      secret: true,
      secretTopic: "Famous cats",
      secretValue: 500,
    });
    // A price range: the maximum.
    expect(clue(game, 0, 0, 3)).toMatchObject({
      secret: true,
      secretTopic: "Ranges",
      secretValue: 1000,
    });
  });

  it("maps audio, video and stake", () => {
    expect(clue(game, 0, 1, 0).media).toEqual([
      { type: "audio", src: expect.stringMatching(/\.wav$/) },
    ]);
    expect(clue(game, 0, 1, 1)).toMatchObject({
      clue: "Name this clip",
      wagerable: true,
      media: [{ type: "video", src: expect.stringMatching(/\.mp4$/) }],
    });
  });

  it("keeps a question whose media is missing if it has text, and drops one without", () => {
    const sounds = game.boards[0].categories[1].clues;
    expect(sounds.map((c) => c.value)).toEqual([100, 200, 300, 500]);
    expect(sounds[2]).toEqual({
      clue: "A question whose picture is missing",
      answer: "Missing",
      value: 300,
    });
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        'Round 1 › Sounds & video › 300: file "missing.png" is missing from the pack.',
        'Round 1 › Sounds & video › 400: file "also missing.png" is missing from the pack.',
        "Round 1 › Sounds & video › 400: question skipped (no text and no usable media).",
      ]),
    );
  });

  it("plays noRisk as normal and skips HTML", () => {
    expect(clue(game, 0, 1, 3)).toEqual({
      clue: "A no-risk question",
      answer: "No risk",
      value: 500,
    });
    expect(summary.warnings).toContain(
      'Round 1 › Sounds & video › 500: HTML content is not supported ("page.html").',
    );
  });

  it("maps multiple choice options", () => {
    expect(clue(game, 0, 2, 0)).toMatchObject({
      clue: "Pick the largest planet",
      choices: ["Mars", "Jupiter", "Venus"],
      answer: "Jupiter",
    });
  });

  it("keeps the first final theme as a long-form question", () => {
    expect(game.boards[1].categories[0].clues).toEqual([
      {
        clue: "The first final question",
        answer: "First",
        value: 0,
        wagerable: true,
        longForm: true,
      },
    ]);
    expect(summary.warnings).toContain(
      'Final: Jep! plays one final question, so only the theme "Final A" was imported; 1 other final theme was skipped.',
    );
  });

  it("uploads each used file once with its content type", () => {
    // red dot.png, кот.png, blue.png, beep.wav, clip.mp4
    expect(summary.mediaFiles).toBe(5);
    expect([...store.files.values()].map((f) => f.contentType).sort()).toEqual([
      "audio/wav",
      "image/png",
      "image/png",
      "image/png",
      "video/mp4",
    ]);
    expect(store.removeAll).not.toHaveBeenCalled();
  });

  it("summarizes", () => {
    expect(summary).toMatchObject({
      title: "Test pack v5",
      boards: 2,
      categories: 4,
      questions: 10,
      droppedQuestions: 2,
      mediaFiles: 5,
    });
  });
});

describe("importSiq (v4 fixture)", async () => {
  const store = fakeStore();
  const { game, summary } = await importSiq(buildSiq("v4"), { store });

  it("passes GameSchema", () => {
    expect(GameSchema.safeParse(game).success).toBe(true);
    expect(game.title).toBe("Test pack v4");
    expect(game.author).toBe("Old tester");
  });

  it("maps media atoms and the marker", () => {
    expect(clue(game, 0, 0, 0)).toMatchObject({
      clue: "What color is this dot?",
      media: [{ type: "image" }],
    });
    const cat = clue(game, 0, 0, 1);
    expect(cat.clue).toBe("");
    expect(cat.answer).toBe("Cat / Kitten");
    expect(cat.answerMedia).toEqual([
      { type: "image", src: expect.stringMatching(/\.png$/) },
    ]);
    expect(clue(game, 0, 0, 2)).toMatchObject({
      clue: "Listen",
      media: [{ type: "audio" }],
    });
    expect(clue(game, 0, 0, 3)).toMatchObject({
      clue: "Name this clip",
      media: [{ type: "video" }],
    });
    // The last question only had a missing picture.
    expect(game.boards[0].categories[0].clues).toHaveLength(4);
  });

  it("maps cat, bagcat, auction and sponsored", () => {
    expect(game.boards[0].categories[1].clues).toEqual([
      {
        clue: "The cat in the boots",
        answer: "Puss in Boots",
        value: 100,
        secret: true,
        secretTopic: "Famous cats",
        secretValue: 500,
      },
      {
        clue: "A bag cat question",
        answer: "Bag",
        value: 200,
        secret: true,
        secretTopic: "Bags",
        secretValue: 500,
      },
      {
        clue: "An auction question",
        answer: "Auction",
        value: 300,
        wagerable: true,
      },
      { clue: "A sponsored question", answer: "Sponsored", value: 400 },
    ]);
  });

  it("maps the final round", () => {
    expect(game.boards[1].categories[0]).toMatchObject({
      name: "Final A",
      clues: [{ longForm: true, wagerable: true, answer: "First" }],
    });
    expect(summary).toMatchObject({ boards: 2, questions: 9, mediaFiles: 5 });
  });
});

describe("importSiq edge cases", () => {
  it("turns display time hints into the question's reading time", async () => {
    const xml = v5Xml(
      v5Question('<item duration="00:00:07">Q</item>') +
        v5Question('<item duration="00:02:00">Long</item>') +
        v5Question("<item>No hint</item>"),
    );
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      store: fakeStore(),
    });
    expect(GameSchema.safeParse(game).success).toBe(true);
    expect(clue(game, 0, 0, 0).readTimeSec).toBe(7);
    // Capped at the 60 s Jep! allows.
    expect(clue(game, 0, 0, 1).readTimeSec).toBe(60);
    expect(clue(game, 0, 0, 2).readTimeSec).toBeUndefined();
  });

  it("reads v4 atom times (rounded)", async () => {
    const xml = `<package name="P" version="4"><rounds><round name="R"><themes><theme name="T"><questions>
      <question price="100"><scenario><atom time="4.6">Q</atom></scenario><right><answer>A</answer></right></question>
    </questions></theme></themes></round></rounds></package>`;
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      store: fakeStore(),
    });
    expect(clue(game, 0, 0, 0).readTimeSec).toBe(5);
  });

  it("splits a round with more than 12 themes and renames duplicates", async () => {
    const themes = Array.from(
      { length: 14 },
      (_, i) =>
        `<theme name="${i < 2 ? "Same" : `T${i}`}"><questions>${v5Question("<item>Q</item>")}</questions></theme>`,
    ).join("");
    const xml = `<package name="P" version="5"><rounds><round name="Big"><themes>${themes}</themes></round></rounds></package>`;
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": xml }),
      { store: fakeStore() },
    );
    expect(game.boards.map((b) => b.categories.length)).toEqual([12, 2]);
    expect(game.boards[0].categoryNames.slice(0, 2)).toEqual([
      "Same",
      "Same (2)",
    ]);
    expect(summary.warnings).toContain(
      "Big: 14 themes don't fit on one board (at most 12), so it was split into 2 rounds.",
    );
  });

  it("names nameless themes and packages", async () => {
    const xml = `<package name="" version="5"><rounds><round name=""><themes><theme name=" "><questions>${v5Question("<item>Q</item>")}</questions></theme></themes></round></rounds></package>`;
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      fileName: "My pack.siq",
      store: fakeStore(),
    });
    expect(game.title).toBe("My pack");
    expect(game.author).toBe("Unknown");
    expect(game.boards[0].categoryNames).toEqual(["Theme 1"]);
  });

  it("uses https links as they are and skips other links", async () => {
    const xml = v5Xml(
      v5Question(
        '<item>Q</item><item type="image">https://example.com/a.png</item><item type="image">http://example.com/b.png</item><item type="audio">https://youtu.be/aqz-KE-bpKQ</item>',
      ),
    );
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": xml }),
      { store: fakeStore() },
    );
    expect(clue(game, 0, 0, 0).media).toEqual([
      { type: "image", src: "https://example.com/a.png" },
    ]);
    expect(summary.warnings).toEqual([
      'R › T › 100: link "http://example.com/b.png" skipped (media src must be an https:// URL).',
      'R › T › 100: link "https://youtu.be/aqz-KE-bpKQ" skipped (YouTube links must use type "video").',
    ]);
  });

  it("skips unsupported and too large files", async () => {
    const xml = v5Xml(
      v5Question(
        '<item>Q</item><item type="image" isRef="True">x.svg</item><item type="image" isRef="True">big.png</item>',
      ),
    );
    const { game, summary } = await importSiq(
      zipFiles({
        "content.xml": xml,
        "Images/x.svg": "<svg/>",
        "Images/big.png": new Uint8Array(2000),
      }),
      { store: fakeStore(), maxMediaFileSize: 1000 },
    );
    expect(clue(game, 0, 0, 0).media).toBeUndefined();
    expect(summary.warnings).toEqual([
      'R › T › 100: file "x.svg" has an unsupported type.',
      'R › T › 100: file "big.png" is larger than 0 MB.',
    ]);
  });

  it("uses the file extension to decide the media type", async () => {
    const xml = v5Xml(
      v5Question('<item type="image" isRef="True">song.mp3</item>'),
    );
    const { game } = await importSiq(
      zipFiles({ "content.xml": xml, "Images/song.mp3": "id3" }),
      { store: fakeStore() },
    );
    expect(clue(game, 0, 0, 0).media).toEqual([
      { type: "audio", src: `${BASE}/0001.mp3` },
    ]);
  });

  it("keeps at most 10 media blocks", async () => {
    const items = Array.from(
      { length: 12 },
      (_, i) => `<item type="image">https://example.com/${i}.png</item>`,
    ).join("");
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": v5Xml(v5Question(items)) }),
      { store: fakeStore() },
    );
    expect(clue(game, 0, 0, 0).media).toHaveLength(10);
    expect(summary.warnings).toEqual([
      "R › T › 100: only the first 10 of 12 media files are used.",
    ]);
  });

  it("warns about unknown question types and missing answers", async () => {
    const xml = `<package name="P" version="5"><rounds><round name="R"><themes><theme name="T"><questions>
      <question price="100" type="mystery"><params><param name="question" type="content"><item>Q</item></param></params><right /></question>
    </questions></theme></themes></round></rounds></package>`;
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": xml }),
      { store: fakeStore() },
    );
    expect(clue(game, 0, 0, 0)).toEqual({
      clue: "Q",
      answer: "(no answer in the pack)",
      value: 100,
    });
    expect(summary.warnings).toEqual([
      "R › T › 100: the pack has no answer for this question.",
      'R › T › 100: question type "mystery" is played as a normal question.',
    ]);
  });

  it("uses answer text when there are no right answers", async () => {
    const xml = v5Xml(
      `<question price="100"><params><param name="question" type="content"><item>Q</item></param><param name="answer" type="content"><item>Shown answer</item></param></params><right /></question>`,
    );
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      store: fakeStore(),
    });
    expect(clue(game, 0, 0, 0).answer).toBe("Shown answer");
  });

  it("does not import invalid options", async () => {
    const xml = v5Xml(
      v5Question(
        "<item>Q</item>",
        '<param name="answerType">select</param><param name="answerOptions" type="group"><param name="A" type="content"><item>Same</item></param><param name="B" type="content"><item>same</item></param></param>',
      ),
    );
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": xml }),
      { store: fakeStore() },
    );
    expect(clue(game, 0, 0, 0).choices).toBeUndefined();
    expect(summary.warnings[0]).toMatch(/options not imported/);
  });

  it("secret with price 0 keeps the cell value", async () => {
    const xml = v5Xml(
      v5Question(
        "<item>Q</item>",
        '<param name="price" type="numberSet"><numberSet minimum="0" maximum="0" /></param>',
        'price="300" type="secret"',
      ),
    );
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      store: fakeStore(),
    });
    expect(clue(game, 0, 0, 0)).toEqual({
      clue: "Q",
      answer: "A",
      value: 300,
      secret: true,
    });
  });

  it("does not upload media of final themes that are skipped", async () => {
    const final = (name: string, file: string) =>
      `<theme name="${name}"><questions>${v5Question(`<item>Q</item><item type="image" isRef="True">${file}</item>`, "", 'price="0"')}</questions></theme>`;
    const xml = `<package name="P" version="5"><rounds><round name="F" type="final"><themes>${final("A", "a.png")}${final("B", "b.png")}</themes></round></rounds></package>`;
    const store = fakeStore();
    const { summary } = await importSiq(
      zipFiles({
        "content.xml": xml,
        "Images/a.png": "a",
        "Images/b.png": "b",
      }),
      { store },
    );
    expect(store.upload).toHaveBeenCalledTimes(1);
    expect(summary).toMatchObject({ questions: 1, droppedQuestions: 1 });
  });

  it("skips a file that fails to upload", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const xml = v5Xml(
      v5Question('<item>Q</item><item type="image" isRef="True">a.png</item>'),
    );
    const { game, summary } = await importSiq(
      zipFiles({ "content.xml": xml, "Images/a.png": "a" }),
      { store: fakeStore({ fail: () => true }) },
    );
    expect(clue(game, 0, 0, 0).media).toBeUndefined();
    expect(summary.warnings).toEqual([
      'R › T › 100: file "a.png" could not be uploaded.',
    ]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("fails without playable questions and removes uploaded media", async () => {
    const xml = v5Xml(
      v5Question('<item type="image" isRef="True">missing.png</item>'),
    );
    const store = fakeStore();
    await expect(
      importSiq(zipFiles({ "content.xml": xml }), { store }),
    ).rejects.toThrow("The SIGame pack has no questions Jep! can play.");
    expect(store.removeAll).toHaveBeenCalled();
  });

  it("removes uploaded media when the game is invalid", async () => {
    // The converter always produces valid games, so simulate a schema
    // rejection to check the cleanup.
    const xml = v5Xml(
      v5Question('<item>Q</item><item type="image" isRef="True">a.png</item>'),
    );
    const store = fakeStore();
    const failure = GameSchema.safeParse({});
    const spy = vi
      .spyOn(GameSchema, "safeParse")
      .mockImplementation(() => failure);
    try {
      await expect(
        importSiq(zipFiles({ "content.xml": xml, "Images/a.png": "a" }), {
          store,
        }),
      ).rejects.toThrow(/^The imported game is not valid \(title: /);
      expect(store.upload).toHaveBeenCalledTimes(1);
      expect(store.removeAll).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects bad XML with a SiqImportError", async () => {
    await expect(
      importSiq(zipFiles({ "content.xml": "<package><oops></package>" }), {
        store: fakeStore(),
      }),
    ).rejects.toThrow(SiqImportError);
  });

  it("enforces the archive limits", async () => {
    await expect(
      importSiq(buildSiq("v5"), {
        store: fakeStore(),
        limits: { ...DEFAULT_ARCHIVE_LIMITS, maxTotalSize: 100 },
      }),
    ).rejects.toThrow(/too large when unpacked/);
  });
});

describe("importSiq in Ukrainian", () => {
  it("writes warnings in the user's language", async () => {
    const { summary } = await importSiq(buildSiq("v5"), {
      fileName: "test.siq",
      store: fakeStore(),
      locale: "uk",
    });
    expect(summary.warnings).toEqual(
      expect.arrayContaining([
        "Round 1 › Sounds & video › 300: файлу «missing.png» немає в пакеті.",
        "Round 1 › Sounds & video › 500: HTML-вміст не підтримується («page.html»).",
        "Final: у Jep! лише одне фінальне питання, тож імпортовано тільки тему «Final A»; ще 1 фінальну тему пропущено.",
      ]),
    );
  });

  it("names nameless rounds and themes in the user's language", async () => {
    const xml =
      '<package name="P" version="5"><rounds><round name=""><themes><theme name=""><questions>' +
      '<question price="100"><params><param name="question" type="content"><item>Q</item></param></params><right><answer>A</answer></right></question>' +
      "</questions></theme></themes></round></rounds></package>";
    const { game } = await importSiq(zipFiles({ "content.xml": xml }), {
      store: fakeStore(),
      locale: "uk",
    });
    expect(game.boards[0].categoryNames).toEqual(["Тема 1"]);
  });

  it("localizes import errors", async () => {
    const error = await importSiq(new TextEncoder().encode("{}"), {
      store: fakeStore(),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SiqImportError);
    if (!(error instanceof SiqImportError)) return;
    expect(error.message).toBe("The file is not a SIGame pack (not a zip).");
    expect(error.localize("uk")).toBe(
      "Цей файл не є пакетом SIGame (це не zip-архів).",
    );
  });
});
