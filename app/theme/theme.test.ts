import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME,
  isTheme,
  nextTheme,
  parseThemeCookie,
  resolveTheme,
  serializeThemeCookie,
  THEMES,
} from "./theme";

describe("themes", () => {
  it("offers Classic, Dark and System, Classic by default", () => {
    expect(THEMES).toEqual(["classic", "dark", "system"]);
    expect(DEFAULT_THEME).toBe("classic");
  });

  it("recognises only known themes", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("light")).toBe(false);
    expect(isTheme(undefined)).toBe(false);
    expect(isTheme(1)).toBe(false);
  });

  it("cycles through the themes", () => {
    expect(nextTheme("classic")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
    expect(nextTheme("system")).toBe("classic");
  });
});

describe("theme cookie", () => {
  it("reads the theme cookie among others", () => {
    expect(parseThemeCookie("lang=uk; theme=dark; x=1")).toBe("dark");
    expect(parseThemeCookie("theme=system")).toBe("system");
  });

  it("ignores missing, unknown and similarly named cookies", () => {
    expect(parseThemeCookie(null)).toBeUndefined();
    expect(parseThemeCookie("")).toBeUndefined();
    expect(parseThemeCookie("theme=neon")).toBeUndefined();
    expect(parseThemeCookie("themes=dark")).toBeUndefined();
  });

  it("round-trips through the serialized cookie", () => {
    const cookie = serializeThemeCookie("dark");
    expect(cookie).toMatch(/^theme=dark; Path=\/; Max-Age=\d+; SameSite=Lax$/);
    expect(parseThemeCookie(cookie.split(";")[0])).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("prefers the cookie over the account setting", () => {
    expect(resolveTheme({ cookie: "theme=dark", account: "system" })).toEqual({
      theme: "dark",
      source: "cookie",
    });
  });

  it("uses the account setting without a cookie", () => {
    expect(resolveTheme({ cookie: "lang=uk", account: "system" })).toEqual({
      theme: "system",
      source: "account",
    });
  });

  it("falls back to Classic", () => {
    expect(resolveTheme({})).toEqual({ theme: "classic", source: "default" });
    expect(resolveTheme({ cookie: null, account: undefined })).toEqual({
      theme: "classic",
      source: "default",
    });
  });

  it("skips invalid values at every step", () => {
    expect(resolveTheme({ cookie: "theme=neon", account: "dark" })).toEqual({
      theme: "dark",
      source: "account",
    });
    expect(resolveTheme({ cookie: "theme=neon", account: "neon" })).toEqual({
      theme: "classic",
      source: "default",
    });
  });
});
