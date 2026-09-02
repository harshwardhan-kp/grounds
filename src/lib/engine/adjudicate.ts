import {
  Claim,
  SourceJudgement,
  CorroborationResult,
  Verdict,
  ClaimCluster,
  GroundsScore,
} from "@/lib/types";

export interface AdjudicationInput {
  claim: Pick<Claim, "polarity" | "type" | "isAboutTarget">;
  sourceJudgements: SourceJudgement[]; // one per cited reference on the BLOCK
  corroboration: CorroborationResult | null;
  /** true when the corroborating evidence is newer than every supporting source */
  newerEvidenceContradicts?: boolean;
}

export interface AdjudicationOutcome {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  needsHumanReview: boolean;
}

/**
 * Pure decision core of GROUNDS.
 * Evaluates claims deterministically following a strict precedence order.
 */
export function adjudicate(input: AdjudicationInput): AdjudicationOutcome {
  const { claim, sourceJudgements, corroboration, newerEvidenceContradicts } = input;
  const readableJudgements = sourceJudgements.filter((j) => j.stance !== "opaque");

  let verdict: Verdict;

  // Rule (a): Opinions and predictions cannot be falsified against factual sources;
  // they are subjective assertions excluded from defect scoring.
  if (claim.type === "opinion" || claim.type === "prediction") {
    verdict = "OPINION";
  }
  // Rule (b): If no citations exist or all cited sources were unreachable/paywalled/opaque,
  // we lack evidence to evaluate grounding. A fetch failure must never become an accusation (Rule #3).
  else if (
    sourceJudgements.length === 0 ||
    sourceJudgements.every((j) => j.stance === "opaque")
  ) {
    verdict = "UNVERIFIABLE";
  }
  // Rule (c): If independent corroboration confirms the assertion is true, but it is not about
  // the target entity, Google conflated the target with another entity (e.g. from the collision set).
  else if (!claim.isAboutTarget && corroboration?.outcome === "confirmed") {
    verdict = "CONFLATED";
  }
  // Rule (d): Independent authoritative sources refute the claim. Factual external contradiction
  // overrides what the cited pages stated or omitted.
  else if (corroboration?.outcome === "refuted") {
    verdict = "CONTRADICTED";
  }
  // Rule (e): Cited sources supported the assertion when published, but newer subsequent evidence
  // refutes it. The model repeated obsolete information superseded by subsequent events.
  else if (
    sourceJudgements.some((j) => j.stance === "supports") &&
    Boolean(newerEvidenceContradicts)
  ) {
    verdict = "STALE";
  }
  // Rule (f): At least one cited source on the containing block directly supports the claim,
  // and no refuting or newer contrary evidence was found. The answer is grounded in its citations.
  else if (sourceJudgements.some((j) => j.stance === "supports")) {
    verdict = "GROUNDED";
  }
  // Rule (g): The claim is factually true per corroboration, but every readable cited source on the
  // block is silent or contradicts it. The statement is accurate, but the citations are misattributed.
  else if (
    readableJudgements.length > 0 &&
    readableJudgements.every((j) => j.stance === "silent" || j.stance === "contradicts") &&
    corroboration?.outcome === "confirmed"
  ) {
    verdict = "MISCITED";
  }
  // Rule (h): Every readable cited source on the block is silent and independent search found no
  // corroborating evidence anywhere. This is an ungrounded, unverified assertion.
  else if (
    readableJudgements.length > 0 &&
    readableJudgements.every((j) => j.stance === "silent") &&
    corroboration?.outcome === "absent"
  ) {
    verdict = "UNSOURCED";
  }
  // Rule (i): Fallback for incomplete, inconclusive, or ambiguous evidence states.
  // In dubio pro reo: ambiguity must never trigger an accusation of defect.
  else {
    verdict = "UNVERIFIABLE";
  }

  const confidence = confidenceFor(input, verdict);
  const reasoning = explain(input, verdict);
  const needsHumanReview = needsReview(verdict, confidence, input);

  return {
    verdict,
    confidence,
    reasoning,
    needsHumanReview,
  };
}

/**
 * Computes a confidence score in the range [0, 1] for an adjudication.
 *
 * Weighting model:
 * - Base confidence: 1.0 (for OPINION: 1.0, purely classification-based).
 * - Source volume penalty:
 *   - 0 sources: -0.35 (absence of citations leaves no ground for verification)
 *   - 1 source:  -0.15 (single citation offers no block-level redundancy)
 *   - 2 sources: -0.05 (acceptable redundancy)
 *   - 3+ sources: 0.00 (robust citation coverage)
 * - Opaque source penalty:
 *   - -0.20 if any cited reference is opaque (paywalled, blocked, or unparseable),
 *     introducing uncertainty regarding potential unobserved support.
 * - Corroboration penalty:
 *   - -0.20 if corroboration was executed but yielded "inconclusive".
 *   - -0.10 if corroboration is null (unperformed), except for OPINION.
 * - Source confidence adjustment:
 *   - Deducts up to -0.15 based on (1 - averageSourceConfidence) across readable sources.
 *
 * The final score is clamped to [0, 1] and rounded to two decimal places.
 */
export function confidenceFor(input: AdjudicationInput, verdict: Verdict): number {
  if (verdict === "OPINION") {
    return 1.0;
  }

  let score = 1.0;
  const sources = input.sourceJudgements;

  // 1. Source volume penalty
  if (sources.length === 0) {
    score -= 0.35;
  } else if (sources.length === 1) {
    score -= 0.15;
  } else if (sources.length === 2) {
    score -= 0.05;
  }

  // 2. Opaque source penalty
  if (sources.some((j) => j.stance === "opaque")) {
    score -= 0.20;
  }

  // 3. Corroboration penalty
  if (input.corroboration?.outcome === "inconclusive") {
    score -= 0.20;
  } else if (input.corroboration === null) {
    score -= 0.10;
  }

  // 4. Source confidence adjustment
  const readable = sources.filter((j) => j.stance !== "opaque");
  if (readable.length > 0) {
    const avgConfidence =
      readable.reduce((acc, j) => acc + j.confidence, 0) / readable.length;
    score -= (1 - avgConfidence) * 0.15;
  }

  return Math.max(0, Math.min(1, Math.round(score * 100) / 100));
}

/**
 * Determines whether an adjudication should be flagged for human review.
 * Biases toward under-reporting to prevent false accusations.
 *
 * True when:
 * - A defect verdict has confidence < 0.75, OR
 * - Any cited source is opaque and the verdict is a defect.
 */
export function needsReview(
  verdict: Verdict,
  confidence: number,
  input: AdjudicationInput
): boolean {
  const isDefect =
    verdict === "MISCITED" ||
    verdict === "UNSOURCED" ||
    verdict === "CONTRADICTED" ||
    verdict === "STALE" ||
    verdict === "CONFLATED";

  if (!isDefect) {
    return false;
  }

  const hasOpaqueSource = input.sourceJudgements.some((j) => j.stance === "opaque");
  return confidence < 0.75 || hasOpaqueSource;
}

/**
 * Emits a factual, falsifiable explanation for the verdict including citation counts.
 * Strictly maintains language discipline: never emits legal conclusions or forbidden terms.
 */
export function explain(input: AdjudicationInput, verdict: Verdict): string {
  const total = input.sourceJudgements.length;
  const readable = input.sourceJudgements.filter((j) => j.stance !== "opaque").length;
  const opaque = input.sourceJudgements.filter((j) => j.stance === "opaque").length;
  const supporting = input.sourceJudgements.filter((j) => j.stance === "supports").length;

  const totalStr = `${total} source${total === 1 ? "" : "s"}`;
  const readableStr = `${readable} readable source${readable === 1 ? "" : "s"}`;

  switch (verdict) {
    case "OPINION":
      return `Claim is categorized as an ${input.claim.type}; subjective or forward-looking assertions are excluded from defect scoring.`;

    case "GROUNDED":
      return `Claim is supported by ${supporting} of ${totalStr} cited alongside it, with no contradicting real-world evidence.`;

    case "MISCITED":
      return `Independent search confirmed this claim, but no support was found in the ${readableStr} cited alongside it (${totalStr} total).`;

    case "UNSOURCED":
      return `No support for this claim was found in the ${readableStr} cited alongside it (${totalStr} total); independent search returned no corroboration.`;

    case "CONTRADICTED":
      return `Independent search refuted this claim across authoritative sources (${totalStr} cited).`;

    case "STALE":
      return `Claim was supported by ${supporting} of ${totalStr} cited, but newer subsequent evidence contradicts it.`;

    case "CONFLATED":
      return `Claim was confirmed by independent search but pertains to a different entity rather than the target company (${totalStr} cited).`;

    case "UNVERIFIABLE":
    default:
      if (total === 0) {
        return `No cited sources were provided for this block; claim could not be verified.`;
      }
      if (opaque > 0) {
        return `${opaque} of ${totalStr} could not be retrieved or parsed; claim cannot be verified without reading all cited sources.`;
      }
      return `Evidence across ${totalStr} and independent search remained inconclusive; claim cannot be verified.`;
  }
}

/**
 * Aggregates cluster-level findings into a GROUNDS forensic scorecard.
 *
 * Overall score starts at 100 and subtracts weighted penalties for each defect cluster:
 *   penalty = base(verdict) * harmFactor(polarity) * reach * frequency
 *   where reach = observedInLocales.length / (observedInLocales.length + absentInLocales.length)
 *
 * Base defect penalties:
 *   CONTRADICTED: 18, UNSOURCED: 15, MISCITED: 9, CONFLATED: 7, STALE: 5.
 *
 * Harm factors:
 *   adverse: 1.0, neutral: 0.5, positive: 0.3.
 *
 * Sub-scores:
 *   accuracy = 1 - (contradicted + unsourced) / totalScorable
 *   attributionIntegrity = grounded / (grounded + miscited + unsourced)
 *   consistency = 1 - inconsistentClusters / totalClusters
 *
 * All scores are returned as integers in the range [0, 100].
 * An audit with no clusters scores 100 on everything without NaN.
 */
export function scoreAudit(clusters: ClaimCluster[]): GroundsScore {
  if (clusters.length === 0) {
    return {
      overall: 100,
      accuracy: 100,
      attributionIntegrity: 100,
      consistency: 100,
    };
  }

  // 1. Overall penalty calculation
  let totalPenalty = 0;

  for (const cluster of clusters) {
    let base = 0;
    switch (cluster.verdict) {
      case "CONTRADICTED":
        base = 18;
        break;
      case "UNSOURCED":
        base = 15;
        break;
      case "MISCITED":
        base = 9;
        break;
      case "CONFLATED":
        base = 7;
        break;
      case "STALE":
        base = 5;
        break;
      default:
        base = 0;
        break;
    }

    if (base === 0) {
      continue;
    }

    let harmFactor = 0.5;
    if (cluster.polarity === "adverse") {
      harmFactor = 1.0;
    } else if (cluster.polarity === "neutral") {
      harmFactor = 0.5;
    } else if (cluster.polarity === "positive") {
      harmFactor = 0.3;
    }

    const totalLocales =
      cluster.observedInLocales.length + cluster.absentInLocales.length;
    const reach =
      totalLocales > 0
        ? cluster.observedInLocales.length / totalLocales
        : 1;

    const penalty = base * harmFactor * reach * cluster.frequency;
    totalPenalty += penalty;
  }

  const overall = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));

  // 2. Accuracy: share of factual (scorable) claims not contradicted or unsourced
  const scorableClusters = clusters.filter((c) => c.verdict !== "OPINION");
  const totalScorable = scorableClusters.length;
  const contradictedCount = clusters.filter((c) => c.verdict === "CONTRADICTED").length;
  const unsourcedCount = clusters.filter((c) => c.verdict === "UNSOURCED").length;

  const accuracy =
    totalScorable === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((1 - (contradictedCount + unsourcedCount) / totalScorable) * 100)
          )
        );

  // 3. Attribution integrity: grounded / (grounded + miscited + unsourced)
  const groundedCount = clusters.filter((c) => c.verdict === "GROUNDED").length;
  const miscitedCount = clusters.filter((c) => c.verdict === "MISCITED").length;
  const attributionDenominator = groundedCount + miscitedCount + unsourcedCount;

  const attributionIntegrity =
    attributionDenominator === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((groundedCount / attributionDenominator) * 100)
          )
        );

  // 4. Consistency: 1 - inconsistentClusters / totalClusters
  const inconsistentCount = clusters.filter((c) => c.inconsistent).length;
  const totalClusters = clusters.length;

  const consistency =
    totalClusters === 0
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((1 - inconsistentCount / totalClusters) * 100)
          )
        );

  return {
    overall,
    accuracy,
    attributionIntegrity,
    consistency,
  };
}
