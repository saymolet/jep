import type { FileUpload } from "@mjackson/form-data-parser";

import type { AuthSession } from "~/models/auth";
import { Convert } from "~/models/convert.server";
import type { GameVisibility } from "~/models/game.server";
import { createGame } from "~/models/game.server";
import { importSiq, type SiqImportSummary } from "~/models/siq/import.server";
import { createGameMediaStore } from "~/models/siq/media-store.server";

/** MAX_JSON_SIZE is the largest Jep! game (.jep.json) upload. */
export const MAX_JSON_SIZE = 1_000_000;
/** MAX_SIQ_SIZE is the largest SIGame pack (.siq) upload (nginx allows a bit
 * more, so the app reports the error). */
export const MAX_SIQ_SIZE = 100 * 1024 * 1024;

export type UploadKind = "json" | "siq";

/** uploadKind decides how to read an uploaded file. Browsers report .siq
 * files as zip, octet-stream or nothing, so the file name decides. */
export function uploadKind(file: {
  name: string;
  type: string;
}): UploadKind | undefined {
  const name = file.name.toLowerCase();
  if (name.endsWith(".siq")) return "siq";
  if (file.type === "application/json" || name.endsWith(".json")) {
    return "json";
  }
  return undefined;
}

export class UploadError extends Error {}

/** newUploadHandler creates a function which uploads games to the database:
 * Jep! games (.jep.json) as they are, SIGame packs (.siq) converted, with
 * their media uploaded to storage. After a .siq import, `siqSummary()`
 * describes what was imported. */
export function newUploadHandler(
  authSession: AuthSession | null,
  visibility: GameVisibility,
) {
  const userId = authSession?.userId;
  let summary: SiqImportSummary | undefined;

  async function handler(fileUpload: FileUpload) {
    const kind = uploadKind(fileUpload);
    if (fileUpload.fieldName !== "upload" || !kind) {
      console.warn(
        `Invalid upload: fieldName=${fileUpload.fieldName}, type=${fileUpload.type}`,
      );
      if (fileUpload.fieldName === "upload") {
        throw new UploadError(
          "Unsupported file. Upload a Jep! game (.jep.json) or a SIGame pack (.siq).",
        );
      }
      return undefined;
    }

    const bytes = new Uint8Array(await fileUpload.arrayBuffer());

    if (kind === "json") {
      if (bytes.length > MAX_JSON_SIZE) {
        throw new UploadError("JSON games must be at most 1 MB.");
      }
      const game = Convert.toGame(new TextDecoder().decode(bytes));
      return createGame(game, visibility, userId, authSession?.accessToken);
    }

    const store = createGameMediaStore();
    const result = await importSiq(bytes, {
      fileName: fileUpload.name,
      store,
    });
    try {
      const gameId = await createGame(
        result.game,
        visibility,
        userId,
        authSession?.accessToken,
      );
      summary = result.summary;
      return gameId;
    } catch (error) {
      await store.removeAll().catch((cleanupError: unknown) => {
        console.error(
          "SIGame import: removing uploaded media failed",
          cleanupError,
        );
      });
      throw error;
    }
  }

  return Object.assign(handler, { siqSummary: () => summary });
}
