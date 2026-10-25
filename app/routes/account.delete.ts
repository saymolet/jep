import { data } from "react-router";
import { z } from "zod";

import { createT } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import {
  deleteAuthAccount,
  destroyAuthSession,
  requireAuthSession,
} from "~/models/auth";

import type { Route } from "./+types/account.delete";

const formSchema = z.object({
  confirmation: z.string(),
});

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    throw new Response("Method not allowed", { status: 405 });
  }

  const authSession = await requireAuthSession(request);
  if (!authSession) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const result = formSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return data(
      { error: t("auth.account.typeEmailToConfirm"), ok: false },
      { status: 400 },
    );
  }

  if (result.data.confirmation !== authSession.email) {
    return data(
      { error: t("auth.account.emailMismatch"), ok: false },
      { status: 400 },
    );
  }

  try {
    await deleteAuthAccount(authSession.userId);
    return destroyAuthSession(request);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t("auth.account.deleteFailed");
    return data({ error: message, ok: false }, { status: 500 });
  }
}
