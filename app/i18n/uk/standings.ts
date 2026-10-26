import type { standings as en } from "../en/standings";
import type { Dictionary } from "../types";

/** Ukrainian messages: standings. */
export const standings: Dictionary<typeof en> = {
  "standings.open": "Рахунок",
  "standings.title": "Рахунок",
  "standings.description":
    "Рахунок наживо. Зміна — скільки дало чи забрало попереднє питання.",
  "standings.players": "Гравці",
  "standings.teams": "Команди",
  "standings.noPlayers": "Ще ніхто не приєднався.",
  "standings.rank": "#{rank}",
  "standings.rankLabel": "{rank} місце",
  "standings.tied": "нарівно",
  "standings.you": "ви",
  "standings.boardControl": "Обирає питання",
  "standings.change": "{change} за попереднє питання",
  "standings.noChange": "Попереднє питання рахунок не змінило",
};
