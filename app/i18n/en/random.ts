/** English messages: random board generator (`/random-board`). Keys start
 * with "random.". */
export const random = {
  "random.metaTitle": "Random board",
  "random.homeButton": "Random board",
  "random.title": "Random board",
  "random.intro":
    "Mix categories from the public games on Jep! into a fresh game and start playing right away.",
  "random.categoriesLabel": "Categories per round",
  "random.roundsLabel": "Rounds",
  "random.oneRound": "1 round",
  "random.twoRounds": "2 rounds",
  "random.includeFinal": "Add a final question (if there is one)",
  "random.playWithFriends": "Generate and play with friends",
  "random.playSolo": "Generate and play solo",
  "random.unlistedHint":
    "The new game is unlisted: only people with the link can find it. Questions keep their original values.",
  "random.gameTitle": "Random board · {date}",
  "random.gameNote": "Categories from: {sources}",
  "random.error.notEnough":
    "Not enough public games to build this board: it needs {needed} categories with different names and at least 3 questions each, but only {available} were found. Upload more games or choose fewer categories.",
  "random.error.invalid": "Choose 3 to 8 categories and 1 or 2 rounds.",
} as const;
