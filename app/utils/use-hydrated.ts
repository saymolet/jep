import * as React from "react";

function subscribe() {
  return () => {};
}

/** useHydrated is false on the server and during hydration, and true once the
 * app has hydrated (or for components that mount later on the client).
 *
 * Render browser-only values (local time zone, localStorage, navigator...)
 * only when it is true, so the hydration render matches the server HTML. */
export function useHydrated() {
  return React.useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
