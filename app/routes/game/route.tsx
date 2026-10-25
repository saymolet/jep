import {
  MaxFileSizeExceededError,
  parseFormData,
} from "@mjackson/form-data-parser";
import { redirect } from "react-router";
import { ENV } from "varlock/env";

import { getValidAuthSession } from "~/models/auth";
import { formatSiqSummary } from "~/models/siq/summary";
import { flashFormState } from "~/session.server";
import { getRedirectTo, safeRedirect } from "~/utils/http.server";

import type { Route } from "./+types/route";
import { MAX_SIQ_SIZE, newUploadHandler } from "./file-upload-handler.server";

export function loader({ request }: Route.LoaderArgs) {
  const redirectTo = getRedirectTo(request);
  return redirect(safeRedirect(redirectTo));
}

/** POST /game parses and uploads a new game to the server. */
export async function action({ request }: Route.ActionArgs) {
  const authSession = await getValidAuthSession(request);
  const visibility = authSession !== null ? "UNLISTED" : "PUBLIC";
  const redirectTo = getRedirectTo(request);

  try {
    const uploadHandler = newUploadHandler(authSession, visibility);
    const formData = await parseFormData(
      request,
      {
        // The SIGame pack limit; JSON games are limited to 1 MB by the
        // upload handler.
        maxFileSize: MAX_SIQ_SIZE,
        maxFiles: 1,
      },
      uploadHandler,
    );
    // formData.get will return the type our upload handler returns.
    const gameKey = formData.get("upload")?.toString();

    if (!gameKey) {
      const formState = {
        success: false,
        message: "Error uploading game: no game key returned.",
      };
      const headers = await flashFormState(request, formState);
      return redirect(safeRedirect(redirectTo), { headers, status: 400 });
    }

    const gameUrl = ENV.BASE_URL + "/game/" + gameKey + "/play";
    const created =
      visibility === "PUBLIC"
        ? `Created new public game. You may now view your game on the home page.`
        : `Created new unlisted game. You may now visit the link ${gameUrl} to play the new game.`;
    const siqSummary = uploadHandler.siqSummary();
    const imported = siqSummary ? formatSiqSummary(siqSummary) : undefined;
    const formState = {
      success: true,
      message: imported ? `${imported.message} ${created}` : created,
      ...(imported && imported.details.length > 0
        ? { details: imported.details }
        : {}),
    };
    const headers = await flashFormState(request, formState);
    return redirect(safeRedirect(redirectTo), { headers });
  } catch (error: unknown) {
    if (error instanceof MaxFileSizeExceededError) {
      const formState = {
        success: false,
        message:
          "Error uploading game: the file is too large (SIGame packs: at most 100 MB, JSON games: at most 1 MB).",
      };
      const headers = await flashFormState(request, formState);
      return redirect(safeRedirect(redirectTo), { headers, status: 400 });
    }
    if (error instanceof Error) {
      const formState = {
        success: false,
        message: "Error uploading game: " + error.message,
      };
      const headers = await flashFormState(request, formState);
      return redirect(safeRedirect(redirectTo), { headers, status: 400 });
    }
    throw error;
  }
}
