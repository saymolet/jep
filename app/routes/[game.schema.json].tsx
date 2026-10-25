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
            items: {
              type: "string",
            },
          },
          categories: {
            type: "array",
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
