import type { AuthSession } from "~/models/auth";
import type {
  Board,
  Clue,
  Game as ConvertedGame,
  MediaBlock,
} from "~/models/convert.server";
import { Convert, GameSchema, MediaBlockSchema } from "~/models/convert.server";
import type { Database, Json } from "~/models/database.types";
import { getSupabase } from "~/supabase";
import { getSupabaseAdmin } from "~/supabase/admin.server";
import { choicesError } from "~/utils/choices";

/* Types */

type GameTable = Database["public"]["Tables"]["games"];
export type DbGame = GameTable["Row"];

/** Game is the representation of a game within the game engine. */
export type Game = ConvertedGame & Pick<DbGame, "id" | "visibility">;

export type GameVisibility = Database["public"]["Enums"]["game_visibility"];

type CategoryTable = Database["public"]["Tables"]["categories"];
type DbCategory = CategoryTable["Row"];

type ClueTable = Database["public"]["Tables"]["clues"];
type DbClue = ClueTable["Row"];

type CategoryAndClues = DbCategory & { clues: DbClue[] | null };

/** SEARCHABLE_GAME_COLUMNS are the columns of {@link DbGame} that are searched
 * on in {@link getGames}.
 */
const SEARCHABLE_GAME_COLUMNS = ["title", "author"];
const RESULTS_PER_PAGE = 10;
const SITEMAP_RESULTS_PER_PAGE = 1000;

/* Helpers */

/** dbMediaToMedia reads a `media`/`answer_media` jsonb column. Null, empty or
 * malformed values (which createGame never writes) become undefined so the
 * game JSON round-trips without empty fields. */
function dbMediaToMedia(value: Json | null): MediaBlock[] | undefined {
  if (value === null) return undefined;
  const result = MediaBlockSchema.array().safeParse(value);
  if (!result.success) {
    console.warn("ignoring malformed clue media", result.error.message);
    return undefined;
  }
  return result.data.length > 0 ? result.data : undefined;
}

function mediaToDbMedia(media: MediaBlock[] | undefined): Json | null {
  if (!media || media.length === 0) return null;
  return media.map(({ type, src, alt }) =>
    alt === undefined ? { type, src } : { type, src, alt },
  );
}

/** dbChoicesToChoices reads the `choices` jsonb column. Null or malformed
 * values (which createGame never writes) become undefined, so a bad row plays
 * as a normal clue instead of an unanswerable one. */
function dbChoicesToChoices(
  value: Json | null,
  clue: Pick<DbClue, "answer" | "long_form">,
): string[] | undefined {
  if (value === null) return undefined;
  if (
    clue.long_form ||
    !Array.isArray(value) ||
    !value.every((c): c is string => typeof c === "string") ||
    choicesError(value, clue.answer) !== null
  ) {
    console.warn("ignoring malformed clue choices");
    return undefined;
  }
  return value;
}

/** dbSecretToSecret reads the `secret`, `secret_topic` and `secret_value`
 * columns. Values the schema would reject (which createGame never writes)
 * are dropped, so the JSON export never fails and a bad row plays as a
 * normal clue. */
function dbSecretToSecret(
  clue: Pick<
    DbClue,
    "secret" | "secret_topic" | "secret_value" | "wagerable" | "long_form"
  >,
): Pick<Clue, "secret" | "secretTopic" | "secretValue"> {
  if (!clue.secret) return {};
  if (clue.wagerable || clue.long_form) {
    console.warn("ignoring secret on a wagerable clue");
    return {};
  }
  const topic = clue.secret_topic?.trim();
  const value = clue.secret_value;
  return {
    secret: true,
    secretTopic: topic ? topic : undefined,
    secretValue:
      value !== null && Number.isInteger(value) && value > 0
        ? value
        : undefined,
  };
}

/** dbClueToClue maps a clues row to the game representation. */
export function dbClueToClue(clue: DbClue): Clue {
  return {
    ...clue,
    longForm: clue.long_form,
    imageSrc: clue.image_src ?? undefined,
    media: dbMediaToMedia(clue.media),
    answerMedia: dbMediaToMedia(clue.answer_media),
    choices: dbChoicesToChoices(clue.choices, clue),
    // Overwrite the raw columns spread in above.
    secret: undefined,
    ...dbSecretToSecret(clue),
  };
}

/** clueToDbClue maps a game clue to a clues row to insert. */
export function clueToDbClue(
  clue: Clue,
  categoryId: number,
): ClueTable["Insert"] {
  return {
    category_id: categoryId,
    answer: clue.answer,
    clue: clue.clue,
    value: clue.value,
    wagerable: clue.wagerable ?? false,
    long_form: clue.longForm ?? false,
    image_src: clue.imageSrc,
    media: mediaToDbMedia(clue.media),
    answer_media: mediaToDbMedia(clue.answerMedia),
    choices: clue.choices && clue.choices.length > 0 ? clue.choices : null,
    secret: clue.secret ? true : null,
    secret_topic: clue.secret ? (clue.secretTopic ?? null) : null,
    secret_value: clue.secret ? (clue.secretValue ?? null) : null,
  };
}

function dbGameToGame(dbGame: DbGame, categories: CategoryAndClues[]): Game {
  const game: Game = {
    id: dbGame.id,
    author: dbGame.author,
    title: dbGame.title,
    copyright: dbGame.copyright ?? "",
    note: dbGame.note ?? "",
    boards: [],
    visibility: dbGame.visibility,
  };

  const boardsMap = new Map<number, Board>();

  if (!categories.length) {
    throw new Error("game must have at least one category");
  }

  for (const category of categories) {
    if (category.clues == null || category.clues.length === 0) {
      throw new Error("category must have at least one clue");
    }
    const round = category.round;
    const board = boardsMap.get(round) ?? { categories: [], categoryNames: [] };
    if (!boardsMap.has(round)) {
      boardsMap.set(round, board);
    }
    board.categories.push({
      ...category,
      note: category.note ?? undefined,
      clues: category.clues.map(dbClueToClue),
    });
    board.categoryNames.push(category.name);
  }

  for (let round = 0; round < boardsMap.size; round++) {
    const board = boardsMap.get(round);
    if (!board) {
      throw new Error("boardsMap did not contain board for round " + round);
    }
    game.boards.push(board);
  }

  return game;
}

export function gameToJson(game: Game): string {
  return Convert.gameToJson(GameSchema.parse(game));
}

/** getPagination returns the from and to indices for the given page and page
 * size.
 *
 * @example getPagination(1, 20) // { from: 0, to: 19 }
 * @example getPagination(2, 20) // { from: 20, to: 39 }
 */
function getPagination(page: number, pageSize: number = RESULTS_PER_PAGE) {
  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  return { from, to };
}

/* Reads */

/** nsgetGame bypasses RLS and enforces permissions on the server side to get
 * unlisted games.
 */
export async function getGame(
  gameId: string,
  userId?: string,
): Promise<Game | null> {
  const { data: gameData, error: gameErr } = await getSupabaseAdmin()
    .from("games")
    .select()
    .eq("id", gameId);

  if (gameErr !== null) {
    throw new Error(gameErr.message);
  }

  const game = gameData.at(0);
  if (!game) {
    return null;
  }

  if (game.visibility === "PRIVATE" && game.uploaded_by !== userId) {
    return null;
  }

  const { data: categoryData, error: categoryErr } = await getSupabaseAdmin()
    .from("categories")
    .select<"*, clues ( * )", CategoryAndClues>("*, clues ( * )")
    .eq("game_id", gameId)
    .order("created_at")
    .order("value", { foreignTable: "clues" });

  if (categoryErr !== null) {
    throw new Error(categoryErr.message);
  }

  return dbGameToGame(game, categoryData);
}

export async function getGamesForUser(
  userId: string,
  accessToken?: AuthSession["accessToken"],
) {
  const { data, error } = await getSupabase(accessToken)
    .from("games")
    .select()
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw new Error(error.message);
  }

  return data;
}

/** getGames gets all games from the database. Search searches the title and
 * author fields (see {@link SEARCHABLE_GAME_COLUMNS}).
 */
export async function getGames(
  options: {
    page: number;
    search: string | null;
  },
  accessToken?: AuthSession["accessToken"],
) {
  const { search, page } = options;
  const { from, to } = getPagination(page);

  let query = getSupabase(accessToken)
    .from("games")
    .select()
    .order("created_at", { ascending: false })
    .range(from, to);

  if (search && search.trim() !== "") {
    // .or doesn't accept variables, so sanitize the search string to prevent
    // SQL injection
    const sanitizedSearch = search.trim().replace(/[^a-zA-Z0-9\s]/g, "");
    const tokens = sanitizedSearch.split(/\s/);
    // Make a search clause for each searchable column. The tokens must all
    // match the same column.
    const clauses = [];
    for (const column of SEARCHABLE_GAME_COLUMNS) {
      // Make an ILIKE clause for every token.
      const tokenClauses = tokens.map((t) => `${column}.ilike.%${t}%`);
      const clause = `and(${tokenClauses.join(",")})`;
      clauses.push(clause);
    }
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query;

  if (error !== null) {
    throw new Error(error.message);
  }

  return data;
}

/** Returns the minimal public-game data used to build the search sitemap. */
export async function getPublicGameSitemapEntries() {
  // Use the anonymous client so row-level security guarantees that only public
  // games can be exposed, even if this query changes later.
  const client = getSupabase();
  const entries: { id: string }[] = [];

  for (let from = 0; ; from += SITEMAP_RESULTS_PER_PAGE) {
    const { data, error } = await client
      .from("games")
      .select("id")
      .eq("visibility", "PUBLIC")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + SITEMAP_RESULTS_PER_PAGE - 1);

    if (error !== null) {
      throw new Error(error.message);
    }

    entries.push(...data);
    if (data.length < SITEMAP_RESULTS_PER_PAGE) break;
  }

  return entries;
}

/* Writes */

export async function createGame(
  inputGame: ConvertedGame,
  visibility: GameVisibility,
  uploadedByUserId?: string,
  accessToken?: AuthSession["accessToken"],
) {
  GameSchema.parse(inputGame);
  const client = getSupabase(accessToken);

  const { data: gameData, error: gameErr } = await client
    .from<"games", GameTable>("games")
    .insert<GameTable["Insert"]>({
      author: inputGame.author,
      copyright: inputGame.copyright,
      note: inputGame.note,
      title: inputGame.title,
      visibility,
      uploaded_by: uploadedByUserId,
    })
    .select();

  if (gameErr !== null) {
    throw gameErr;
  }
  const game = gameData.at(0);
  if (!game) {
    throw new Error("game data response must not be null");
  }

  const categoriesToInsert: CategoryTable["Insert"][] = [];
  for (let round = 0; round < inputGame.boards.length; round++) {
    const board = inputGame.boards[round];
    for (const category of board.categories) {
      categoriesToInsert.push({
        game_id: game.id,
        name: category.name,
        note: category.note ?? null,
        round,
      });
    }
  }

  const { data: categoryData, error: categoryErr } = await client
    .from<"categories", CategoryTable>("categories")
    .insert<CategoryTable["Insert"]>(categoriesToInsert)
    .select();

  // TODO: createGame is not transactional, so if any category fails to insert
  // the game will still be created.
  if (categoryErr !== null) {
    throw categoryErr;
  }
  if (categoryData === null) {
    throw new Error("category data response must not be null");
  }

  const cluesToInsert: ClueTable["Insert"][] = [];
  for (let round = 0; round < inputGame.boards.length; round++) {
    const board = inputGame.boards[round];
    for (const category of board.categories) {
      const dbCategory = categoryData.find(
        (c) => c.name === category.name && c.round == round,
      );
      if (!dbCategory) {
        throw new Error(
          "category " + category.name + " not inserted into database",
        );
      }
      for (const clue of category.clues) {
        cluesToInsert.push(clueToDbClue(clue, dbCategory.id));
      }
    }
  }

  const { error: cluesErr } = await client
    .from<"clues", ClueTable>("clues")
    .insert<ClueTable["Insert"]>(cluesToInsert);

  // TODO: createGame is not transactional, so if any clue fails to insert the
  // game will still be created.
  if (cluesErr !== null) {
    throw cluesErr;
  }

  return game.id;
}

export async function updateGameVisibility(
  gameId: string,
  visibility: GameVisibility,
  accessToken?: AuthSession["accessToken"],
) {
  const { data, error } = await getSupabase(accessToken)
    .from("games")
    .update({ visibility })
    .eq("id", gameId)
    .select();

  if (error !== null) {
    throw new Error(error.message);
  }

  const game = data.at(0);
  if (!game) {
    throw new Error("game data response must not be null");
  }

  return game;
}

export async function deleteGame(
  gameId: string,
  accessToken?: AuthSession["accessToken"],
) {
  const { data, error } = await getSupabase(accessToken)
    .from("games")
    .delete()
    .eq("id", gameId)
    .select();

  if (error !== null) {
    throw new Error(error.message);
  }

  const game = data.at(0);
  if (!game) {
    throw new Error("game data response must not be null");
  }

  return game;
}
