import type { home as en } from "../en/home";
import type { Dictionary } from "../types";

/** Ukrainian messages: home. */
export const home: Dictionary<typeof en> = {
  "home.noGames": "Ігор не знайдено",
  "home.noGamesForSearch": "За запитом «{search}» ігор не знайдено",
  "home.downloadedOffline": "Збережено для гри офлайн",
  "home.warning": "Увага",
  "home.removeDownload": "Видалити завантаження",
  "home.removeDownloadDescription":
    "Видалити офлайн-копію гри «{title}»? Грати в неї без інтернету можна буде лише після повторного завантаження.",
  "home.cancel": "Скасувати",
  "home.playOffline": "Грати офлайн",
  "home.downloadOffline": "Зберегти для офлайну",
  "home.roomsInProgress": "Кімнати, де вже грають",
  "home.roomActivity": "{players} · активність {ago}",
  "home.join": "Приєднатися",
  "home.timeAgo.justNow": "щойно",
  "home.timeAgo.minutes": "{minutes} хв тому",
  "home.timeAgo.hours": "{hours} год тому",
};
