import * as React from "react";

const NAME_STORAGE_KEY = "jep-name";
/** MAX_JOIN_NAME_LENGTH keeps names readable on the board and the TV. */
export const MAX_JOIN_NAME_LENGTH = 40;

/** loadStoredName reads the name last typed in a join dialog on this
 * device. */
export function loadStoredName(): string | undefined {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/** storeName remembers the name on this device (an empty name forgets it). */
export function storeName(name: string) {
  try {
    if (name.trim()) {
      localStorage.setItem(NAME_STORAGE_KEY, name.trim());
    } else {
      localStorage.removeItem(NAME_STORAGE_KEY);
    }
  } catch {
    // Storage may be full or disabled (private mode); the name just isn't
    // remembered.
  }
}

/** useJoinName is the name to join a game (or host it) with: the one last
 * typed on this device, else `defaultName` (the account's name, or a random
 * emoji for guests). Typing remembers it on this device. */
export function useJoinName(defaultName: string) {
  const [name, setNameState] = React.useState(defaultName);
  // localStorage only exists in the browser, so read it after hydration.
  React.useEffect(() => {
    const stored = loadStoredName();
    if (stored) setNameState(stored);
  }, []);
  const setName = React.useCallback((next: string) => {
    setNameState(next);
    storeName(next);
  }, []);
  // What to send: never an empty name.
  const submitName = name.trim() || defaultName;
  return { name, setName, submitName };
}
