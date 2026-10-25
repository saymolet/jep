import type { random as en } from "../en/random";
import type { Dictionary } from "../types";

/** Ukrainian messages: random board generator. */
export const random: Dictionary<typeof en> = {
  "random.metaTitle": "Випадкова гра",
  "random.homeButton": "Випадкова гра",
  "random.title": "Випадкова гра",
  "random.intro":
    "Збери нову гру з категорій публічних ігор на Jep! і починай грати одразу.",
  "random.categoriesLabel": "Категорій у раунді",
  "random.roundsLabel": "Раунди",
  "random.oneRound": "1 раунд",
  "random.twoRounds": "2 раунди",
  "random.includeFinal": "Додати фінальне питання (якщо є)",
  "random.playWithFriends": "Створити й грати з друзями",
  "random.playSolo": "Створити й грати самому",
  "random.unlistedHint":
    "Нова гра буде доступна лише за посиланням. Питання зберігають свою початкову вартість.",
  "random.gameTitle": "Випадкова гра · {date}",
  "random.gameNote": "Категорії з ігор: {sources}",
  "random.error.notEnough":
    "Замало публічних ігор для такої гри: потрібно категорій з різними назвами й щонайменше 3 питаннями — {needed}, а знайдено лише {available}. Завантаж більше ігор або вибери менше категорій.",
  "random.error.invalid": "Вибери від 3 до 8 категорій і 1 або 2 раунди.",
};
