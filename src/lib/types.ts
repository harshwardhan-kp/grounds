/**
 * GROUNDS — domain model.
 *
 * This file is the contract every module builds against. It is owned by the
 * supervisor; workers implement against it and must not change it without
 * saying so explicitly in their report.
 */

// ---------------------------------------------------------------------------
// Observations — raw, append-only record of what a search engine returned.
// ---------------------------------------------------------------------------

/** Which SerpApi engine produced an observation. */
export type Engine =
  | "google"
  | "google_ai_overview"
  | "google_ai_mode"
  | "google_news"
  | "google_maps"
  | "google_local"
  | "google_scholar"
  | "google_patents"
  | "google_trends"
  | "bing"
  | "duckduckgo"
  | "brave"
  | "yandex";

/** A geographic point the probe grid samples from. */
export interface Locale {
  /** Stable key, e.g. "us-mn-minneapolis". */
  id: string;
  /** SerpApi `location` value, e.g. "Minneapolis, Minnesota, United States". */
  location: string;
  /** Country code for `gl`. */
  gl: string;
  /** Language code for `hl`. */
  hl: string;
  /** Short label for the UI grid column. */
  label: string;
}

/**
 * One raw engine response. APPEND-ONLY: never mutate a persisted observation.
 * The hash + archive id are the chain of custody.
 */
export interface Observation {
  id: string;
  auditId: string;
  probeId: string;
  localeId: string;
  engine: Engine;
  /** Exact params sent to SerpApi, for reproduction. */
  params: Record<string, string>;
  /** Full unmodified SerpApi JSON. */
  raw: unknown;
  /** SerpApi `search_metadata.id` — third-party corroboration. */
  searchId: string | null;
  /** SHA-256 of the canonicalised raw payload. */
  payloadHash: string;
  /** Wall-clock capture time, ISO 8601. */
  capturedAt: string;
  /** Round-trip latency in ms, shown in the Forensic Inspector. */
  latencyMs: number;
  /**
   * True when the engine returned no generative answer at all.
   * Suppression is DATA, not an error — Google withholds AI Overviews on
   * exactly the adverse queries we care about.
   */
  suppressed: boolean;
}

// ---------------------------------------------------------------------------
// Probes — the line of questioning.
// ---------------------------------------------------------------------------

export type ProbeFamily =
  | "identity"
  | "adverse"
  | "commercial"
  | "qualification"
  | "operational";

export interface Probe {
  id: string;
  auditId: string;
  /** The question as a real person would type it. */
  query: string;
  family: ProbeFamily;
  /** 0..1. Adverse probes weigh heaviest in scoring. */
  harmWeight: number;
  /** Operator can disable a probe before spending budget. */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Claims — atomic assertions extracted from a generative answer.
// ---------------------------------------------------------------------------

export type ClaimPolarity = "positive" | "neutral" | "adverse";
export type ClaimType = "factual" | "opinion" | "prediction";

/** A source the AI itself cited, as parsed by SerpApi. */
export interface Reference {
  index: number;
  title: string;
  link: string;
  /** SerpApi's indexed snippet. Tested BEFORE fetching the page. */
  snippet: string | null;
  source: string | null;
}

export interface Claim {
  id: string;
  observationId: string;
  /** The assertion, as one subject-predicate-object sentence. */
  text: string;
  /** Character span in the source text_block, for highlighting. */
  span: { start: number; end: number };
  /** Index of the text_block this came from. */
  blockIndex: number;
  /**
   * Reference indices attached to the CONTAINING BLOCK, not the sentence.
   * Google cites at block level; the union of these is the evidence set.
   */
  blockReferenceIndices: number[];
  /** Which entity the claim is about — target, or a collision-set neighbour. */
  aboutEntity: string;
  isAboutTarget: boolean;
  polarity: ClaimPolarity;
  type: ClaimType;
}

// ---------------------------------------------------------------------------
// Cross-examination.
// ---------------------------------------------------------------------------

/** How one cited source relates to one claim. */
export type SourceStance = "supports" | "contradicts" | "silent" | "opaque";

/** Why we could or couldn't read a source. Prevents fetch failure → false accusation. */
export type EvidenceChannel =
  | "serpapi_snippet" // preferred: Google's own index of the page
  | "fetched_page" // we retrieved and parsed the document
  | "site_search" // site: + exact phrase probe
  | "unreachable"; // paywalled, blocked, unparseable

export interface SourceJudgement {
  claimId: string;
  referenceIndex: number;
  stance: SourceStance;
  channel: EvidenceChannel;
  /** Quoted text that justifies the stance. Empty for `silent`/`opaque`. */
  evidenceQuote: string | null;
  /** SerpApi search ids consulted to reach this judgement. */
  searchIds: string[];
  confidence: number;
  reasoning: string;
}

export type Corroboration = "confirmed" | "refuted" | "absent" | "inconclusive";

export interface CorroborationResult {
  claimId: string;
  outcome: Corroboration;
  /** Engines actually queried, e.g. google_news for events. */
  enginesUsed: Engine[];
  searchIds: string[];
  evidenceQuote: string | null;
  reasoning: string;
}

/**
 * Verdict taxonomy. Deliberately mirrors the categories defamation
 * practitioners already use, so output speaks the buyer's language.
 */
export type Verdict =
  | "GROUNDED" // cited sources support it and it checks out
  | "MISCITED" // true, but the cited sources don't say it
  | "UNSOURCED" // cited sources silent AND no independent corroboration
  | "CONTRADICTED" // independent sources refute it
  | "STALE" // was true; a newer source refutes it
  | "CONFLATED" // true of a different entity in the collision set
  | "UNVERIFIABLE" // we could not read the sources. NEVER a defect.
  | "OPINION"; // excluded from scoring

export interface Adjudication {
  id: string;
  claimId: string;
  verdict: Verdict;
  confidence: number;
  /** Human-readable justification. Never asserts a legal conclusion. */
  reasoning: string;
  sourceJudgements: SourceJudgement[];
  corroboration: CorroborationResult | null;
  /** Every SerpApi search id used anywhere in reaching this verdict. */
  citationTrail: string[];
  /** Did this verdict survive the adversarial second pass? */
  survivedReview: boolean;
  /** Borderline verdicts are queued for a human rather than published. */
  needsHumanReview: boolean;
}

// ---------------------------------------------------------------------------
// Aggregation.
// ---------------------------------------------------------------------------

/**
 * The same assertion seen across locales/engines. Non-determinism means a
 * single observation is never a finding — frequency is the finding.
 */
export interface ClaimCluster {
  id: string;
  auditId: string;
  canonicalText: string;
  verdict: Verdict;
  polarity: ClaimPolarity;
  /** Locale ids where this cluster was observed. */
  observedInLocales: string[];
  /** Locale ids sampled but where it did not appear. */
  absentInLocales: string[];
  enginesObserved: Engine[];
  /** times observed / times sampled. */
  frequency: number;
  sampleCount: number;
  /** Contradictory assertions across locales. */
  inconsistent: boolean;
  memberClaimIds: string[];
}

export interface GroundsScore {
  /** 0..100, starts at 100 and subtracts weighted penalties. */
  overall: number;
  /** Share of factual claims not contradicted or unsourced. */
  accuracy: number;
  /** Share of claims whose cited sources actually support them. */
  attributionIntegrity: number;
  /** Cross-locale and cross-engine agreement. */
  consistency: number;
}

// ---------------------------------------------------------------------------
// Audit — the top-level unit of work.
// ---------------------------------------------------------------------------

export interface EntityCard {
  canonicalName: string;
  domain: string | null;
  aliases: string[];
  categories: string[];
  /** Per-location name/address/phone as seen by Google. */
  locations: { label: string; address: string | null; phone: string | null }[];
  /**
   * Confusingly-similar entities. Powers the CONFLATED verdict — a claim can
   * be true, but about somebody else.
   */
  collisionSet: { name: string; why: string }[];
}

export type AuditState =
  | "draft"
  | "probes_ready"
  | "deposing"
  | "adjudicating"
  | "complete"
  | "failed";

export interface Audit {
  id: string;
  entityQuery: string;
  entityCard: EntityCard | null;
  state: AuditState;
  locales: Locale[];
  createdAt: string;
  /** Hard cap on SerpApi searches this audit may spend. */
  searchBudget: number;
  searchesSpent: number;
  score: GroundsScore | null;
  /** Set when loaded from a cached fixture instead of live search. */
  fromFixture: boolean;
}

// ---------------------------------------------------------------------------
// Live pipeline events (SSE) — drives the deposition grid.
// ---------------------------------------------------------------------------

export type PipelineEvent =
  | { kind: "audit_state"; auditId: string; state: AuditState }
  | { kind: "budget"; spent: number; budget: number }
  /**
   * The generated line of questioning, emitted once before deposition begins.
   * Cells are keyed by probe id, so the UI needs this to label its rows with the
   * actual question rather than a uuid.
   */
  | {
      kind: "probes";
      probes: { id: string; query: string; family: ProbeFamily }[];
    }
  | {
      kind: "cell_started";
      probeId: string;
      localeId: string;
      engine: Engine;
    }
  | {
      kind: "cell_done";
      probeId: string;
      localeId: string;
      engine: Engine;
      suppressed: boolean;
      searchId: string | null;
      latencyMs: number;
      claimCount: number;
    }
  | { kind: "claim_adjudicated"; claimId: string; verdict: Verdict }
  | { kind: "log"; line: string }
  | { kind: "error"; message: string };

/** Verdicts that count as defects for scoring and for the register. */
export const DEFECT_VERDICTS: Verdict[] = [
  "MISCITED",
  "UNSOURCED",
  "CONTRADICTED",
  "STALE",
  "CONFLATED",
];

export function isDefect(v: Verdict): boolean {
  return DEFECT_VERDICTS.includes(v);
}
