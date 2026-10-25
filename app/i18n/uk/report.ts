import type { report as en } from "../en/report";
import type { Dictionary } from "../types";

/** Ukrainian messages: report. */
export const report: Dictionary<typeof en> = {
  "report.metaTitle": "Поскаржитися на гру",
  "report.title": "Поскаржитися на гру",
  "report.intro":
    "Повідом нам про будь-яку гру, що порушує <guidelines>правила спільноти</guidelines>.",
  "report.otherIssues":
    "З усіх інших питань створи issue в проєкті на <github>GitHub</github>.",
  "report.linkLabel": "Посилання на гру",
  "report.linkPlaceholder": "{base}/room/... або {base}/game/...",
  "report.reasonLabel": "Причина",
  "report.reasonPlaceholder": "наприклад, спам",
  "report.submit": "Поскаржитися",
  "report.wrongOrigin": "Посилання має бути з {base}",
  "report.badRoomName": "назва кімнати має бути у форматі {roomId}-{roomName}",
  "report.roomNotFound": "кімнату «{room}» не знайдено",
  "report.reportedRoom": "Скаргу на гру {gameId} у кімнаті {room} надіслано.",
  "report.gameNotFound": "гру «{gameId}» не знайдено",
  "report.fetchError": "Не вдалося завантажити гру: {error}",
  "report.reportedGame": "Скаргу на гру {gameId} надіслано.",
  "report.noGameOrRoom": "У посиланні немає /game/ або /room/.",
};
