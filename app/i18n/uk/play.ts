import type { play as en } from "../en/play";
import type { Dictionary } from "../types";

/** Ukrainian messages: play. */
export const play: Dictionary<typeof en> = {
  // Prompt header and hints
  "play.categoryFor": "<b>{category}</b> за <b>{value}</b>",
  "play.categoryForWagered":
    "<b>{category}</b> за <b>{value}</b> (ставка <b>{wager}</b>)",
  "play.buzzHint": "Клацни або натисни <kbd>Enter</kbd>, щоб відповідати",
  "play.secretHint": "Кіт у мішку",
  "play.winningBuzzer": "найшвидшого гравця",
  "play.finalClue": "фінальне питання",
  "play.doubleDown": "подвійна ставка",
  "play.notEnoughToWager":
    "Тобі не вистачає грошей, щоб зробити ставку на це питання.",
  "play.waitingForWagers": "Чекаємо на ставки інших...",
  "play.waitingForResponse": "Чекаємо на відповідь: {name}...",
  "play.noOneCanWagerRead":
    "Ні в кого не вистачає грошей на ставку, але питання все одно варто прочитати!",
  "play.waitingForAnswers": "Чекаємо на відповіді інших...",
  "play.yourSecretQuestion": "Тобі дістався кіт у мішку! Відповідаєш лише ти.",
  "play.secretQuestionFor": "Кіт у мішку для гравця {name}",
  "play.waitingForPick": "Чекаємо, поки {name} обере відповідь...",
  "play.waitingForChecks": "Чекаємо на перевірку від: {names}...",
  "play.noAnswer": "[без відповіді]",
  "play.lockout": "ЗАРАНО!",
  "play.tapHint": "Тисни кнопку внизу, коли вона стане зеленою",

  // Big BUZZ button on phones
  "play.buzzer.wait": "Чекай…",
  "play.buzzer.waitHint": "Натиснеш зараз — кнопку заблокує",
  "play.buzzer.open": "ТИСНИ!",
  "play.buzzer.tooEarly": "Зарано!",
  "play.buzzer.tooEarlyHint": "Кнопку заблоковано на мить",
  "play.buzzer.alreadyAnswered": "Заблоковано",
  "play.buzzer.alreadyAnsweredHint":
    "Твою спробу на це питання вже використано",
  "play.buzzer.timedOut": "Час вийшов",
  "play.buzzer.timedOutHint": "Кнопку не натиснуто вчасно",
  "play.buzzer.otherWon": "Швидше за всіх: {name}",
  "play.buzzer.otherWonHint": "Чекай на відповідь",
  "play.buzzer.won": "Твоя черга — відповідай!",

  // Check form
  "play.check.dontSpoil": "(не підказуй відповідь іншим!)",
  "play.check.yourAnswer": "Твоя відповідь: {answer}",
  "play.check.wereYouRight": "Відповідь правильна?",
  "play.check.incorrect": "неправильно",
  "play.check.correct": "правильно!",
  "play.check.answerThen": "Скажи відповідь уголос, а потім",
  "play.check.revealAnswer": "Показати відповідь",
  "play.check.won": "Твій виграш: {amount}",
  "play.check.lost": "Твій програш: {amount}",
  "play.check.waitingForChecks": "Чекаємо на перевірку від: {names}...",

  // Long-form answer form
  "play.answer.youAnswered": "Твоя відповідь: {answer}",
  "play.answer.canChange":
    "Відповідь можна змінити, поки останній гравець не надішле свою.",
  "play.answer.placeholder": "Це...",
  "play.answer.submit": "надіслати",

  // After the clue
  "play.next.noOneCanWager":
    "Ні в кого не вистачає грошей на ставку на це питання.",
  "play.next.playerCantWager":
    "Гравцю {name} не вистачає грошей на ставку на це питання.",
  "play.next.skipped": "Адміністратор пропустив це питання.",
  "play.next.noOneWon": "Ніхто не взяв це питання.",
  "play.next.unknownPlayer": "Невідомий гравець",
  "play.next.backToBoard": "До табло",

  // Wagers
  "play.wager.you": "(ти)",
  "play.wager.cantWager": "(без ставки)",
  "play.wager.suggestions": "Підказки",
  "play.wager.allIn": "Ва-банк",
  "play.wager.allInAmount": "Ва-банк ({amount})",
  "play.wager.howMuch": "Скільки ставиш на це питання?",
  "play.wager.upTo": "Можна поставити до {amount}.",
  "play.wager.placeholder": "розмір ставки",
  "play.wager.submit": "Поставити",
  "play.wager.yourWager": "Твоя ставка: {amount}",
  "play.wager.waitingForOthers": "Чекаємо на ставки інших гравців...",

  // Final clue wager suggestions
  "play.strategy.label.wagerEverything": "Поставити все",
  "play.strategy.label.goAllIn": "Ва-банк",
  "play.strategy.label.betNothing": "Нічого не ставити",
  "play.strategy.label.safeBet": "Безпечна ставка",
  "play.strategy.label.coverBet": "Ставка із запасом",
  "play.strategy.label.conservativeBet": "Обережна ставка",
  "play.strategy.label.competitiveBet": "Ставка на обгін",
  "play.strategy.label.targetBet": "Ставка на ціль",
  "play.strategy.reason.noOpponents":
    "Суперників немає — нема про що хвилюватися.",
  "play.strategy.reason.tiedAllIn":
    "У вас нічия. Став усе — якщо суперник поставить багато і відповість правильно, тобі треба не відстати.",
  "play.strategy.reason.tiedNothing":
    "Якщо ви обоє помилитеся, а суперник поставив багато, ти виграєш. Але програєш, якщо він відповість правильно і поставить хоч щось.",
  "play.strategy.reason.runawaySafe":
    "У тебе більш ніж удвічі більше, ніж у другого місця. Постав $0 — і перемога гарантована.",
  "play.strategy.reason.runawayCover":
    "Ставка, щоб лишитися попереду, навіть якщо друге місце подвоїть рахунок правильною відповіддю.",
  "play.strategy.reason.cover":
    "Якщо і ти, і друге місце відповісте правильно, ти все одно виграєш на $1.",
  "play.strategy.reason.crushAllIn":
    "Тобі потрібно, щоб лідер помилився. Збільш свій рахунок якомога більше — це найкращий шанс.",
  "play.strategy.reason.twoThirdsConservative":
    "Якщо ви обоє відповісте правильно, лідера не обійти. Лишайся попереду, якщо обоє помилитеся.",
  "play.strategy.reason.twoThirdsAllIn":
    "Ризиковано: найбільший рахунок, якщо лідер теж помилиться.",
  "play.strategy.reason.competitive":
    "Мінімальна ставка, щоб обійти лідера, якщо ви обоє відповісте правильно.",
  "play.strategy.reason.threeQuartersSafe":
    "Максимальна ставка, з якою ти лишишся попереду, якщо і ти, і лідер помилитеся.",
  "play.strategy.reason.thirdSafe":
    "Якщо обидва суперники помиляться зі звичайними ставками, ти виграєш без жодного ризику.",
  "play.strategy.reason.thirdAllIn":
    "Тобі потрібно, щоб суперники попереду помилилися. Збільш свій можливий рахунок.",
  "play.strategy.reason.thirdTarget":
    "Постав стільки, щоб обійти лідера, якщо він помилиться.",

  // Multiple choice
  "play.choices.options": "Варіанти",
  "play.choices.someone": "Хтось",
  "play.choices.pickYourAnswer": "Обери відповідь",
  "play.choices.youPicked": "Твій вибір: {label}...",

  // Secret question (cat in the bag)
  "play.secret.title": "Кіт у мішку!",
  "play.secret.subtitle": "секретне питання",
  "play.secret.choosing": "{name} вирішує, кому віддати кота в мішку...",
  "play.secret.givingTo": "Віддаємо гравцю {name}...",
  "play.secret.giveTo": "Віддай це питання іншому гравцю:",
  "play.secret.players": "Гравці",
  "play.secret.theChooser": "Гравець",

  // Media
  "play.media.imageFor": "Зображення до питання: {clue}",
  "play.media.clueImage": "Зображення до питання",
  "play.media.clueAudio": "Аудіо до питання",
  "play.media.clueVideo": "Відео до питання",
  "play.media.youTubeVideo": "Відео з YouTube",
  "play.media.playAudio": "Відтворити аудіо",
  "play.media.pauseAudio": "Призупинити аудіо",
  "play.media.tapToPlayAudio": "Торкнись, щоб увімкнути аудіо",
  "play.media.tapPlayToStart": "Натисни «відтворити», щоб почати",

  // Undo a check
  "play.undo.undo": "виправити",
  "play.undo.undoAmount": "виправити ({amount})",
  "play.undo.cancel": "скасувати",
  "play.undo.thisClue": "Виправити свою оцінку цього питання?",
  "play.undo.lastClue": "Виправити свою оцінку останнього питання?",
  "play.answerTimer.label": "Таймер відповіді",
  "play.answerTimer.secondsLeft": {
    one: "Залишилася {count} секунда",
    few: "Залишилося {count} секунди",
    many: "Залишилося {count} секунд",
    other: "Залишилося {count} секунди",
  },
  "play.answerTimer.timesUp": "Час вийшов!",
  "play.answerTimer.autoWrongHint":
    "Коли час вийде, відповідь зарахується як неправильна.",
  "play.answerTimer.countedWrong": "Твою відповідь зараховано як неправильну.",
  "play.answerTimer.markNow": "Оціни свою відповідь зараз.",
  "play.answerTimer.ranOutOfTime": "{name}: час на відповідь вийшов.",
};
