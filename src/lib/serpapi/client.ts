/**
 * GROUNDS — SerpApi Client & Search Chokepoint.
 *
 * This module is the single gateway through which all search engine queries flow.
 * It enforces cryptographic chain of custody, query budgeting, deterministic
 * caching on disk, bounded concurrency, and resilient backoff handling.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types & Contracts
// ---------------------------------------------------------------------------

/**
 * Parameters submitted to SerpApi.
 *
 * An explicit `engine` parameter is mandatory to prevent accidental default
 * routing and ensure engine-level auditability. Arbitrary additional parameters
 * are typed flexibly to accommodate engine-specific switches (e.g. gl, hl, location)
 * while disallowing unsupported nested complex structures.
 */
export interface SerpParams {
  engine: string;
  [k: string]: string | number | boolean | undefined;
}

/**
 * Normalized result wrapper preserving evidentiary provenance.
 *
 * Defamation and misattribution audits require strict chain-of-custody tracking.
 * We capture the SHA-256 hash of the canonical response payload for tamper verification,
 * preserve SerpApi's third-party search ID for independent subpoena/discovery corroboration,
 * and record wall-clock timestamps and latency to measure engine responsiveness.
 */
export interface SerpResult<T = unknown> {
  data: T;
  searchId: string | null;
  payloadHash: string;
  latencyMs: number;
  capturedAt: string;
  fromCache: boolean;
  params: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Custom Errors
// ---------------------------------------------------------------------------

/**
 * Thrown when SERPAPI_KEY is not defined in the process environment.
 *
 * Fast failure prevents probe pipelines from executing ungrounded partial audits
 * or emitting false findings caused by unauthenticated upstream responses.
 */
export class MissingKeyError extends Error {
  constructor(
    message: string = "SERPAPI_KEY environment variable is not set. A valid SerpApi key is required."
  ) {
    super(message);
    this.name = "MissingKeyError";
  }
}

/**
 * Thrown when an audit attempts to consume more searches than pre-allocated.
 *
 * Safeguards operational budgets against infinite crawler loops or unexpected
 * combinatorial explosions across dense locale/probe inquiry grids.
 */
export class BudgetExceededError extends Error {
  constructor(message: string = "Search budget exceeded for this audit.") {
    super(message);
    this.name = "BudgetExceededError";
  }
}

/**
 * Internal error representing non-retryable 4xx client errors (excluding 429).
 */
class NonRetryableHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "NonRetryableHttpError";
  }
}

// ---------------------------------------------------------------------------
// Budget Ledger
// ---------------------------------------------------------------------------

/**
 * Stateful in-memory ledger tracking search credit consumption per audit.
 *
 * Audit operators set explicit budget caps before dispatching probe matrices.
 * The ledger guarantees that live queries halt as soon as limits are reached,
 * while allowing zero-cost evaluation of historical disk cache hits.
 */
export class BudgetLedger {
  private readonly _limit: number;
  private _spent: number = 0;

  constructor(limit: number) {
    if (limit < 0) {
      throw new Error("Budget limit must be a non-negative number.");
    }
    this._limit = limit;
  }

  get limit(): number {
    return this._limit;
  }

  get spent(): number {
    return this._spent;
  }

  get remaining(): number {
    return Math.max(0, this._limit - this._spent);
  }

  /**
   * Consumes search quota from the ledger.
   * Throws BudgetExceededError immediately if the expenditure would surpass the ceiling.
   *
   * @param n - Number of searches to spend (defaults to 1).
   */
  spend(n: number = 1): void {
    if (n <= 0) {
      return;
    }
    if (this._spent + n > this._limit) {
      throw new BudgetExceededError(
        `Search budget exceeded: limit is ${this._limit}, currently spent ${this._spent}, attempted to spend ${n}.`
      );
    }
    this._spent += n;
  }
}

// ---------------------------------------------------------------------------
// Canonical Serialization & Hashing
// ---------------------------------------------------------------------------

/**
 * Recursively serializes arbitrary data to canonical JSON with object keys sorted.
 *
 * Deterministic JSON representation is foundational to forensic evidence integrity:
 * it guarantees that identical engine responses and identical query parameter maps
 * always generate bitwise-identical SHA-256 hashes regardless of runtime property
 * insertion order or V8 internal dictionary layout.
 *
 * @param v - Value to serialize canonically.
 * @returns Deterministic JSON string.
 */
export function canonicalJson(v: unknown): string {
  if (v === undefined) {
    return "null";
  }
  if (v === null || typeof v !== "object") {
    return JSON.stringify(v);
  }
  if (typeof (v as { toJSON?: unknown }).toJSON === "function") {
    return canonicalJson((v as { toJSON: () => unknown }).toJSON());
  }
  if (Array.isArray(v)) {
    const items = v.map((item) =>
      item === undefined ||
      typeof item === "function" ||
      typeof item === "symbol"
        ? "null"
        : canonicalJson(item)
    );
    return `[${items.join(",")}]`;
  }
  const record = v as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => {
      const val = record[k];
      return (
        val !== undefined &&
        typeof val !== "function" &&
        typeof val !== "symbol"
      );
    })
    .sort();

  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`
  );
  return `{${entries.join(",")}}`;
}

/**
 * Computes a SHA-256 hexadecimal digest over canonicalized JSON data.
 */
function computeSha256(v: unknown): string {
  const serialized = canonicalJson(v);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Safely extracts SerpApi's search_metadata.id from a raw response payload.
 */
function extractSearchId(payload: unknown): string | null {
  if (payload && typeof payload === "object" && "search_metadata" in payload) {
    const meta = (payload as { search_metadata?: unknown }).search_metadata;
    if (meta && typeof meta === "object" && "id" in meta) {
      const id = (meta as { id?: unknown }).id;
      if (typeof id === "string" && id.trim().length > 0) {
        return id.trim();
      }
    }
  }
  return null;
}

/**
 * Strips secret tokens and standardizes parameters into sorted key-value strings.
 */
function normalizeParams(rawParams: SerpParams): Record<string, string> {
  const normalized: Record<string, string> = {};
  const keys = Object.keys(rawParams).sort();
  for (const key of keys) {
    if (key === "api_key") {
      continue;
    }
    const val = rawParams[key];
    if (val !== undefined) {
      normalized[key] = String(val);
    }
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Disk Cache Storage
// ---------------------------------------------------------------------------

interface DiskCacheEnvelope<T> {
  data: T;
  searchId: string | null;
  payloadHash: string;
  latencyMs: number;
  capturedAt: string;
  params: Record<string, string>;
}

const CACHE_BASE_DIR = join(process.cwd(), ".cache", "serpapi");

async function readFromDiskCache<T>(
  cacheKey: string
): Promise<DiskCacheEnvelope<T> | null> {
  const filePath = join(CACHE_BASE_DIR, `${cacheKey}.json`);
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as DiskCacheEnvelope<T> | T;
    if (
      parsed &&
      typeof parsed === "object" &&
      "data" in parsed &&
      "payloadHash" in parsed
    ) {
      return parsed as DiskCacheEnvelope<T>;
    }
    // Backward compatibility if raw JSON payload was persisted directly
    const rawData = parsed as T;
    return {
      data: rawData,
      searchId: extractSearchId(rawData),
      payloadHash: computeSha256(rawData),
      latencyMs: 0,
      capturedAt: new Date().toISOString(),
      params: {},
    };
  } catch {
    return null;
  }
}

async function writeToDiskCache<T>(
  cacheKey: string,
  envelope: DiskCacheEnvelope<T>
): Promise<void> {
  const filePath = join(CACHE_BASE_DIR, `${cacheKey}.json`);
  try {
    await mkdir(CACHE_BASE_DIR, { recursive: true });
    await writeFile(filePath, JSON.stringify(envelope, null, 2), "utf8");
  } catch {
    // Non-fatal: disk write failure must not abort an otherwise successful search.
  }
}

// ---------------------------------------------------------------------------
// Concurrency Control
// ---------------------------------------------------------------------------

/**
 * Concurrently maps an array of items through an async function with bounded concurrency.
 *
 * Preserving the original item order is mandatory because probe matrix cells and
 * evaluation grids correspond positionally to user-specified hypothesis sets.
 * Bounded concurrency prevents upstream socket starvation and local file descriptor exhaustion.
 *
 * @param items - Source elements to process.
 * @param limit - Maximum number of active asynchronous workers.
 * @param fn - Async iterator invoked for each item with its original index.
 * @returns Transformed items in original input order.
 */
export async function mapLimit<A, B>(
  items: A[],
  limit: number,
  fn: (a: A, i: number) => Promise<B>
): Promise<B[]> {
  if (items.length === 0) {
    return [];
  }

  const concurrency = Math.max(1, Math.min(Math.floor(limit), items.length));
  const results: B[] = new Array(items.length);
  let nextIndex = 0;
  let aborted = false;

  async function worker(): Promise<void> {
    while (nextIndex < items.length && !aborted) {
      const index = nextIndex++;
      try {
        results[index] = await fn(items[index], index);
      } catch (err) {
        aborted = true;
        throw err;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Network Helpers
// ---------------------------------------------------------------------------

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(signal.reason ?? new Error("Operation aborted."));
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason ?? new Error("Operation aborted."));
      },
      { once: true }
    );
  });
}

// ---------------------------------------------------------------------------
// Primary SerpApi Dispatcher
// ---------------------------------------------------------------------------

/**
 * Executes a SerpApi search query through an audited, cached, and budget-governed pipeline.
 *
 * Why this is the single chokepoint:
 * 1. Guarantees identical query parameter hashing and caching to prevent redundant API bills.
 * 2. Deducts against BudgetLedger only on true network cache misses.
 * 3. Enforces exponential backoff with jitter on 429 rate limits and 5xx upstream outages,
 *    while rejecting non-retryable 4xx client errors immediately to avoid wasted retries.
 * 4. Captures the third-party SerpApi searchId and computes a SHA-256 payload hash to build
 *    a forensic chain of custody suitable for legal cross-examination.
 *
 * @param params - Engine and query parameters.
 * @param opts - Budget ledger, abort signal, and cache override options.
 * @returns Normalized SerpResult envelope.
 */
export async function serp<T = unknown>(
  params: SerpParams,
  opts?: {
    budget?: BudgetLedger;
    signal?: AbortSignal;
    noCache?: boolean;
  }
): Promise<SerpResult<T>> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new MissingKeyError(
      "SERPAPI_KEY environment variable is missing. A valid SerpApi key is required to perform searches."
    );
  }

  const normalizedParams = normalizeParams(params);
  const cacheKey = computeSha256(normalizedParams);

  // 1. Cache Inspection: cache hits must never consume budget
  if (!opts?.noCache) {
    const cached = await readFromDiskCache<T>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        searchId: cached.searchId,
        payloadHash: cached.payloadHash,
        latencyMs: cached.latencyMs,
        capturedAt: cached.capturedAt,
        fromCache: true,
        params: normalizedParams,
      };
    }
  }

  // 2. Budget Enforcement: deduct only when we know network access is necessary
  if (opts?.budget) {
    opts.budget.spend(1);
  }

  // 3. URL Construction
  const url = new URL("https://serpapi.com/search.json");
  for (const [key, value] of Object.entries(normalizedParams)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("api_key", apiKey);

  // 4. Bounded Network Execution with Jittered Exponential Backoff
  const MAX_ATTEMPTS = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (opts?.signal?.aborted) {
      throw opts.signal.reason ?? new Error("Operation aborted.");
    }

    try {
      const startTime = Date.now();
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: opts?.signal,
      });

      const latencyMs = Date.now() - startTime;
      const status = response.status;

      if (!response.ok) {
        const isRetryable = status === 429 || status >= 500;

        // Never retry 4xx errors other than rate limits (429)
        if (!isRetryable) {
          const bodyText = await response.text().catch(() => "");
          throw new NonRetryableHttpError(
            status,
            `SerpApi client error HTTP ${status} (${response.statusText}): ${bodyText}`
          );
        }

        if (attempt >= MAX_ATTEMPTS) {
          const bodyText = await response.text().catch(() => "");
          throw new Error(
            `SerpApi request failed after ${MAX_ATTEMPTS} attempts with HTTP ${status}: ${bodyText}`
          );
        }

        // Full jitter exponential backoff: (base * 2^(attempt-1)) + random jitter
        const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.random() * 250;
        await sleep(backoffMs, opts?.signal);
        continue;
      }

      const data = (await response.json()) as T;
      const capturedAt = new Date().toISOString();
      const searchId = extractSearchId(data);
      const payloadHash = computeSha256(data);

      const envelope: DiskCacheEnvelope<T> = {
        data,
        searchId,
        payloadHash,
        latencyMs,
        capturedAt,
        params: normalizedParams,
      };

      // Always write to cache for future replays (even if noCache bypassed read)
      await writeToDiskCache(cacheKey, envelope);

      return {
        data,
        searchId,
        payloadHash,
        latencyMs,
        capturedAt,
        fromCache: false,
        params: normalizedParams,
      };
    } catch (err) {
      if (err instanceof NonRetryableHttpError) {
        throw err;
      }
      if (opts?.signal?.aborted) {
        throw opts.signal.reason ?? err;
      }

      lastError = err;
      if (attempt >= MAX_ATTEMPTS) {
        throw err;
      }

      const backoffMs = 500 * Math.pow(2, attempt - 1) + Math.random() * 250;
      await sleep(backoffMs, opts?.signal);
    }
  }

  throw lastError ?? new Error("SerpApi request failed unexpectedly.");
}


/**
 * Whether live search is available at all.
 *
 * The public demo is deliberately deployed without a key so it cannot spend the
 * monthly search quota. Callers use this to present a designed "live audit is
 * off" state instead of letting a missing-key error surface mid-stream.
 */
export function isSerpApiConfigured(): boolean {
  return typeof process.env.SERPAPI_KEY === "string" && process.env.SERPAPI_KEY.length > 0;
}
