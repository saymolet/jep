import * as React from "react";

/** "Mute soundboard" is a per-device setting (localStorage), separate from
 * the game sounds' mute: e.g. the TV plays reactions while a phone doesn't. */
const STORAGE_KEY = "jep-soundboard-mute";

const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Last value written on this page (storage can be unavailable). */
let current: boolean | null = null;

function getSnapshot(): boolean {
  if (current === null) current = read();
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed it.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = read();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function setSoundboardMuted(muted: boolean) {
  current = muted;
  try {
    if (muted) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not remembered (private mode or storage full); still applies now.
  }
  for (const listener of listeners) listener();
}

/** useSoundboardMute is whether soundboard sounds are muted on this device.
 * Always false on the server and during hydration (localStorage is
 * browser-only), so server and client render the same HTML. */
export function useSoundboardMute() {
  const muted = React.useSyncExternalStore(subscribe, getSnapshot, () => false);
  return [muted, setSoundboardMuted] as const;
}

/** For tests: forget the cached value. */
export function resetSoundboardMuteForTests() {
  current = null;
}
