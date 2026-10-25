/** English messages: play (the question prompt, wagers, checks, media,
 * undo). Keys start with "play.". */
export const play = {
  // Prompt header and hints
  "play.categoryFor": "<b>{category}</b> for <b>{value}</b>",
  "play.categoryForWagered":
    "<b>{category}</b> for <b>{value}</b> (wagered <b>{wager}</b>)",
  "play.buzzHint": "Click or press <kbd>Enter</kbd> to buzz in",
  "play.secretHint": "Secret question",
  "play.winningBuzzer": "winning buzzer",
  "play.finalClue": "final clue",
  "play.doubleDown": "double down",
  "play.notEnoughToWager":
    "You do not have enough money to wager on this clue.",
  "play.waitingForWagers": "Waiting for others to submit wagers...",
  "play.waitingForResponse": "Waiting for response from {name}...",
  "play.noOneCanWagerRead":
    "No one has enough money to wager, but give the clue a read!",
  "play.waitingForAnswers": "Waiting for others to answer...",
  "play.yourSecretQuestion": "Your secret question! Only you answer it.",
  "play.secretQuestionFor": "Secret question for {name}",
  "play.waitingForPick": "Waiting for {name} to pick an answer...",
  "play.waitingForChecks": "Waiting for checks from {names}...",
  "play.noAnswer": "[no answer]",
  "play.lockout": "LOCKOUT",
  "play.tapHint": "Tap the button below when it turns green",

  // Big BUZZ button on phones
  "play.buzzer.wait": "Wait…",
  "play.buzzer.waitHint": "Tapping now locks you out",
  "play.buzzer.open": "BUZZ!",
  "play.buzzer.tooEarly": "Too early!",
  "play.buzzer.tooEarlyHint": "Locked out for a moment",
  "play.buzzer.alreadyAnswered": "Locked out",
  "play.buzzer.alreadyAnsweredHint": "You already tried this question",
  "play.buzzer.timedOut": "Time's up",
  "play.buzzer.timedOutHint": "You didn't buzz in time",
  "play.buzzer.otherWon": "{name} was faster",
  "play.buzzer.otherWonHint": "Wait for their answer",
  "play.buzzer.won": "Your turn — answer!",

  // Check form
  "play.check.dontSpoil": "(don't spoil the answer for others!)",
  "play.check.yourAnswer": "Your answer: {answer}",
  "play.check.wereYouRight": "Were you right?",
  "play.check.incorrect": "incorrect",
  "play.check.correct": "correct!",
  "play.check.answerThen": "Answer in the form of a question, then",
  "play.check.revealAnswer": "Reveal answer",
  "play.check.won": "You won {amount}",
  "play.check.lost": "You lost {amount}",
  "play.check.waitingForChecks": "Waiting for check(s) from {names}...",

  // Long-form answer form
  "play.answer.youAnswered": "You answered: {answer}",
  "play.answer.canChange":
    "You can change your answer until the last player submits an answer.",
  "play.answer.placeholder": "What is...",
  "play.answer.submit": "submit",

  // After the clue
  "play.next.noOneCanWager": "No one has enough money to wager on this clue.",
  "play.next.playerCantWager":
    "{name} does not have enough money to wager on this clue.",
  "play.next.noOneWon": "No one won the clue.",
  "play.next.unknownPlayer": "Unknown player",
  "play.next.backToBoard": "Back to board",

  // Wagers
  "play.wager.you": "(you)",
  "play.wager.cantWager": "(can't wager)",
  "play.wager.suggestions": "Suggestions",
  "play.wager.allIn": "All-in",
  "play.wager.allInAmount": "All-in ({amount})",
  "play.wager.howMuch": "How much will you wager on this clue?",
  "play.wager.upTo": "You can wager up to {amount}.",
  "play.wager.placeholder": "choose wager amount",
  "play.wager.submit": "Submit",
  "play.wager.yourWager": "Your wager: {amount}",
  "play.wager.waitingForOthers": "Waiting for other players to wager...",

  // Final clue wager suggestions (utils/wager-strategy.ts)
  "play.strategy.label.wagerEverything": "Wager everything",
  "play.strategy.label.goAllIn": "Go all in",
  "play.strategy.label.betNothing": "Bet nothing",
  "play.strategy.label.safeBet": "Safe bet",
  "play.strategy.label.coverBet": "Cover bet",
  "play.strategy.label.conservativeBet": "Conservative bet",
  "play.strategy.label.competitiveBet": "Competitive bet",
  "play.strategy.label.targetBet": "Target bet",
  "play.strategy.reason.noOpponents": "No opponents to worry about.",
  "play.strategy.reason.tiedAllIn":
    "You're tied. Bet everything — if your opponent bets big and is correct, you need to match.",
  "play.strategy.reason.tiedNothing":
    "If both miss and your opponent bet big, you win. But you lose if they're right and bet anything.",
  "play.strategy.reason.runawaySafe":
    "You have more than double second place. Bet $0 to guarantee the win.",
  "play.strategy.reason.runawayCover":
    "Bet to stay ahead even if second place doubles up and is correct.",
  "play.strategy.reason.cover":
    "If both you and second place answer correctly, you still win by $1.",
  "play.strategy.reason.crushAllIn":
    "You need the leader to miss. Maximize your score for the best chance.",
  "play.strategy.reason.twoThirdsConservative":
    "You can't pass the leader if both right. Stay ahead if both miss.",
  "play.strategy.reason.twoThirdsAllIn":
    "High-risk: maximizes your score if the leader also misses.",
  "play.strategy.reason.competitive":
    "Minimum wager to beat the leader if you both answer correctly.",
  "play.strategy.reason.threeQuartersSafe":
    "Maximum wager that keeps you ahead if both you and the leader miss.",
  "play.strategy.reason.thirdSafe":
    "If both opponents miss with standard bets, you win without risking anything.",
  "play.strategy.reason.thirdAllIn":
    "You need opponents ahead to miss. Maximize your potential score.",
  "play.strategy.reason.thirdTarget":
    "Bet enough to pass where the leader falls if they miss.",

  // Multiple choice
  "play.choices.options": "Options",
  "play.choices.someone": "Someone",
  "play.choices.pickYourAnswer": "Pick your answer",
  "play.choices.youPicked": "You picked {label}...",

  // Secret question (cat in the bag)
  "play.secret.title": "Cat in the bag!",
  "play.secret.subtitle": "Кот в мешке · secret question",
  "play.secret.choosing": "{name} is choosing who gets the secret question...",
  "play.secret.givingTo": "Giving it to {name}...",
  "play.secret.giveTo": "Give this question to another player:",
  "play.secret.players": "Players",
  "play.secret.theChooser": "The chooser",

  // Media
  "play.media.imageFor": "Image for clue: {clue}",
  "play.media.clueImage": "Clue image",
  "play.media.clueAudio": "Clue audio",
  "play.media.clueVideo": "Clue video",
  "play.media.youTubeVideo": "YouTube video",
  "play.media.playAudio": "Play audio",
  "play.media.pauseAudio": "Pause audio",
  "play.media.tapToPlayAudio": "Tap to play audio",
  "play.media.tapPlayToStart": "Tap play to start",

  // Undo a check
  "play.undo.undo": "undo",
  "play.undo.undoAmount": "undo ({amount})",
  "play.undo.cancel": "cancel",
  "play.undo.thisClue": "Undo your check on this clue?",
  "play.undo.lastClue": "Undo your check on the last clue?",
  "play.answerTimer.label": "Answer timer",
  "play.answerTimer.secondsLeft": {
    one: "{count} second left",
    other: "{count} seconds left",
  },
  "play.answerTimer.timesUp": "Time's up!",
  "play.answerTimer.autoWrongHint":
    "When the time runs out, your answer counts as wrong.",
  "play.answerTimer.countedWrong": "Your answer counts as wrong.",
  "play.answerTimer.markNow": "Mark your answer now.",
  "play.answerTimer.ranOutOfTime": "{name} ran out of time.",
} as const;
