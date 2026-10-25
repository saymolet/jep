import { data, Form, useNavigation } from "react-router";
import { ENV } from "varlock/env";
import { z } from "zod";

import Button from "~/components/button";
import { SuccessMessage } from "~/components/error";
import Input from "~/components/input";
import Link from "~/components/link";
import Main from "~/components/main";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { sendPasswordResetEmail } from "~/models/auth";
import { assertIsPost, parseFormData } from "~/utils/http.server";

import type { Route } from "./+types/forgot-password";

const formSchema = z.object({ email: z.string().email() });

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: metaT(matches)("auth.forgot.metaTitle") },
];

export async function action({ request }: Route.ActionArgs) {
  assertIsPost(request);
  const formData = await request.formData();
  const { email } = parseFormData(formData, formSchema);

  // Always show success to prevent email enumeration.
  try {
    await sendPasswordResetEmail(email, ENV.BASE_URL + "/reset-password");
  } catch {
    // Silently ignore errors to prevent email enumeration.
  }

  return data({ sent: true });
}

export default function ForgotPassword({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const disabled = navigation.state !== "idle";

  return (
    <div className="max-w-full grow">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">
          {t("auth.forgot.title")}
        </h1>
        <p className="mb-4">{t("auth.forgot.intro")}</p>
        {actionData?.sent ? (
          <>
            <SuccessMessage>{t("auth.forgot.sent")}</SuccessMessage>
            <p className="mt-4">
              <Link to="/login">{t("auth.forgot.backToLogin")}</Link>
            </p>
          </>
        ) : (
          <Form method="POST" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                {t("auth.emailAddress")}
              </label>
              <Input
                type="email"
                name="email"
                id="email"
                aria-label={t("auth.emailAddress")}
                autoComplete="email"
                autoFocus
                disabled={disabled}
                placeholder={t("auth.emailPlaceholder")}
                required
              />
            </div>
            <Button variant="primary" type="submit" disabled={disabled}>
              {t("auth.forgot.submit")}
            </Button>
            <p>
              <Link to="/login">{t("auth.forgot.backToLogin")}</Link>
            </p>
          </Form>
        )}
      </Main>
    </div>
  );
}
