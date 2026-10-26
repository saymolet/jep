/** Brute-force protection for the admin login: failed attempts are counted
 * per client (IP address) and, with a higher limit, for all clients together
 * (so many addresses can't share the work). Kept in memory: a restart clears
 * it, which is fine for one small server. */

export interface ThrottleOptions {
  /** Failures from one client before it is locked out. */
  maxFailures: number;
  /** Failures from all clients together before everyone is locked out. */
  maxGlobalFailures: number;
  /** Failures older than this are forgotten. */
  windowMs: number;
  /** How long a lockout lasts. */
  lockoutMs: number;
  /** At most this many clients are tracked (oldest dropped first). */
  maxEntries: number;
}

export const DEFAULT_THROTTLE_OPTIONS: ThrottleOptions = {
  maxFailures: 5,
  maxGlobalFailures: 50,
  windowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000,
  maxEntries: 10_000,
};

interface Entry {
  failures: number[];
  lockedUntil: number;
}

const GLOBAL_KEY = "\0all";

export class LoginThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly options: ThrottleOptions;

  constructor(options: Partial<ThrottleOptions> = {}) {
    this.options = { ...DEFAULT_THROTTLE_OPTIONS, ...options };
  }

  /** isLocked reports whether `client` must not try a password now. */
  isLocked(client: string, now: number): boolean {
    return [client, GLOBAL_KEY].some(
      (key) => (this.entries.get(key)?.lockedUntil ?? 0) > now,
    );
  }

  /** recordFailure counts a wrong password from `client`. */
  recordFailure(client: string, now: number) {
    this.fail(client, now, this.options.maxFailures);
    this.fail(GLOBAL_KEY, now, this.options.maxGlobalFailures);
  }

  /** recordSuccess forgets `client`'s failures after a correct password. */
  recordSuccess(client: string) {
    this.entries.delete(client);
  }

  private fail(key: string, now: number, max: number) {
    const { windowMs, lockoutMs } = this.options;
    const entry = this.entries.get(key) ?? { failures: [], lockedUntil: 0 };
    entry.failures = entry.failures.filter((t) => t > now - windowMs);
    entry.failures.push(now);
    if (entry.failures.length >= max) {
      entry.lockedUntil = now + lockoutMs;
      entry.failures = [];
    }
    // Re-insert so the Map's order is least recently failed first.
    this.entries.delete(key);
    this.entries.set(key, entry);
    this.prune(now);
  }

  private prune(now: number) {
    if (this.entries.size <= this.options.maxEntries) return;
    for (const [key, entry] of this.entries) {
      if (this.entries.size <= this.options.maxEntries) break;
      if (key === GLOBAL_KEY) continue;
      // Drop expired entries first; a locked client is only dropped when the
      // map is full of locked clients (the global limit still applies).
      if (entry.lockedUntil <= now) this.entries.delete(key);
    }
    for (const key of this.entries.keys()) {
      if (this.entries.size <= this.options.maxEntries) break;
      if (key !== GLOBAL_KEY) this.entries.delete(key);
    }
  }
}

/** getClientAddress is the client's IP address as seen by the reverse proxy
 * in front of the app: nginx sets `X-Real-IP` to the connecting address and
 * appends it to `X-Forwarded-For`, so only the last X-Forwarded-For entry is
 * trusted (earlier ones are whatever the client sent). Without a proxy header
 * all clients share one key ("unknown"), which still limits guessing. */
export function getClientAddress(headers: Headers): string {
  const realIp = headers.get("X-Real-IP")?.trim();
  if (realIp) return realIp;
  const forwarded = headers
    .get("X-Forwarded-For")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .at(-1);
  return forwarded || "unknown";
}
