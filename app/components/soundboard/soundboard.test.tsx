import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SoundControl from "~/components/sound";
import {
  ANN,
  BOB,
  engineFor,
  play,
  playUntil,
  STEPS,
} from "~/components/watch/fixtures.test-helpers";
import { GameEngineContext } from "~/engine";
import {
  createListenerSet,
  NO_BROADCAST,
  type RoomBroadcast,
} from "~/engine/room-broadcast";
import { I18nProvider, type Locale } from "~/i18n";
import type { UserSettings } from "~/models/user-settings";
import { SEND_COOLDOWN_MS } from "~/utils/soundboard/limiter";
import {
  resetSoundboardMuteForTests,
  setSoundboardMuted,
} from "~/utils/soundboard/mute";
import { UserSettingsProvider } from "~/utils/user-settings";

import { Soundboard } from "./soundboard";
import { MEDIA_DUCK, TOAST_MS } from "./use-soundboard";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

/** A room channel stand-in: records what is sent, delivers what we emit. */
function fakeBroadcast() {
  const listeners = createListenerSet<unknown>();
  const sent: unknown[] = [];
  const broadcast: RoomBroadcast = {
    available: true,
    send: (payload) => {
      sent.push(payload);
      return true;
    },
    subscribe: listeners.add,
  };
  return {
    broadcast,
    sent,
    receive: (payload: unknown) => act(() => listeners.emit(payload)),
  };
}

let channel: ReturnType<typeof fakeBroadcast>;
let playSound: ReturnType<typeof vi.fn<(s: string, v: number) => boolean>>;

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  localStorage.clear();
  resetSoundboardMuteForTests();
  channel = fakeBroadcast();
  playSound = vi.fn(() => true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function render({
  userId = ANN,
  engine = { ...engineFor(play(STEPS.join)), soundboard: channel.broadcast },
  locale = "en",
  settings = {},
  variant = "room",
}: {
  userId?: string | null;
  engine?: ReturnType<typeof engineFor>;
  locale?: Locale;
  settings?: UserSettings;
  variant?: "room" | "tv";
} = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <I18nProvider locale={locale}>
          <UserSettingsProvider initialSettings={settings} loggedIn={false}>
            <GameEngineContext.Provider value={engine}>
              <Soundboard
                userId={userId}
                variant={variant}
                playSound={playSound}
              />
            </GameEngineContext.Provider>
          </UserSettingsProvider>
        </I18nProvider>
      ),
    },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

function fab() {
  return document.querySelector<HTMLButtonElement>(
    '[data-testid="soundboard-button"]',
  );
}

function openPanel() {
  act(() => fab()!.click());
  return document.querySelector<HTMLElement>(
    '[data-testid="soundboard-panel"]',
  )!;
}

function soundButton(panel: HTMLElement, label: string) {
  return Array.from(panel.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label),
  )!;
}

function toasts() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid="soundboard-toast"]'),
  );
}

function toastTexts() {
  return toasts().map(
    (t) =>
      t.querySelector("[aria-hidden]")!.textContent! +
      t.children[1].textContent,
  );
}

describe("Soundboard", () => {
  it("lets a player play a sound for everyone", () => {
    render();
    const panel = openPanel();
    const buttons = panel.querySelectorAll("button");
    expect(buttons).toHaveLength(9);
    expect(panel.textContent).toContain("Applause");
    expect(panel.textContent).toContain("Crickets");

    act(() => soundButton(panel, "Ta-da!").click());
    expect(channel.sent).toEqual([{ sound: "tada", userId: ANN, name: "Ann" }]);
    expect(playSound).toHaveBeenCalledWith("tada", 0.5);
    expect(toastTexts()).toEqual(["🎺 Ann"]);
    expect(toasts()[0].dataset.played).toBe("true");

    // The toast goes away.
    act(() => vi.advanceTimersByTime(TOAST_MS));
    expect(toasts()).toHaveLength(0);
  });

  it("allows one sound every 2 seconds", () => {
    render();
    const panel = openPanel();
    act(() => soundButton(panel, "Applause").click());
    act(() => soundButton(panel, "Ding!").click());
    expect(channel.sent).toHaveLength(1);
    expect(soundButton(panel, "Ding!").getAttribute("aria-disabled")).toBe(
      "true",
    );
    expect(panel.textContent).toContain("One sound every 2 seconds");

    act(() => vi.advanceTimersByTime(SEND_COOLDOWN_MS));
    expect(soundButton(panel, "Ding!").getAttribute("aria-disabled")).toBe(
      "false",
    );
    act(() => soundButton(panel, "Ding!").click());
    expect(channel.sent).toHaveLength(2);
  });

  it("plays sounds from other players with a toast", () => {
    render();
    channel.receive({ sound: "airhorn", userId: BOB, name: "Bob" });
    expect(playSound).toHaveBeenCalledWith("airhorn", 0.5);
    expect(toastTexts()).toEqual(["📯 Bob"]);
    expect(toasts()[0].textContent).toContain("Bob played “Air horn”");
  });

  it("ignores malformed messages, unknown sounds and non-players", () => {
    render();
    channel.receive(null);
    channel.receive("airhorn");
    channel.receive({ sound: "explosion", userId: BOB, name: "Bob" });
    channel.receive({ sound: "ding", name: "Bob" });
    channel.receive({ sound: "ding", userId: "stranger", name: "Eve" });
    // Its own echo (should never come back, but be safe).
    channel.receive({ sound: "ding", userId: ANN, name: "Ann" });
    expect(toasts()).toHaveLength(0);
    expect(playSound).not.toHaveBeenCalled();
  });

  it("ignores a sender who sends faster than the cooldown", () => {
    render();
    channel.receive({ sound: "ding", userId: BOB, name: "Bob" });
    act(() => vi.advanceTimersByTime(500));
    channel.receive({ sound: "airhorn", userId: BOB, name: "Bob" });
    expect(playSound).toHaveBeenCalledTimes(1);
    expect(toasts()).toHaveLength(1);
    act(() => vi.advanceTimersByTime(SEND_COOLDOWN_MS));
    channel.receive({ sound: "airhorn", userId: BOB, name: "Bob" });
    expect(playSound).toHaveBeenCalledTimes(2);
  });

  it("shows the toast but plays nothing when the soundboard is muted", () => {
    act(() => setSoundboardMuted(true));
    render();
    channel.receive({ sound: "laugh", userId: BOB, name: "Bob" });
    expect(toastTexts()).toEqual(["😂 Bob"]);
    expect(toasts()[0].dataset.played).toBe("false");
    expect(playSound).not.toHaveBeenCalled();
  });

  it("mutes from the panel, on this device only", () => {
    render();
    const panel = openPanel();
    const toggle = panel.querySelector<HTMLInputElement>(
      'input[type="checkbox"]',
    )!;
    expect(toggle.checked).toBe(false);
    expect(panel.textContent).toContain("Mute soundboard on this device");
    act(() => toggle.click());
    expect(toggle.checked).toBe(true);
    expect(localStorage.getItem("jep-soundboard-mute")).toBe("1");

    // Sending still works for the others; this device stays quiet.
    act(() => soundButton(panel, "Applause").click());
    expect(channel.sent).toHaveLength(1);
    expect(playSound).not.toHaveBeenCalled();
  });

  it("follows the game sounds' mute and volume", () => {
    render({ settings: { sound: { volume: 0.8, mute: true } } });
    channel.receive({ sound: "ding", userId: BOB, name: "Bob" });
    expect(playSound).not.toHaveBeenCalled();
    expect(toasts()[0].dataset.played).toBe("false");
  });

  it("is quieter while a question's audio or video may be playing", () => {
    const base = engineFor(playUntil("chooseFirst"));
    render({
      engine: {
        ...base,
        clue: {
          ...base.clue!,
          media: [{ type: "audio", src: "https://a.example/x.mp3" }],
        },
        soundboard: channel.broadcast,
      },
      settings: { sound: { volume: 0.8, mute: false } },
    });
    channel.receive({ sound: "ding", userId: BOB, name: "Bob" });
    expect(playSound).toHaveBeenCalledWith("ding", 0.8 * MEDIA_DUCK);
  });

  it("only listens for spectators and on the TV", () => {
    render({ userId: "spectator" });
    expect(fab()).toBeNull();
    channel.receive({ sound: "ooh", userId: BOB, name: "Bob" });
    expect(toastTexts()).toEqual(["😮 Bob"]);

    act(() => root.unmount());
    root = createRoot(container);
    render({ userId: null, variant: "tv" });
    expect(fab()).toBeNull();
    channel.receive({ sound: "crickets", userId: ANN, name: "Ann" });
    expect(toastTexts()).toEqual(["🦗 Ann"]);
  });

  it("is not there in solo play", () => {
    render({
      engine: { ...engineFor(play(STEPS.join)), soundboard: NO_BROADCAST },
    });
    expect(fab()).toBeNull();
    expect(container.textContent).toBe("");
  });

  it("speaks Ukrainian", () => {
    render({ locale: "uk" });
    expect(fab()!.getAttribute("aria-label")).toBe(
      "Звукова панель: зіграй звук для всіх",
    );
    const panel = openPanel();
    expect(panel.textContent).toContain("Оплески");
    expect(panel.textContent).toContain("Вимкнути звукову панель");
    channel.receive({ sound: "tada", userId: BOB, name: "Bob" });
    expect(toasts()[0].textContent).toContain("Bob вмикає «Та-дам!»");
  });

  it("has a mute toggle in the sound settings, not in the compact control", () => {
    act(() =>
      root.render(
        <I18nProvider locale="en">
          <SoundControl />
          <div data-testid="compact">
            <SoundControl showLabel={false} showSlider={false} />
          </div>
        </I18nProvider>,
      ),
    );
    const toggles = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(toggles).toHaveLength(1);
    expect(container.textContent).toContain("Mute soundboard on this device");
    act(() => toggles[0].click());
    expect(localStorage.getItem("jep-soundboard-mute")).toBe("1");
  });
});
