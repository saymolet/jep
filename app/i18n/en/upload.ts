/** English messages: upload (upload box, upload results and errors).
 * Keys start with "upload.". */
export const upload = {
  "upload.uploadOrImport": "Upload or import a game",
  "upload.invalidFileType": "Invalid file type",
  "upload.dropFileHere": "Drop file here",
  "upload.hint": "Jep! game (.jep.json) or SIGame pack (.siq, up to 100 MB)",
  "upload.help": "Upload help",
  "upload.confirmPublic": "Confirm public upload",
  "upload.confirmPublicDescription":
    'Do you want to upload the game "{name}" publicly?',
  "upload.unknownFile": "unknown",
  "upload.guestWarning":
    "As a guest, you will not be able to edit or delete the game later.",
  "upload.cancel": "Cancel",
  "upload.guidelines":
    "Games must follow the <link>community guidelines</link>.",
  "upload.uploadPublicly": "Upload publicly",
  "upload.importingSiq": "Importing SIGame pack…",
  "upload.uploading": "Uploading…",
  "upload.createdPublic":
    "Created new public game. You may now view your game on the home page.",
  "upload.createdUnlisted":
    "Created new unlisted game. You may now visit the link {url} to play the new game.",
  "upload.error.prefix": "Error uploading game: {reason}",
  "upload.error.noGameKey": "no game key returned.",
  "upload.error.tooLarge":
    "the file is too large (SIGame packs: at most 100 MB, JSON games: at most 1 MB).",
  "upload.error.unsupported":
    "Unsupported file. Upload a Jep! game (.jep.json) or a SIGame pack (.siq).",
  "upload.error.jsonTooLarge": "JSON games must be at most 1 MB.",
} as const;
