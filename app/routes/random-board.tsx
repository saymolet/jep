import { data, Form, redirect, useNavigation } from "react-router";
import { z } from "zod";

import Button from "~/components/button";
import { ErrorMessage } from "~/components/error";
import Main from "~/components/main";
import { createT, INTL_LOCALE, useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getRequestLocale } from "~/i18n/resolve";
import { getValidAuthSession } from "~/models/auth";
import { createGame } from "~/models/game.server";
import {
  DEFAULT_RANDOM_CATEGORIES,
  MAX_RANDOM_CATEGORIES,
  MIN_RANDOM_CATEGORIES,
  RANDOM_BOARD_AUTHOR,
  randomBoardOptionsSchema,
} from "~/models/random-board";
import {
  generateRandomGame,
  RandomBoardPoolError,
} from "~/models/random-board.server";

import type { Route } from "./+types/random-board";

export const meta: Route.MetaFunction = ({ matches }) => [
  { title: metaT(matches)("random.metaTitle") },
];

const formSchema = randomBoardOptionsSchema.extend({
  intent: z.enum(["room", "solo"]).default("room"),
});

const CATEGORY_COUNTS = Array.from(
  { length: MAX_RANDOM_CATEGORIES - MIN_RANDOM_CATEGORIES + 1 },
  (_, k) => MIN_RANDOM_CATEGORIES + k,
);

/** POST /random-board builds a new game from random categories of public
 * games and opens it: a new room (default) or solo play. */
export async function action({ request }: Route.ActionArgs) {
  const locale = getRequestLocale(request);
  const t = createT(locale);

  const formData = await request.formData();
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return data({ error: t("random.error.invalid") }, { status: 400 });
  }
  const { intent, ...options } = parsed.data;

  const date = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date());

  try {
    const game = await generateRandomGame(options, {
      title: t("random.gameTitle", { date }),
      author: RANDOM_BOARD_AUTHOR,
      note: (sources) => t("random.gameNote", { sources: sources.join(", ") }),
    });

    const authSession = await getValidAuthSession(request);
    // Unlisted, so generated boards don't flood the public list. Guests
    // insert through the server (the anonymous role can't read back an
    // unlisted game); logged-in players own the game.
    const gameId = await createGame(
      game,
      "UNLISTED",
      authSession?.userId,
      authSession?.accessToken,
      { asAdmin: authSession === null },
    );

    return redirect(
      intent === "solo" ? `/game/${gameId}/solo` : `/game/${gameId}/play?new`,
    );
  } catch (error: unknown) {
    if (error instanceof RandomBoardPoolError) {
      return data(
        {
          error: t("random.error.notEnough", {
            needed: error.needed,
            available: error.available,
          }),
        },
        { status: 422 },
      );
    }
    throw error;
  }
}

function Choice({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value: number;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex min-w-12 cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-base font-medium text-slate-700 shadow-sm transition-colors has-checked:border-blue-600 has-checked:bg-blue-600 has-checked:text-white has-focus-visible:ring-2 has-focus-visible:ring-blue-500 has-focus-visible:ring-offset-2 sm:text-sm">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}

export default function RandomBoard({ actionData }: Route.ComponentProps) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const submittingIntent =
    navigation.state !== "idle" && navigation.formAction === "/random-board"
      ? (navigation.formData?.get("intent") ?? "room")
      : null;

  return (
    <div className="max-w-full grow">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">{t("random.title")}</h1>
        <p className="mb-6">{t("random.intro")}</p>
        <Form method="POST" className="flex flex-col gap-6">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700">
              {t("random.categoriesLabel")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COUNTS.map((n) => (
                <Choice
                  key={n}
                  name="categories"
                  value={n}
                  label={String(n)}
                  defaultChecked={n === DEFAULT_RANDOM_CATEGORIES}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700">
              {t("random.roundsLabel")}
            </legend>
            <div className="flex flex-wrap gap-2">
              <Choice
                name="rounds"
                value={1}
                label={t("random.oneRound")}
                defaultChecked
              />
              <Choice
                name="rounds"
                value={2}
                label={t("random.twoRounds")}
                defaultChecked={false}
              />
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="includeFinal"
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            {t("random.includeFinal")}
          </label>
          <p className="text-xs text-slate-500">{t("random.unlistedHint")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="primary"
              type="submit"
              name="intent"
              value="room"
              disabled={submittingIntent !== null}
              loading={submittingIntent === "room"}
            >
              {t("random.playWithFriends")}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="solo"
              disabled={submittingIntent !== null}
              loading={submittingIntent === "solo"}
            >
              {t("random.playSolo")}
            </Button>
          </div>
          {actionData?.error ? (
            <ErrorMessage>{actionData.error}</ErrorMessage>
          ) : null}
        </Form>
      </Main>
    </div>
  );
}
