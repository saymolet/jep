import type { header as en } from "../en/header";
import type { Dictionary } from "../types";

/** Ukrainian messages: header. */
export const header: Dictionary<typeof en> = {
  "header.admin": "Адміністратор",
  "header.adminActive": "Панель адміністратора",
  "header.profile": "Профіль",
  "header.learnMore": "Докладніше",
  "header.howToPlay": "Як грати",
  "header.uploadGame": "Завантажити гру",
  "header.about": "Про сайт",
  "header.gameMenu": "Параметри гри",
  "header.roundCount": {
    one: "{count} раунд",
    few: "{count} раунди",
    many: "{count} раундів",
    other: "{count} раунду",
  },
  "header.gameDetails": "Про гру",
  "header.copyRoomLink": "Скопіювати посилання на кімнату",
  "header.report": "Поскаржитися",
  "header.reportGame": "Поскаржитися на гру",
  "header.primaryNavigation": "Головна навігація",
  "header.communityGuidelines": "Правила спільноти",
};
