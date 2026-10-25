import type { Provider } from "@supabase/supabase-js";

import Button from "~/components/button";
import { Discord, Google } from "~/components/icons";
import { useTranslation } from "~/i18n";
import { getSupabase } from "~/supabase";

interface OAuthButtonsProps {
  redirectTo?: string;
  disabled?: boolean;
}

export default function OAuthButtons({
  redirectTo = "/",
  disabled,
}: OAuthButtonsProps) {
  const { t } = useTranslation();
  const handleOAuthLogin = async (provider: Provider) => {
    const supabase = getSupabase();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    if (redirectTo) {
      callbackUrl.searchParams.set("redirectTo", redirectTo);
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error("OAuth error:", error);
      return;
    }

    if (data.url) {
      window.location.href = data.url;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={() => handleOAuthLogin("google")}
        disabled={disabled}
      >
        <Google className="h-5 w-5" />
        {t("auth.continueWithGoogle")}
      </Button>
      <Button
        type="button"
        onClick={() => handleOAuthLogin("discord")}
        disabled={disabled}
      >
        <Discord className="h-5 w-5" />
        {t("auth.continueWithDiscord")}
      </Button>
    </div>
  );
}
