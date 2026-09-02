/**
 * GROUNDS — Probe Grid Deposition Executor.
 *
 * Implements the automated deposition process across the probe grid:
 * evaluating enabled probes across geographic locales and search engines,
 * capturing raw SerpApi responses with verifiable SHA-256 payload hashes,
 * synchronously chasing short-lived Google AI Overview tokens, detecting
 * answer suppression as data, and respecting strict search budgets.
 */

import { createHash, randomUUID } from "node:crypto";
import { serp, BudgetLedger, mapLimit, type SerpParams } from "@/lib/serpapi/client";
export { DEFAULT_LOCALES } from "@/lib/locales";
import { DEFAULT_LOCALES } from "@/lib/locales";

import type {
  Engine,
  Locale,
  Observation,
  PipelineEvent,
  Probe,
  Reference,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 1. Default Locales
// ---------------------------------------------------------------------------

/**
 * Standard 8-point geographic grid across the United States.
 *
 * WHY THESE LOCALES:
 * Google search results and AI Overviews vary significantly by geography due to
 * localized query routing, jurisdiction-specific knowledge graphs, and regional CDN caches.
 * Minneapolis and Saint Paul are explicitly included because the motivating case
 * involved an alleged lawsuit by the Minnesota Attorney General. The remaining 6 points
 * provide broad continental distribution across the Midwest (Chicago, Milwaukee),
 * Southwest (Austin, Phoenix), Mountain West (Denver), and Pacific Northwest (Seattle)
 * to test whether a generative hallucination is isolated or nationwide.
 */

// ---------------------------------------------------------------------------
// 2. Search Budget Estimation
// ---------------------------------------------------------------------------

/**
 * Pure function to estimate the upper-bound number of SerpApi searches required.
 *
 * ARITHMETIC:
 * 1. Base grid cells = enabledProbes * locales * engines.
 *    Disabled probes are filtered out before deposition to conserve quota.
 * 2. Additional follow-ups = enabledProbes * locales * 1 (if "google" is in engines).
 *    When querying the standard "google" organic engine, generative answers frequently
 *    return an `ai_overview.page_token` instead of inline text. Following that token
 *    triggers an immediate, synchronous secondary call to the `google_ai_overview`
 *    engine, doubling the search cost for that specific engine cell.
 *
 * Total = (enabledProbes * locales * engines) + (hasGoogle ? enabledProbes * locales : 0).
 */
export function estimateSearches(
  probes: Probe[],
  locales: Locale[],
  engines: Engine[]
): number {
  const enabledCount = probes.filter((p) => p.enabled).length;
  const localeCount = locales.length;
  const baseSearches = enabledCount * localeCount * engines.length;
  const googleFollowUpEstimate = engines.includes("google")
    ? enabledCount * localeCount
    : 0;

  return baseSearches + googleFollowUpEstimate;
}

// ---------------------------------------------------------------------------
// 3. Payload Parsing & Defensive Normalization
// ---------------------------------------------------------------------------

/**
 * Normalized representation of an atomic block of generative text and the
 * reference indices attached to it by the search engine.
 */
export interface TextBlock {
  type?: string;
  snippet: string;
  referenceIndices: number[];
}

/**
 * Result of parsing a raw SerpApi generative answer payload.
 */
export interface ParsedAiOverview {
  textBlocks: TextBlock[];
  references: Reference[];
  /** Alias supporting consumers expecting snake_case */
  text_blocks: TextBlock[];
}

/**
 * Defensively extracts cited sources from raw payload data.
 * Guarantees a safe array of References without throwing on malformed records.
 */
function extractReferences(rawRefs: unknown): Reference[] {
  if (!Array.isArray(rawRefs)) {
    return [];
  }

  const results: Reference[] = [];
  for (let i = 0; i < rawRefs.length; i++) {
    const item = rawRefs[i];
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const record = item as Record<string, unknown>;
    results.push({
      index: typeof record.index === "number" ? record.index : i,
      title: typeof record.title === "string" ? record.title : "",
      link: typeof record.link === "string" ? record.link : "",
      snippet: typeof record.snippet === "string" ? record.snippet : null,
      source: typeof record.source === "string" ? record.source : null,
    });
  }

  return results;
}

/**
 * Defensively parses an array of text block objects into normalized TextBlocks.
 * Accommodates paragraph blocks, text snippets, and list structures.
 */
function extractBlocks(rawBlocks: unknown): TextBlock[] {
  if (!Array.isArray(rawBlocks)) {
    return [];
  }

  const blocks: TextBlock[] = [];

  for (const item of rawBlocks) {
    if (typeof item !== "object" || item === null) {
      if (typeof item === "string" && item.trim().length > 0) {
        blocks.push({
          snippet: item.trim(),
          referenceIndices: [],
        });
      }
      continue;
    }

    const record = item as Record<string, unknown>;
    const type = typeof record.type === "string" ? record.type : undefined;

    // Normalise reference index arrays from varied SerpApi formats
    const rawIndices =
      record.reference_indexes ??
      record.reference_indices ??
      record.references;

    const referenceIndices: number[] = [];
    if (Array.isArray(rawIndices)) {
      for (const idx of rawIndices) {
        if (typeof idx === "number" && !referenceIndices.includes(idx)) {
          referenceIndices.push(idx);
        } else if (
          typeof idx === "object" &&
          idx !== null &&
          typeof (idx as Record<string, unknown>).index === "number"
        ) {
          const num = (idx as Record<string, unknown>).index as number;
          if (!referenceIndices.includes(num)) {
            referenceIndices.push(num);
          }
        }
      }
    }

    let snippet = "";
    if (typeof record.snippet === "string") {
      snippet = record.snippet.trim();
    } else if (typeof record.text === "string") {
      snippet = record.text.trim();
    }

    // Handle nested list blocks where snippet is empty but list items contain the text
    if (!snippet && Array.isArray(record.list)) {
      const parts: string[] = [];
      for (const listItem of record.list) {
        if (typeof listItem === "object" && listItem !== null) {
          const lRecord = listItem as Record<string, unknown>;
          if (typeof lRecord.snippet === "string") {
            parts.push(lRecord.snippet.trim());
          } else if (typeof lRecord.text === "string") {
            parts.push(lRecord.text.trim());
          }

          const lIndices =
            lRecord.reference_indexes ?? lRecord.reference_indices;
          if (Array.isArray(lIndices)) {
            for (const lIdx of lIndices) {
              if (
                typeof lIdx === "number" &&
                !referenceIndices.includes(lIdx)
              ) {
                referenceIndices.push(lIdx);
              }
            }
          }
        } else if (typeof listItem === "string" && listItem.trim().length > 0) {
          parts.push(listItem.trim());
        }
      }
      snippet = parts.join("\n");
    }

    if (snippet.length > 0) {
      blocks.push({
        type,
        snippet,
        referenceIndices,
      });
    }
  }

  return blocks;
}

/**
 * Defensively parses a SerpApi google_ai_mode or google_ai_overview payload into
 * text blocks and references.
 *
 * WHY THIS MUST BE DEFENSIVE:
 * SerpApi outputs change shapes depending on whether the call was made to google_ai_mode
 * (where text_blocks and references are top-level) or google / google_ai_overview
 * (where they are nested inside an ai_overview container). Under adverse or zero-hit
 * circumstances, Google may omit fields entirely. This parser must never throw
 * on malformed or partial JSON, returning empty collections instead.
 */
export function parseAiOverview(raw: unknown): ParsedAiOverview {
  if (typeof raw !== "object" || raw === null) {
    return { textBlocks: [], references: [], text_blocks: [] };
  }

  const root = raw as Record<string, unknown>;
  const nested =
    typeof root.ai_overview === "object" && root.ai_overview !== null
      ? (root.ai_overview as Record<string, unknown>)
      : null;

  const rawBlocks = nested?.text_blocks ?? root.text_blocks;
  const rawReferences = nested?.references ?? root.references;

  const textBlocks = extractBlocks(rawBlocks);
  const references = extractReferences(rawReferences);

  return {
    textBlocks,
    references,
    text_blocks: textBlocks,
  };
}

/** Exported alias for compatibility with generative terminology. */
export const parseGenerativePayload = parseAiOverview;

// ---------------------------------------------------------------------------
// 4. Helpers: Hashing, Serialization, and Budget Tracking
// ---------------------------------------------------------------------------

/**
 * Deterministically canonicalises an unknown value to JSON for hashing.
 * Sorts object keys recursively to ensure hash stability across platforms.
 */
function canonicalJson(val: unknown): string {
  if (val === null || typeof val !== "object") {
    return JSON.stringify(val) ?? "null";
  }

  if (Array.isArray(val)) {
    return "[" + val.map(canonicalJson).join(",") + "]";
  }

  const obj = val as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const entries = sortedKeys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Computes SHA-256 digest of canonicalised payload for evidence chain of custody.
 */
function computePayloadHash(raw: unknown): string {
  return createHash("sha256").update(canonicalJson(raw)).digest("hex");
}

/**
 * Extracts SerpApi search_metadata.id if present in the raw payload.
 */
function extractSearchId(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const root = raw as Record<string, unknown>;
  if (
    typeof root.search_metadata === "object" &&
    root.search_metadata !== null
  ) {
    const meta = root.search_metadata as Record<string, unknown>;
    if (typeof meta.id === "string") {
      return meta.id;
    }
  }
  if (typeof root.search_id === "string") {
    return root.search_id;
  }
  return null;
}

/**
 * Extracts an AI Overview page_token from a standard Google search response.
 */
function extractPageToken(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) {
    return null;
  }
  const root = raw as Record<string, unknown>;
  if (
    typeof root.ai_overview === "object" &&
    root.ai_overview !== null
  ) {
    const aio = root.ai_overview as Record<string, unknown>;
    if (typeof aio.page_token === "string" && aio.page_token.length > 0) {
      return aio.page_token;
    }
  }
  return null;
}

/**
 * Determines whether an unknown thrown error represents budget exhaustion.
 */
function isBudgetExceededError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "BudgetExceededError" ||
      err.constructor.name === "BudgetExceededError" ||
      err.message.toLowerCase().includes("budget exceeded") ||
      err.message.toLowerCase().includes("budget limit")
    );
  }
  if (typeof err === "object" && err !== null) {
    const rec = err as Record<string, unknown>;
    return rec.name === "BudgetExceededError";
  }
  return false;
}

/**
 * Inspects a BudgetLedger to retrieve spent and total budget numbers safely.
 */
function getBudgetSnapshot(ledger: BudgetLedger): {
  spent: number;
  budget: number;
} {
  const rec = ledger as unknown as Record<string, unknown>;

  let spent = 0;
  if (typeof rec.spent === "number") {
    spent = rec.spent;
  } else if (typeof rec.getSpent === "function") {
    const s = (rec.getSpent as () => unknown)();
    if (typeof s === "number") spent = s;
  }

  let total = 0;
  if (typeof rec.budget === "number") {
    total = rec.budget;
  } else if (typeof rec.limit === "number") {
    total = rec.limit;
  } else if (typeof rec.total === "number") {
    total = rec.total;
  } else if (typeof rec.getBudget === "function") {
    const b = (rec.getBudget as () => unknown)();
    if (typeof b === "number") total = b;
  }

  return { spent, budget: total };
}

/**
 * Records a search expenditure on the budget ledger if methods exist,
 * or throws BudgetExceededError if spent exceeds the allowed allocation.
 */
function registerSpend(ledger: BudgetLedger, units = 1): void {
  const rec = ledger as unknown as Record<string, unknown>;

  if (typeof rec.spend === "function") {
    (rec.spend as (n: number) => void)(units);
  } else if (typeof rec.charge === "function") {
    (rec.charge as (n: number) => void)(units);
  } else if (typeof rec.record === "function") {
    (rec.record as (n: number) => void)(units);
  } else if (typeof rec.spent === "number") {
    rec.spent += units;
    if (typeof rec.budget === "number" && rec.spent > rec.budget) {
      const err = new Error(
        `Search budget exceeded: spent ${rec.spent} > budget ${rec.budget}`
      );
      err.name = "BudgetExceededError";
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Grid Deposition Executor
// ---------------------------------------------------------------------------

export interface DeposeOptions {
  auditId: string;
  probes: Probe[];
  locales: Locale[];
  engines: Engine[];
  budget: BudgetLedger;
  concurrency?: number; // default 4
  onEvent?: (e: PipelineEvent) => void;
  signal?: AbortSignal;
}

interface GridCell {
  probe: Probe;
  locale: Locale;
  engine: Engine;
}

/**
 * Runs the probe grid deposition across all enabled probes, locales, and engines.
 *
 * WHY THIS ARCHITECTURE:
 * Generative search answers are non-deterministic. A single probe in a single browser
 * session is not an audit finding. Deposition treats the search space as a matrix
 * (Probes x Locales x Engines) executed concurrently through mapLimit.
 *
 * CRITICAL PIPELINE INVARIANTS:
 * 1. google_ai_mode is the primary generative engine queried directly.
 * 2. If the "google" organic engine returns an `ai_overview.page_token`, it MUST be
 *    followed immediately and synchronously in the same frame because Google tokens
 *    expire in ~60 seconds.
 * 3. Suppression (no AI Overview returned) is treated as valid DATA, never an error.
 * 4. On BudgetExceededError, execution halts cleanly without crashing or discarding
 *    observations acquired prior to exhaustion.
 */
export async function depose(opts: DeposeOptions): Promise<Observation[]> {
  const concurrency = opts.concurrency ?? 4;
  const enabledProbes = opts.probes.filter((p) => p.enabled);

  // Build the complete cell list
  const cells: GridCell[] = [];
  for (const probe of enabledProbes) {
    for (const locale of opts.locales) {
      for (const engine of opts.engines) {
        cells.push({ probe, locale, engine });
      }
    }
  }

  let budgetExhausted = false;

  const emitBudget = () => {
    if (opts.onEvent) {
      const snap = getBudgetSnapshot(opts.budget);
      opts.onEvent({ kind: "budget", spent: snap.spent, budget: snap.budget });
    }
  };

  const results = await mapLimit(
    cells,
    concurrency,
    async (cell): Promise<Observation | null> => {
      // If budget was previously exhausted or abort requested, halt further cell dispatch
      if (budgetExhausted || opts.signal?.aborted) {
        return null;
      }

      opts.onEvent?.({
        kind: "cell_started",
        probeId: cell.probe.id,
        localeId: cell.locale.id,
        engine: cell.engine,
      });

      const start = Date.now();
      let rawPayload: unknown = null;
      let recordedParams: SerpParams = { engine: cell.engine };
      let searchId: string | null = null;

      try {
        if (cell.engine === "google_ai_mode") {
          recordedParams = {
            engine: "google_ai_mode",
            q: cell.probe.query,
            location: cell.locale.location,
            gl: cell.locale.gl,
            hl: cell.locale.hl,
          };
          registerSpend(opts.budget, 1);
          emitBudget();
          const res = await serp(recordedParams);
          rawPayload = res.data;
          searchId = res.searchId ?? extractSearchId(res.data);
        } else if (cell.engine === "google") {
          recordedParams = {
            engine: "google",
            q: cell.probe.query,
            location: cell.locale.location,
            gl: cell.locale.gl,
            hl: cell.locale.hl,
          };
          registerSpend(opts.budget, 1);
          emitBudget();
          const googleRes = await serp(recordedParams);
          rawPayload = googleRes.data;
          searchId = googleRes.searchId ?? extractSearchId(googleRes.data);

          const pageToken = extractPageToken(googleRes);
          if (pageToken) {
            // =======================================================================
            // CRITICAL: SerpApi AI Overview page_token expires in ~60 seconds.
            // It MUST NOT be queued, batched, or deferred to later execution.
            // We call serp({ engine: "google_ai_overview", page_token }) IMMEDIATELY
            // and SYNCHRONOUSLY as the very next await in this exact execution frame.
            // =======================================================================
            registerSpend(opts.budget, 1);
            emitBudget();
            const aioParams: SerpParams = {
              engine: "google_ai_overview",
              page_token: pageToken,
            };
            const aioRes = await serp(aioParams);
            rawPayload = aioRes.data;
            searchId = aioRes.searchId ?? extractSearchId(aioRes.data) ?? searchId;
            recordedParams = aioParams;
          }
        } else {
          recordedParams = {
            engine: cell.engine,
            q: cell.probe.query,
            location: cell.locale.location,
            gl: cell.locale.gl,
            hl: cell.locale.hl,
          };
          registerSpend(opts.budget, 1);
          emitBudget();
          const res = await serp(recordedParams);
          rawPayload = res.data;
          searchId = res.searchId ?? extractSearchId(res.data);
        }
      } catch (err: unknown) {
        if (isBudgetExceededError(err)) {
          if (!budgetExhausted) {
            budgetExhausted = true;
            const message =
              err instanceof Error ? err.message : "Search budget exceeded";
            opts.onEvent?.({ kind: "error", message });
            opts.onEvent?.({
              kind: "log",
              line: `Search budget cap reached; stopping pending deposition cells.`,
            });
          }
          return null;
        }

        // For non-budget execution errors, log and do not crash the audit run
        const errorMsg = err instanceof Error ? err.message : String(err);
        opts.onEvent?.({
          kind: "log",
          line: `Search error on ${cell.engine} (${cell.locale.id}): ${errorMsg}`,
        });
        return null;
      }

      const latencyMs = Date.now() - start;

      // Detect suppression: no ai_overview, no text_blocks returned.
      // Suppression is evidence of Google withholding generative answers on adverse queries.
      const parsed = parseAiOverview(rawPayload);
      const suppressed = parsed.textBlocks.length === 0;
      const claimCount = suppressed ? 0 : parsed.textBlocks.length;

      const finalRaw = rawPayload ?? {};
      const payloadHash = computePayloadHash(finalRaw);

      opts.onEvent?.({
        kind: "cell_done",
        probeId: cell.probe.id,
        localeId: cell.locale.id,
        engine: cell.engine,
        suppressed,
        searchId,
        latencyMs,
        claimCount,
      });

      opts.onEvent?.({
        kind: "log",
        line: `→ ${cell.engine} | "${cell.probe.query}" | ${cell.locale.label} … ${claimCount} claims`,
      });

      const observation: Observation = {
        id: randomUUID(),
        auditId: opts.auditId,
        probeId: cell.probe.id,
        localeId: cell.locale.id,
        engine: cell.engine,
        params: stringifyParams(recordedParams),
        raw: finalRaw,
        searchId,
        payloadHash,
        capturedAt: new Date().toISOString(),
        latencyMs,
        suppressed,
      };

      return observation;
    }
  );

  // Filter out any cells that were halted or skipped
  return results.filter((obs): obs is Observation => obs !== null);
}

/**
 * Observations persist their params as plain strings so a finding can be
 * reproduced byte-for-byte later. Numbers/booleans are stringified; undefined
 * entries are dropped rather than serialised as "undefined".
 */
function stringifyParams(p: SerpParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== undefined) out[k] = String(v);
  }
  return out;
}
