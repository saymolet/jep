import { data } from "react-router";
import { z } from "zod";

import { createT, type TFunction } from "~/i18n";
import { getRequestLocale } from "~/i18n/resolve";
import {
  getAuthAccountByAccessToken,
  requireAuthSession,
  signInWithEmail,
  updateAuthPassword,
} from "~/models/auth";
import { assertIsPost } from "~/utils/http.server";

import type { Route } from "./+types/account.change-password";

function formSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(6, t("auth.passwordTooShort")),
      confirmPassword: z.string(),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t("auth.passwordsDontMatch"),
      path: ["confirmPassword"],
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
  const { currentPassword, newPassword } = result.data;

  try {
    const authUser = await getAuthAccountByAccessToken(authSession.accessToken);
    const hasPassword =
      authUser.identities?.some((i) => i.provider === "email") ?? false;

    if (hasPassword) {
      if (!currentPassword) {
        return data(
          { error: t("auth.account.currentPasswordRequired"), ok: false },
          { status: 400 },
        );
      }
      const verified = await signInWithEmail(
        authSession.email,
        currentPassword,
      );
      if (!verified) {
        return data(
          { error: t("auth.account.currentPasswordIncorrect"), ok: false },
          { status: 400 },
        );
      }
    }

    await updateAuthPassword(
      authSession.accessToken,
      newPassword,
      authSession.refreshToken,
    );
    return data({ error: null, ok: true });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : t("auth.account.updatePasswordFailed");
    return data({ error: message, ok: false }, { status: 500 });
  }
}
