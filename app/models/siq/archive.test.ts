import { describe, expect, it } from "vitest";

import { buildSiq, zipFiles } from "~/test-fixtures/siq/build";

import { DEFAULT_ARCHIVE_LIMITS, openSiqArchive } from "./archive";
import { SiqImportError } from "./errors";

const CONTENT = '<package name="P" version="5" />';

/** Patches the uncompressed size of `name` in the zip's central directory. */
function patchDeclaredSize(zip: Uint8Array, name: string, size: number) {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  for (let i = zip.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) !== 0x02014b50) continue;
    const nameLength = view.getUint16(i + 28, true);
    const entryName = new TextDecoder().decode(
      zip.subarray(i + 46, i + 46 + nameLength),
    );
    if (entryName === name) view.setUint32(i + 24, size, true);
  }
}

describe("openSiqArchive", () => {
  it("reads content.xml and finds URI-escaped media", () => {
    const archive = openSiqArchive(buildSiq("v5"));
    expect(archive.contentXml).toContain('name="Test pack v5"');

    const red = archive.findFile("image", "red dot.png");
    expect(red?.path).toBe("Images/red%20dot.png");
    expect(archive.read(red!).slice(1, 4)).toEqual(
      new Uint8Array([0x50, 0x4e, 0x47]), // "PNG"
    );
    expect(archive.findFile("image", "кот.png")?.path).toBe(
      `Images/${encodeURI("кот.png")}`,
    );
    expect(archive.findFile("audio", "beep.wav")?.path).toBe("Audio/beep.wav");
    expect(archive.findFile("video", "clip.mp4")?.path).toBe("Video/clip.mp4");
    expect(archive.findFile("image", "missing.png")).toBeUndefined();
  });

  it("matches folders case-insensitively, prefers the kind's folder and falls back to any folder", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const archive = openSiqArchive(
      zipFiles({
        "content.xml": CONTENT,
        "images/a.png": bytes,
        "Audio/a.png": bytes,
        "Other/b%20c.mp3": bytes,
      }),
    );
    expect(archive.findFile("image", "a.png")?.path).toBe("images/a.png");
    expect(archive.findFile("audio", "a.png")?.path).toBe("Audio/a.png");
    expect(archive.findFile("audio", "b c.mp3")?.path).toBe("Other/b%20c.mp3");
    // A ref that is itself escaped matches too.
    expect(archive.findFile("audio", "b%20c.mp3")?.path).toBe(
      "Other/b%20c.mp3",
    );
  });

  it("finds content.xml regardless of case and strips nothing else", () => {
    const archive = openSiqArchive(zipFiles({ "Content.XML": CONTENT }));
    expect(archive.contentXml).toBe(CONTENT);
  });

  it("rejects files that are not zips", () => {
    expect(() => openSiqArchive(new TextEncoder().encode("{}"))).toThrow(
      /not a zip/,
    );
    expect(() => openSiqArchive(new Uint8Array())).toThrow(SiqImportError);
  });

  it("rejects a broken zip", () => {
    const zip = buildSiq("v5").slice(0, 200);
    expect(() => openSiqArchive(zip)).toThrow(SiqImportError);
  });

  it("rejects a pack without content.xml", () => {
    expect(() =>
      openSiqArchive(zipFiles({ "Images/a.png": new Uint8Array([1]) })),
    ).toThrow(/no content.xml/);
  });

  it("rejects content.xml that isn't UTF-8", () => {
    expect(() =>
      openSiqArchive(zipFiles({ "content.xml": new Uint8Array([0xff, 0xfe]) })),
    ).toThrow(/UTF-8/);
  });

  describe("zip bomb guards", () => {
    it("limits the number of entries", () => {
      const files: Record<string, string> = { "content.xml": CONTENT };
      for (let i = 0; i < 10; i++) files[`Images/${i}.png`] = "x";
      expect(() =>
        openSiqArchive(zipFiles(files), {
          ...DEFAULT_ARCHIVE_LIMITS,
          maxEntries: 10,
        }),
      ).toThrow(/too many files/);
    });

    it("limits the total unpacked size before unpacking anything", () => {
      // 20 MB of zeros compresses to a few KB.
      const zip = zipFiles({
        "content.xml": CONTENT,
        "Images/zeros.xml": new Uint8Array(20 * 1024 * 1024),
      });
      expect(zip.length).toBeLessThan(100_000);
      expect(() =>
        openSiqArchive(zip, {
          ...DEFAULT_ARCHIVE_LIMITS,
          maxTotalSize: 10 * 1024 * 1024,
        }),
      ).toThrow(/too large when unpacked/);
    });

    it("limits content.xml", () => {
      expect(() =>
        openSiqArchive(zipFiles({ "content.xml": CONTENT }), {
          ...DEFAULT_ARCHIVE_LIMITS,
          maxContentXmlSize: 10,
        }),
      ).toThrow(/content.xml is too large/);
    });

    it("never unpacks more than the declared size of an entry", () => {
      const zip = zipFiles({
        "content.xml": CONTENT,
        "Images/zeros.xml": new Uint8Array(5 * 1024 * 1024),
      });
      patchDeclaredSize(zip, "Images/zeros.xml", 100);
      const archive = openSiqArchive(zip);
      const file = archive.findFile("image", "zeros.xml")!;
      expect(file.size).toBe(100);
      expect(archive.read(file).length).toBeLessThanOrEqual(100);
    });
  });
});
