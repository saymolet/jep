import type { SiqImportSummary } from "./import.server";

/** The summary travels in the flash session cookie (browsers cap cookies at
 * ~4 KB, and the session is base64-encoded and signed), so it is kept small. */
const MAX_DETAILS = 8;
const MAX_DETAIL_LENGTH = 160;
const MAX_DETAILS_BYTES = 1200;
const MAX_TITLE_LENGTH = 80;

function plural(count: number, word: string, words = `${word}s`) {
  return `${count} ${count === 1 ? word : words}`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

/** formatSiqSummary describes an import for the user: a one-line message and
 * a short list of what was skipped or changed (the rest is counted). */
export function formatSiqSummary(summary: SiqImportSummary): {
  message: string;
  details: string[];
} {
  const parts = [
    plural(summary.boards, "round"),
    plural(summary.categories, "category", "categories"),
    plural(summary.questions, "question"),
    plural(summary.mediaFiles, "media file"),
  ];
  let message = `Imported SIGame pack "${truncate(summary.title, MAX_TITLE_LENGTH)}": ${parts.join(", ")}.`;
  if (summary.droppedQuestions > 0) {
    message += ` ${plural(summary.droppedQuestions, "question")} skipped.`;
  }
  if (summary.warnings.length > 0) {
    message += ` ${plural(summary.warnings.length, "warning")}.`;
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
  if (rest > 0) details.push(`…and ${plural(rest, "more warning")}.`);

  return { message, details };
}
