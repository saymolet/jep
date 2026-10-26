import { describe, expect, it } from "vitest";

import { fixtureContentXml } from "~/test-fixtures/siq/build";

import { SiqImportError } from "./errors";
import { parseDuration, parsePriceRange, parseSiqXml } from "./parse";

function v5Package(questionXml: string, roundAttrs = "") {
  return `<?xml version="1.0" encoding="utf-8"?>
<package name="P" version="5" xmlns="https://github.com/VladimirKhil/SI/blob/master/assets/siq_5.xsd">
  <rounds><round name="R"${roundAttrs}><themes><theme name="T"><questions>
  ${questionXml}
  </questions></theme></themes></round></rounds>
</package>`;
}

describe("parseSiqXml (v5)", () => {
  const pkg = parseSiqXml(fixtureContentXml("v5"));
  const [round1, final] = pkg.rounds;
  const [pictures, sounds, options] = round1.themes;

  it("reads package info", () => {
    expect(pkg.name).toBe("Test pack v5");
    expect(pkg.version).toBe(5);
    expect(pkg.authors).toEqual(["Jep tester", "Second author"]);
    expect(pkg.comments).toBe("A tiny synthetic pack for tests.");
  });

  it("reads rounds and themes", () => {
    expect(pkg.rounds.map((r) => [r.name, r.type])).toEqual([
      ["Round 1", ""],
      ["Final", "final"],
    ]);
    expect(round1.themes.map((t) => t.name)).toEqual([
      "Pictures",
      "Sounds & video",
      "Options",
    ]);
    expect(final.themes.map((t) => t.name)).toEqual(["Final A", "Final B"]);
  });

  it("reads text and image content", () => {
    expect(pictures.questions[0]).toEqual({
      price: 100,
      type: "",
      question: [
        { kind: "text", value: "What color is this dot?", isRef: false },
        { kind: "image", value: "red dot.png", isRef: true },
      ],
      answer: [],
      right: ["Red"],
    });
  });

  it("reads answer content and several right answers", () => {
    const q = pictures.questions[1];
    expect(q.question).toEqual([
      { kind: "image", value: "кот.png", isRef: true },
    ]);
    expect(q.answer).toEqual([
      { kind: "image", value: "blue.png", isRef: true },
    ]);
    expect(q.right).toEqual(["Cat", "Kitten"]);
  });

  it("reads secret questions with topic and price", () => {
    expect(pictures.questions[2]).toMatchObject({
      type: "secret",
      topic: "Famous cats",
      secretPrice: { min: 500, max: 500 },
    });
    expect(pictures.questions[3]).toMatchObject({
      type: "secretPublicPrice",
      topic: "Ranges",
      secretPrice: { min: 500, max: 1000 },
    });
  });

  it("reads audio, video, stake and other types", () => {
    expect(sounds.questions[0].question[1]).toEqual({
      kind: "audio",
      value: "beep.wav",
      isRef: true,
    });
    expect(sounds.questions[1]).toMatchObject({
      type: "stake",
      question: [
        { kind: "text", value: "Name this clip" },
        { kind: "video", value: "clip.mp4", isRef: true },
      ],
    });
    expect(sounds.questions[4].type).toBe("noRisk");
    expect(sounds.questions[4].question[1].kind).toBe("html");
  });

  it("reads multiple choice options", () => {
    expect(options.questions[0]).toMatchObject({
      answerType: "select",
      options: [
        { label: "A", content: [{ kind: "text", value: "Mars" }] },
        { label: "B", content: [{ kind: "text", value: "Jupiter" }] },
        { label: "C", content: [{ kind: "text", value: "Venus" }] },
      ],
      right: ["B"],
    });
  });

  it("decodes XML entities", () => {
    expect(sounds.name).toBe("Sounds & video");
  });

  it("reads a price given as text", () => {
    const pkg = parseSiqXml(
      v5Package(
        `<question price="100" type="secret"><params><param name="price">[100;300]/100</param><param name="question" type="content"><item>Q</item></param></params><right><answer>A</answer></right></question>`,
      ),
    );
    expect(pkg.rounds[0].themes[0].questions[0].secretPrice).toEqual({
      min: 100,
      max: 300,
    });
  });

  it("handles a question without params or answers", () => {
    const pkg = parseSiqXml(
      v5Package(`<question price="100"><right /></question>`),
    );
    expect(pkg.rounds[0].themes[0].questions[0]).toEqual({
      price: 100,
      type: "",
      question: [],
      answer: [],
      right: [],
    });
  });
});

describe("parseSiqXml (v4)", () => {
  const pkg = parseSiqXml(fixtureContentXml("v4"));
  const [round1, final] = pkg.rounds;
  const [pictures, types] = round1.themes;

  it("reads package info", () => {
    expect(pkg.name).toBe("Test pack v4");
    expect(pkg.version).toBe(4);
    expect(pkg.authors).toEqual(["Old tester"]);
    expect(final.type).toBe("final");
  });

  it("strips @ from file references and splits at the marker", () => {
    expect(pictures.questions[0].question).toEqual([
      { kind: "text", value: "What color is this dot?", isRef: false },
      { kind: "image", value: "red dot.png", isRef: true },
    ]);
    expect(pictures.questions[1].question).toEqual([
      { kind: "image", value: "кот.png", isRef: true },
    ]);
    expect(pictures.questions[1].answer).toEqual([
      { kind: "image", value: "blue.png", isRef: true },
      {
        kind: "text",
        value: "Text after the marker is not shown",
        isRef: false,
      },
    ]);
  });

  it("maps voice to audio and say to text", () => {
    expect(pictures.questions[2].question).toEqual([
      { kind: "text", value: "Listen", isRef: false },
      { kind: "audio", value: "beep.wav", isRef: true },
    ]);
    expect(pictures.questions[3].question[0]).toEqual({
      kind: "video",
      value: "clip.mp4",
      isRef: true,
    });
  });

  it("reads question types and their params", () => {
    expect(types.questions.map((q) => q.type)).toEqual([
      "cat",
      "bagcat",
      "auction",
      "sponsored",
    ]);
    expect(types.questions[0]).toMatchObject({
      topic: "Famous cats",
      secretPrice: { min: 500, max: 500 },
    });
    expect(types.questions[1]).toMatchObject({
      topic: "Bags",
      secretPrice: { min: 100, max: 500 },
    });
  });

  it("keeps external (non-@) media links", () => {
    const xml = `<package name="P" version="4"><rounds><round name="R"><themes><theme name="T"><questions>
      <question price="1"><scenario><atom type="image">https://example.com/a.png</atom></scenario><right><answer>A</answer></right></question>
    </questions></theme></themes></round></rounds></package>`;
    expect(parseSiqXml(xml).rounds[0].themes[0].questions[0].question).toEqual([
      { kind: "image", value: "https://example.com/a.png", isRef: false },
    ]);
  });
});

describe("parseSiqXml errors", () => {
  it("rejects malformed XML", () => {
    expect(() => parseSiqXml("<package><rounds></package>")).toThrow(
      SiqImportError,
    );
    expect(() => parseSiqXml("not xml at all")).toThrow(SiqImportError);
  });

  it("rejects a document without <package>", () => {
    expect(() => parseSiqXml("<other />")).toThrow(/no <package>/);
  });

  it("rejects DOCTYPEs (entity expansion and external entities)", () => {
    const bomb = `<?xml version="1.0"?>
<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;&lol;">]>
<package name="&lol2;" version="5"></package>`;
    expect(() => parseSiqXml(bomb)).toThrow(/DOCTYPE/);
    const xxe = `<?xml version="1.0"?>
<!DOCTYPE p [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<package name="&xxe;" version="5"></package>`;
    expect(() => parseSiqXml(xxe)).toThrow(/DOCTYPE/);
  });

  it("accepts a byte order mark", () => {
    expect(
      parseSiqXml(
        `${String.fromCharCode(0xfeff)}<package name="P" version="5" />`,
      ).name,
    ).toBe("P");
  });
});

describe("parsePriceRange", () => {
  it.each([
    ["500", { min: 500, max: 500 }],
    ["0", { min: 0, max: 0 }],
    ["[100;500]", { min: 100, max: 500 }],
    ["[100;500]/100", { min: 100, max: 500 }],
    [" [500 ; 100] / 50 ", { min: 100, max: 500 }],
    ["abc", undefined],
    ["", undefined],
  ])("%j", (input, expected) => {
    expect(parsePriceRange(input)).toEqual(expected);
  });
});

describe("display time hints", () => {
  const v4 = (atoms: string) =>
    `<package name="P" version="4"><rounds><round name="R"><themes><theme name="T"><questions>
      <question price="1"><scenario>${atoms}</scenario><right><answer>A</answer></right></question>
    </questions></theme></themes></round></rounds></package>`;
  const first = (xml: string) =>
    parseSiqXml(xml).rounds[0].themes[0].questions[0];

  it("v4: sums the time of the question atoms (not the answer part)", () => {
    const q = first(
      v4(
        `<atom>Look</atom><atom type="image" time="5">@a.png</atom><atom type="say" time="2.5">Hm</atom><atom type="marker" /><atom time="9">Answer text</atom>`,
      ),
    );
    expect(q.displayTimeSec).toBe(7.5);
  });

  it("v4: no time attributes, no hint", () => {
    expect(first(v4(`<atom>Look</atom>`)).displayTimeSec).toBeUndefined();
  });

  it("v4: ignores a malformed time", () => {
    expect(
      first(v4(`<atom time="soon">Look</atom>`)).displayTimeSec,
    ).toBeUndefined();
  });

  it("v5: sums the duration of the question items", () => {
    const q = first(
      v5Package(`<question price="100"><params>
        <param name="question" type="content">
          <item>Look</item>
          <item type="image" isRef="True" duration="00:00:06">a.png</item>
          <item type="audio" isRef="True" duration="00:01:00">b.mp3</item>
        </param>
        <param name="answer" type="content"><item duration="00:00:30">x</item></param>
      </params><right><answer>A</answer></right></question>`),
    );
    expect(q.displayTimeSec).toBe(66);
  });

  it("v5: no duration, no hint", () => {
    const q = first(
      v5Package(`<question price="100"><params>
        <param name="question" type="content"><item>Look</item></param>
      </params><right><answer>A</answer></right></question>`),
    );
    expect(q.displayTimeSec).toBeUndefined();
  });

  it.each([
    ["00:00:05", 5],
    ["00:02:03", 123],
    ["01:00:00", 3600],
    ["5", undefined],
    ["", undefined],
    [undefined, undefined],
  ])("parseDuration(%j)", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});
