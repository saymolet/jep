import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** digest hashes a password to a fixed length, so passwords of any length
 * compare with `timingSafeEqual` (which needs equal-length inputs) and the
 * comparison time doesn't depend on where the inputs differ or on the length
 * of the real password. */
function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/** checkAdminPassword compares `input` with the configured admin password in
 * constant time. Always false when no admin password is configured (the admin
 * panel is off) or the input is empty. */
export function checkAdminPassword(
  input: unknown,
  expected: string | undefined,
): boolean {
  if (!expected) return false;
  const given = typeof input === "string" ? input : "";
  // Compare even for an empty input, so every rejected attempt takes the same
  // path.
  const same = timingSafeEqual(digest(given), digest(expected));
  return same && given.length > 0;
}

/** adminPasswordFingerprint ties an admin session to the password it was
 * opened with: changing ADMIN_PASSWORD logs every admin out. It is an HMAC
 * keyed with the session secret, so the (readable, signed) session cookie
 * never carries anything that could be used to guess the password offline. */
export function adminPasswordFingerprint(password: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`jep-admin:${password}`, "utf8")
    .digest("base64url")
    .slice(0, 22);
}

/** safeEqual compares two short strings (e.g. CSRF tokens) in constant time. */
export function safeEqual(a: string, b: string) {
  return timingSafeEqual(digest(a), digest(b)) && a.length === b.length;
}
