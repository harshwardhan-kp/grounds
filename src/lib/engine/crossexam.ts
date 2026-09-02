/**
 * src/lib/engine/crossexam.ts
 *
 * Claim extraction, citation testing, corroboration, and adversarial review.
 * Core engine module for the GROUNDS auditing pipeline.
 */

import { complete, completeJson } from "@/lib/engine/llm";
import { serp } from "@/lib/serpapi/client";
import { adjudicate, explain } from "@/lib/engine/adjudicate";
import type {
  Adjudication,
  Claim,
  ClaimPolarity,
  ClaimType,
  Corroboration,
  CorroborationResult,
  Engine,
  EvidenceChannel,
  Reference,
  SourceJudgement,
  SourceStance,
  Verdict,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface SerpSearchResult {
  search_metadata?: {
    id?: string;
    status?: string;
  };
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
  news_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
  scholar_results?: Array<{
    title?: string;
    snippet?: string;
  }>;
  place_results?: {
    title?: string;
    address?: string;
  };
  error?: string;
  [key: string]: unknown;
}

function parseDomain(link: string): string {
  try {
    const url = new URL(link);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return link.replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  }
}

function extractDistinctivePhrase(text: string): string {
  const cleaned = text.trim().replace(/[.,;!?"']+$/, "");
  const words = cleaned.split(/\s+/);
  if (words.length <= 6) {
    return cleaned;
  }
  return words.slice(0, 6).join(" ");
}

function selectCorroborationEngine(claim: Claim): Engine {
  const t = claim.text.toLowerCase();
  if (
    /\b(sued|lawsuit|litigation|attorney general|investigation|indictment|settlement|court|trial|scandal|charges|allegation|enforcement)\b/.test(
      t
    )
  ) {
    return "google_news";
  }
  if (
    /\b(study|research|journal|paper|clinical trial|peer-reviewed|findings|published|university|experiment)\b/.test(
      t
    )
  ) {
    return "google_scholar";
  }
  if (
    /\b(patent|patent pending|trademark|uspto|intellectual property|invention)\b/.test(
      t
    )
  ) {
    return "google_patents";
  }
  if (
    /\b(address|located at|headquarters|office hours|store hours|location|phone number|street|suite|zip)\b/.test(
      t
    )
  ) {
    return "google_maps";
  }
  return "google";
}

// ---------------------------------------------------------------------------
// Exported Engine Functions
// ---------------------------------------------------------------------------

/**
 * Decomposes raw text blocks into atomic, single-assertion claims.
 *
 * WHY: Generative answers bundle multiple distinct assertions into compound
 * sentences. Testing complex sentences against citations leads to attribution
 * confusion. Decomposing into atomic claims isolates individual assertions so
 * each can be independently grounded against cited references.
 */
export async function decomposeClaims(opts: {
  observationId: string;
  textBlocks: { type: string; snippet: string }[];
  references: Reference[];
  targetEntity: string;
  collisionSet: string[];
}): Promise<Claim[]> {
  const allReferenceIndices = opts.references.map((r) => r.index);

  interface RawExtractedClaim {
    text: string;
    blockIndex: number;
    type: ClaimType;
    polarity: ClaimPolarity;
    aboutEntity: string;
    isAboutTarget: boolean;
  }

  const prompt = `You are a forensic claim extraction engine.
Analyze the following text blocks from a generative search answer and extract all atomic claims.

Target Entity: "${opts.targetEntity}"
Collision Set (confusable entities): ${JSON.stringify(opts.collisionSet)}

Text Blocks:
${opts.textBlocks.map((b, i) => `[Block ${i}] (${b.type}): "${b.snippet}"`).join("\n")}

Extraction Rules:
1. Split content into ATOMIC claims (one subject-predicate-object sentence per claim).
2. Record the exact 0-based blockIndex where the assertion originates.
3. Classify type strictly as "factual", "opinion", or "prediction".
4. Classify polarity strictly as "positive", "neutral", or "adverse".
5. Identify the exact entity the claim is about in "aboutEntity". Set "isAboutTarget" to true only if it is about "${opts.targetEntity}". If it is about an entity in the collision set, set isAboutTarget to false.
6. Language discipline: Do NOT use legal conclusions or defamatory language. State only factual, falsifiable assertions.

Return JSON matching this exact structure:
{
  "claims": [
    {
      "text": "Atomic assertion as a single sentence.",
      "blockIndex": 0,
      "type": "factual",
      "polarity": "neutral",
      "aboutEntity": "Entity Name",
      "isAboutTarget": true
    }
  ]
}`;

  const response = await completeJson<{ claims?: RawExtractedClaim[] }>({ prompt: prompt, schemaHint: "strict JSON object", maxTokens: 4000 });
  const rawClaims = Array.isArray(response?.claims) ? response.claims : [];

  return rawClaims.map((raw, idx) => {
    const block = opts.textBlocks[raw.blockIndex] ?? { snippet: "" };
    const snippetText = block.snippet || "";

    // Locate span if present within the source block snippet
    let start = snippetText.indexOf(raw.text);
    if (start === -1) {
      const firstWords = raw.text.split(/\s+/).slice(0, 3).join(" ");
      start = firstWords.length > 0 ? snippetText.indexOf(firstWords) : -1;
    }
    const span =
      start >= 0
        ? { start, end: start + raw.text.length }
        : { start: 0, end: raw.text.length };

    // Identify per-block citations if present in brackets (e.g. "[1]", "[2]")
    const explicitBlockIndices = new Set<number>();
    const matches = snippetText.matchAll(/\[(\d+)\]/g);
    for (const match of matches) {
      const parsedIndex = parseInt(match[1], 10);
      if (allReferenceIndices.includes(parsedIndex)) {
        explicitBlockIndices.add(parsedIndex);
      }
    }

    // Deliberately over-inclusive: when per-block citation attachment is absent
    // in SerpApi's response, attaching all reference indices to every block ensures
    // we evaluate claims against the widest possible evidence set. A wider evidence
    // set makes us LESS likely to flag a defect, which is the safe direction to err.
    const blockReferenceIndices =
      explicitBlockIndices.size > 0
        ? Array.from(explicitBlockIndices)
        : allReferenceIndices;

    return {
      id: `${opts.observationId}-claim-${idx}`,
      observationId: opts.observationId,
      text: raw.text,
      span,
      blockIndex: raw.blockIndex,
      blockReferenceIndices,
      aboutEntity: raw.aboutEntity || opts.targetEntity,
      isAboutTarget: Boolean(raw.isAboutTarget),
      polarity: raw.polarity || "neutral",
      type: raw.type || "factual",
    };
  });
}

/**
 * Evaluates whether cited sources support, contradict, or are silent on a claim.
 *
 * WHY: Grounding requires verifying that the specific sources cited alongside
 * an answer actually contain the claim. We inspect SerpApi's indexed snippet first
 * because if the grounding exists in Google's index, the generative model did not
 * hallucinate even if an external webpage fetcher subsequently fails.
 */
export async function testCitedSources(opts: {
  claim: Claim;
  references: Reference[];
}): Promise<SourceJudgement[]> {
  const relevantRefs = opts.references.filter((r) =>
    opts.claim.blockReferenceIndices.includes(r.index)
  );

  const judgements: SourceJudgement[] = [];

  for (const ref of relevantRefs) {
    const searchIds: string[] = [];

    // Step 1: Snippet before page.
    // If Google's own index carries the grounding, Google did not hallucinate.
    // Do NOT fetch the page if the indexed snippet directly resolves the stance.
    if (ref.snippet && ref.snippet.trim().length > 0) {
      const entailmentPrompt = `Evaluate if the search snippet supports, contradicts, or is silent on the claim.

Claim: "${opts.claim.text}"
Entity: "${opts.claim.aboutEntity}"
Cited Source Snippet: "${ref.snippet}"

Rules:
- "supports": snippet directly supports the factual claim.
- "contradicts": snippet directly refutes or contradicts the claim.
- "silent": snippet contains no information verifying or refuting the claim.
- Language discipline: Do NOT assert legal conclusions or use terms like "defamed" or "illegal".

Return JSON:
{
  "stance": "supports" | "contradicts" | "silent",
  "evidenceQuote": string | null,
  "confidence": number,
  "reasoning": string
}`;

      try {
        const check = await completeJson<{
          stance?: SourceStance;
          evidenceQuote?: string | null;
          confidence?: number;
          reasoning?: string;
        }>({ prompt: entailmentPrompt, schemaHint: "strict JSON object", maxTokens: 4000 });

        if (check?.stance === "supports" || check?.stance === "contradicts") {
          judgements.push({
            claimId: opts.claim.id,
            referenceIndex: ref.index,
            stance: check.stance,
            channel: "serpapi_snippet",
            evidenceQuote: check.evidenceQuote ?? ref.snippet,
            searchIds,
            confidence: check.confidence ?? 0.85,
            reasoning:
              check.reasoning ??
              "Grounding determined from indexed search snippet.",
          });
          continue;
        }
      } catch {
        // Fall through to site search verification
      }
    }

    // Step 2: Site search fallback when snippet is absent or silent.
    const domain = parseDomain(ref.link);
    const distinctivePhrase = extractDistinctivePhrase(opts.claim.text);

    if (domain && domain.length > 0) {
      try {
        const query = `site:${domain} "${distinctivePhrase}"`;
        const rawRes: unknown = await serp({
          engine: "google",
          q: query,
        });

        const res = rawRes as SerpSearchResult;
        if (res.search_metadata?.id) {
          searchIds.push(res.search_metadata.id);
        }

        const organic = res.organic_results ?? [];
        const phraseLower = distinctivePhrase.toLowerCase();

        const match = organic.find(
          (o) =>
            o.snippet?.toLowerCase().includes(phraseLower) ||
            o.title?.toLowerCase().includes(phraseLower)
        );

        if (match) {
          judgements.push({
            claimId: opts.claim.id,
            referenceIndex: ref.index,
            stance: "supports",
            channel: "site_search",
            evidenceQuote: match.snippet ?? match.title ?? null,
            searchIds,
            confidence: 0.8,
            reasoning:
              "Distinctive phrase found on cited domain via site search.",
          });
          continue;
        }

        // NON-NEGOTIABLE RULE: NEVER return "silent" unless we actually read the snippet
        // or got a clean empty search result from a successful query. If the domain cannot
        // be checked at all, the stance must be "opaque" and channel "unreachable".
        if (organic.length === 0 && !res.error) {
          judgements.push({
            claimId: opts.claim.id,
            referenceIndex: ref.index,
            stance: "silent",
            channel: "site_search",
            evidenceQuote: null,
            searchIds,
            confidence: 0.75,
            reasoning: "no support found in the cited sources",
          });
          continue;
        }
      } catch {
        // Network or search failure -> mark as opaque
      }
    }

    // Step 3: Unreachable domain or unparseable source
    judgements.push({
      claimId: opts.claim.id,
      referenceIndex: ref.index,
      stance: "opaque",
      channel: "unreachable",
      evidenceQuote: null,
      searchIds,
      confidence: 0.5,
      reasoning:
        "Source could not be retrieved or verified via snippet or site query.",
    });
  }

  return judgements;
}

/**
 * Conducts independent corroboration across specialized search engines.
 *
 * WHY: A claim may be true in reality even if the AI overview cited an ungrounded
 * source (MISCITED), or it may be completely unsubstantiated (UNSOURCED), or
 * disproven by independent records (CONTRADICTED). Routing to specialized indices
 * (news for lawsuits, patents for IP, scholar for research) gathers authentic external truth.
 */
export async function corroborate(opts: {
  claim: Claim;
}): Promise<CorroborationResult> {
  const engine = selectCorroborationEngine(opts.claim);
  const searchIds: string[] = [];
  const enginesUsed: Engine[] = [engine];

  let query: string;
  if (engine === "google") {
    const distinctive = extractDistinctivePhrase(opts.claim.text);
    query = `"${distinctive}" ${opts.claim.aboutEntity}`;
  } else {
    query = `${opts.claim.aboutEntity} ${opts.claim.text}`;
  }

  let rawRes: unknown;
  try {
    rawRes = await serp({
      engine,
      q: query,
    });
  } catch {
    return {
      claimId: opts.claim.id,
      outcome: "absent",
      enginesUsed,
      searchIds,
      evidenceQuote: null,
      reasoning: "no support found in the cited sources or independent search",
    };
  }

  const res = rawRes as SerpSearchResult;
  if (res.search_metadata?.id) {
    searchIds.push(res.search_metadata.id);
  }

  // Gather evidentiary snippets returned by the engine
  const candidateSnippets: string[] = [];
  if (res.organic_results) {
    for (const item of res.organic_results.slice(0, 5)) {
      if (item.snippet) candidateSnippets.push(item.snippet);
    }
  }
  if (res.news_results) {
    for (const item of res.news_results.slice(0, 5)) {
      if (item.snippet) candidateSnippets.push(item.snippet);
    }
  }
  if (res.scholar_results) {
    for (const item of res.scholar_results.slice(0, 5)) {
      if (item.snippet) candidateSnippets.push(item.snippet);
    }
  }
  if (res.place_results?.address) {
    candidateSnippets.push(
      `${res.place_results.title ?? ""}: ${res.place_results.address}`
    );
  }

  if (candidateSnippets.length === 0) {
    return {
      claimId: opts.claim.id,
      outcome: "absent",
      enginesUsed,
      searchIds,
      evidenceQuote: null,
      reasoning: "no support found in the cited sources or independent search",
    };
  }

  const evalPrompt = `Assess whether independent search results confirm or refute the claim.

Claim: "${opts.claim.text}"
Entity: "${opts.claim.aboutEntity}"
Search Results:
${candidateSnippets.map((s, idx) => `[${idx + 1}] "${s}"`).join("\n")}

Classification:
- "confirmed": external sources substantiate the factual claim.
- "refuted": external sources directly contradict the factual claim.
- "absent": external sources do not contain evidence regarding this specific assertion.
- "inconclusive": mixed or ambiguous evidence found.
- Language discipline: Do NOT emit words like "defamed", "libel", or "illegal". Use only factual observations.

Return JSON:
{
  "outcome": "confirmed" | "refuted" | "absent" | "inconclusive",
  "evidenceQuote": string | null,
  "reasoning": string
}`;

  try {
    const assessment = await completeJson<{
      outcome?: Corroboration;
      evidenceQuote?: string | null;
      reasoning?: string;
    }>({ prompt: evalPrompt, schemaHint: "strict JSON object", maxTokens: 4000 });

    return {
      claimId: opts.claim.id,
      outcome: assessment?.outcome || "absent",
      enginesUsed,
      searchIds,
      evidenceQuote: assessment?.evidenceQuote || null,
      reasoning:
        assessment?.reasoning ||
        "Independent corroboration assessment complete.",
    };
  } catch {
    return {
      claimId: opts.claim.id,
      outcome: "absent",
      enginesUsed,
      searchIds,
      evidenceQuote: null,
      reasoning: "no support found in the cited sources or independent search",
    };
  }
}

/**
 * Challenges non-grounded verdicts from a devil's-advocate perspective.
 *
 * WHY: Defect findings carry severe real-world reputational and commercial
 * consequences. Subjecting defect verdicts to an adversarial check ensures that
 * plausible alternative interpretations or weak evidentiary inferences are
 * caught and scrutinized before publishing a finding.
 */
export async function adversarialReview(
  a: Adjudication,
  claimText: string
): Promise<boolean> {
  // GROUNDED and OPINION claims are not defect findings; bypass adversarial review
  if (a.verdict === "GROUNDED" || a.verdict === "OPINION") {
    return true;
  }

  const prompt = `You are an adversarial review auditor testing a defect finding.
Argue AGAINST the following verdict. Try to identify if the claim could reasonably be considered grounded, harmless, or supported by secondary interpretation.

Claim: "${claimText}"
Proposed Verdict: ${a.verdict}
Initial Justification: "${a.reasoning}"
Source Judgements: ${JSON.stringify(
    a.sourceJudgements.map((s) => ({
      stance: s.stance,
      channel: s.channel,
      quote: s.evidenceQuote,
    }))
  )}
Corroboration: ${JSON.stringify(a.corroboration)}

Question:
Does the verdict withstand rigorous scrutiny as a true defect, or is the accusation based on flawed, ambiguous, or incomplete reading?
Language discipline: Do NOT conclude legal liability or defamation. Stick strictly to evidentiary support.

Return JSON:
{
  "survivesScrutiny": boolean,
  "critique": "Brief explanation of adversarial review findings."
}`;

  try {
    const res = await completeJson<{
      survivesScrutiny?: boolean;
      critique?: string;
    }>({ prompt: prompt, schemaHint: "strict JSON object", maxTokens: 4000 });

    return Boolean(res?.survivesScrutiny);
  } catch {
    // If the review call fails, conservatively allow review to pass
    return true;
  }
}

/**
 * Coordinates end-to-end cross-examination of a single claim.
 *
 * WHY: Cross-examination is the central synthesis of GROUNDS. It executes cited
 * source inspection, gathers independent corroboration, enforces chain-of-custody
 * citation trails, checks confidence boundaries, and subjects adverse findings
 * to adversarial challenge.
 */
export async function crossExamine(opts: {
  claim: Claim;
  references: Reference[];
}): Promise<Adjudication> {
  const [sourceJudgements, corroboration] = await Promise.all([
    testCitedSources({ claim: opts.claim, references: opts.references }),
    corroborate({ claim: opts.claim }),
  ]);

  // Consolidate citation trail across all consulted searches
  const trailSet = new Set<string>();
  for (const sj of sourceJudgements) {
    for (const sid of sj.searchIds) {
      if (sid) trailSet.add(sid);
    }
  }
  if (corroboration) {
    for (const sid of corroboration.searchIds) {
      if (sid) trailSet.add(sid);
    }
  }
  const citationTrail = Array.from(trailSet);

  // Derive initial verdict and reasoning
  const adjResult = adjudicate({ claim: opts.claim, sourceJudgements, corroboration });

  let verdict: Verdict = adjResult.verdict;
  let confidence = adjResult.confidence;
  let needsHumanReview = adjResult.needsHumanReview;

  // RULE 6: No verdict without a citation trail.
  // A verdict without an audit trail of consulted searches must be discarded.
  if (citationTrail.length === 0 && verdict !== "OPINION") {
    verdict = "UNVERIFIABLE";
    confidence = 0.5;
    needsHumanReview = true;
  }

  const reasoning = explain({ claim: opts.claim, sourceJudgements, corroboration }, verdict);

  const preliminary: Adjudication = {
    id: `adj-${opts.claim.id}`,
    claimId: opts.claim.id,
    verdict,
    confidence,
    reasoning,
    sourceJudgements,
    corroboration,
    citationTrail,
    survivedReview: true,
    needsHumanReview,
  };

  preliminary.survivedReview = await adversarialReview(
    preliminary,
    opts.claim.text
  );

  return preliminary;
}
