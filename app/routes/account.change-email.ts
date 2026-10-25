import { data } from "react-router";
import { z } from "zod";

import { createT, type TFunction } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import { requireAuthSession, updateAuthEmail } from "~/models/auth";
import { assertIsPost } from "~/utils/http.server";

import type { Route } from "./+types/account.change-email";

function formSchema(t: TFunction) {
  return z.object({
    newEmail: z.string().email(t("auth.invalidEmail")),
  });
}

export async function action({ request }: Route.ActionArgs) {
  assertIsPost(request);
  const authSession = await requireAuthSession(request);
  if (!authSession) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const result = formSchema(t).safeParse(Object.fromEntries(formData));
  if (!result.success) {
    return data(
      { error: result.error.issues[0].message, ok: false },
      { status: 400 },
    );
  }

  try {
    await updateAuthEmail(
      authSession.accessToken,
      result.data.newEmail,
      authSession.refreshToken,
    );
    return data({ error: null, ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("auth.account.updateEmailFailed");
    return data({ error: message, ok: false }, { status: 500 });
  }
}
