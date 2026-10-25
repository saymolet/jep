import type { en } from "./en";
import type { Dictionary } from "./types";
import { about } from "./uk/about";
import { auth } from "./uk/auth";
import { common } from "./uk/common";
import { community } from "./uk/community";
import { errors } from "./uk/errors";
import { game } from "./uk/game";
import { header } from "./uk/header";
import { home } from "./uk/home";
import { howto } from "./uk/howto";
import { play } from "./uk/play";
import { profile } from "./uk/profile";
import { random } from "./uk/random";
import { report } from "./uk/report";
import { room } from "./uk/room";
import { settings } from "./uk/settings";
import { siq } from "./uk/siq";
import { summary } from "./uk/summary";
import { upload } from "./uk/upload";
import { uploadHelp } from "./uk/uploadHelp";

/** Ukrainian UI messages. Must have exactly the keys of `en` (each area file
 * is typed against its English counterpart, so a missing or extra key is a
 * type error). */
export const uk: Dictionary<typeof en> = {
  ...common,
  ...header,
  ...home,
  ...game,
  ...play,
  ...room,
  ...summary,
  ...auth,
  ...profile,
  ...upload,
  ...howto,
  ...uploadHelp,
  ...about,
  ...community,
  ...report,
  ...errors,
  ...siq,
  ...settings,
  ...random,
};
