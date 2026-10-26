import * as React from "react";
import {
  data,
  Form,
  redirect,
  useNavigation,
  useSearchParams,
} from "react-router";
import { z } from "zod";

import Button from "~/components/button";
import { ErrorMessage } from "~/components/error";
import Input from "~/components/input";
import Link from "~/components/link";
import Main from "~/components/main";
import OAuthButtons from "~/components/oauth-buttons";
import ShowPasswordButton from "~/components/show-password-button";
import { createT } from "~/i18n";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getRequestLocale } from "~/i18n/resolve";
import {
  createAuthSession,
  getValidAuthSession,
  signInWithEmail,
} from "~/models/auth";
import {
  assertIsPost,
  getRedirectTo,
  parseFormData,
} from "~/utils/http.server";

import type { Route } from "./+types/login";

const formSchema = z.object({ email: z.string(), password: z.string() });

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: metaT(matches)("auth.login.metaTitle") },
];

export async function loader({ request }: Route.LoaderArgs) {
  const authSession = await getValidAuthSession(request);

  if (authSession) throw redirect(getRedirectTo(request));

  return null;
}

export async function action({ request }: Route.ActionArgs) {
  assertIsPost(request);
  const t = createT(getRequestLocale(request));
  const formData = await request.formData();
  const { email, password } = parseFormData(formData, formSchema);

  try {
    const authSession = await signInWithEmail(email, password);

    if (!authSession) {
      return data(
        { error: t("auth.login.invalidCredentials") },
        { status: 400 },
      );
    }

    return createAuthSession({
      request,
      authSession,
      redirectTo: getRedirectTo(request),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data({ error: error.message }, { status: 500 });
    }
    console.error(error);
    return data({ error: t("auth.unknownError") }, { status: 500 });
  }
}

export default function Login({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const disabled = navigation.state !== "idle";

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") ?? "";
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <div className="max-w-full grow">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">{t("auth.login.title")}</h1>
        <p className="mb-4">{t("auth.login.intro")}</p>
        <OAuthButtons redirectTo={redirectTo} disabled={disabled} />
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-page px-2 text-gray-500">{t("auth.or")}</span>
          </div>
        </div>
        <Form method="POST" className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              {t("auth.emailAddress")}
            </label>
            <div>
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
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              {t("auth.password")}
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                id="password"
                autoComplete="current-password"
                disabled={disabled}
                placeholder={t("auth.passwordPlaceholder")}
                required
              />
              <ShowPasswordButton
                showPassword={showPassword}
                onClick={() => setShowPassword((s) => !s)}
              />
            </div>
          </div>
          <div className="flex justify-end text-sm">
            <Link to="/forgot-password">{t("auth.login.forgotPassword")}</Link>
          </div>
          <Button variant="primary" type="submit" disabled={disabled}>
            {t("auth.login.submit")}
          </Button>
          {actionData?.error ? (
            <ErrorMessage>{actionData?.error}</ErrorMessage>
          ) : null}
          <p>
            {t("auth.login.noAccount")}{" "}
            <Link
              to={`/signup${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            >
              {t("auth.login.signUpLink")}
            </Link>
          </p>
        </Form>
      </Main>
    </div>
  );
}
