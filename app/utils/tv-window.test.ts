import { afterEach, describe, expect, it, vi } from "vitest";

import { openTvWindow, pickOtherScreen, TV_WINDOW_NAME } from "./tv-window";

const screen = (isPrimary: boolean, availLeft: number) => ({
  isPrimary,
  availLeft,
  availTop: 0,
  availWidth: 1920,
  availHeight: 1080,
});
const LAPTOP = screen(true, 0);
const PROJECTOR = screen(false, 1920);

/** Pretend a second screen is connected (happy-dom has no such API). */
function setExtended(value: boolean) {
  Object.defineProperty(window.screen, "isExtended", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete window.getScreenDetails;
  setExtended(false);
});

describe("pickOtherScreen", () => {
  it("picks the screen the host's window isn't on", () => {
    expect(
      pickOtherScreen({ screens: [LAPTOP, PROJECTOR], currentScreen: LAPTOP }),
    ).toBe(PROJECTOR);
    expect(
      pickOtherScreen({
        screens: [LAPTOP, PROJECTOR],
        currentScreen: PROJECTOR,
      }),
    ).toBe(LAPTOP);
    expect(
      pickOtherScreen({ screens: [LAPTOP], currentScreen: LAPTOP }),
    ).toBeUndefined();
  });
});

describe("openTvWindow", () => {
  function fakeWindow() {
    return { moveTo: vi.fn(), resizeTo: vi.fn() };
  }

  it("opens the TV in its own window", async () => {
    const tv = fakeWindow();
    const open = vi
      .spyOn(window, "open")
      .mockReturnValue(Object.assign(Object.create(window), tv));
    await openTvWindow("/room/1-word/present");
    expect(open).toHaveBeenCalledWith(
      "/room/1-word/present",
      TV_WINDOW_NAME,
      expect.stringContaining("popup"),
    );
    expect(tv.moveTo).not.toHaveBeenCalled();
  });

  it("moves it to the projector when there is a second screen", async () => {
    const tv = fakeWindow();
    vi.spyOn(window, "open").mockReturnValue(
      Object.assign(Object.create(window), tv),
    );
    setExtended(true);
    window.getScreenDetails = async () => ({
      screens: [LAPTOP, PROJECTOR],
      currentScreen: LAPTOP,
    });
    await openTvWindow("/room/1-word/present");
    expect(tv.moveTo).toHaveBeenCalledWith(1920, 0);
    expect(tv.resizeTo).toHaveBeenCalledWith(1920, 1080);
  });

  it("leaves the window where it is when permission is denied", async () => {
    const tv = fakeWindow();
    vi.spyOn(window, "open").mockReturnValue(
      Object.assign(Object.create(window), tv),
    );
    setExtended(true);
    window.getScreenDetails = () => Promise.reject(new Error("denied"));
    await openTvWindow("/room/1-word/present");
    expect(tv.moveTo).not.toHaveBeenCalled();
  });
});
