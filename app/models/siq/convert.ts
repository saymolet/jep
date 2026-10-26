import { createT, type Locale, type TFunction } from "~/i18n";
import { choicesError, MAX_CHOICES, MIN_CHOICES } from "~/utils/choices";
import { MAX_MEDIA_BLOCKS } from "~/utils/media";

/** Maps a parsed SIGame package to a Jep! game.
 *
 * - package name/authors/comments -> title/author/note
 * - rounds -> boards (at most 12 themes per board; more are split into
 *   several boards), themes -> categories, questions -> clues (value = price)
 * - question text -> `clue`, pictures/sound/video -> `media`, content of the
 *   answer part -> `answerMedia`, right answers -> `answer` (" / " joined)
 * - question types: secret kinds -> `secret` (topic/price from params),
 *   stake kinds -> `wagerable`, everything else -> a normal question
 * - a final round -> one long-form (final) question: the first final theme.
 *
 * Media is resolved through an async callback (the importer uploads files);
 * it is only called for questions that are kept.
 */
import type {
  Board,
  Category,
  Clue,
  Game,
  MediaBlock,
} from "../convert.server";
import type { SiqContent, SiqPackage, SiqQuestion, SiqRound } from "./parse";

/** The most categories per board (Jep's limit, see `BoardSchema`). */
const MAX_CATEGORIES = 12;

export type ResolvedMedia = { block: MediaBlock } | { skip: string };

/** Resolves one non-text content item to a media block (or a reason to skip
 * it). Called at most once per distinct item by a caching resolver. */
export type MediaResolver = (content: SiqContent) => Promise<ResolvedMedia>;

export interface SiqConversionStats {
  boards: number;
  categories: number;
  questions: number;
  droppedQuestions: number;
}

export interface SiqConversion {
  game: Game;
  warnings: string[];
  stats: SiqConversionStats;
}

const SECRET_TYPES = new Set([
  "cat",
  "bagcat",
  "secret",
  "secretpublicprice",
  "secretnoquestion",
]);
const STAKE_TYPES = new Set(["auction", "stake", "stakeall"]);
/** Types Jep! plays as normal questions. noRisk/sponsored (no penalty for a
 * wrong answer), forYourself and forAll have no equivalent in Jep!. */
const NORMAL_TYPES = new Set([
  "",
  "simple",
  "withbutton",
  "norisk",
  "sponsored",
  "foryourself",
  "forall",
]);
const FINAL_ROUND_TYPES = new Set(["final", "themelist"]);

export function isFinalRound(round: SiqRound): boolean {
  return FINAL_ROUND_TYPES.has(round.type.toLowerCase());
}

interface QuestionResult {
  clue?: Clue;
  warnings: string[];
}

function joinText(content: SiqContent[]): string {
  return content
    .filter((c) => c.kind === "text")
    .map((c) => c.value.trim())
    .filter((t) => t.length > 0)
    .join(" ");
}

function uniqueAnswers(answers: string[]): string[] {
  const seen = new Set<string>();
  return answers
    .map((a) => a.trim())
    .filter((a) => {
      const key = a.toLowerCase();
      if (a.length === 0 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function resolveAll(
  content: SiqContent[],
  resolveMedia: MediaResolver,
  where: string,
  warnings: string[],
  t: TFunction,
): Promise<MediaBlock[]> {
  const blocks: MediaBlock[] = [];
  for (const item of content) {
    if (item.kind === "text" || item.value.trim() === "") continue;
    const resolved = await resolveMedia(item);
    if ("skip" in resolved) {
      warnings.push(`${where}: ${resolved.skip}`);
    } else {
      blocks.push(resolved.block);
    }
  }
  if (blocks.length > MAX_MEDIA_BLOCKS) {
    warnings.push(
      t("siq.warn.tooManyMedia", {
        where,
        max: MAX_MEDIA_BLOCKS,
        count: blocks.length,
      }),
    );
    return blocks.slice(0, MAX_MEDIA_BLOCKS);
  }
  return blocks;
}

/** Multiple choice (v5 answerType "select"): options must be text only. */
function convertChoices(
  question: SiqQuestion,
  t: TFunction,
): { choices: string[]; answer: string } | { error: string } | undefined {
  if (question.answerType?.toLowerCase() !== "select" || !question.options) {
    return undefined;
  }
  const options = question.options;
  if (options.length < MIN_CHOICES || options.length > MAX_CHOICES) {
    return {
      error: t("siq.warn.optionsCount", { min: MIN_CHOICES, max: MAX_CHOICES }),
    };
  }
  if (options.some((o) => o.content.some((c) => c.kind !== "text"))) {
    return { error: t("siq.warn.optionsMedia") };
  }
  const choices = options.map((o) => joinText(o.content));
  const right = question.right[0]?.trim() ?? "";
  const index = options.findIndex(
    (o, i) =>
      o.label.toLowerCase() === right.toLowerCase() ||
      choices[i].toLowerCase() === right.toLowerCase(),
  );
  if (index < 0) {
    return { error: t("siq.warn.optionsUnknownRight") };
  }
  const answer = choices[index];
  const error = choicesError(choices, answer);
  if (error) return { error: t("siq.warn.optionsInvalid", { reason: error }) };
  return { choices, answer };
}

async function convertQuestion(
  question: SiqQuestion,
  where: string,
  final: boolean,
  resolveMedia: MediaResolver,
  t: TFunction,
): Promise<QuestionResult> {
  const warnings: string[] = [];
  const clueText = joinText(question.question);
  const media = await resolveAll(
    question.question,
    resolveMedia,
    where,
    warnings,
    t,
  );

  if (clueText.length === 0 && media.length === 0) {
    warnings.push(t("siq.warn.questionSkipped", { where }));
    return { warnings };
  }

  const answerMedia = await resolveAll(
    question.answer,
    resolveMedia,
    t("siq.answerPart", { where }),
    warnings,
    t,
  );

  let answer = uniqueAnswers(question.right).join(" / ");
  if (!answer) answer = joinText(question.answer);
  if (!answer) {
    answer = t("siq.noAnswerPlaceholder");
    warnings.push(t("siq.warn.noAnswer", { where }));
  }

  const clue: Clue = {
    clue: clueText,
    answer,
    value: question.price,
  };
  if (media.length > 0) clue.media = media;
  if (answerMedia.length > 0) clue.answerMedia = answerMedia;

  if (final) {
    clue.wagerable = true;
    clue.longForm = true;
    return { clue, warnings };
  }

  // The pack's display time for the question becomes its reading time for a
  // room's "Auto" setting (Jep!'s reading time is 0–60 s).
  if (question.displayTimeSec !== undefined) {
    clue.readTimeSec = Math.min(60, Math.round(question.displayTimeSec));
  }

  const choices = convertChoices(question, t);
  if (choices && "error" in choices) {
    warnings.push(t("siq.warn.at", { where, reason: choices.error }));
  } else if (choices) {
    clue.choices = choices.choices;
    clue.answer = choices.answer;
  }

  const type = question.type.trim().toLowerCase();
  if (SECRET_TYPES.has(type)) {
    clue.secret = true;
    if (question.topic) clue.secretTopic = question.topic;
    // A price range lets the SIGame player choose; Jep! uses the maximum.
    // 0 means "the round's minimum or maximum" in SIGame: keep the cell value.
    const secretValue = question.secretPrice?.max ?? 0;
    if (Number.isInteger(secretValue) && secretValue > 0) {
      clue.secretValue = secretValue;
    }
  } else if (STAKE_TYPES.has(type)) {
    clue.wagerable = true;
  } else if (!NORMAL_TYPES.has(type)) {
    warnings.push(t("siq.warn.unknownType", { where, type: question.type }));
  }

  return { clue, warnings };
}

function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  for (let n = 2; used.has(candidate); n++) candidate = `${name} (${n})`;
  used.add(candidate);
  return candidate;
}

function toBoards(categories: Category[]): Board[] {
  const boards: Board[] = [];
  for (let i = 0; i < categories.length; i += MAX_CATEGORIES) {
    const used = new Set<string>();
    const chunk = categories
      .slice(i, i + MAX_CATEGORIES)
      .map((c) => ({ ...c, name: uniqueName(c.name, used) }));
    boards.push({
      categoryNames: chunk.map((c) => c.name),
      categories: chunk,
    });
  }
  return boards;
}

function trimTitle(fileName: string): string {
  return fileName.replace(/\.siq$/i, "").trim();
}

/** siqToGame converts a parsed package. It never throws for content problems;
 * those become warnings. The result may still fail `GameSchema` (e.g. no
 * questions at all), which the importer reports. */
export async function siqToGame(
  pkg: SiqPackage,
  {
    fileName = "",
    resolveMedia,
    locale = "en",
  }: { fileName?: string; resolveMedia: MediaResolver; locale?: Locale },
): Promise<SiqConversion> {
  const t = createT(locale);
  const warnings: string[] = [];
  const boards: Board[] = [];
  let droppedQuestions = 0;

  for (const [r, round] of pkg.rounds.entries()) {
    const roundName = round.name || t("siq.roundName", { n: r + 1 });
    const themeName = (name: string, index: number) =>
      name.trim() || t("siq.themeName", { n: index + 1 });

    if (isFinalRound(round)) {
      // SIGame players remove final themes until one is left and play it.
      // Jep! has no theme removal: the first theme with a usable question is
      // the final question, the rest is skipped.
      let kept: { name: string; clue: Clue } | undefined;
      let skippedThemes = 0;
      for (const [index, theme] of round.themes.entries()) {
        if (kept) {
          skippedThemes++;
          continue;
        }
        const name = themeName(theme.name, index);
        for (const [q, question] of theme.questions.entries()) {
          const where = `${roundName} › ${name} › ${question.price}`;
          if (q > 0) {
            warnings.push(t("siq.warn.finalExtraQuestion", { where }));
            droppedQuestions++;
            continue;
          }
          const result = await convertQuestion(
            question,
            where,
            true,
            resolveMedia,
            t,
          );
          warnings.push(...result.warnings);
          if (result.clue) kept = { name, clue: result.clue };
          else droppedQuestions++;
        }
      }
      if (skippedThemes > 0) {
        warnings.push(
          t("siq.warn.finalThemesSkipped", {
            round: roundName,
            theme: kept?.name ?? "",
            count: skippedThemes,
          }),
        );
        droppedQuestions += round.themes
          .slice(round.themes.length - skippedThemes)
          .reduce((n, theme) => n + theme.questions.length, 0);
      }
      if (kept) {
        boards.push({
          categoryNames: [kept.name],
          categories: [{ name: kept.name, clues: [kept.clue] }],
        });
      } else {
        warnings.push(t("siq.warn.noFinal", { round: roundName }));
      }
      continue;
    }

    const categories: (Category | undefined)[] = await Promise.all(
      round.themes.map(async (theme, index) => {
        const name = themeName(theme.name, index);
        const results = await Promise.all(
          theme.questions.map((question) =>
            convertQuestion(
              question,
              `${roundName} › ${name} › ${question.price}`,
              false,
              resolveMedia,
              t,
            ),
          ),
        );
        const clues: Clue[] = [];
        for (const result of results) {
          warnings.push(...result.warnings);
          if (result.clue) clues.push(result.clue);
          else droppedQuestions++;
        }
        if (clues.length === 0) {
          warnings.push(
            t("siq.warn.themeSkipped", { where: `${roundName} › ${name}` }),
          );
          return undefined;
        }
        return { name, clues };
      }),
    );
    const kept = categories.filter((c): c is Category => c !== undefined);
    if (kept.length === 0) {
      warnings.push(t("siq.warn.roundSkipped", { round: roundName }));
      continue;
    }
    const roundBoards = toBoards(kept);
    if (roundBoards.length > 1) {
      warnings.push(
        t("siq.warn.roundSplit", {
          round: roundName,
          count: kept.length,
          max: MAX_CATEGORIES,
          boards: roundBoards.length,
        }),
      );
    }
    boards.push(...roundBoards);
  }

  const game: Game = {
    title: pkg.name || trimTitle(fileName) || t("siq.defaultTitle"),
    author: pkg.authors.join(", ") || t("siq.unknownAuthor"),
    copyright: "",
    note: pkg.comments,
    boards,
  };

  return {
    game,
    warnings,
    stats: {
      boards: boards.length,
      categories: boards.reduce((n, b) => n + b.categories.length, 0),
      questions: boards.reduce(
        (n, b) => n + b.categories.reduce((m, c) => m + c.clues.length, 0),
        0,
      ),
      droppedQuestions,
    },
  };
}
