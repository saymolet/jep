import { z } from "zod";

import type { TFunction } from "~/i18n";
import { setAdminGameVisibility } from "~/models/admin.server";

import { GAME_VISIBILITIES } from "./constants";

const VisibilityForm = z.object({
  gameId: z.guid(),
  visibility: z.enum(GAME_VISIBILITIES),
});

/** changeVisibility handles the "change visibility" form (games list and
 * game page) and returns the message to show. */
export async function changeVisibility(formData: FormData, t: TFunction) {
  const parsed = VisibilityForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Response("Bad Request", { status: 400 });
  }
  const { gameId, visibility } = parsed.data;
  const title = await setAdminGameVisibility(gameId, visibility);
  if (title === null) {
    return { success: false, message: t("admin.game.notFound") };
  }
  return {
    success: true,
    message: t("admin.games.visibilityChanged", {
      title,
      visibility: t(`common.visibility.${visibility}`),
    }),
  };
}

/** errorMessage is a short text for an unexpected error. */
export function errorMessage(error: unknown, t: TFunction) {
  return t("admin.error", {
    error: error instanceof Error ? error.message : String(error),
  });
}
