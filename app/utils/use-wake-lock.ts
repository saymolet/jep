import * as React from "react";

/** useWakeLock keeps the screen on while the component is mounted (Screen
 * Wake Lock API), e.g. for a TV showing the game. Browsers release the lock
 * when the tab is hidden, so it is re-acquired when the tab is visible again.
 * Does nothing where the API is missing (older browsers, insecure origins).
 * Runs only in effects, never during render (no hydration mismatch). */
export function useWakeLock(enabled = true) {
  React.useEffect(() => {
    if (!enabled) return;
    if (!("wakeLock" in navigator) || !navigator.wakeLock) return;
    const wakeLock = navigator.wakeLock;

    let disposed = false;
    let sentinel: WakeLockSentinel | null = null;

    async function acquire() {
      if (disposed || document.visibilityState !== "visible") return;
      if (sentinel && !sentinel.released) return;
      try {
        const lock = await wakeLock.request("screen");
        if (disposed) {
          lock.release().catch(() => {});
        } else {
          sentinel = lock;
        }
      } catch {
        // Refused (e.g. battery saver, permissions policy): the screen may
        // dim, nothing else breaks.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") acquire();
    }

    acquire();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [enabled]);
}
