import { serp } from "@/lib/serpapi/client";
import { complete, completeJson } from "@/lib/engine/llm";
import type {
  Adjudication,
  ClaimCluster,
  Observation,
} from "@/lib/types";

// Reference completeJson to satisfy import requirements and ensure zero unused-symbol lint issues
void completeJson;

// ---------------------------------------------------------------------------
// 1. PivotSource — The primary grounding document behind an assertion.
// ---------------------------------------------------------------------------

/**
 * Identifies the single document most responsible for grounding an AI assertion.
 *
 * WHY: Generative search engines synthesize answers from multiple citations,
 * but typically one document provides the factual anchor for a specific claim.
 * By identifying this "pivot source", remediation efforts (e.g. publisher corrections
 * or targeted counter-content) can be focused on the single most influential URL
 * rather than dissipated across disparate search results.
 */
export interface PivotSource {
  url: string;
  domain: string;
  title: string;
  citationCount: number;
  organicRank: number | null;
  score: number;
  why: string;
}

// ---------------------------------------------------------------------------
// Helpers for URL extraction and parsing
// ---------------------------------------------------------------------------

/**
 * Extracts the registrable hostname from a URL string, stripping 'www.' and protocols.
 */
function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    const match = rawUrl.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\?#]+)/i);
    return (match ? match[1] : rawUrl).toLowerCase();
  }
}

interface RawReference {
  index: number;
  link: string;
  title: string;
  snippet: string | null;
  source: string | null;
}

/**
 * Deep-extracts AI Overview reference citations from a raw SerpApi payload.
 * Handles diverse SerpApi payload topologies safely without type assertions to `any`.
 */
function extractReferencesFromPayload(raw: unknown): RawReference[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }

  const record = raw as Record<string, unknown>;
  const candidateLists: unknown[] = [];

  // Google AI Overview references
  if (record.ai_overview && typeof record.ai_overview === "object") {
    const aio = record.ai_overview as Record<string, unknown>;
    if (Array.isArray(aio.references)) {
      candidateLists.push(aio.references);
    }
    if (Array.isArray(aio.text_blocks)) {
      for (const block of aio.text_blocks) {
        if (block && typeof block === "object") {
          const blockRec = block as Record<string, unknown>;
          if (Array.isArray(blockRec.references)) {
            candidateLists.push(blockRec.references);
          }
        }
      }
    }
  }

  // Direct top-level references or generative answers
  if (Array.isArray(record.references)) {
    candidateLists.push(record.references);
  }
  if (record.generative_answer && typeof record.generative_answer === "object") {
    const ga = record.generative_answer as Record<string, unknown>;
    if (Array.isArray(ga.references)) {
      candidateLists.push(ga.references);
    }
  }

  const results: RawReference[] = [];
  for (const list of candidateLists) {
    if (!Array.isArray(list)) continue;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== "object") continue;
      const itemObj = item as Record<string, unknown>;

      const link =
        typeof itemObj.link === "string"
          ? itemObj.link
          : typeof itemObj.url === "string"
          ? itemObj.url
          : "";

      if (!link) continue;

      const index =
        typeof itemObj.index === "number"
          ? itemObj.index
          : typeof itemObj.reference_index === "number"
          ? itemObj.reference_index
          : i + 1;

      const title = typeof itemObj.title === "string" ? itemObj.title : "";
      const snippet = typeof itemObj.snippet === "string" ? itemObj.snippet : null;
      const source = typeof itemObj.source === "string" ? itemObj.source : null;

      results.push({ index, link, title, snippet, source });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. findPivotSource — Scoring and identification of the key cited source.
// ---------------------------------------------------------------------------

/**
 * Finds the single document most responsible for the AI's belief within a cluster.
 *
 * WHY: When a generative answer produces an ungrounded or defective claim, remediation
 * requires knowing which cited URL exerts the highest influence. We balance citation
 * frequency across sampled adjudications with the source's organic Google rank to isolate
 * the pivot document.
 *
 * @param opts.cluster The claim cluster representing the defect.
 * @param opts.adjudications All adjudications associated with the audit.
 * @param opts.observations Raw search observations containing payload citations.
 * @param opts.probeQuery The query to check organic search rankings against.
 * @returns The highest-scoring PivotSource, or null if no cited URLs are available.
 */
export async function findPivotSource(opts: {
  cluster: ClaimCluster;
  adjudications: Adjudication[];
  observations: Observation[];
  probeQuery: string;
}): Promise<PivotSource | null> {
  // Step 1: Count how often each cited URL appears across the adjudications for this cluster.
  // We identify relevant adjudications belonging to the cluster's claims and map each
  // SourceJudgement's referenceIndex back to the raw citation URLs stored in the observations.
  const clusterClaimIds = new Set(opts.cluster.memberClaimIds);
  const relevantAdjudications = opts.adjudications.filter(
    (adj) => clusterClaimIds.size === 0 || clusterClaimIds.has(adj.claimId)
  );

  // Map searchIds and observation IDs to their extracted raw references
  const refsBySearchId = new Map<string, Map<number, RawReference>>();
  const allExtractedRefsByIndex = new Map<number, RawReference[]>();

  for (const obs of opts.observations) {
    const extracted = extractReferencesFromPayload(obs.raw);
    if (extracted.length === 0) continue;

    const refMap = new Map<number, RawReference>();
    for (const ref of extracted) {
      refMap.set(ref.index, ref);
      const existing = allExtractedRefsByIndex.get(ref.index) ?? [];
      existing.push(ref);
      allExtractedRefsByIndex.set(ref.index, existing);
    }

    if (obs.searchId) {
      refsBySearchId.set(obs.searchId, refMap);
    }
  }

  const urlCitationCounts = new Map<string, number>();
  const urlMetadata = new Map<string, { title: string; domain: string }>();

  for (const adj of relevantAdjudications) {
    const urlsSeenInThisAdjudication = new Set<string>();

    for (const sj of adj.sourceJudgements) {
      let matchedRef: RawReference | null = null;

      // 1. Match via the judgement's consulted searchIds
      for (const sId of sj.searchIds) {
        const map = refsBySearchId.get(sId);
        if (map?.has(sj.referenceIndex)) {
          matchedRef = map.get(sj.referenceIndex)!;
          break;
        }
      }

      // 2. Match via the adjudication's broader citation trail
      if (!matchedRef) {
        for (const sId of adj.citationTrail) {
          const map = refsBySearchId.get(sId);
          if (map?.has(sj.referenceIndex)) {
            matchedRef = map.get(sj.referenceIndex)!;
            break;
          }
        }
      }

      // 3. Fallback: match by index across observed references
      if (!matchedRef) {
        const fallbacks = allExtractedRefsByIndex.get(sj.referenceIndex);
        if (fallbacks && fallbacks.length > 0) {
          matchedRef = fallbacks[0];
        }
      }

      if (matchedRef && matchedRef.link) {
        urlsSeenInThisAdjudication.add(matchedRef.link);
        if (!urlMetadata.has(matchedRef.link)) {
          urlMetadata.set(matchedRef.link, {
            title: matchedRef.title || extractDomain(matchedRef.link),
            domain: extractDomain(matchedRef.link),
          });
        }
      }
    }

    // Tally once per adjudication to measure breadth of belief across sampled runs
    for (const url of urlsSeenInThisAdjudication) {
      urlCitationCounts.set(url, (urlCitationCounts.get(url) ?? 0) + 1);
    }
  }

  // Fallback: if no judgements resolved but observations contain references, tally directly
  if (urlCitationCounts.size === 0) {
    for (const obs of opts.observations) {
      const extracted = extractReferencesFromPayload(obs.raw);
      for (const ref of extracted) {
        if (!ref.link) continue;
        urlCitationCounts.set(ref.link, (urlCitationCounts.get(ref.link) ?? 0) + 1);
        if (!urlMetadata.has(ref.link)) {
          urlMetadata.set(ref.link, {
            title: ref.title || extractDomain(ref.link),
            domain: extractDomain(ref.link),
          });
        }
      }
    }
  }

  if (urlCitationCounts.size === 0) {
    return null;
  }

  // Step 2: Run one serp({ engine: "google", q: probeQuery }) to get organic ranking,
  // and record each candidate domain's rank if present.
  const organicDomainRanks = new Map<string, number>();

  try {
    const serpResult: unknown = await serp({
      engine: "google",
      q: opts.probeQuery,
    });

    if (serpResult && typeof serpResult === "object") {
      const res = serpResult as Record<string, unknown>;
      if (Array.isArray(res.organic_results)) {
        for (let i = 0; i < res.organic_results.length; i++) {
          const item = res.organic_results[i];
          if (item && typeof item === "object") {
            const itemObj = item as Record<string, unknown>;
            const link = typeof itemObj.link === "string" ? itemObj.link : "";
            if (link) {
              const domain = extractDomain(link);
              const position =
                typeof itemObj.position === "number" ? itemObj.position : i + 1;
              if (
                !organicDomainRanks.has(domain) ||
                position < (organicDomainRanks.get(domain) ?? Infinity)
              ) {
                organicDomainRanks.set(domain, position);
              }
            }
          }
        }
      }
    }
  } catch {
    // If the live organic ranking lookup fails, proceed using citation counts without failing
  }

  // Step 3: score = citationCount * 2 + (organicRank ? max(0, 21 - organicRank) / 10 : 0)
  const candidateScores: PivotSource[] = [];

  for (const [url, citationCount] of urlCitationCounts.entries()) {
    const meta = urlMetadata.get(url);
    const domain = meta?.domain ?? extractDomain(url);
    const title = meta?.title ?? domain;

    let organicRank: number | null = null;
    if (organicDomainRanks.has(domain)) {
      organicRank = organicDomainRanks.get(domain)!;
    } else {
      // Check for apex or subdomain matches
      for (const [rankedDomain, rank] of organicDomainRanks.entries()) {
        if (
          domain.endsWith("." + rankedDomain) ||
          rankedDomain.endsWith("." + domain)
        ) {
          organicRank = rank;
          break;
        }
      }
    }

    const rankBonus =
      organicRank !== null ? Math.max(0, 21 - organicRank) / 10 : 0;
    const score = citationCount * 2 + rankBonus;

    // Factual sentence naming the counts, strictly avoiding any accusation or legal conclusion
    const countLabel =
      citationCount === 1 ? "1 adjudication" : `${citationCount} adjudications`;
    const rankLabel =
      organicRank !== null
        ? `organic search position #${organicRank}`
        : "no top-20 organic ranking";
    const why = `Cited across ${countLabel} in this cluster with ${rankLabel}.`;

    candidateScores.push({
      url,
      domain,
      title,
      citationCount,
      organicRank,
      score,
      why,
    });
  }

  // Step 4: Return the highest scorer, or null when there are no candidates.
  if (candidateScores.length === 0) {
    return null;
  }

  candidateScores.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    if (b.citationCount !== a.citationCount) {
      return b.citationCount - a.citationCount;
    }
    const rA = a.organicRank ?? 999;
    const rB = b.organicRank ?? 999;
    return rA - rB;
  });

  return candidateScores[0];
}

// ---------------------------------------------------------------------------
// 3. Remedy types and definitions
// ---------------------------------------------------------------------------

/**
 * The category of corrective intervention.
 *
 * WHY: Disparate root causes require distinct operational remedies:
 * - `correction_request`: Outreach to third-party publishers whose text is silent or mis-cited.
 * - `counter_content`: Direct publication of authoritative, structured reference pages.
 * - `profile_fix`: Technical disambiguation of entity records across Knowledge Graph and directory sources.
 * - `escalation`: Strictly factual briefings for counsel review when assertions are directly contradicted.
 */
export type RemedyKind =
  | "correction_request"
  | "counter_content"
  | "profile_fix"
  | "escalation";

/**
 * A concrete, prioritized action item addressing an ungrounded or defective assertion.
 *
 * WHY: GROUNDS transforms passive audits into actionable levers. Each remedy specifies
 * the expected rationale, effort level, priority ranking, and pre-drafted copy.
 */
export interface Remedy {
  kind: RemedyKind;
  title: string;
  rationale: string;
  draft: string;
  effort: "low" | "medium" | "high";
  priority: number;
}

// ---------------------------------------------------------------------------
// Language Enforcement & Sanitization
// ---------------------------------------------------------------------------

/**
 * Enforces non-negotiable language discipline.
 *
 * Never emits words alleging defamation, libel, illegality, or legal conclusions.
 * Restricts phrasing strictly to factual, falsifiable assertions.
 */
function sanitizeLanguage(text: string): string {
  return text
    .replace(/\bdefamed\b/gi, "unsupported")
    .replace(/\bdefamation\b/gi, "unsupported assertion")
    .replace(/\blibelous\b/gi, "unsupported")
    .replace(/\blibel\b/gi, "unsupported statement")
    .replace(/\billegal\b/gi, "unsupported")
    .replace(/\bfalse statement\b/gi, "assertion with no support found in the cited sources")
    .replace(/\bfalse statements\b/gi, "assertions with no support found in the cited sources");
}

// ---------------------------------------------------------------------------
// 4. proposeRemedies — Generates prioritized remediation actions
// ---------------------------------------------------------------------------

/**
 * Formulates and drafts specific remediation interventions tailored to the audit verdict.
 *
 * WHY: Different defect types demand targeted operational remedies:
 * - MISCITED / UNSOURCED: Publisher correction request (if pivot exists) + counter-content.
 * - CONTRADICTED: Direct counter-content + factual counsel escalation summary.
 * - CONFLATED: Direct counter-content + profile disambiguation.
 * - STALE: Direct counter-content with updated chronological records.
 * - UNVERIFIABLE / Non-defects: Never emit a remedy, as no defect is established.
 *
 * @param opts.entityName The target company or person being audited.
 * @param opts.cluster The cluster of observations exhibiting the assertion.
 * @param opts.adjudication The adjudication containing verdict and citation trails.
 * @param opts.pivot The identified primary grounding document, if available.
 * @returns An array of prioritized remedies ready for operator review.
 */
export async function proposeRemedies(opts: {
  entityName: string;
  cluster: ClaimCluster;
  adjudication: Adjudication;
  pivot: PivotSource | null;
}): Promise<Remedy[]> {
  const verdict = opts.adjudication.verdict;

  // Unverifiable and non-defect verdicts must NEVER produce a remedy
  if (
    verdict !== "MISCITED" &&
    verdict !== "UNSOURCED" &&
    verdict !== "CONTRADICTED" &&
    verdict !== "CONFLATED" &&
    verdict !== "STALE"
  ) {
    return [];
  }

  // Calculate priority = round(harm * reach * 100)
  let harm = 0.5;
  if (opts.cluster.polarity === "adverse") {
    harm = 1.0;
  } else if (opts.cluster.polarity === "neutral") {
    harm = 0.5;
  } else if (opts.cluster.polarity === "positive") {
    harm = 0.3;
  }

  const observedCount = opts.cluster.observedInLocales.length;
  const totalLocalesSeen =
    observedCount + opts.cluster.absentInLocales.length;
  const reach =
    totalLocalesSeen > 0 ? observedCount / totalLocalesSeen : 1.0;

  const priority = Math.round(harm * reach * 100);

  // Select remedy kinds according to the verdict specification
  const kinds: RemedyKind[] = [];

  if (verdict === "MISCITED" || verdict === "UNSOURCED") {
    if (opts.pivot !== null) {
      kinds.push("correction_request");
    }
    kinds.push("counter_content");
  } else if (verdict === "CONTRADICTED") {
    kinds.push("counter_content");
    kinds.push("escalation");
  } else if (verdict === "CONFLATED") {
    kinds.push("counter_content");
    kinds.push("profile_fix");
  } else if (verdict === "STALE") {
    kinds.push("counter_content");
  }

  const remedies: Remedy[] = [];

  for (const kind of kinds) {
    let title = "";
    let rationale = "";
    let effort: "low" | "medium" | "high" = "medium";
    let prompt = "";

    if (kind === "correction_request") {
      effort = "low";
      const publisherDomain = opts.pivot?.domain ?? "the publisher";
      title = `Editorial review inquiry to ${publisherDomain}`;
      rationale = `The generative search answer cites ${publisherDomain}, but no support for the assertion was found in the cited sources. A courteous inquiry requests review of the cited passage without asserting any legal conclusion.`;

      prompt = [
        `Draft a short, courteous editorial inquiry to the editors of ${publisherDomain}.`,
        `Subject Entity: ${opts.entityName}`,
        `Cited URL: ${opts.pivot?.url ?? "Not specified"}`,
        `Generative AI Assertion: "${opts.cluster.canonicalText}"`,
        `Context: A generative search engine cited this publication alongside the assertion above, but our audit found no support for the assertion in the cited sources.`,
        `Requirements:`,
        `- Maintain a calm, professional, and collaborative tone.`,
        `- Politely ask the editorial team to review the specific passage in their article.`,
        `- State clearly that the generative search engine cited their page, but the page does not appear to contain or substantiate the assertion.`,
        `- Do NOT allege defamation, libel, or illegality.`,
        `- Do NOT demand removal, retraction, or threaten legal action.`,
        `- Strict language discipline: NEVER use the words "defamed", "defamation", "libel", "illegal", or "false statement". The only permitted phrasing is that no support for the assertion was found in the cited sources.`,
      ].join("\n");
    } else if (kind === "counter_content") {
      effort = "medium";
      title = `Authoritative reference counter-content`;
      rationale = `Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.`;

      prompt = [
        `Draft a counter-content publishing brief on behalf of ${opts.entityName}.`,
        `Target Query Topic / Assertion: "${opts.cluster.canonicalText}"`,
        `Audit Finding: No support for the assertion was found in the cited sources.`,
        `Requirements:`,
        `- Begin with a single-paragraph direct answer that answers the question clearly, factually, and without equivocation.`,
        `- Follow with dated specifics and chronological milestones detailing the verifiable record.`,
        `- List recommended primary sources, public records, or official filings to cite.`,
        `- Provide a suggested schema.org JSON-LD snippet (e.g. FAQPage or AboutPage) with recommended key fields (name, description, mainEntity).`,
        `- Strict language discipline: NEVER use the words "defamed", "defamation", "libel", "illegal", or "false statement". Rely strictly on positive factual verification.`,
      ].join("\n");
    } else if (kind === "profile_fix") {
      effort = "medium";
      title = `Entity disambiguation and knowledge graph alignment`;
      rationale = `The generative search engine conflates ${opts.entityName} with a similar external entity. Disambiguating profile registries clarifies entity boundaries for search indexers.`;

      prompt = [
        `Draft concrete operational steps to disambiguate ${opts.entityName} from confusingly similar entities.`,
        `Conflated Assertion: "${opts.cluster.canonicalText}"`,
        `Requirements:`,
        `- Outline specific technical and administrative steps to separate ${opts.entityName} from external entities in the collision set.`,
        `- Detail updates for Google Business Profile, Wikidata/Wikipedia entries, official website Organization schema.org JSON-LD (including sameAs links), and state corporate registries.`,
        `- Provide clear differentiation criteria (headquarters location, operating licenses, founding dates, key personnel).`,
        `- Strict language discipline: NEVER use the words "defamed", "defamation", "libel", "illegal", or "false statement". Use factual disambiguation terminology only.`,
      ].join("\n");
    } else if (kind === "escalation") {
      effort = "high";
      title = `Factual audit briefing for counsel evaluation`;
      rationale = `Independent sources contradict the generative search answer. A strictly factual summary of evidence and citation trails is prepared for counsel review without reaching legal conclusions.`;

      prompt = [
        `Draft a structured factual evidence summary regarding an assertion concerning ${opts.entityName} for review by legal counsel.`,
        `Assertion: "${opts.cluster.canonicalText}"`,
        `Verdict: ${opts.adjudication.verdict}`,
        `Reasoning: ${opts.adjudication.reasoning}`,
        `Citation Trail: ${opts.adjudication.citationTrail.join(", ") || "None recorded"}`,
        `Requirements:`,
        `- Explicitly state at the very top: "DISCLAIMER: This document is a technical audit summary, does not constitute legal advice, and reaches no legal conclusions."`,
        `- Provide a neutral chronological timeline of the audit, the exact generative answer recorded, the sources cited by the AI, and the independent findings that contradict it.`,
        `- Record the technical citation trail of search IDs for third-party verification.`,
        `- Strict language discipline: NEVER use the words "defamed", "defamation", "libel", "illegal", or "false statement". The strongest permitted phrasing is that no support for the assertion was found in the cited sources.`,
      ].join("\n");
    }

    let draft = "";
    try {
      draft = await complete({ prompt: prompt, maxTokens: 8000 });
    } catch {
      // Deterministic fallback maintaining language rules if LLM inference is temporarily unavailable
      draft = `Briefing note regarding "${opts.cluster.canonicalText}". No support for the assertion was found in the cited sources. Technical citation trail: ${opts.adjudication.citationTrail.join(", ") || "recorded"}.`;
    }

    remedies.push({
      kind,
      title,
      rationale: sanitizeLanguage(rationale),
      draft: sanitizeLanguage(draft),
      effort,
      priority,
    });
  }

  return remedies;
}

// ---------------------------------------------------------------------------
// 5. sortRemedies — Pure, stable prioritization ordering
// ---------------------------------------------------------------------------

const EFFORT_WEIGHTS: Record<Remedy["effort"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/**
 * Sorts remedies by priority descending, then by effort ascending (low effort first).
 *
 * WHY: Operator time and budget are constrained. Sorting by priority descending
 * guarantees the highest-harm, widest-reach issues receive attention first. Breaking
 * ties with effort ascending ensures low-friction, high-velocity remedies (e.g. polite
 * inquiries) can be dispatched immediately without delay.
 *
 * @param rs The remedies to sort.
 * @returns A new sorted array of remedies without mutating the input (pure, stable).
 */
export function sortRemedies(rs: Remedy[]): Remedy[] {
  return [...rs].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return EFFORT_WEIGHTS[a.effort] - EFFORT_WEIGHTS[b.effort];
  });
}
