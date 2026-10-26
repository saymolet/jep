import * as crypto from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  const mocked = { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
  return { ...mocked, default: mocked };
});

import {
  adminPasswordFingerprint,
  checkAdminPassword,
  safeEqual,
} from "./password.server";

const PASSWORD = "correct horse battery staple";

afterEach(() => {
  vi.mocked(crypto.timingSafeEqual).mockClear();
});

describe("checkAdminPassword", () => {
  it("accepts the right password", () => {
    expect(checkAdminPassword(PASSWORD, PASSWORD)).toBe(true);
  });

  it.each([
    ["a wrong password", "wrong"],
    ["a prefix", PASSWORD.slice(0, -1)],
    ["a longer password", PASSWORD + "!"],
    ["an empty password", ""],
    ["no password", undefined],
    ["a non-string", 12345],
  ])("rejects %s", (_name, input) => {
    expect(checkAdminPassword(input, PASSWORD)).toBe(false);
  });

  it("compares equal-length digests with timingSafeEqual", () => {
    checkAdminPassword("short", PASSWORD);
    checkAdminPassword("", PASSWORD);
    const calls = vi.mocked(crypto.timingSafeEqual).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [a, b] of calls) {
      expect(a.byteLength).toBe(32);
      expect(b.byteLength).toBe(32);
    }
  });

  it.each([undefined, ""])(
    "rejects everything when the admin password is %j (feature off)",
    (expected) => {
      expect(checkAdminPassword("", expected)).toBe(false);
      expect(checkAdminPassword("anything", expected)).toBe(false);
    },
  );
});

describe("adminPasswordFingerprint", () => {
  it("changes with the password and the secret, and hides both", () => {
    const a = adminPasswordFingerprint(PASSWORD, "secret-1");
    expect(a).toBe(adminPasswordFingerprint(PASSWORD, "secret-1"));
    expect(a).not.toBe(adminPasswordFingerprint("other", "secret-1"));
    expect(a).not.toBe(adminPasswordFingerprint(PASSWORD, "secret-2"));
    expect(a).not.toContain(PASSWORD);
  });
});

describe("safeEqual", () => {
  it("compares strings", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
