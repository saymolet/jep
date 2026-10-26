import { ENV } from "varlock/env";

/** SCHEMA is the JSON schema for *.jep.json files. */
const SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: ENV.BASE_URL + "/game.schema.json",
  additionalProperties: false,
  pattern: "^.*\\.jep\\.json$",
  title: "Jep! Game Schema",
  type: "object",
  definitions: {
    mediaBlock: {
      type: "object",
      description:
        "A picture, sound or video. src must be an https:// URL; a YouTube link is allowed for type video.",
      properties: {
        type: {
          type: "string",
          enum: ["image", "audio", "video"],
        },
        src: {
          type: "string",
          pattern: "^\\s*https://",
        },
        alt: {
          type: "string",
        },
      },
      required: ["type", "src"],
    },
    mediaList: {
      type: "array",
      maxItems: 10,
      items: { $ref: "#/definitions/mediaBlock" },
    },
  },
  properties: {
    title: {
      type: "string",
    },
    author: {
      type: "string",
    },
    copyright: {
      type: "string",
    },
    note: {
      type: "string",
    },
    boards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          categoryNames: {
            type: "array",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "string",
            },
          },
          categories: {
            type: "array",
            description:
              "1 to 12 categories (columns). Categories may have different numbers of clues.",
            minItems: 1,
            maxItems: 12,
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
                note: {
                  type: "string",
                },
                clues: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      clue: {
                        type: "string",
                      },
                      answer: {
                        type: "string",
                      },
                      value: {
                        type: "integer",
                      },
                      wagerable: {
                        type: "boolean",
                      },
                      longForm: {
                        type: "boolean",
                      },
                      imageSrc: {
                        type: "string",
                      },
                      media: {
                        $ref: "#/definitions/mediaList",
                        description:
                          "Media shown with the clue. The clue text may be empty when media is present.",
                      },
                      answerMedia: {
                        $ref: "#/definitions/mediaList",
                        description: "Media shown when the answer is revealed.",
                      },
                      choices: {
                        type: "array",
                        items: { type: "string", minLength: 1 },
                        minItems: 2,
                        maxItems: 6,
                        uniqueItems: true,
                        description:
                          "Options for a multiple choice question (2-6, unique). The answer must be one of them (ignoring case). Not allowed on long-form clues.",
                      },
                      secret: {
                        type: "boolean",
                        description:
                          'A secret ("cat in the bag") question: whoever chooses it gives it to another player, who answers it alone. Not allowed with wagerable or longForm.',
                      },
                      secretTopic: {
                        type: "string",
                        minLength: 1,
                        description:
                          "Topic shown when the secret question is handed over (default: the category name). Requires secret: true.",
                      },
                      secretValue: {
                        type: "integer",
                        exclusiveMinimum: 0,
                        description:
                          "What the secret question is worth (default: value). Requires secret: true.",
                      },
                      readTimeSec: {
                        type: "integer",
                        minimum: 0,
                        maximum: 60,
                        description:
                          'Seconds to show the question before the buzzers open, when the room\'s reading time is "Auto" (default: from the text and media). Imported from SIGame display times.',
                      },
                    },
                    required: ["clue", "answer", "value"],
                  },
                },
              },
              required: ["name", "clues"],
            },
          },
        },
        required: ["categoryNames", "categories"],
      },
    },
  },
  required: ["title", "author", "copyright", "note", "boards"],
};

export function loader() {
  const schemaStr = JSON.stringify(SCHEMA, null, 2);

  return new Response(schemaStr, {
    status: 200,
    headers: {
      "Content-Type": "application/schema+json",
      // This machine-readable schema is linked for tooling, not search results.
      "X-Robots-Tag": "noindex",
    },
  });
}
