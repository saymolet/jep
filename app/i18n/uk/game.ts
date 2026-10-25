import type { game as en } from "../en/game";
import type { Dictionary } from "../types";

/** Ukrainian messages: game. */
export const game: Dictionary<typeof en> = {
  "game.metaDescription":
    "{title} — вікторина від автора {author}. Переглянь гру й обери, як грати.",
  "game.deleted": "Гру «{title}» видалено.",
  "game.visibilityUpdated": "Доступ до гри «{title}» змінено: {visibility}.",
  "game.playWithFriends": "Грати з друзями",
  "game.playSolo": "Грати самому",
  "game.byAuthor": "Автор: {author}",
  "game.clueCount": {
    one: "{count} питання",
    few: "{count} питання",
    many: "{count} питань",
    other: "{count} питання",
  },
  "game.downloadJson": "Скачати JSON",
  "game.downloadJsonHint": "Відредагуй файл і завантаж його знову як нову гру.",
};
