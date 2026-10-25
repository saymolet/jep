import type { siq as en } from "../en/siq";
import type { Dictionary } from "../types";

/** Ukrainian messages: siq. */
export const siq: Dictionary<typeof en> = {
  "siq.error.notZip": "Цей файл не є пакетом SIGame (це не zip-архів).",
  "siq.error.cannotOpen": "Не вдалося відкрити пакет SIGame: {reason}",
  "siq.error.tooManyFiles":
    "У пакеті SIGame забагато файлів ({files}; максимум {max}).",
  "siq.error.tooLargeUnpacked":
    "Розпакований пакет SIGame завеликий ({size} МБ; максимум {max} МБ).",
  "siq.error.noContentXml":
    "У пакеті SIGame немає content.xml. Це точно файл .siq?",
  "siq.error.contentXmlTooLarge":
    "Файл content.xml завеликий (максимум {max} МБ).",
  "siq.error.notUtf8": "Файл content.xml не є коректним текстом UTF-8.",
  "siq.error.cannotUnpack": "Не вдалося розпакувати {path}: {reason}",
  "siq.error.fileMissing": "У пакеті немає файлу {path}.",
  "siq.error.doctype": "Файл content.xml не може містити DOCTYPE",
  "siq.error.invalidXml":
    "Файл content.xml містить помилку XML (рядок {line}: {reason})",
  "siq.error.unreadableXml": "Не вдалося прочитати content.xml: {reason}",
  "siq.error.noPackage": "У файлі content.xml немає елемента <package>",
  "siq.error.noQuestions":
    "У пакеті SIGame немає жодного питання, у яке можна зіграти в Jep!.",
  "siq.error.invalidGame": "Імпортована гра некоректна ({issue}).",

  "siq.skip.uploadFailed": "не вдалося завантажити файл «{ref}».",
  "siq.skip.html": "HTML-вміст не підтримується («{ref}»).",
  "siq.skip.unsupportedKind": "вміст типу «{kind}» не підтримується.",
  "siq.skip.link": "посилання «{ref}» пропущено ({reason}).",
  "siq.skip.missingFile": "файлу «{ref}» немає в пакеті.",
  "siq.skip.unsupportedType": "файл «{ref}» має непідтримуваний формат.",
  "siq.skip.tooLarge": "файл «{ref}» більший за {max} МБ.",

  "siq.warn.at": "{where}: {reason}",
  "siq.warn.tooManyMedia": {
    one: "{where}: використано лише перші {max} з {count} медіафайлу.",
    few: "{where}: використано лише перші {max} з {count} медіафайлів.",
    many: "{where}: використано лише перші {max} з {count} медіафайлів.",
    other: "{where}: використано лише перші {max} з {count} медіафайлу.",
  },
  "siq.warn.optionsCount":
    "варіанти відповіді не імпортовано (у Jep! їх має бути {min}–{max}).",
  "siq.warn.optionsMedia":
    "варіанти відповіді з картинками чи звуком не імпортуються.",
  "siq.warn.optionsUnknownRight":
    "варіанти відповіді не імпортовано (невідомо, який правильний).",
  "siq.warn.optionsInvalid": "варіанти відповіді не імпортовано ({reason}).",
  "siq.warn.questionSkipped":
    "{where}: питання пропущено (немає ні тексту, ні придатних медіафайлів).",
  "siq.warn.noAnswer": "{where}: у пакеті немає відповіді на це питання.",
  "siq.warn.unknownType":
    "{where}: питання типу «{type}» гратиметься як звичайне.",
  "siq.warn.finalExtraQuestion":
    "{where}: пропущено (у Jep! фінальна тема має одне питання).",
  "siq.warn.finalThemesSkipped": {
    one: "{round}: у Jep! лише одне фінальне питання, тож імпортовано тільки тему «{theme}»; ще {count} фінальну тему пропущено.",
    few: "{round}: у Jep! лише одне фінальне питання, тож імпортовано тільки тему «{theme}»; ще {count} фінальні теми пропущено.",
    many: "{round}: у Jep! лише одне фінальне питання, тож імпортовано тільки тему «{theme}»; ще {count} фінальних тем пропущено.",
    other:
      "{round}: у Jep! лише одне фінальне питання, тож імпортовано тільки тему «{theme}»; ще {count} фінальної теми пропущено.",
  },
  "siq.warn.noFinal":
    "{round}: пропущено (немає придатного фінального питання).",
  "siq.warn.themeSkipped": "{where}: тему пропущено (немає придатних питань).",
  "siq.warn.roundSkipped": "{round}: пропущено (немає придатних питань).",
  "siq.warn.roundSplit": {
    one: "{round}: {count} тема не вміщується на одне табло (максимум {max}), тому раунд поділено на кілька (раундів: {boards}).",
    few: "{round}: {count} теми не вміщуються на одне табло (максимум {max}), тому раунд поділено на кілька (раундів: {boards}).",
    many: "{round}: {count} тем не вміщуються на одне табло (максимум {max}), тому раунд поділено на кілька (раундів: {boards}).",
    other:
      "{round}: {count} теми не вміщуються на одне табло (максимум {max}), тому раунд поділено на кілька (раундів: {boards}).",
  },

  "siq.answerPart": "{where} (відповідь)",
  "siq.noAnswerPlaceholder": "(у пакеті немає відповіді)",
  "siq.roundName": "Раунд {n}",
  "siq.themeName": "Тема {n}",
  "siq.defaultTitle": "Пакет SIGame",
  "siq.unknownAuthor": "Невідомий автор",

  "siq.summary.imported": "Імпортовано пакет SIGame «{title}»: {parts}.",
  "siq.summary.rounds": {
    one: "{count} раунд",
    few: "{count} раунди",
    many: "{count} раундів",
    other: "{count} раунду",
  },
  "siq.summary.categories": {
    one: "{count} категорія",
    few: "{count} категорії",
    many: "{count} категорій",
    other: "{count} категорії",
  },
  "siq.summary.questions": {
    one: "{count} питання",
    few: "{count} питання",
    many: "{count} питань",
    other: "{count} питання",
  },
  "siq.summary.mediaFiles": {
    one: "{count} медіафайл",
    few: "{count} медіафайли",
    many: "{count} медіафайлів",
    other: "{count} медіафайлу",
  },
  "siq.summary.skipped": {
    one: "Пропущено {count} питання.",
    few: "Пропущено {count} питання.",
    many: "Пропущено {count} питань.",
    other: "Пропущено {count} питання.",
  },
  "siq.summary.warnings": {
    one: "{count} попередження.",
    few: "{count} попередження.",
    many: "{count} попереджень.",
    other: "{count} попередження.",
  },
  "siq.summary.moreWarnings": {
    one: "…і ще {count} попередження.",
    few: "…і ще {count} попередження.",
    many: "…і ще {count} попереджень.",
    other: "…і ще {count} попередження.",
  },
};
