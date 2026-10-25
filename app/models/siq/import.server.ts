import { createT, type Locale } from "~/i18n";
/** Imports a SIGame pack (.siq): unzip in memory, parse content.xml, upload
 * the media the kept questions use, convert to a Jep! game and validate it.
 * Nothing is inserted into the database here; on any failure the uploaded
 * media is removed again. */
import {
  GameSchema,
  type Game,
  type MediaBlock,
} from "~/models/convert.server";
import { mediaBlockError, MEDIA_TYPES, type MediaType } from "~/utils/media";

import {
  type ArchiveFile,
  type ArchiveLimits,
  DEFAULT_ARCHIVE_LIMITS,
  openSiqArchive,
} from "./archive";
import {
  siqToGame,
  type ResolvedMedia,
  type SiqConversionStats,
} from "./convert";
import { SiqImportError } from "./errors";
import { fileExtension, mediaFileType } from "./media-types";
import { parseSiqXml, type SiqContent } from "./parse";

/** MAX_MEDIA_FILE_SIZE is the largest media file that is imported; larger
 * files are skipped (Supabase Storage's default upload limit is 50 MB). */
export const MAX_MEDIA_FILE_SIZE = 50 * 1024 * 1024;

/** How many files are uploaded at the same time. */
const UPLOAD_CONCURRENCY = 4;

/** Where imported media files go. */
export interface MediaStore {
  /** Uploads a file and returns its public https URL. */
  upload(name: string, bytes: Uint8Array, contentType: string): Promise<string>;
  /** Removes every file this store uploaded. */
  removeAll(): Promise<void>;
}

export interface SiqImportSummary extends SiqConversionStats {
  title: string;
  /** Media files uploaded. */
  mediaFiles: number;
  warnings: string[];
}

export interface SiqImportResult {
  game: Game;
  summary: SiqImportSummary;
}

function isMediaType(kind: string): kind is MediaType {
  return MEDIA_TYPES.some((type) => type === kind);
}

function limiter(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

function describeIssue(error: {
  issues: { path: PropertyKey[]; message: string }[];
}) {
  const issue = error.issues[0];
  if (!issue) return "unknown problem";
  const path = issue.path.map(String).join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

/** importSiq converts a .siq file to a game. Throws {@link SiqImportError}
 * with a user-facing message when the pack can't be imported. Warnings (and
 * names Jep! makes up, like "Round 2") are in `locale`. */
export async function importSiq(
  bytes: Uint8Array,
  {
    fileName = "",
    store,
    limits = DEFAULT_ARCHIVE_LIMITS,
    maxMediaFileSize = MAX_MEDIA_FILE_SIZE,
    locale = "en",
  }: {
    fileName?: string;
    store: MediaStore;
    limits?: ArchiveLimits;
    maxMediaFileSize?: number;
    locale?: Locale;
  },
): Promise<SiqImportResult> {
  const t = createT(locale);
  const archive = openSiqArchive(bytes, limits);
  const pkg = parseSiqXml(archive.contentXml);

  const runUpload = limiter(UPLOAD_CONCURRENCY);
  // One upload per file, even if several questions use it.
  const uploads = new Map<string, Promise<ResolvedMedia>>();
  let fileCount = 0;
  let uploadedCount = 0;

  async function uploadFile(
    file: ArchiveFile,
    ref: string,
    type: MediaType,
    contentType: string,
  ): Promise<ResolvedMedia> {
    const name = `${String(++fileCount).padStart(4, "0")}.${fileExtension(file.path)}`;
    try {
      const src = await runUpload(() =>
        store.upload(name, archive.read(file), contentType),
      );
      uploadedCount++;
      const block: MediaBlock = { type, src };
      return { block };
    } catch (error) {
      if (error instanceof SiqImportError) {
        return { skip: error.localize(locale) };
      }
      console.error(`SIGame import: uploading ${file.path} failed`, error);
      return { skip: t("siq.skip.uploadFailed", { ref }) };
    }
  }

  async function resolveMedia(content: SiqContent): Promise<ResolvedMedia> {
    const ref = content.value.trim();
    if (content.kind === "html") {
      return { skip: t("siq.skip.html", { ref }) };
    }
    if (!isMediaType(content.kind)) {
      return { skip: t("siq.skip.unsupportedKind", { kind: content.kind }) };
    }
    if (!content.isRef) {
      // A link to a file on the web (old packs).
      const block: MediaBlock = { type: content.kind, src: ref };
      const error = mediaBlockError(block);
      return error
        ? { skip: t("siq.skip.link", { ref, reason: error }) }
        : { block };
    }

    const file = archive.findFile(content.kind, ref);
    if (!file) return { skip: t("siq.skip.missingFile", { ref }) };
    const fileType = mediaFileType(file.path);
    if (!fileType) {
      return { skip: t("siq.skip.unsupportedType", { ref }) };
    }
    if (file.size > maxMediaFileSize) {
      return {
        skip: t("siq.skip.tooLarge", {
          ref,
          max: Math.round(maxMediaFileSize / 1024 / 1024),
        }),
      };
    }
    let upload = uploads.get(file.path);
    if (!upload) {
      upload = uploadFile(file, ref, fileType.type, fileType.contentType);
      uploads.set(file.path, upload);
    }
    return upload;
  }

  try {
    const { game, warnings, stats } = await siqToGame(pkg, {
      fileName,
      resolveMedia,
      locale,
    });
    if (stats.questions === 0) {
      throw new SiqImportError("siq.error.noQuestions");
    }
    const parsed = GameSchema.safeParse(game);
    if (!parsed.success) {
      throw new SiqImportError("siq.error.invalidGame", {
        issue: describeIssue(parsed.error),
      });
    }
    return {
      game: parsed.data,
      summary: {
        ...stats,
        title: parsed.data.title,
        mediaFiles: uploadedCount,
        warnings,
      },
    };
  } catch (error) {
    // Let pending uploads settle before cleaning up, so none is left behind.
    await Promise.allSettled(uploads.values());
    await store.removeAll().catch((cleanupError: unknown) => {
      console.error(
        "SIGame import: removing uploaded media failed",
        cleanupError,
      );
    });
    throw error;
  }
}
