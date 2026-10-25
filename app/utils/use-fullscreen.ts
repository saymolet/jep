import * as React from "react";

/** useFullscreen wraps the Fullscreen API for the whole page. `supported` is
 * false on the server and during hydration (and where the API is missing,
 * e.g. iPhone Safari), so a fullscreen button only appears after mount. */
export function useFullscreen() {
  const [supported, setSupported] = React.useState(false);
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    setSupported(
      Boolean(document.fullscreenEnabled) &&
        typeof document.documentElement.requestFullscreen === "function",
    );
    const update = () => setActive(document.fullscreenElement !== null);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggle = React.useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return { supported, active, toggle };
}
