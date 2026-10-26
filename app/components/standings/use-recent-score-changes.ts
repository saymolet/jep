import * as React from "react";

import { useEngineContext } from "~/engine";
import { NO_SCORE_CHANGES, type ScoreChanges } from "~/engine/standings";

/** How long the TV shows the score changes after a question. */
export const SCORE_CHANGES_VISIBLE_MS = 6_000;

/** useRecentScoreChanges returns the score changes of the previous question
 * for a few seconds after they happen (a new question was scored, or a check
 * on it was corrected), and no changes otherwise. Changes that already
 * existed when the page loaded are not shown, and nothing is shown in the
 * server render, so it is hydration-safe. */
export function useRecentScoreChanges(
  visibleMs = SCORE_CHANGES_VISIBLE_MS,
): ScoreChanges {
  const { scoreChanges, scoreChangesKey } = useEngineContext();
  const [visibleKey, setVisibleKey] = React.useState("");
  const seenKey = React.useRef<string | null>(null);

  React.useEffect(() => {
    const previous = seenKey.current;
    seenKey.current = scoreChangesKey;
    // The first run records the state the page loaded with.
    if (previous === null || previous === scoreChangesKey) return;
    if (!scoreChangesKey) {
      setVisibleKey("");
      return;
    }
    setVisibleKey(scoreChangesKey);
    const timeout = window.setTimeout(() => setVisibleKey(""), visibleMs);
    return () => window.clearTimeout(timeout);
  }, [scoreChangesKey, visibleMs]);

  return visibleKey && visibleKey === scoreChangesKey
    ? scoreChanges
    : NO_SCORE_CHANGES;
}
