import { CategorySchema, ClueSchema } from "~/models/convert.server";
import type { Clue, Game } from "~/models/convert.server";
import type { Database } from "~/models/database.types";
import { dbClueToClue } from "~/models/game.server";
import {
  buildRandomGame,
  type CandidateCategory,
  type FinalCandidate,
  MIN_RANDOM_CLUES,
  pickRandomBoard,
  type RandomBoardOptions,
  type RandomCategoryContent,
  type Rng,
  shuffle,
} from "~/models/random-board";
import { getSupabase } from "~/supabase";

type DbClue = Database["public"]["Tables"]["clues"]["Row"];

/** How many random candidate categories to sample. Far more than a board
 * needs (at most 16), so duplicate names and invalid categories rarely make
 * the pool look too small. */
const CANDIDATE_SAMPLE = 200;
const FINAL_SAMPLE = 10;
/** Picks are retried without categories whose questions turn out invalid. */
const MAX_ATTEMPTS = 3;

/** RandomBoardPoolError means there are not enough suitable categories in
 * public games for the requested board. */
export class RandomBoardPoolError extends Error {
  constructor(
    readonly needed: number,
    readonly available: number,
  ) {
    super(`not enough public categories: need ${needed}, have ${available}`);
    this.name = "RandomBoardPoolError";
  }
}

/** The anonymous client: row-level security only shows PUBLIC games (and
 * their categories and clues), on top of the explicit filter in the SQL
 * functions — generated boards never leak unlisted or private games. */
function publicClient() {
  return getSupabase();
}

async function sampleCategories(): Promise<CandidateCategory[]> {
  const { data, error } = await publicClient().rpc("random_board_categories", {
    max_count: CANDIDATE_SAMPLE,
  });
  if (error !== null) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    gameId: row.game_id,
    gameTitle: row.game_title,
    clueCount: row.clue_count,
  }));
}

async function sampleFinals(): Promise<FinalCandidate[]> {
  const { data, error } = await publicClient().rpc("random_final_clues", {
    max_count: FINAL_SAMPLE,
  });
  if (error !== null) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id,
    categoryName: row.category_name,
    gameId: row.game_id,
    gameTitle: row.game_title,
  }));
}

/** fetchCategories loads the questions of the given categories, ordered like
 * getGame orders them. Categories whose questions don't pass the game schema
 * (old rows) map to null. */
async function fetchCategories(
  ids: number[],
): Promise<Map<number, RandomCategoryContent | null>> {
  const { data, error } = await publicClient()
    .from("categories")
    .select<
      "id, name, clues ( * )",
      { id: number; name: string; clues: DbClue[] | null }
    >("id, name, clues ( * )")
    .in("id", ids)
    .order("value", { foreignTable: "clues" })
    .order("id", { foreignTable: "clues" });
  if (error !== null) throw new Error(error.message);

  const result = new Map<number, RandomCategoryContent | null>();
  for (const id of ids) result.set(id, null);
  for (const row of data) {
    const clues = (row.clues ?? [])
      .map(dbClueToClue)
      .filter((clue) => !clue.longForm);
    const parsed = CategorySchema.safeParse({ name: row.name, clues });
    result.set(
      row.id,
      parsed.success && parsed.data.clues.length >= MIN_RANDOM_CLUES
        ? { name: parsed.data.name, clues: parsed.data.clues }
        : null,
    );
  }
  return result;
}

async function fetchFinalClue(id: number): Promise<Clue | null> {
  const { data, error } = await publicClient()
    .from("clues")
    .select()
    .eq("id", id);
  if (error !== null) throw new Error(error.message);
  const row = data.at(0);
  if (!row) return null;
  const parsed = ClueSchema.safeParse(dbClueToClue(row));
  return parsed.success && parsed.data.longForm && parsed.data.wagerable
    ? parsed.data
    : null;
}

export interface RandomGameText {
  title: string;
  /** Builds the game note from the titles of the source games. */
  note: (sourceTitles: string[]) => string;
  author: string;
}

/** generateRandomGame builds a new game from random categories of PUBLIC
 * games. Throws {@link RandomBoardPoolError} when there are not enough. */
export async function generateRandomGame(
  options: RandomBoardOptions,
  text: RandomGameText,
  rng: Rng = Math.random,
): Promise<Game> {
  const [candidates, finals] = await Promise.all([
    sampleCategories(),
    options.includeFinal ? sampleFinals() : Promise.resolve([]),
  ]);

  const contents = new Map<number, RandomCategoryContent | null>();
  let pool = candidates;
  for (let attempt = 0; ; attempt++) {
    const pick = pickRandomBoard(pool, finals, options, rng);
    if (!pick.ok) throw new RandomBoardPoolError(pick.needed, pick.available);

    const missing = pick.rounds
      .flat()
      .map((c) => c.id)
      .filter((id) => !contents.has(id));
    if (missing.length > 0) {
      for (const [id, content] of await fetchCategories(missing)) {
        contents.set(id, content);
      }
    }

    const invalid = new Set(
      pick.rounds
        .flat()
        .filter((c) => !contents.get(c.id))
        .map((c) => c.id),
    );
    if (invalid.size === 0) {
      const final = await loadFinal(pick.final, finals, rng);
      const sources = [
        ...pick.rounds.flat().map((c) => c.gameTitle),
        ...(final ? [final.gameTitle] : []),
      ];
      return buildRandomGame({
        title: text.title,
        author: text.author,
        note: text.note([...new Set(sources)]),
        rounds: pick.rounds.map((round) =>
          round.map((c) => {
            const content = contents.get(c.id);
            if (!content) throw new Error("category content missing");
            return content;
          }),
        ),
        final: final
          ? { categoryName: final.categoryName, clue: final.clue }
          : null,
      });
    }

    if (attempt + 1 >= MAX_ATTEMPTS) {
      throw new Error("could not find enough valid categories");
    }
    pool = pool.filter((c) => !invalid.has(c.id));
  }
}

/** loadFinal returns the picked final question, or — when its row turns out
 * invalid — the first valid one of the other sampled finals (in random
 * order). Null when none is valid: the game then has no final. */
async function loadFinal(
  picked: FinalCandidate | null,
  finals: FinalCandidate[],
  rng: Rng,
) {
  if (!picked) return null;
  const others = shuffle(
    finals.filter((f) => f.id !== picked.id),
    rng,
  );
  for (const candidate of [picked, ...others]) {
    const clue = await fetchFinalClue(candidate.id);
    if (clue) return { ...candidate, clue };
  }
  return null;
}
