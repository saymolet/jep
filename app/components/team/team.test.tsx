import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRoutesStub } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlayerScores } from "~/components/player";
import {
  ANN,
  BOB,
  engineFor,
  play,
  STEPS,
  WATCH_GAME,
} from "~/components/watch/fixtures.test-helpers";
import { Presenter } from "~/components/watch/presenter";
import { ActionType, GameEngineContext } from "~/engine";
import type { State } from "~/engine/state";
import { I18nProvider, type Locale } from "~/i18n";

import { TeamDialog } from "./team";
import { TeamStandings } from "./team-standings";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CY = "u3";

/** Ann is on the red team with Cy, Bob on the blue team. */
const TEAMS = [
  { type: ActionType.Join, payload: { userId: CY, name: "Cy" } },
  { type: ActionType.SetTeam, payload: { userId: ANN, team: "red" } },
  { type: ActionType.SetTeam, payload: { userId: CY, team: "red" } },
  { type: ActionType.SetTeam, payload: { userId: BOB, team: "blue" } },
];

/** Ann scores $200 for the red team (Bob and Cy don't buzz). */
const ANN_SCORES = [
  ...STEPS.start,
  ...STEPS.chooseFirst,
  ...STEPS.buzzFirst,
  {
    type: ActionType.Buzz,
    payload: { userId: CY, i: 0, j: 0, deltaMs: 99_999 },
  },
  ...STEPS.checkFirst,
  ...STEPS.nextFirst,
];

let container: HTMLDivElement;
let root: Root;
const roomAction = vi.fn(async ({ request }: { request: Request }) => {
  const form = await request.formData();
  return { url: new URL(request.url).pathname, ...Object.fromEntries(form) };
});

beforeEach(() => {
  roomAction.mockClear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function render(
  state: State,
  ui: React.ReactNode,
  { locale = "en" }: { locale?: Locale } = {},
) {
  const engine = engineFor(state);
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <I18nProvider locale={locale}>
          <GameEngineContext.Provider value={engine}>
            {ui}
          </GameEngineContext.Provider>
        </I18nProvider>
      ),
    },
    { path: "/room/:roomId/:verb", action: roomAction },
  ]);
  act(() => root.render(<Stub initialEntries={["/"]} />));
}

const byTestId = (id: string) =>
  document.querySelector(`[data-testid="${id}"]`);

describe("grouped scoreboard", () => {
  it("shows one grid without team headers when no one has a team", () => {
    render(play(STEPS.join), <PlayerScores roomId={1} userId={ANN} />);
    expect(byTestId("team-scores")).toBeNull();
    expect(container.textContent).toContain("Bob");
  });

  it("groups tiles under their team, largest total first, with totals", () => {
    const state = play(
      STEPS.join,
      TEAMS,
      [{ type: ActionType.SetTeam, payload: { userId: CY, team: null } }],
      ANN_SCORES,
    );
    render(state, <PlayerScores roomId={1} userId={BOB} />);

    const sections = Array.from(
      container.querySelectorAll('[data-testid^="team-"]'),
    ).filter((el) => el.tagName === "SECTION");
    expect(sections.map((s) => s.getAttribute("data-testid"))).toStrictEqual([
      "team-red",
      "team-blue",
      "team-none",
    ]);
    expect(sections[0].textContent).toContain("Red team");
    expect(sections[0].textContent).toContain("$200");
    expect(sections[0].textContent).toContain("Ann");
    expect(sections[1].textContent).toContain("Blue team");
    expect(sections[1].textContent).toContain("$0");
    // Your own tile (with the team button) is in your team's group.
    expect(sections[1].querySelector('[data-testid="team-button"]')).not.toBe(
      null,
    );
    expect(sections[2].textContent).toContain("No team");
    expect(sections[2].textContent).toContain("Cy");
  });

  it("uses custom team names and Ukrainian default names", () => {
    const state = play(STEPS.join, TEAMS, [
      {
        type: ActionType.RenameTeam,
        payload: { userId: BOB, team: "blue", name: "Owls" },
      },
    ]);
    render(state, <PlayerScores roomId={1} userId={ANN} />, { locale: "uk" });
    const text = container.textContent ?? "";
    expect(text).toContain("Червоні");
    expect(text).toContain("Owls");
  });
});

describe("team dialog", () => {
  it("sends your team pick and shows team names and sizes", async () => {
    render(
      play(STEPS.join, TEAMS),
      <TeamDialog roomId={7} userId={BOB} isOpen onClose={() => {}} />,
    );
    const chips = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    expect(chips.map((c) => c.textContent)).toStrictEqual([
      "Red team2 players",
      "Blue team1 player",
      "Green team",
      "Yellow team",
      "No team",
    ]);
    expect(chips[1].getAttribute("aria-checked")).toBe("true");

    await act(async () => chips[2].click());
    expect(roomAction).toHaveBeenCalledTimes(1);
    const result = await roomAction.mock.results[0].value;
    expect(result).toStrictEqual({
      url: "/room/7/team",
      userId: BOB,
      team: "green",
    });
    // The rename field is for your own team.
    expect(
      document.querySelector<HTMLInputElement>("#team-name")?.placeholder,
    ).toBe("Blue team");
  });

  it("locks team changes while a question is open", () => {
    render(
      play(STEPS.join, TEAMS, STEPS.start, STEPS.chooseFirst),
      <TeamDialog roomId={7} userId={BOB} isOpen onClose={() => {}} />,
    );
    const chips =
      document.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    expect(Array.from(chips).every((c) => c.disabled)).toBe(true);
    expect(document.body.textContent).toContain(
      "Teams can be changed between questions.",
    );
  });
});

/** Every step of the game in order, with teams set up after joining. */
function playWholeGame(...extra: Parameters<typeof play>) {
  const { join, pause, ...rest } = STEPS;
  void pause;
  return play(join, TEAMS, ...extra, ...Object.values(rest));
}

describe("presenter team totals", () => {
  it("shows team totals next to the board", () => {
    vi.useFakeTimers();
    render(
      play(STEPS.join, TEAMS, ANN_SCORES),
      <Presenter game={WATCH_GAME} joinUrl="http://localhost/room/7-apple" />,
    );
    const teams = byTestId("presenter-teams");
    expect(teams?.textContent).toContain("Red team$200");
    expect(teams?.textContent).toContain("Blue team$0");
    vi.useRealTimers();
  });

  it("names the winning team at game over (in Ukrainian too)", () => {
    vi.useFakeTimers();
    // Cy never answers the final, so they are not on a team for it.
    const state = playWholeGame([
      { type: ActionType.Leave, payload: { userId: CY, name: "Cy" } },
    ]);
    expect(state.type).toBe("GameOver");
    render(
      state,
      <Presenter game={WATCH_GAME} joinUrl="http://localhost/room/7-apple" />,
      { locale: "uk" },
    );
    expect(byTestId("presenter-winning-team")?.textContent).toContain(
      "Перемогла команда: Червоні",
    );
    vi.useRealTimers();
  });
});

describe("summary team standings", () => {
  it("is empty without teams", () => {
    render(play(STEPS.join), <TeamStandings state={play(STEPS.join)} />);
    expect(byTestId("team-standings")).toBeNull();
  });

  it("shows the winning team and every team's total and players", () => {
    const state = play(STEPS.join, TEAMS, ANN_SCORES, [
      { type: ActionType.Leave, payload: { userId: CY, name: "Cy" } },
    ]);
    render(state, <TeamStandings state={state} />);
    expect(byTestId("winning-team")?.textContent).toContain(
      "Winning team: Red team",
    );
    const items = Array.from(
      container.querySelectorAll('[data-testid="team-standings"] li'),
    ).map((li) => li.textContent);
    expect(items[0]).toContain("Red team");
    expect(items[0]).toContain("$200");
    expect(items[0]).toContain("Ann and Cy (left)");
    expect(items[1]).toContain("Blue team");
  });

  it("reports a tie between teams", () => {
    const state = play(STEPS.join, TEAMS);
    render(state, <TeamStandings state={state} />, { locale: "uk" });
    expect(byTestId("winning-team")?.textContent).toContain(
      "Нічия між командами: Червоні і Сині",
    );
  });
});
