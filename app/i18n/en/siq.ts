/** English messages: siq (SIGame pack import: errors, warnings, summary).
 * Keys start with "siq.". */
export const siq = {
  "siq.error.notZip": "The file is not a SIGame pack (not a zip).",
  "siq.error.cannotOpen": "The SIGame pack could not be opened: {reason}",
  "siq.error.tooManyFiles":
    "The SIGame pack has too many files ({files}; at most {max}).",
  "siq.error.tooLargeUnpacked":
    "The SIGame pack is too large when unpacked ({size} MB; at most {max} MB).",
  "siq.error.noContentXml":
    "The SIGame pack has no content.xml. Is it a .siq file?",
  "siq.error.contentXmlTooLarge":
    "content.xml is too large (at most {max} MB).",
  "siq.error.notUtf8": "content.xml is not valid UTF-8 text.",
  "siq.error.cannotUnpack": "{path} could not be unpacked: {reason}",
  "siq.error.fileMissing": "{path} is missing from the pack.",
  "siq.error.doctype": "content.xml must not contain a DOCTYPE",
  "siq.error.invalidXml":
    "content.xml is not valid XML (line {line}: {reason})",
  "siq.error.unreadableXml": "content.xml could not be read: {reason}",
  "siq.error.noPackage": "content.xml has no <package> element",
  "siq.error.noQuestions": "The SIGame pack has no questions Jep! can play.",
  "siq.error.invalidGame": "The imported game is not valid ({issue}).",

  "siq.skip.uploadFailed": 'file "{ref}" could not be uploaded.',
  "siq.skip.html": 'HTML content is not supported ("{ref}").',
  "siq.skip.unsupportedKind": 'content of type "{kind}" is not supported.',
  "siq.skip.link": 'link "{ref}" skipped ({reason}).',
  "siq.skip.missingFile": 'file "{ref}" is missing from the pack.',
  "siq.skip.unsupportedType": 'file "{ref}" has an unsupported type.',
  "siq.skip.tooLarge": 'file "{ref}" is larger than {max} MB.',

  "siq.warn.at": "{where}: {reason}",
  "siq.warn.tooManyMedia": {
    one: "{where}: only the first {max} of {count} media files are used.",
    other: "{where}: only the first {max} of {count} media files are used.",
  },
  "siq.warn.optionsCount": "options not imported (Jep! needs {min}–{max}).",
  "siq.warn.optionsMedia": "options with pictures or sound are not imported.",
  "siq.warn.optionsUnknownRight":
    "options not imported (the right option is unknown).",
  "siq.warn.optionsInvalid": "options not imported ({reason}).",
  "siq.warn.questionSkipped":
    "{where}: question skipped (no text and no usable media).",
  "siq.warn.noAnswer": "{where}: the pack has no answer for this question.",
  "siq.warn.unknownType":
    '{where}: question type "{type}" is played as a normal question.',
  "siq.warn.finalExtraQuestion":
    "{where}: skipped (a final theme has one question in Jep!).",
  "siq.warn.finalThemesSkipped": {
    one: '{round}: Jep! plays one final question, so only the theme "{theme}" was imported; {count} other final theme was skipped.',
    other:
      '{round}: Jep! plays one final question, so only the theme "{theme}" was imported; {count} other final themes were skipped.',
  },
  "siq.warn.noFinal": "{round}: skipped (no usable final question).",
  "siq.warn.themeSkipped": "{where}: theme skipped (no usable questions).",
  "siq.warn.roundSkipped": "{round}: skipped (no usable questions).",
  "siq.warn.roundSplit": {
    one: "{round}: {count} themes don't fit on one board (at most {max}), so it was split into {boards} rounds.",
    other:
      "{round}: {count} themes don't fit on one board (at most {max}), so it was split into {boards} rounds.",
  },

  "siq.answerPart": "{where} (answer)",
  "siq.noAnswerPlaceholder": "(no answer in the pack)",
  "siq.roundName": "Round {n}",
  "siq.themeName": "Theme {n}",
  "siq.defaultTitle": "SIGame pack",
  "siq.unknownAuthor": "Unknown",

  "siq.summary.imported": 'Imported SIGame pack "{title}": {parts}.',
  "siq.summary.rounds": { one: "{count} round", other: "{count} rounds" },
  "siq.summary.categories": {
    one: "{count} category",
    other: "{count} categories",
  },
  "siq.summary.questions": {
    one: "{count} question",
    other: "{count} questions",
  },
  "siq.summary.mediaFiles": {
    one: "{count} media file",
    other: "{count} media files",
  },
  "siq.summary.skipped": {
    one: "{count} question skipped.",
    other: "{count} questions skipped.",
  },
  "siq.summary.warnings": {
    one: "{count} warning.",
    other: "{count} warnings.",
  },
  "siq.summary.moreWarnings": {
    one: "…and {count} more warning.",
    other: "…and {count} more warnings.",
  },
} as const;
