import { z } from "zod";

import { choicesError } from "~/utils/choices";
import {
  MAX_MEDIA_BLOCKS,
  MEDIA_TYPES,
  type MediaBlock,
  mediaBlockError,
} from "~/utils/media";

function isValidImageSrc(src: string): boolean {
  try {
    const url = new URL(src);
    // http: is still accepted for backwards compatibility with old games.
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const MediaBlockSchema = z
  .object({
    type: z.enum(MEDIA_TYPES),
    src: z.string().trim().min(1, "media src must not be empty"),
    alt: z.string().optional(),
  })
  .superRefine((block, ctx) => {
    const error = mediaBlockError(block);
    if (error) ctx.addIssue({ code: "custom", message: error, path: ["src"] });
  });

const MediaListSchema = z
  .array(MediaBlockSchema)
  .max(MAX_MEDIA_BLOCKS, `at most ${MAX_MEDIA_BLOCKS} media blocks per clue`)
  .optional();

export const ClueSchema = z
  .object({
    // The clue text may be empty when media carries the question.
    clue: z.string().trim(),
    answer: z.string().trim().min(1, "answer must not be empty"),
    value: z.number(),
    imageSrc: z
      .string()
      .trim()
      .min(1, "imageSrc must not be empty; remove the field instead")
      .refine(isValidImageSrc, "imageSrc must be a valid HTTP(S) URL")
      .optional(),
    media: MediaListSchema,
    answerMedia: MediaListSchema,
    /** Options for a multiple choice clue; `answer` must be one of them. */
    choices: z.array(z.string().trim()).optional(),
    wagerable: z.boolean().optional(),
    longForm: z.boolean().optional(),
    /** A secret ("cat in the bag") clue: whoever chooses it must give it to
     * another player, who answers it alone. */
    secret: z.boolean().optional(),
    /** Topic shown when the secret clue is handed over (default: the
     * category name). */
    secretTopic: z
      .string()
      .trim()
      .min(1, "secretTopic must not be empty; remove the field instead")
      .optional(),
    /** Value of the secret clue for scoring (default: the cell value). */
    secretValue: z
      .number()
      .int("secretValue must be a whole number")
      .positive("secretValue must be positive")
      .optional(),
  })
  .refine(
    (clue) =>
      clue.clue.length > 0 ||
      clue.imageSrc !== undefined ||
      (clue.media?.length ?? 0) > 0,
    {
      message: "clue must not be empty (unless the clue has media)",
      path: ["clue"],
    },
  )
  .refine((clue) => !clue.longForm || clue.wagerable, {
    message: "long-form clues must also be wagerable",
  })
  .refine((clue) => !clue.secret || (!clue.wagerable && !clue.longForm), {
    message: "secret clues cannot be wagerable or long-form",
    path: ["secret"],
  })
  .refine(
    (clue) =>
      clue.secret ||
      (clue.secretTopic === undefined && clue.secretValue === undefined),
    {
      message: "secretTopic and secretValue need secret: true",
      path: ["secret"],
    },
  )
  .superRefine((clue, ctx) => {
    if (clue.choices === undefined) return;
    if (clue.longForm) {
      ctx.addIssue({
        code: "custom",
        message: "long-form clues cannot have choices",
        path: ["choices"],
      });
      return;
    }
    const error = choicesError(clue.choices, clue.answer);
    if (error)
      ctx.addIssue({ code: "custom", message: error, path: ["choices"] });
  });

export const CategorySchema = z.object({
  name: z.string().trim().min(1, "category name must not be empty"),
  clues: z.array(ClueSchema).min(1, "category must have at least one clue"),
  note: z.string().optional(),
});

export const BoardSchema = z
  .object({
    categoryNames: z
      .array(z.string())
      .min(1, "board must have at least one category name"),
    categories: z
      .array(CategorySchema)
      .min(1, "board must have at least one category"),
  })
  .refine((board) => board.categoryNames.length === board.categories.length, {
    message: "categoryNames and categories must have the same length",
  })
  .refine(
    (board) => new Set(board.categoryNames).size === board.categoryNames.length,
    { message: "categoryNames must not have duplicates" },
  )
  .refine(
    (board) =>
      board.categories.every((cat, j) => cat.name === board.categoryNames[j]),
    { message: "category names must match categoryNames at each index" },
  );

export const GameSchema = z.object({
  title: z.string().trim().min(1, "title must not be empty"),
  author: z.string().trim().min(1, "author must not be empty"),
  copyright: z.string(),
  note: z.string(),
  boards: z.array(BoardSchema).min(1, "game must have at least one board"),
});

export type Game = z.infer<typeof GameSchema>;
export type Board = z.infer<typeof BoardSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type { MediaBlock };

export const Convert = {
  toGame(json: string): Game {
    return GameSchema.parse(JSON.parse(json));
  },

  gameToJson(value: Game): string {
    return JSON.stringify(value, null, 2);
  },
};
