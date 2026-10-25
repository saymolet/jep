import { describe, expect, it } from "vitest";

import { devServerOptions } from "./dev-server";

describe("devServerOptions", () => {
  it("uses the BASE_URL port for a local origin", () => {
    expect(devServerOptions({ baseUrl: "http://localhost:3000" })).toEqual({
      port: 3000,
      allowedHosts: ["localhost"],
    });
  });

  it("prefers an explicit PORT over the BASE_URL port", () => {
    expect(
      devServerOptions({ baseUrl: "http://localhost:3000", port: 3100 }),
    ).toEqual({ port: 3100, allowedHosts: ["localhost"] });
  });

  it("uses PORT behind a port-less public HTTPS origin", () => {
    expect(
      devServerOptions({
        baseUrl: "https://jep.samoilenko.engineer",
        port: 3000,
      }),
    ).toEqual({ port: 3000, allowedHosts: ["jep.samoilenko.engineer"] });
  });

  it("falls back to 3000 when neither PORT nor a BASE_URL port is set", () => {
    expect(
      devServerOptions({ baseUrl: "https://jep.samoilenko.engineer" }).port,
    ).toBe(3000);
  });
});
