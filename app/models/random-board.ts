import { z } from "zod";

import type { Board, Clue, Game } from "~/models/convert.server";

/* Random board generator: picks categories of public games and assembles a
 * new game from them. This module is pure (no database) so the selection
 * rules can be tested with a seeded random number generator; the database
 * side is in `random-board.server.ts`. */

export const MIN_RANDOM_CATEGORIES = 3;
/** At most 8 per round keeps the board readable on a phone (the hard limit
 * is MAX_CATEGORIES = 12). */
export const MAX_RANDOM_CATEGORIES = 8;
export const DEFAULT_RANDOM_CATEGORIES = 5;
export const MAX_RANDOM_ROUNDS = 2;
/** A category needs at least this many (regular, not long-form) questions. */
export const MIN_RANDOM_CLUES = 3;

/** RANDOM_BOARD_AUTHOR is the author of every generated game. */
export const RANDOM_BOARD_AUTHOR = "Jep! random";

/** Form fields of the generator. A checkbox sends "on" when ticked and
 * nothing otherwise. */
export const randomBoardOptionsSchema = z.object({
  categories: z.coerce
    .number()
    .int()
    .min(MIN_RANDOM_CATEGORIES)
    .max(MAX_RANDOM_CATEGORIES)
    .default(DEFAULT_RANDOM_CATEGORIES),
  rounds: z.coerce.number().int().min(1).max(MAX_RANDOM_ROUNDS).default(1),
  includeFinal: z
    .string()
    .optional()
    .transform((v) => v !== undefined && v !== "" && v !== "false"),
});

export type RandomBoardOptions = z.output<typeof randomBoardOptionsSchema>;

/** A category of a public game that could go on the board (metadata only). */
export interface CandidateCategory {
  id: number;
  name: string;
  gameId: string;
  gameTitle: string;
  /** Number of regular (not long-form) questions. */
  clueCount: number;
}

/** A long-form question of a public game that could be the final. */
export interface FinalCandidate {
  id: number;
  categoryName: string;
  gameId: string;
  gameTitle: string;
}

export type PickResult =
  | {
      ok: true;
      /** The categories of each round, in board order. */
      rounds: CandidateCategory[][];
      final: FinalCandidate | null;
    }
  | {
      ok: false;
      needed: number;
      /** How many suitable categories (with distinct names) there are. */
      available: number;
    };

export type Rng = () => number;

/** seededRng returns a deterministic random number generator in [0, 1)
 * (mulberry32), for tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** shuffle returns a shuffled copy (Fisher–Yates). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** normalizeCategoryName is the key for "same name": case, surrounding and
 * repeated spaces don't matter. */
export function normalizeCategoryName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

/** pickRandomBoard chooses `categories × rounds` categories in random order:
 * every category has at least MIN_RANDOM_CLUES questions, no source category
 * is used twice and no two categories share a name. Categories from games not
 * used yet are preferred, so the board mixes as many games as possible. With
 * `includeFinal`, one final question is picked if there is any. */
export function pickRandomBoard(
  candidates: readonly CandidateCategory[],
  finals: readonly FinalCandidate[],
  options: Pick<RandomBoardOptions, "categories" | "rounds" | "includeFinal">,
  rng: Rng,
): PickResult {
  const needed = options.categories * options.rounds;

  const seenIds = new Set<number>();
  const eligible = candidates.filter((c) => {
    if (c.clueCount < MIN_RANDOM_CLUES || seenIds.has(c.id)) return false;
    seenIds.add(c.id);
    return true;
  });
  const shuffled = shuffle(eligible, rng);

  const picked: CandidateCategory[] = [];
  const usedIds = new Set<number>();
  const usedNames = new Set<string>();
  const usedGames = new Set<string>();
  const take = (c: CandidateCategory) => {
    picked.push(c);
    usedIds.add(c.id);
    usedNames.add(normalizeCategoryName(c.name));
    usedGames.add(c.gameId);
  };
  const fits = (c: CandidateCategory) =>
    !usedIds.has(c.id) && !usedNames.has(normalizeCategoryName(c.name));

  // First one category per game, then fill up from games already used.
  for (const c of shuffled) {
    if (picked.length === needed) break;
    if (fits(c) && !usedGames.has(c.gameId)) take(c);
  }
  for (const c of shuffled) {
    if (picked.length === needed) break;
    if (fits(c)) take(c);
  }

  if (picked.length < needed) {
    const available = new Set(
      eligible.map((c) => normalizeCategoryName(c.name)),
    ).size;
    return { ok: false, needed, available };
  }

  // The first pass put one category per game first: shuffle again so the
  // board order doesn't reveal that.
  const ordered = shuffle(picked, rng);
  const rounds: CandidateCategory[][] = [];
  for (let r = 0; r < options.rounds; r++) {
    rounds.push(
      ordered.slice(r * options.categories, (r + 1) * options.categories),
    );
  }

  const final =
    options.includeFinal && finals.length > 0
      ? finals[Math.floor(rng() * finals.length)]
      : null;

  return { ok: true, rounds, final };
}

export interface RandomCategoryContent {
  name: string;
  clues: Clue[];
}

/** buildRandomGame assembles the picked categories (with their questions as
 * they are: media, choices, secret and wager flags) into a game. Long-form
 * questions only belong in the final, so they are dropped from the boards;
 * the final, if any, is its own last round. */
export function buildRandomGame({
  title,
  author,
  note,
  rounds,
  final,
}: {
  title: string;
  author: string;
  note: string;
  rounds: RandomCategoryContent[][];
  final: { categoryName: string; clue: Clue } | null;
}): Game {
  const boards: Board[] = rounds.map((categories) => {
    const cats = categories.map(({ name, clues }) => ({
      name,
      clues: clues.filter((clue) => !clue.longForm),
    }));
    return { categoryNames: cats.map((c) => c.name), categories: cats };
  });

  if (final) {
    boards.push({
      categoryNames: [final.categoryName],
      categories: [{ name: final.categoryName, clues: [final.clue] }],
    });
  }

  return { title, author, copyright: "", note, boards };
}
