/** Safe, in-memory access to the files of a SIGame package (a zip file).
 *
 * Zip bomb protection: every limit is checked against the sizes declared in
 * the zip's central directory before anything is decompressed, and fflate
 * decompresses each entry into a buffer of exactly the declared size, so a
 * lying header can't make an entry grow beyond it. Entries are decompressed
 * one at a time, only when needed. Nothing is written to disk.
 */
import { unzipSync, type UnzipFileInfo } from "fflate";

import { SiqImportError } from "./errors";

const MiB = 1024 * 1024;

export interface ArchiveLimits {
  /** Most entries (files and folders) in the zip. */
  maxEntries: number;
  /** Most bytes of all entries together, uncompressed. */
  maxTotalSize: number;
  /** Most bytes of content.xml, uncompressed. */
  maxContentXmlSize: number;
}

export const DEFAULT_ARCHIVE_LIMITS: ArchiveLimits = {
  maxEntries: 5000,
  maxTotalSize: 300 * MiB,
  maxContentXmlSize: 20 * MiB,
};

export interface ArchiveFile {
  /** Full path inside the zip, e.g. "Images/red%20dot.png". */
  path: string;
  /** Uncompressed size declared by the zip. */
  size: number;
}

/** The folders SIQuester stores media in, by content kind. */
const KIND_FOLDERS: Record<string, string[]> = {
  image: ["images"],
  audio: ["audio"],
  video: ["video"],
  html: ["html"],
};

function safeDecode(name: string): string {
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}

export class SiqArchive {
  readonly contentXml: string;
  private readonly bytes: Uint8Array;
  private readonly files: ArchiveFile[];

  constructor(bytes: Uint8Array, limits: ArchiveLimits) {
    this.bytes = bytes;
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new SiqImportError("The file is not a SIGame pack (not a zip).");
    }

    // Pass 1: list the entries (decompress nothing) and check the limits.
    const files: ArchiveFile[] = [];
    let total = 0;
    try {
      unzipSync(bytes, {
        filter: (info: UnzipFileInfo) => {
          files.push({ path: info.name, size: info.originalSize });
          total += info.originalSize;
          return false;
        },
      });
    } catch (error) {
      throw new SiqImportError(
        `The SIGame pack could not be opened: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (files.length > limits.maxEntries) {
      throw new SiqImportError(
        `The SIGame pack has too many files (${files.length}; at most ${limits.maxEntries}).`,
      );
    }
    if (total > limits.maxTotalSize) {
      throw new SiqImportError(
        `The SIGame pack is too large when unpacked (${Math.round(total / MiB)} MB; at most ${Math.round(limits.maxTotalSize / MiB)} MB).`,
      );
    }
    this.files = files.filter((f) => !f.path.endsWith("/"));

    const content = this.files.find(
      (f) => f.path.toLowerCase() === "content.xml",
    );
    if (!content) {
      throw new SiqImportError(
        "The SIGame pack has no content.xml. Is it a .siq file?",
      );
    }
    if (content.size > limits.maxContentXmlSize) {
      throw new SiqImportError(
        `content.xml is too large (at most ${Math.round(limits.maxContentXmlSize / MiB)} MB).`,
      );
    }
    try {
      this.contentXml = new TextDecoder("utf-8", { fatal: true }).decode(
        this.read(content),
      );
    } catch (error) {
      if (error instanceof SiqImportError) throw error;
      throw new SiqImportError("content.xml is not valid UTF-8 text.");
    }
  }

  /** findFile finds the file a content item refers to. Names in the zip may be
   * URI-escaped and folder names may differ in case; if the file isn't in the
   * folder for its kind, any folder is searched. */
  findFile(kind: string, ref: string): ArchiveFile | undefined {
    const wanted = new Set([ref, safeDecode(ref)]);
    const matches = this.files.filter((file) => {
      const slash = file.path.lastIndexOf("/");
      if (slash < 0) return false;
      const name = file.path.slice(slash + 1);
      return wanted.has(name) || wanted.has(safeDecode(name));
    });
    const folders = KIND_FOLDERS[kind] ?? [];
    return (
      matches.find((file) =>
        folders.includes(file.path.split("/")[0].toLowerCase()),
      ) ?? matches[0]
    );
  }

  /** read decompresses one file. The result is never larger than the size
   * the zip declares for it (already checked against the limits). */
  read(file: ArchiveFile): Uint8Array {
    let result: Uint8Array | undefined;
    try {
      const out = unzipSync(this.bytes, {
        filter: (info) => info.name === file.path,
      });
      result = out[file.path];
    } catch (error) {
      throw new SiqImportError(
        `${file.path} could not be unpacked: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!result) {
      throw new SiqImportError(`${file.path} is missing from the pack.`);
    }
    return result;
  }
}

/** openSiqArchive opens a .siq file held in memory and reads its content.xml.
 * Throws {@link SiqImportError} if it isn't a usable SIGame pack or breaks
 * a limit. */
export function openSiqArchive(
  bytes: Uint8Array,
  limits: ArchiveLimits = DEFAULT_ARCHIVE_LIMITS,
): SiqArchive {
  return new SiqArchive(bytes, limits);
}
