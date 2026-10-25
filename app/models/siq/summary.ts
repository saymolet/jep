import { createT, type Locale } from "~/i18n";

import type { SiqImportSummary } from "./import.server";

/** The summary travels in the flash session cookie (browsers cap cookies at
 * ~4 KB, and the session is base64-encoded and signed), so it is kept small. */
const MAX_DETAILS = 8;
const MAX_DETAIL_LENGTH = 160;
const MAX_DETAILS_BYTES = 1200;
const MAX_TITLE_LENGTH = 80;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

/** formatSiqSummary describes an import for the user (in `locale`): a
 * one-line message and a short list of what was skipped or changed (the rest
 * is counted). */
export function formatSiqSummary(
  summary: SiqImportSummary,
  locale: Locale = "en",
): {
  message: string;
  details: string[];
} {
  const t = createT(locale);
  const parts = [
    t("siq.summary.rounds", { count: summary.boards }),
    t("siq.summary.categories", { count: summary.categories }),
    t("siq.summary.questions", { count: summary.questions }),
    t("siq.summary.mediaFiles", { count: summary.mediaFiles }),
  ];
  let message = t("siq.summary.imported", {
    title: truncate(summary.title, MAX_TITLE_LENGTH),
    parts: parts.join(", "),
  });
  if (summary.droppedQuestions > 0) {
    message +=
      " " + t("siq.summary.skipped", { count: summary.droppedQuestions });
  }
  if (summary.warnings.length > 0) {
    message +=
      " " + t("siq.summary.warnings", { count: summary.warnings.length });
  }

  const details: string[] = [];
  let bytes = 0;
  for (const warning of summary.warnings) {
    const detail = truncate(warning, MAX_DETAIL_LENGTH);
    const size = utf8Length(detail);
    if (details.length >= MAX_DETAILS || bytes + size > MAX_DETAILS_BYTES) {
      break;
    }
    details.push(detail);
    bytes += size;
  }
  const rest = summary.warnings.length - details.length;
  if (rest > 0) details.push(t("siq.summary.moreWarnings", { count: rest }));

  return { message, details };
}
