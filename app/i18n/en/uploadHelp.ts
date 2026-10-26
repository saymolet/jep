/** English messages: uploadHelp (the /upload-help page). Keys start with
 * "uploadHelp.". JSON samples on the page are not translated (file format). */
export const uploadHelp = {
  "uploadHelp.metaTitle": "Upload a Game to Jep!",
  "uploadHelp.metaDescription":
    "Learn how to format and upload a custom trivia game to Jep! using a .jep.json file.",
  "uploadHelp.title": "How to upload a new game",
  "uploadHelp.intro":
    "To upload a new game, submit a file ending in <code>.jep.json</code> that follows the schema described below.",
  "uploadHelp.schemaLinks":
    "The schema is also defined in this <schema>JSON schema file</schema> and in this <editor>JSON editor</editor>.",
  "uploadHelp.changeGame":
    "To change an existing game, open it and use <strong>Download JSON</strong>, edit the file and upload it again (it becomes a new game).",
  "uploadHelp.siqTitle": "Import a SIGame pack",
  "uploadHelp.siqIntro":
    'You can also upload a SIGame / SIQuester pack (a <code>.siq</code> file, up to 100 MB). Jep! converts it: rounds become rounds, themes become categories and each question keeps its price. Pictures, sound and video in the pack are stored by Jep! and shown with the question (or with the answer, for content after the answer marker). "Cat in the bag" questions become secret questions, stake (auction) questions become wager questions, and other special questions play as normal questions. Jep! plays one final question, so only the first theme of a final round is imported.',
  "uploadHelp.siqSkipped":
    "Files over 50 MB, missing files and unsupported content (such as HTML pages) are skipped, and questions left with no text or media are dropped. After the import you see a summary of what was skipped.",
  "uploadHelp.schemaTitle": "Schema definition",
  "uploadHelp.boards":
    'A game is a series of "boards". Each board looks like so:',
  "uploadHelp.categories":
    "A board has 1 to 12 categories (5 or 6 is classic; boards with more categories use more of the screen and still fit a phone). Categories don't need the same number of questions: a category with fewer questions leaves empty cells at the bottom of its column, and the round ends when every question on the board has been played.",
  "uploadHelp.wagerable":
    'A clue can be <em>wagerable</em> or not. Wagerable clues allow players to wager on the answer and win or lose that value instead of the clue\'s value. The "wagerable" field is not required.',
  "uploadHelp.longForm":
    "Clues can also be <em>long-form</em> or not. For long-form clues, all players may write down their answers over a longer time period instead of competing to buzz in. Long-form clues must also be wagerable.",
  "uploadHelp.mediaTitle": "Questions with pictures, audio and video",
  "uploadHelp.mediaIntro":
    'A clue can show pictures, play sound or play video. Add a <code>media</code> list to show media together with the clue, and an <code>answerMedia</code> list to show media when the answer is revealed (for example a picture of the answer). Each item has a <code>type</code> (<code>"image"</code>, <code>"audio"</code> or <code>"video"</code>), a <code>src</code> and an optional <code>alt</code> text description.',
  "uploadHelp.mediaHosting":
    "Jep! does not host files: <code>src</code> must be an <code>https://</code> link to a file hosted anywhere on the web (for example Wikimedia Commons or your own storage).",
  "uploadHelp.mediaYoutube":
    'For <code>"video"</code>, a YouTube link also works (<code>youtube.com/watch?v=…</code> or <code>youtu.be/…</code>). Add <code>t=90</code> or <code>t=1m30s</code> to start at a given time — handy for music rounds.',
  "uploadHelp.mediaEmptyClue":
    'The clue text may be empty (<code>"clue": ""</code>) when the media carries the question.',
  "uploadHelp.mediaAutoplay":
    "Audio and video start by themselves when the clue opens if the browser allows it; otherwise players tap play. Buzzers open after at least 10 seconds for clues with audio or video, and at least 3 seconds for clues with pictures.",
  "uploadHelp.mediaFormats":
    "Use widely supported formats: JPEG/PNG/WebP/GIF pictures, MP3 audio and MP4 video work on every phone and computer.",
  "uploadHelp.imageSrc":
    "The older <code>imageSrc</code> field (a single picture URL) still works and is shown like an image in <code>media</code>.",
  "uploadHelp.choicesTitle": "Multiple choice questions",
  "uploadHelp.choicesIntro":
    "Add a <code>choices</code> list to turn a question into multiple choice. Everyone sees the options (A, B, C...) while the question is read, and buzzing works as usual. The player who wins the buzz taps an option instead of revealing the answer, and Jep! checks it automatically: a right pick wins the value, a wrong pick loses it and the others may buzz in.",
  "uploadHelp.choicesCount": "2 to 6 options, all different.",
  "uploadHelp.choicesAnswer":
    "The <code>answer</code> must be exactly one of the options (letter case doesn't matter).",
  "uploadHelp.choicesWorksWith":
    "Works with wagerable questions and with media, but not with long-form questions.",
  "uploadHelp.readTimeTitle": "Reading time",
  "uploadHelp.readTimeIntro":
    "Add <code>\"readTimeSec\": 8</code> (a whole number from 0 to 60) to show a question for exactly that many seconds before the buzzers open. It is used when the room's reading time is <b>Auto</b> (the default); without it, Jep! estimates the time from the text and media. Imported SIGame packs get it from the display times of their question parts (if the pack has any; SIGame's own timers are app settings and are not stored in packs). The admin can set a fixed reading time, the buzz window, the Final answer time and the wager time for each room.",
  "uploadHelp.secretTitle": "Secret questions (cat in the bag)",
  "uploadHelp.secretIntro":
    'Set <code>"secret": true</code> to hide a cat in the bag (<i>Кот в мешке</i>). On the board it looks like any other question. Whoever chooses it sees the cat, the topic and the value, and must give it to another player. Only that player answers, without buzzing: right wins the value and board control, wrong loses the value and the chooser keeps board control. Playing alone, you get it yourself.',
  "uploadHelp.secretTopic":
    "<code>secretTopic</code> (optional) is shown when the question is handed over; the category name is shown by default.",
  "uploadHelp.secretValue":
    "<code>secretValue</code> (optional, a positive whole number) is what the question is worth; the value on the board by default.",
  "uploadHelp.secretWorksWith":
    "Works with media and with <code>choices</code>, but not with wagerable or long-form questions.",
  "uploadHelp.typeTitle": "Type definition",
  "uploadHelp.exampleTitle": "Example full game (copy, modify, paste)",
} as const;
