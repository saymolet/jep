import {
  about,
  auth,
  common,
  community,
  errors,
  game,
  header,
  home,
  howto,
  play,
  profile,
  report,
  room,
  settings,
  siq,
  summary,
  upload,
  uploadHelp,
} from "./en/areas";
import type { Messages } from "./types";

/** English UI messages: the source of truth. Every key must also be in
 * `uk.ts` (type-checked). Messages are split by area into `en/<area>.ts`;
 * keys start with the area name, e.g. "header.logIn". */
export const en = {
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
} as const satisfies Messages;
