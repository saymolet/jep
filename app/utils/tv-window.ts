/* The TV screen in its own window (feature 24): a laptop drives the
 * projector over HDMI (an extended display) while the host keeps their own
 * view on the laptop's screen. Chrome and Edge can place the window on the
 * other screen (Window Management API, asks for permission once); other
 * browsers open a window the host drags to the projector. */

/** A screen as the Window Management API describes it (Chrome/Edge). */
interface DetailedScreen {
  readonly isPrimary: boolean;
  readonly availLeft: number;
  readonly availTop: number;
  readonly availWidth: number;
  readonly availHeight: number;
}

interface ScreenDetails {
  readonly screens: readonly DetailedScreen[];
  readonly currentScreen: DetailedScreen;
}

declare global {
  interface Window {
    getScreenDetails?: () => Promise<ScreenDetails>;
  }
  interface Screen {
    /** More than one screen is connected (Chrome/Edge). */
    readonly isExtended?: boolean;
  }
}

/** TV_WINDOW_NAME: opening the TV again reuses its window. */
export const TV_WINDOW_NAME = "jep-tv";

/** pickOtherScreen is the screen the TV window goes to: one that isn't the
 * screen the host's window is on (the projector), else none. */
export function pickOtherScreen(
  details: ScreenDetails,
): DetailedScreen | undefined {
  const others = details.screens.filter((s) => s !== details.currentScreen);
  return others.find((s) => !s.isPrimary) ?? others[0];
}

/** openTvWindow opens the TV screen (`url`) in its own window, and moves it
 * to the other screen when there is one and the browser allows it. Call it
 * from a click: browsers only open windows on a user gesture. */
export async function openTvWindow(url: string) {
  const tv = window.open(url, TV_WINDOW_NAME, "popup,width=1280,height=720");
  if (!tv || !window.screen.isExtended || !window.getScreenDetails) return;
  try {
    const target = pickOtherScreen(await window.getScreenDetails());
    if (!target) return;
    tv.moveTo(target.availLeft, target.availTop);
    tv.resizeTo(target.availWidth, target.availHeight);
  } catch {
    // Permission denied: the host drags the window to the projector.
  }
}
