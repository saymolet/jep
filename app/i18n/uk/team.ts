import type { team as en } from "../en/team";
import type { Dictionary } from "../types";

/** Ukrainian messages: team (team mode). */
export const team: Dictionary<typeof en> = {
  "team.name.red": "Червоні",
  "team.name.blue": "Сині",
  "team.name.green": "Зелені",
  "team.name.yellow": "Жовті",
  "team.noTeam": "Без команди",
  "team.pickOptional": "Грати в команді (необов'язково)",
  "team.team": "Команда",
  "team.teams": "Команди",
  "team.chooseTeam": "Обери команду",
  "team.chooseTeamDescription":
    "До чотирьох команд. Твої очки йдуть у залік команди: її рахунок — це сума очок її гравців.",
  "team.changeTeam": "Змінити команду",
  "team.teamName": "Назва команди",
  "team.saveName": "Зберегти",
  "team.betweenQuestions": "Команду можна змінити між питаннями.",
  "team.score": "{name}: {score}",
  "team.standings": "Командний залік",
  "team.winner": "Перемогла команда: {name}",
  "team.tie": "Нічия між командами: {names}",
  "team.leftCount": {
    one: "{count} вийшов",
    few: "{count} вийшли",
    many: "{count} вийшли",
    other: "{count} вийшли",
  },
};
