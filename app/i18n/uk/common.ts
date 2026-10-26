import type { common as en } from "../en/common";
import type { Dictionary } from "../types";

/** Ukrainian messages: common.
 *
 * Glossary (keep the UI consistent): clue → питання; answer → відповідь;
 * player → гравець; round → раунд; category → категорія; board → табло;
 * buzz in → натиснути кнопку / зголоситися; buzzer → кнопка;
 * wager → ставка; final clue → фінальне питання; room → кімната;
 * secret question / cat in the bag → «Кіт у мішку»; score → рахунок;
 * upload → завантажити; game pack → пакет. Address the player as «ти»
 * (friendly party game). */
export const common: Dictionary<typeof en> = {
  "common.siteDescription":
    "Сайт, щоб ділитися вікторинами в стилі J! і грати разом із друзями в реальному часі.",
  "common.theme": "Тема",
  "common.themeCurrent": "Тема: {name}",
  "common.theme.classic": "Класична",
  "common.theme.dark": "Темна",
  "common.theme.system": "Системна",
  "common.language": "Мова",
  "common.playerCount": {
    one: "{count} гравець",
    few: "{count} гравці",
    many: "{count} гравців",
    other: "{count} гравця",
  },
  "common.errorTitle": "Ой лишенько!",
  "common.caughtError": "Сталася помилка",
  "common.errorStatus": "Статус: {status}",
  "common.unknownError": "Невідома помилка",
  "common.error": "Помилка",
  "common.errorSad": "Помилка :(",
  "common.preferencesSaved": "Налаштування збережено.",
  "common.close": "Закрити",
  "common.search": "Пошук",
  "common.searchGames": "Шукати ігри...",
  "common.showPassword": "Показати пароль",
  "common.hidePassword": "Сховати пароль",
  "common.moreActions": "Інші дії",
  "common.copyLink": "Скопіювати посилання",
  "common.copiedLink": "Посилання скопійовано",
  "common.visibility.PUBLIC": "Публічна",
  "common.visibility.PRIVATE": "Приватна",
  "common.visibility.UNLISTED": "За посиланням",
  "common.solved": "Зіграно",
  "common.inProgress": "Триває",
  "common.gameSounds": "Звуки гри",
  "common.mute": "Вимкнути звук",
  "common.volume": "Гучність",
  "common.wagerHints": "Підказки для ставок",
  "common.wagerHints.show": "Завжди",
  "common.wagerHints.tapToReveal": "За дотиком",
  "common.wagerHints.never": "Ніколи",
  "common.resume.title": "Гра триває",
  "common.resume.description":
    "У тебе є незавершена гра. Продовжити з того ж місця чи почати нову?",
  "common.resume.newGame": "Нова гра",
  "common.resume.resumeGame": "Продовжити гру",
  "common.offline": "Ти офлайн. Граємо зі збережених даних.",
  "common.skippedOrChanged": "Пропущено або змінено:",
  "common.howToPlay.title": "Як грати",
  "common.howToPlay.voiceCall": "Зберіться разом у голосовому дзвінку",
  "common.howToPlay.choose": "Обирай питання, коли твоя черга",
  "common.howToPlay.wait": "Зачекай, поки кнопка стане активною",
  "common.howToPlay.buzz": "Тисни на кнопку, коли знаєш відповідь",
  "common.howToPlay.guess": "Найшвидший відповідає вголос у дзвінку",
  "common.howToPlay.check":
    "Найшвидший сам перевіряє правильну відповідь (не кажи її вголос!)",
  "common.howToPlay.swoop": "Перехоплюй, коли інші помиляються",
  "common.howToPlay.wager":
    "Обережно зі ставками на приховані питання «Подвійна ставка»",
};
