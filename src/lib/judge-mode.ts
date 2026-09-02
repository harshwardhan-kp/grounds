/**
 * GROUNDS — Demo rate limiting and budget protection.
 *
 * NOTE: This rate limiter uses an in-memory store suitable for single-instance demo
 * deployments. A multi-instance production environment would back this with a shared
 * store (e.g. Upstash Redis, Redis KV, or a shared database) to maintain consistency
 * across concurrent serverless invocations and instances.
 */

const CLIENT_MAX_RUNS = 3;
const CLIENT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const GLOBAL_MAX_RUNS = 40;
const GLOBAL_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

const clientTimestamps = new Map<string, number[]>();
let globalTimestamps: number[] = [];

/**
 * Prunes expired timestamps across global records and client entries.
 * Deletes empty client keys to ensure the map cannot grow without bound.
 */
function prune(now: number): void {
  globalTimestamps = globalTimestamps.filter((t) => now - t < GLOBAL_WINDOW_MS);

  for (const [key, timestamps] of clientTimestamps.entries()) {
    const active = timestamps.filter((t) => now - t < CLIENT_WINDOW_MS);
    if (active.length === 0) {
      clientTimestamps.delete(key);
    } else {
      clientTimestamps.set(key, active);
    }
  }
}

/**
 * The rate limit assessment returned to callers.
 *
 * Provides a machine-readable decision and countdown, paired with a user-facing
 * non-technical message directing visitors to recorded dossiers rather than
 * showing generic or unhandled error screens.
 */
export interface RateDecision {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
  remaining: number;
}

/**
 * Checks whether a client is permitted to start a live audit under both per-client
 * and global rate quotas.
 *
 * WHY: SerpApi allocations for the demo are capped at 250 searches per month.
 * A single unconstrained user could exhaust the entire quota in minutes, leaving
 * subsequent reviewers with unhandled 429 failures. Enforcing 3 runs/hour per client
 * and 40 runs/day globally guarantees the monthly allotment is preserved while
 * gracefully redirecting traffic to pre-recorded dossiers when limits are reached.
 */
export function checkRateLimit(clientKey: string): RateDecision {
  const now = Date.now();
  prune(now);

  const globalActive = globalTimestamps;
  const clientActive = clientTimestamps.get(clientKey) ?? [];

  // Global backstop check takes precedence to preserve shared demo viability.
  if (globalActive.length >= GLOBAL_MAX_RUNS) {
    const oldest = globalActive[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + GLOBAL_WINDOW_MS - now) / 1000)
    );

    return {
      allowed: false,
      reason:
        "The shared demo budget for today is spent. Please explore the recorded dossier instead.",
      retryAfterSeconds,
      remaining: 0,
    };
  }

  // Per-client check limits burst consumption by any single reviewer.
  if (clientActive.length >= CLIENT_MAX_RUNS) {
    const oldest = clientActive[0] ?? now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + CLIENT_WINDOW_MS - now) / 1000)
    );

    return {
      allowed: false,
      reason:
        "You have reached the limit of live audits for this hour. Please explore the recorded dossier instead.",
      retryAfterSeconds,
      remaining: 0,
    };
  }

  const remainingClient = CLIENT_MAX_RUNS - clientActive.length;
  const remainingGlobal = GLOBAL_MAX_RUNS - globalActive.length;
  const remaining = Math.max(0, Math.min(remainingClient, remainingGlobal));

  return {
    allowed: true,
    remaining,
  };
}

/**
 * Commits an execution timestamp against both the client and global quotas.
 *
 * WHY: Counters must only be decremented when an audit actually executes, rather
 * than during pre-flight checks or validation failures, ensuring legitimate runs
 * are not penalized by aborted requests.
 */
export function recordRun(clientKey: string): void {
  const now = Date.now();
  prune(now);

  globalTimestamps.push(now);

  const existing = clientTimestamps.get(clientKey) ?? [];
  existing.push(now);
  clientTimestamps.set(clientKey, existing);
}

/**
 * Derives a reliable client identifier from incoming HTTP request headers.
 *
 * WHY: Live audits originate behind CDNs and reverse proxies (such as Vercel or
 * Cloudflare). Inspecting forwarded IP chains is necessary to attribute runs
 * correctly across requests, while defensive handling prevents unexpected header
 * formatting from crashing the request pipeline.
 */
export function clientKeyFrom(req: Request): string {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      const firstEntry = forwarded.split(",")[0]?.trim();
      if (firstEntry) {
        return firstEntry;
      }
    }

    const realIp = req.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Reads the operator-configured live search budget ceiling from the environment.
 *
 * WHY: Allows operators to impose an explicit financial ceiling on SerpApi credits
 * via GROUNDS_SEARCH_BUDGET. This ceiling is distinct from SerpApi's upstream hard quota,
 * providing proactive budget control before upstream billing thresholds are triggered.
 */
export function remainingSearchBudget(): number | null {
  const envVal = process.env.GROUNDS_SEARCH_BUDGET;
  if (!envVal || envVal.trim() === "") {
    return null;
  }

  const parsed = parseInt(envVal, 10);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}
