import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createI18n } from "./context";
import { en } from "./en";
import * as enAreas from "./en/areas";
import {
  localeFromAcceptLanguage,
  parseLangCookie,
  resolveLocale,
  serializeLangCookie,
} from "./resolve";
import { formatRich } from "./rich";
import { createT, interpolate, selectPlural, translate } from "./translate";
import type { Message, PluralMessage } from "./types";
import { uk } from "./uk";

describe("plurals", () => {
  const players: PluralMessage = {
    one: "{count} гравець",
    few: "{count} гравці",
    many: "{count} гравців",
    other: "{count} гравця",
  };

  it.each([
    [0, "гравців"],
    [1, "гравець"],
    [2, "гравці"],
    [3, "гравці"],
    [4, "гравці"],
    [5, "гравців"],
    [11, "гравців"],
    [12, "гравців"],
    [14, "гравців"],
    [21, "гравець"],
    [22, "гравці"],
    [25, "гравців"],
    [101, "гравець"],
    [111, "гравців"],
    [1.5, "гравця"],
  ])("uk %d → %s", (count, word) => {
    expect(selectPlural("uk", players, count)).toBe(`{count} ${word}`);
  });

  it("uses the dictionaries", () => {
    const tUk = createT("uk");
    expect(tUk("common.playerCount", { count: 1 })).toBe("1 гравець");
    expect(tUk("common.playerCount", { count: 3 })).toBe("3 гравці");
    expect(tUk("common.playerCount", { count: 5 })).toBe("5 гравців");
    expect(tUk("common.playerCount", { count: 21 })).toBe("21 гравець");

    const tEn = createT("en");
    expect(tEn("common.playerCount", { count: 1 })).toBe("1 player");
    expect(tEn("common.playerCount", { count: 0 })).toBe("0 players");
    expect(tEn("common.playerCount", { count: 3 })).toBe("3 players");
  });

  it("falls back to `other` when a form is missing", () => {
    expect(selectPlural("uk", { other: "x" }, 1)).toBe("x");
  });
});

describe("interpolation", () => {
  it("replaces placeholders", () => {
    expect(interpolate("{a} and {b}", { a: 1, b: "two" })).toBe("1 and two");
  });

  it("leaves unknown placeholders as they are", () => {
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
    expect(interpolate("Hi {name}")).toBe("Hi {name}");
  });

  it("interpolates translated messages", () => {
    expect(translate("uk", "common.errorStatus", { status: 404 })).toBe(
      "Статус: 404",
    );
  });
});

describe("missing keys", () => {
  it("returns the key instead of throwing", () => {
    expect(translate("uk", "does.not.exist")).toBe("does.not.exist");
    expect(translate("en", "does.not.exist")).toBe("does.not.exist");
  });
});

describe("rich messages", () => {
  it("renders tags and React values", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        formatRich("Read <b>the <i>rules</i></b> by {who}.", {
          b: (c) => React.createElement("strong", null, c),
          i: (c) => React.createElement("em", null, c),
          who: React.createElement("span", null, "us"),
        }),
      ),
    );
    expect(html).toBe(
      "Read <strong>the <em>rules</em></strong> by <span>us</span>.",
    );
  });

  it("leaves unknown tags and placeholders as text", () => {
    const html = renderToStaticMarkup(
      React.createElement(React.Fragment, null, formatRich("<x>a</x> {y}")),
    );
    expect(html).toBe("&lt;x&gt;a&lt;/x&gt; {y}");
  });

  it("interpolates plurals in rich messages", () => {
    const { rich } = createI18n("uk");
    const html = renderToStaticMarkup(
      React.createElement(
        React.Fragment,
        null,
        rich("common.playerCount", { count: 2 }),
      ),
    );
    expect(html).toBe("2 гравці");
  });
});

describe("language resolution", () => {
  it("prefers the cookie, then the account, then Accept-Language", () => {
    expect(
      resolveLocale({
        cookie: "a=b; lang=en",
        account: "uk",
        acceptLanguage: "uk",
      }),
    ).toEqual({ locale: "en", source: "cookie" });
    expect(
      resolveLocale({ cookie: "a=b", account: "uk", acceptLanguage: "en" }),
    ).toEqual({ locale: "uk", source: "account" });
    expect(
      resolveLocale({ cookie: null, account: undefined, acceptLanguage: "uk" }),
    ).toEqual({ locale: "uk", source: "header" });
    expect(resolveLocale({})).toEqual({ locale: "en", source: "default" });
  });

  it("ignores invalid cookie and account values", () => {
    expect(
      resolveLocale({ cookie: "lang=fr", account: "de", acceptLanguage: "uk" }),
    ).toEqual({ locale: "uk", source: "header" });
  });

  it.each([
    ["uk", "uk"],
    ["uk-UA,uk;q=0.9,en-US;q=0.8", "uk"],
    ["en-US,en;q=0.9,uk;q=0.8", "en"],
    ["ru-RU,ru;q=0.9", "en"],
    ["ru,uk;q=0.8,en;q=0.5", "uk"],
    ["de, en;q=0.1, uk;q=0.5", "uk"],
    ["fr", "en"],
    ["*", "en"],
  ])("Accept-Language %s → %s", (header, locale) => {
    expect(localeFromAcceptLanguage(header)).toBe(locale);
  });

  it("returns nothing without an Accept-Language header", () => {
    expect(localeFromAcceptLanguage(undefined)).toBeUndefined();
    expect(localeFromAcceptLanguage("")).toBeUndefined();
    expect(localeFromAcceptLanguage("uk;q=0")).toBeUndefined();
  });

  it("reads and writes the cookie", () => {
    expect(parseLangCookie("x=1; lang=uk; y=2")).toBe("uk");
    expect(parseLangCookie("language=uk")).toBeUndefined();
    expect(parseLangCookie(serializeLangCookie("uk").split(";")[0])).toBe("uk");
    expect(serializeLangCookie("uk")).toContain("Path=/");
  });
});

/** Placeholders like {count} in a message. */
function placeholders(message: string | PluralMessage): string[] {
  const text = typeof message === "string" ? message : message.other;
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("dictionaries", () => {
  const ukMessages: Record<string, Message> = uk;

  it("prefixes every key with its area", () => {
    for (const [area, messages] of Object.entries(enAreas)) {
      for (const key of Object.keys(messages)) {
        expect(key.startsWith(`${area}.`), key).toBe(true);
      }
    }
  });

  it("has no key in two areas", () => {
    const total = Object.values(enAreas)
      .map((messages) => Object.keys(messages).length)
      .reduce((sum, n) => sum + n, 0);
    expect(Object.keys(en)).toHaveLength(total);
  });

  it("translates every key into Ukrainian", () => {
    expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
    for (const [key, message] of Object.entries(uk)) {
      expect(message, key).not.toBe("");
    }
  });

  it("keeps the placeholders of every message", () => {
    for (const [key, message] of Object.entries(en)) {
      const translated = ukMessages[key];
      expect(placeholders(translated), key).toEqual(placeholders(message));
    }
  });

  it("has all the plural forms of each language", () => {
    for (const [key, message] of Object.entries(en)) {
      if (typeof message === "string") continue;
      expect(Object.keys(message).sort(), key).toEqual(["one", "other"]);
      const translated = ukMessages[key];
      expect(typeof translated, key).toBe("object");
      if (typeof translated === "object") {
        expect(Object.keys(translated).sort(), key).toEqual([
          "few",
          "many",
          "one",
          "other",
        ]);
      }
    }
  });
});
