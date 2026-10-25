/** English messages: watch (spectators and the TV / presenter screen). Keys
 * start with "watch.". */
export const watch = {
  // Spectators
  "watch.justWatch": "Just watch",
  "watch.watching": "Watching",
  "watch.spectatorHint": "You're watching. Join any time to play.",
  "watch.watchers": { one: "{count} watching", other: "{count} watching" },
  "watch.showOnTv": "Show on TV",

  // Presenter (TV) screen
  "watch.presenterTitle": "{title} · TV",
  "watch.fullscreen": "Fullscreen",
  "watch.exitFullscreen": "Exit fullscreen",
  "watch.scanToJoin": "Scan to join",
  "watch.orOpen": "or open {url}",
  "watch.qrLabel": "QR code to join the game",
  "watch.soundHint": "Tap anywhere to turn on sound",
  "watch.players": "Players",
  "watch.noPlayers": "No players yet",
  "watch.roundOf": "Round {round} of {total}",
  "watch.winner": "{name} wins!",
  "watch.tie": "It's a tie: {names}",

  // What is happening now (shown to spectators and on the TV)
  "watch.status.waitingForPlayers": "Waiting for players to join...",
  "watch.status.roundStarting": "Round {round} is about to start",
  "watch.status.roundStartingWith":
    "Round {round} is about to start · {name} chooses first",
  "watch.status.choosing": "{name} is choosing a question",
  "watch.status.final": "Final round",
  "watch.status.wagering": "{name} is placing a wager",
  "watch.status.finalWagers":
    "Players are placing their wagers ({done} of {total})",
  "watch.status.passing": "{name} is choosing who gets the cat in the bag",
  "watch.status.reading": "Get ready to buzz...",
  "watch.status.buzzersOpen": "Buzzers open!",
  "watch.status.answering": "{name} is answering",
  "watch.status.secretAnswering": "Cat in the bag: {name} is answering",
  "watch.status.picking": "{name} is picking an answer",
  "watch.status.writing": "Players are writing their answers",
  "watch.status.checking": "Players are checking their answers",
  "watch.status.answer": "The answer",
  "watch.status.gotIt": "{name} got it!",
  "watch.status.noOneAnswered": "No one got it",
  "watch.status.gameOver": "Game over!",
  "watch.status.paused": "Game paused",
} as const;
