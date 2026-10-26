import { createClient } from "@supabase/supabase-js";

const EMAIL = process.env.E2E_TEST_EMAIL ?? "playwright@test.local";
const PASSWORD = process.env.E2E_TEST_PASSWORD ?? "test-password";

export default async function globalSetup() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for E2E tests",
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create the auth user (or update password if already exists).
  // We use the admin API because supabase/config.toml has
  // enable_confirmations = true, so regular signup requires email verification.
  let userId: string;

  const { data: createData, error: createError } =
    await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });

  if (createError) {
    // User already exists — find them and update their password
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData.users.find((u) => u.email === EMAIL);
    if (!existing) {
      throw new Error(
        `Failed to create test user and could not find existing: ${createError.message}`,
      );
    }
    userId = existing.id;

    await supabase.auth.admin.updateUserById(userId, { password: PASSWORD });
  } else {
    userId = createData.user.id;
  }

  // Ensure the public.accounts row exists (required by the root loader's
  // getUserByEmail query).
  const { error: upsertError } = await supabase
    .from("accounts")
    .upsert({ id: userId, email: EMAIL }, { onConflict: "id" });

  if (upsertError) {
    throw new Error(`Failed to upsert accounts row: ${upsertError.message}`);
  }

  // Every run uploads games as the test user and nothing deletes them, so
  // the profile page grew with each run until profile specs timed out.
  // Start each run with an empty profile — but only against a local stack,
  // never a hosted project.
  const { hostname } = new URL(supabaseUrl);
  if (hostname === "127.0.0.1" || hostname === "localhost") {
    const { count, error: deleteError } = await supabase
      .from("games")
      .delete({ count: "exact" })
      .eq("uploaded_by", userId);
    if (deleteError) {
      throw new Error(`Failed to clean up test games: ${deleteError.message}`);
    }
    console.log(`[global-setup] Removed ${count ?? 0} games from earlier runs`);

    // Specs change the shared account's settings (theme, language, sound…);
    // an interrupted run left them changed and the next run's settings spec
    // clicked an already-selected option. Start every run from defaults.
    const { error: settingsError } = await supabase
      .from("accounts")
      .update({ settings: {} })
      .eq("id", userId);
    if (settingsError) {
      throw new Error(
        `Failed to reset test settings: ${settingsError.message}`,
      );
    }
  }

  console.log(`[global-setup] Test user ready: ${EMAIL} (${userId})`);
}
