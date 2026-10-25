import Code, { CodeBlock } from "~/components/code";
import Link, { Anchor } from "~/components/link";
import Main from "~/components/main";
import { getPageMetadata } from "~/utils/seo";

import type { Route } from "./+types/upload-help";

export const meta: Route.MetaFunction = () =>
  getPageMetadata(
    "Upload a Game to Jep!",
    "Learn how to format and upload a custom trivia game to Jep! using a .jep.json file.",
  );

const JSON_EDIT_URL =
  "https://json-editor.github.io/json-editor/?data=N4Ig9gDgLglmB2BnEAuUMDGCA2MBGqIAZglAIYDuApomALZUCsIANOHgFZUZQD62ZAJ5gArlELwwAJzplsrEIgwALKrNSgAJEtXqUIZVCgQUAelMda8ALQ61ZAHTSA5qYAmUskSjWADAHZTO1kAYgVNGDdCQ2MzU2wwDDllMEQoFABmX2zTZzIGB2DHSwQFMjc3GFgEOQAFKUgqKVgaVCI5RCo2CDIjJvhCAD0HACoAHTGHLggJqatNBVgobCpCACkqCABCAAIAcXyqHYBlFXtFwQhV/TBObnFuhqvmmFa0ECWVjQ/L68UoKQweDOEAAXzYZDEKSk3ygv0IaUBwLBbCwEEEgOchlh8P0iKBIPBIEkUGuoDhVwRAIJKJAeDAZCkbmQ7wpf0ZnkECiqahZ5Nx7C4PAUECeTRafJASVJzmkggAcodJWzCByhNzSXRlQL8cjQUTpVRZYC3vzKfo1Vy2DytTjzYL7iKxS9TcTDna/rrCWwSWSfvavbSMNgRK6VRapJyNbyPYRbkKHiBRY0XZLg6HY3jqXqIUhqDDWTrs96QAA3OQZwv2oEypq0ihkZxNMh3L5Vv70sArMgDIkJYEAMWkdEzdLAXaoPdpMFkTeOUgwo8D+rYUioAEcRDA11EUABtKUh1a5xD5hTlo8gAC6+qJa8326ou4P8HdqKPyBvK5A963O9QB6GsaCpKgoQHSK8n63quG5/k+AEfFUXwQlC0hgZAGIwFiia+go9KMsy15EogKQULwTQNFILIgDWzY8HAAxsFAugduOUCImQEAACxgqCQA=";

export default function Help() {
  return (
    <div className="max-w-full">
      <Main>
        <h1 className="mb-4 text-2xl font-semibold">
          How to upload a new game
        </h1>
        <p className="mb-4">
          To upload a new game, submit a file ending in <Code>.jep.json</Code>{" "}
          that follows the schema described below.
        </p>
        <p className="mb-4">
          The schema is also defined in this{" "}
          <Link to="/game.schema.json">JSON schema file</Link> and in this{" "}
          <Anchor href={JSON_EDIT_URL}>JSON editor</Anchor>.
        </p>
        <p className="mb-4">
          To change an existing game, open it and use{" "}
          <strong>Download JSON</strong>, edit the file and upload it again (it
          becomes a new game).
        </p>
        <h2 className="mb-4 text-xl font-semibold">Import a SIGame pack</h2>
        <p className="mb-4">
          You can also upload a SIGame / SIQuester pack (a <Code>.siq</Code>{" "}
          file, up to 100 MB). Jep! converts it: rounds become rounds, themes
          become categories and each question keeps its price. Pictures, sound
          and video in the pack are stored by Jep! and shown with the question
          (or with the answer, for content after the answer marker). "Cat in the
          bag" questions become secret questions, stake (auction) questions
          become wager questions, and other special questions play as normal
          questions. Jep! plays one final question, so only the first theme of a
          final round is imported.
        </p>
        <p className="mb-4">
          Files over 50 MB, missing files and unsupported content (such as HTML
          pages) are skipped, and questions left with no text or media are
          dropped. After the import you see a summary of what was skipped.
        </p>
        <h1 className="mb-4 text-2xl font-semibold">Schema definition</h1>
        <CodeBlock
          text={`{
  "title": "Your Title",
  "author": "Author Name",
  "copyright": "(c) Copyright Holder",
  "note": "any note",
  "boards": [ ... board objects ]
}`}
        />
        <p className="mb-4">
          A game is a series of "boards". Each board looks like so:
        </p>

        <CodeBlock
          text={`{
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
}`}
        />
        <p className="mb-4">
          A board has 1 to 12 categories (5 or 6 is classic; boards with more
          categories use more of the screen and still fit a phone). Categories
          don't need the same number of questions: a category with fewer
          questions leaves empty cells at the bottom of its column, and the
          round ends when every question on the board has been played.
        </p>
        <p className="mb-4">
          A clue can be <em>wagerable</em> or not. Wagerable clues allow players
          to wager on the answer and win or lose that value instead of the
          clue's value. The "wagerable" field is not required.
        </p>
        <p className="mb-4">
          Clues can also be <em>long-form</em> or not. For long-form clues, all
          players may write down their answers over a longer time period instead
          of competing to buzz in. Long-form clues must also be wagerable.
        </p>
        <h2 className="mb-4 text-xl font-semibold">
          Questions with pictures, audio and video
        </h2>
        <p className="mb-4">
          A clue can show pictures, play sound or play video. Add a{" "}
          <Code>media</Code> list to show media together with the clue, and an{" "}
          <Code>answerMedia</Code> list to show media when the answer is
          revealed (for example a picture of the answer). Each item has a{" "}
          <Code>type</Code> (<Code>"image"</Code>, <Code>"audio"</Code> or{" "}
          <Code>"video"</Code>), a <Code>src</Code> and an optional{" "}
          <Code>alt</Code> text description.
        </p>
        <ul className="mb-4 list-inside list-disc">
          <li>
            Jep! does not host files: <Code>src</Code> must be an{" "}
            <Code>https://</Code> link to a file hosted anywhere on the web (for
            example Wikimedia Commons or your own storage).
          </li>
          <li>
            For <Code>"video"</Code>, a YouTube link also works (
            <Code>youtube.com/watch?v=…</Code> or <Code>youtu.be/…</Code>). Add{" "}
            <Code>t=90</Code> or <Code>t=1m30s</Code> to start at a given time —
            handy for music rounds.
          </li>
          <li>
            The clue text may be empty (<Code>"clue": ""</Code>) when the media
            carries the question.
          </li>
          <li>
            Audio and video start by themselves when the clue opens if the
            browser allows it; otherwise players tap play. Buzzers open after at
            least 10 seconds for clues with audio or video, and at least 3
            seconds for clues with pictures.
          </li>
          <li>
            Use widely supported formats: JPEG/PNG/WebP/GIF pictures, MP3 audio
            and MP4 video work on every phone and computer.
          </li>
        </ul>
        <CodeBlock
          text={`{
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
}`}
        />
        <p className="mb-4">
          The older <Code>imageSrc</Code> field (a single picture URL) still
          works and is shown like an image in <Code>media</Code>.
        </p>
        <h2 className="mb-4 text-xl font-semibold">
          Multiple choice questions
        </h2>
        <p className="mb-4">
          Add a <Code>choices</Code> list to turn a question into multiple
          choice. Everyone sees the options (A, B, C...) while the question is
          read, and buzzing works as usual. The player who wins the buzz taps an
          option instead of revealing the answer, and Jep! checks it
          automatically: a right pick wins the value, a wrong pick loses it and
          the others may buzz in.
        </p>
        <ul className="mb-4 list-inside list-disc">
          <li>2 to 6 options, all different.</li>
          <li>
            The <Code>answer</Code> must be exactly one of the options (letter
            case doesn't matter).
          </li>
          <li>
            Works with wagerable questions and with media, but not with
            long-form questions.
          </li>
        </ul>
        <CodeBlock
          text={`{
  "clue": "The capital of Australia",
  "answer": "Canberra",
  "value": 200,
  "choices": ["Sydney", "Canberra", "Melbourne", "Perth"]
}`}
        />
        <h2 className="mb-4 text-xl font-semibold">
          Secret questions (cat in the bag)
        </h2>
        <p className="mb-4">
          Set <Code>"secret": true</Code> to hide a cat in the bag (
          <i>Кот в мешке</i>). On the board it looks like any other question.
          Whoever chooses it sees the cat, the topic and the value, and must
          give it to another player. Only that player answers, without buzzing:
          right wins the value and board control, wrong loses the value and the
          chooser keeps board control. Playing alone, you get it yourself.
        </p>
        <ul className="mb-4 list-inside list-disc">
          <li>
            <Code>secretTopic</Code> (optional) is shown when the question is
            handed over; the category name is shown by default.
          </li>
          <li>
            <Code>secretValue</Code> (optional, a positive whole number) is what
            the question is worth; the value on the board by default.
          </li>
          <li>
            Works with media and with <Code>choices</Code>, but not with
            wagerable or long-form questions.
          </li>
        </ul>
        <CodeBlock
          text={`{
  "clue": "The author who created The Cat in the Hat",
  "answer": "Dr. Seuss",
  "value": 400,
  "secret": true,
  "secretTopic": "Famous cats",
  "secretValue": 500
}`}
        />
        <h1 className="mb-4 text-2xl font-semibold">Type definition</h1>
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
          Example full game (copy, modify, paste)
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
