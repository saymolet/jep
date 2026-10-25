import type { watch as en } from "../en/watch";
import type { Dictionary } from "../types";

/** Ukrainian messages: watch (spectators and the TV / presenter screen). */
export const watch: Dictionary<typeof en> = {
  "watch.justWatch": "Просто дивитися",
  "watch.watching": "Глядач",
  "watch.spectatorHint": "Ти дивишся гру. Приєднуйся будь-коли.",
  "watch.watchers": {
    one: "{count} глядач",
    few: "{count} глядачі",
    many: "{count} глядачів",
    other: "{count} глядача",
  },
  "watch.showOnTv": "Показати на телевізорі",

  "watch.presenterTitle": "{title} · ТВ",
  "watch.fullscreen": "На весь екран",
  "watch.exitFullscreen": "Вийти з повноекранного режиму",
  "watch.scanToJoin": "Скануй, щоб приєднатися",
  "watch.orOpen": "або відкрий {url}",
  "watch.qrLabel": "QR-код для приєднання до гри",
  "watch.soundHint": "Торкнися екрана, щоб увімкнути звук",
  "watch.players": "Гравці",
  "watch.noPlayers": "Гравців поки немає",
  "watch.roundOf": "Раунд {round} з {total}",
  "watch.winner": "Перемога: {name}!",
  "watch.tie": "Нічия: {names}",

  "watch.status.waitingForPlayers": "Чекаємо на гравців...",
  "watch.status.roundStarting": "Раунд {round} ось-ось почнеться",
  "watch.status.roundStartingWith":
    "Раунд {round} ось-ось почнеться · перший хід: {name}",
  "watch.status.choosing": "{name} обирає питання",
  "watch.status.final": "Фінальний раунд",
  "watch.status.wagering": "{name} робить ставку",
  "watch.status.finalWagers": "Гравці роблять ставки ({done} з {total})",
  "watch.status.passing": "{name} вирішує, кому дістанеться кіт у мішку",
  "watch.status.reading": "Готуйтеся тиснути на кнопку...",
  "watch.status.buzzersOpen": "Тисніть на кнопку!",
  "watch.status.answering": "Відповідає {name}",
  "watch.status.secretAnswering": "Кіт у мішку: відповідає {name}",
  "watch.status.picking": "{name} обирає відповідь",
  "watch.status.writing": "Гравці пишуть відповіді",
  "watch.status.checking": "Гравці перевіряють відповіді",
  "watch.status.answer": "Відповідь",
  "watch.status.gotIt": "Правильна відповідь від {name}!",
  "watch.status.noOneAnswered": "Ніхто не відповів",
  "watch.status.gameOver": "Гру завершено!",
  "watch.status.paused": "Гру призупинено",
} as const;
