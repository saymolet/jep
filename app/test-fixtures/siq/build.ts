/** Builds the synthetic SIGame packs used by unit and e2e tests from the
 * readable sources in this folder (`v4.content.xml`, `v5.content.xml`,
 * `media/`). File names inside the zip are URI-escaped like SIQuester does
 * (`Images/red%20dot.png`). */
import { readFileSync } from "node:fs";
import path from "node:path";

import { strToU8, zipSync, type Zippable } from "fflate";

export const SIQ_FIXTURE_DIR = path.resolve("app/test-fixtures/siq");

// A fixed timestamp keeps the zip bytes stable.
const MTIME = new Date("2026-01-01T00:00:00Z");

function media(name: string): Uint8Array {
  return readFileSync(path.join(SIQ_FIXTURE_DIR, "media", name));
}

/** The media files of both fixture packs (zip path -> bytes). */
export function fixtureMedia(): Record<string, Uint8Array> {
  return {
    [`Images/${encodeURI("red dot.png")}`]: media("red.png"),
    [`Images/${encodeURI("кот.png")}`]: media("red.png"),
    "Images/blue.png": media("blue.png"),
    "Audio/beep.wav": media("beep.wav"),
    "Video/clip.mp4": media("clip.mp4"),
  };
}

export function fixtureContentXml(version: "v4" | "v5"): string {
  return readFileSync(
    path.join(SIQ_FIXTURE_DIR, `${version}.content.xml`),
    "utf-8",
  );
}

/** zipFiles zips the given files (no compression for media, like SIQuester). */
export function zipFiles(
  files: Record<string, Uint8Array | string>,
): Uint8Array<ArrayBuffer> {
  const zippable: Zippable = {};
  for (const [name, content] of Object.entries(files)) {
    zippable[name] = [
      typeof content === "string" ? strToU8(content) : content,
      { mtime: MTIME, level: name.endsWith(".xml") ? 6 : 0 },
    ];
  }
  // A copy backed by a plain ArrayBuffer, so it can be used as a BlobPart.
  return new Uint8Array(zipSync(zippable));
}

/** buildSiq builds a fixture pack; `extra` adds or replaces zip entries. */
export function buildSiq(
  version: "v4" | "v5",
  extra: Record<string, Uint8Array | string> = {},
): Uint8Array<ArrayBuffer> {
  return zipFiles({
    "content.xml": fixtureContentXml(version),
    "Texts/authors.xml": '<?xml version="1.0" encoding="utf-8"?><Authors />',
    ...fixtureMedia(),
    ...extra,
  });
}
