import type * as React from "react";

import Code, { CodeBlock } from "~/components/code";
import Link, { Anchor } from "~/components/link";
import Main from "~/components/main";
import { useTranslation } from "~/i18n";
import { metaT } from "~/i18n/meta";
import { getPageMetadata } from "~/utils/seo";

import type { Route } from "./+types/upload-help";

export const meta: Route.MetaFunction = ({ matches }) => {
  const t = metaT(matches);
  return getPageMetadata(
    t("uploadHelp.metaTitle"),
    t("uploadHelp.metaDescription"),
  );
};

const JSON_EDIT_URL =
  "https://json-editor.github.io/json-editor/?data=N4Ig9gDgLglmB2BnEAuUMDGCA2MBGqIAZglAIYDuApomALZUCsIANOHgFZUZQD62ZAJ5gArlELwwAJzplsrEIgwALKrNSgAJEtXqUIZVCgQUAelMda8ALQ61ZAHTSA5qYAmUskSjWADAHZTO1kAYgVNGDdCQ2MzU2wwDDllMEQoFABmX2zTZzIGB2DHSwQFMjc3GFgEOQAFKUgqKVgaVCI5RCo2CDIjJvhCAD0HACoAHTGHLggJqatNBVgobCpCACkqCABCAAIAcXyqHYBlFXtFwQhV/TBObnFuhqvmmFa0ECWVjQ/L68UoKQweDOEAAXzYZDEKSk3ygv0IaUBwLBbCwEEEgOchlh8P0iKBIPBIEkUGuoDhVwRAIJKJAeDAZCkbmQ7wpf0ZnkECiqahZ5Nx7C4PAUECeTRafJASVJzmkggAcodJWzCByhNzSXRlQL8cjQUTpVRZYC3vzKfo1Vy2DytTjzYL7iKxS9TcTDna/rrCWwSWSfvavbSMNgRK6VRapJyNbyPYRbkKHiBRY0XZLg6HY3jqXqIUhqDDWTrs96QAA3OQZwv2oEypq0ihkZxNMh3L5Vv70sArMgDIkJYEAMWkdEzdLAXaoPdpMFkTeOUgwo8D+rYUioAEcRDA11EUABtKUh1a5xD5hTlo8gAC6+qJa8326ou4P8HdqKPyBvK5A963O9QB6GsaCpKgoQHSK8n63quG5/k+AEfFUXwQlC0hgZAGIwFiia+go9KMsy15EogKQULwTQNFILIgDWzY8HAAxsFAugduOUCImQEAACxgqCQA=";

const GAME_SAMPLE = `{
  "title": "Your Title",
  "author": "Author Name",
  "copyright": "(c) Copyright Holder",
  "note": "any note",
  "boards": [ ... board objects ]
}`;

const BOARD_SAMPLE = `{
  "categoryNames": [
    "Apples",
    "Bananas"
  ],
  "categories": [
    {
      "name": "Apples",
      "note": "Name the apple variety.",
      "clues": [
        {
          "clue": "This apple variety is named after a city in New York State",
          "answer": "Empire",
          "value": 200
        }
        // ... more clues
      ]
    },
    {
      "name": "Bananas",
      "clues": [ ... clues for category 2 ],
    }
  ]
}`;

const MEDIA_SAMPLE = `{
  "clue": "",
  "answer": "Moonlight Sonata",
  "value": 400,
  "media": [
    {
      "type": "audio",
      "src": "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/eb/Beethoven_Moonlight_1st_movement.ogg/Beethoven_Moonlight_1st_movement.ogg.mp3"
    }
  ],
  "answerMedia": [
    {
      "type": "image",
      "src": "https://example.com/beethoven.jpg",
      "alt": "Portrait of Ludwig van Beethoven"
    }
  ]
},
{
  "clue": "Name this short film",
  "answer": "Big Buck Bunny",
  "value": 600,
  "media": [
    { "type": "video", "src": "https://youtu.be/aqz-KE-bpKQ?t=60" }
  ]
}`;

const CHOICES_SAMPLE = `{
  "clue": "The capital of Australia",
  "answer": "Canberra",
  "value": 200,
  "choices": ["Sydney", "Canberra", "Melbourne", "Perth"]
}`;

const SECRET_SAMPLE = `{
  "clue": "The author who created The Cat in the Hat",
  "answer": "Dr. Seuss",
  "value": 400,
  "secret": true,
  "secretTopic": "Famous cats",
  "secretValue": 500
}`;

export default function Help() {
  const { t, rich } = useTranslation();
  const code = (c: React.ReactNode) => <Code>{c}</Code>;
  return (
    <div className="max-w-full">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">{t("uploadHelp.title")}</h1>
        <p className="mb-4">{rich("uploadHelp.intro", { code })}</p>
        <p className="mb-4">
          {rich("uploadHelp.schemaLinks", {
            schema: (c) => <Link to="/game.schema.json">{c}</Link>,
            editor: (c) => <Anchor href={JSON_EDIT_URL}>{c}</Anchor>,
          })}
        </p>
        <p className="mb-4">
          {rich("uploadHelp.changeGame", {
            strong: (c) => <strong>{c}</strong>,
          })}
        </p>
        <h2 className="mb-4 text-xl font-semibold">
          {t("uploadHelp.siqTitle")}
        </h2>
        <p className="mb-4">{rich("uploadHelp.siqIntro", { code })}</p>
        <p className="mb-4">{t("uploadHelp.siqSkipped")}</p>
        <h1 className="mb-4 text-2xl font-semibold">
          {t("uploadHelp.schemaTitle")}
        </h1>
        <CodeBlock text={GAME_SAMPLE} />
        <p className="mb-4">{t("uploadHelp.boards")}</p>

        <CodeBlock text={BOARD_SAMPLE} />
        <p className="mb-4">{t("uploadHelp.categories")}</p>
        <p className="mb-4">
          {rich("uploadHelp.wagerable", { em: (c) => <em>{c}</em> })}
        </p>
        <p className="mb-4">
          {rich("uploadHelp.longForm", { em: (c) => <em>{c}</em> })}
        </p>
        <h2 className="mb-4 text-xl font-semibold">
          {t("uploadHelp.mediaTitle")}
        </h2>
        <p className="mb-4">{rich("uploadHelp.mediaIntro", { code })}</p>
        <ul className="mb-4 list-inside list-disc">
          <li>{rich("uploadHelp.mediaHosting", { code })}</li>
          <li>{rich("uploadHelp.mediaYoutube", { code })}</li>
          <li>{rich("uploadHelp.mediaEmptyClue", { code })}</li>
          <li>{t("uploadHelp.mediaAutoplay")}</li>
          <li>{t("uploadHelp.mediaFormats")}</li>
        </ul>
        <CodeBlock text={MEDIA_SAMPLE} />
        <p className="mb-4">{rich("uploadHelp.imageSrc", { code })}</p>
        <h2 className="mb-4 text-xl font-semibold">
          {t("uploadHelp.choicesTitle")}
        </h2>
        <p className="mb-4">{rich("uploadHelp.choicesIntro", { code })}</p>
        <ul className="mb-4 list-inside list-disc">
          <li>{t("uploadHelp.choicesCount")}</li>
          <li>{rich("uploadHelp.choicesAnswer", { code })}</li>
          <li>{t("uploadHelp.choicesWorksWith")}</li>
        </ul>
        <CodeBlock text={CHOICES_SAMPLE} />
        <h2 className="mb-4 text-xl font-semibold">
          {t("uploadHelp.secretTitle")}
        </h2>
        <p className="mb-4">
          {rich("uploadHelp.secretIntro", { code, i: (c) => <i>{c}</i> })}
        </p>
        <ul className="mb-4 list-inside list-disc">
          <li>{rich("uploadHelp.secretTopic", { code })}</li>
          <li>{rich("uploadHelp.secretValue", { code })}</li>
          <li>{rich("uploadHelp.secretWorksWith", { code })}</li>
        </ul>
        <CodeBlock text={SECRET_SAMPLE} />
        <h1 className="mb-4 text-2xl font-semibold">
          {t("uploadHelp.typeTitle")}
        </h1>
        <CodeBlock
          text={`interface Game {
  title: string;
  author: string;
  copyright: string;
  note: string;
  boards: Board[];
}

interface Board {
  categoryNames: string[]; // 1 to 12, same names as categories
  categories: Category[]; // 1 to 12
}

interface Category {
  name: string;
  clues: Clue[]; // at least 1; categories may differ in length
  note?: string;
}

interface Clue {
  clue: string;
  answer: string;
  value: number;
  wagerable?: boolean; // default false
  longForm?: boolean; // default false
  imageSrc?: string; // a single picture; prefer media
  media?: MediaBlock[]; // shown with the clue
  answerMedia?: MediaBlock[]; // shown when the answer is revealed
  choices?: string[]; // 2-6 options for a multiple choice question
  secret?: boolean; // cat in the bag: handed to another player; default false
  secretTopic?: string; // shown when handed over; default: the category name
  secretValue?: number; // worth this instead of value
}

interface MediaBlock {
  type: "image" | "audio" | "video";
  src: string; // https:// URL, or a YouTube link for "video"
  alt?: string;
}`}
        />
        <h1 className="mb-4 text-2xl font-semibold">
          {t("uploadHelp.exampleTitle")}
        </h1>
        <CodeBlock
          text={`{
  "title": "** your title **",
  "author": "** your author **",
  "copyright": "** your copyright **",
  "note": "** your note **",
  "boards": [
    {
      "categoryNames": [
        "** round 1, category 1 **",
        "** round 1, category 2 **",
        "** round 1, category 3 **",
        "** round 1, category 4 **",
        "** round 1, category 5 **",
        "** round 1, category 6 **"
      ],
      "categories": [
        {
          "name": "** round 1, category 1 **",
          "note": "** optional category note **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 1, category 2 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600,
              "wagerable": true
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 1, category 3 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 1, category 4 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 1, category 5 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 1, category 6 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        }
      ]
    },
    {
      "categoryNames": [
        "** round 2, category 1 **",
        "** round 2, category 2 **",
        "** round 2, category 3 **",
        "** round 2, category 4 **",
        "** round 2, category 5 **",
        "** round 2, category 6 **"
      ],
      "categories": [
        {
          "name": "** round 2, category 1 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 2, category 2 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 2, category 3 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800,
              "wagerable": true
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 2, category 4 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600,
              "wagerable": true
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 2, category 5 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        },
        {
          "name": "** round 2, category 6 **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 200
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 400
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 600
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 800
            },
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 1000
            }
          ]
        }
      ]
    },
    {
      "categoryNames": ["** round 3, final category **"],
      "categories": [
        {
          "name": "** round 3, final category **",
          "clues": [
            {
              "clue": "** clue **",
              "answer": "** answer **",
              "value": 0,
              "wagerable": true,
              "longForm": true
            }
          ]
        }
      ]
    }
  ]
}`}
        />
      </Main>
    </div>
  );
}
