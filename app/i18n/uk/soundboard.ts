import type { soundboard as en } from "../en/soundboard";
import type { Dictionary } from "../types";

/** Ukrainian messages: soundboard (reaction sounds for everyone in the room). */
export const soundboard: Dictionary<typeof en> = {
  "soundboard.title": "Звукова панель",
  "soundboard.open": "Звукова панель: зіграй звук для всіх",
  "soundboard.hint": "Натисни на звук — його почують усі в кімнаті.",
  "soundboard.wait": "Один звук що 2 секунди",
  "soundboard.mute": "Вимкнути звукову панель на цьому пристрої",
  "soundboard.played": "{name} вмикає «{sound}»",
  "soundboard.sound.applause": "Оплески",
  "soundboard.sound.drumroll": "Барабанний дріб",
  "soundboard.sound.tada": "Та-дам!",
  "soundboard.sound.wrong": "Мимо!",
  "soundboard.sound.airhorn": "Гудок",
  "soundboard.sound.laugh": "Ха-ха",
  "soundboard.sound.ooh": "Ого-о!",
  "soundboard.sound.crickets": "Цвіркуни",
  "soundboard.sound.ding": "Дзень!",
};
