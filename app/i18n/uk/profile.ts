import type { profile as en } from "../en/profile";
import type { Dictionary } from "../types";

/** Ukrainian messages: profile. */
export const profile: Dictionary<typeof en> = {
  "profile.title": "Профіль",
  "profile.downloadedGames": "Збережені ігри",
  "profile.downloadedGamesDescription":
    "Ці ігри збережено в цьому браузері для гри без інтернету.",
  "profile.byAuthor": "— {author}",
  "profile.randomEmoji": "[Випадковий емодзі]",
  "profile.pickColor": "Обрати колір гравця",
  "profile.playerName": "Ім’я гравця",
  "profile.changeAvatar": "Змінити аватар",
  "profile.submit": "Зберегти",
  "profile.edit": "Редагувати",
  "profile.defaultAvatar": "Аватар за замовчуванням",
  "profile.defaultAvatarDescription":
    "Показується, коли ти приєднуєшся до гри. Обери емодзі або фото.",
  "profile.clearName": "Скинути ім’я",
  "profile.clearColor": "Скинути колір",
  "profile.accountSettings": "Налаштування акаунта",
  "profile.gameSettings": "Налаштування гри",
  "profile.myGames": "Мої ігри",
  "profile.noGames": "Ігор не знайдено.",
  "profile.mySolves": "Мої спроби та зіграні ігри",
  "profile.makeVisibility.PUBLIC": "Зробити публічною",
  "profile.makeVisibility.UNLISTED": "Доступ за посиланням",
  "profile.makeVisibility.PRIVATE": "Зробити приватною",
  "profile.downloadJsonFile": "Скачати файл JSON",
  "profile.deleteGame": "Видалити гру",
  "profile.deleteGameDescription":
    "Точно видалити гру «{title}»? Цю дію не можна скасувати.",
};
