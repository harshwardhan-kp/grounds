/**
 * GROUNDS — Adjudication Engine
 *
 * Pure decision core for cross-examining generative search claims against
 * cited sources and independent corroboration.
 *
 * Deterministic: no I/O, no network, no LLM calls, no randomness.
 */

import {
  type Claim,
  type SourceJudgement,
  type CorroborationResult,
  type Verdict,
  type ClaimCluster,
  type GroundsScore,
  isDefect,
} from "@/lib/types";

export interface AdjudicationInput {
  claim: Pick<Claim, "polarity" | "type" | "isAboutTarget">;
  /** One per cited reference on the containing text block. */
  sourceJudgements: SourceJudgement[];
  corroboration: CorroborationResult | null;
  /** True when corroborating evidence is newer than every supporting source. */
  newerEvidenceContradicts?: boolean;
}

export interface AdjudicationOutcome {
  verdict: Verdict;
  confidence: number;
  reasoning: string;
  needsHumanReview: boolean;
}

/**
 * Evaluates the core decision table in strict precedence order.
 * Every rule branch includes the rationale for why that decision exists.
 */
function determineVerdict(input: AdjudicationInput): Verdict {
  const { claim, sourceJudgements, corroboration, newerEvidenceContradicts } =
    input;

  // Rule a: Opinions and forward-looking predictions cannot be falsified against
  // source citations; they are excluded from defect attribution.
  if (claim.type === "opinion" || claim.type === "prediction") {
    return "OPINION";
  }

  // Rule b: If no sources were provided or every cited source was unreachable/opaque
  // (paywalled, blocked, unparseable), the answer cannot be verified.
  // A fetch failure must NEVER be classified as unsourced or treated as a defect.
  if (
    sourceJudgements.length === 0 ||
    sourceJudgements.every((sj) => sj.stance === "opaque")
  ) {
    return "UNVERIFIABLE";
  }

  // "readable" = stance is not "opaque". Opaque sources are excluded from the
  // silent-set test to prevent uninspected sources from becoming false accusations.
  const readableJudgements = sourceJudgements.filter(
    (sj) => sj.stance !== "opaque"
  );

  // Rule c: The claim is verified as true by independent corroboration, but it pertains
  // to a different entity (e.g. from the collision set) rather than the target subject.
  // The generative engine conflated two distinct entities.
  if (!claim.isAboutTarget && corroboration?.outcome === "confirmed") {
    return "CONFLATED";
  }

  // Rule d: Independent search actively refutes the claim with contradicting evidence,
  // establishing that the claim does not align with verifiable facts.
  if (corroboration?.outcome === "refuted") {
    return "CONTRADICTED";
  }

  // Rule e: A cited source supported the claim at publication time, but newer corroborating
  // evidence proves the state of affairs has changed, rendering the assertion out of date.
  if (
    readableJudgements.some((sj) => sj.stance === "supports") &&
    Boolean(newerEvidenceContradicts)
  ) {
    return "STALE";
  }

  // Rule f: At least one readable cited source on the block directly supports the claim,
  // fulfilling attribution grounding.
  if (readableJudgements.some((sj) => sj.stance === "supports")) {
    return "GROUNDED";
  }

  // Rule g: Independent corroboration confirms the assertion is factually accurate, but
  // none of the readable cited sources support it (they are silent or contradictory).
  // The engine provided erroneous citations for a true fact.
  if (
    readableJudgements.length > 0 &&
    readableJudgements.every(
      (sj) => sj.stance === "silent" || sj.stance === "contradicts"
    ) &&
    corroboration?.outcome === "confirmed"
  ) {
    return "MISCITED";
  }

  // Rule h: All readable cited sources are silent AND independent corroboration found
  // no support (absent). Opaque sources are excluded and never counted as silent.
  if (
    readableJudgements.length > 0 &&
    readableJudgements.every((sj) => sj.stance === "silent") &&
    corroboration?.outcome === "absent"
  ) {
    return "UNSOURCED";
  }

  // Rule i: Any remaining permutation (such as inconclusive corroboration or mixed
  // uncorroborated stances) lacks definitive evidence and must remain unverifiable.
  return "UNVERIFIABLE";
}

/**
 * Adjudicates a claim against its cited block sources and independent corroboration.
 */
export function adjudicate(input: AdjudicationInput): AdjudicationOutcome {
  const verdict = determineVerdict(input);
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
 * Computes confidence score in [0..1] for an adjudication.
 *
 * Weighting rationale:
 * - Base confidence starts at 1.0 (or 0.95 for OPINION, where verdict is structural).
 * - Few sources penalty:
 *   - 0 sources:  -0.30 (no citation trail available)
 *   - 1 source:   -0.15 (single-source dependency; no cross-source redundancy)
 *   - 2 sources:  -0.05 (limited cross-source corroboration)
 *   - 3+ sources:  0.00 (adequate source diversity)
 * - Opaque sources penalty:
 *   - If any cited source is opaque: -0.20 (incomplete inspection of cited material)
 * - Corroboration status penalty:
 *   - corroboration?.outcome === "inconclusive": -0.20 (external search inconclusive)
 *   - corroboration === null:                     -0.10 (no external search performed)
 *   - outcome === "confirmed" | "refuted" | "absent": 0.00 (definitive signal)
 *
 * Final score is clamped to [0, 1] and rounded to two decimal places.
 */
export function confidenceFor(
  input: AdjudicationInput,
  verdict: Verdict
): number {
  if (verdict === "OPINION") {
    return 0.95;
  }

  let score = 1.0;

  const totalSources = input.sourceJudgements.length;
  if (totalSources === 0) {
    score -= 0.3;
  } else if (totalSources === 1) {
    score -= 0.15;
  } else if (totalSources === 2) {
    score -= 0.05;
  }

  const hasOpaque = input.sourceJudgements.some((sj) => sj.stance === "opaque");
  if (hasOpaque) {
    score -= 0.2;
  }

  if (!input.corroboration) {
    score -= 0.1;
  } else if (input.corroboration.outcome === "inconclusive") {
    score -= 0.2;
  }

  const clamped = Math.max(0, Math.min(1, score));
  return Number(clamped.toFixed(2));
}

/**
 * Flags borderline or risky defect verdicts for operator review.
 * GROUNDS biases toward under-reporting: a defect with low confidence (< 0.75)
 * or based on an incomplete evidence set (any opaque source) must not be
 * published without human confirmation.
 */
export function needsReview(
  verdict: Verdict,
  confidence: number,
  input: AdjudicationInput
): boolean {
  if (!isDefect(verdict)) {
    return false;
  }

  if (confidence < 0.75) {
    return true;
  }

  const hasOpaque = input.sourceJudgements.some((sj) => sj.stance === "opaque");
  if (hasOpaque) {
    return true;
  }

  return false;
}

/**
 * Generates a strictly factual, falsifiable explanation of the verdict.
 * Adheres to strict language discipline: never emits legal conclusions or defamatory terms.
 */
export function explain(input: AdjudicationInput, verdict: Verdict): string {
  const total = input.sourceJudgements.length;
  const readable = input.sourceJudgements.filter((sj) => sj.stance !== "opaque");
  const supporting = input.sourceJudgements.filter(
    (sj) => sj.stance === "supports"
  );
  const contradictory = input.sourceJudgements.filter(
    (sj) => sj.stance === "contradicts"
  );
  const silent = input.sourceJudgements.filter((sj) => sj.stance === "silent");
  const opaque = input.sourceJudgements.filter((sj) => sj.stance === "opaque");

  switch (verdict) {
    case "OPINION":
      return `Claim represents a subjective ${input.claim.type} rather than an empirical factual assertion.`;

    case "GROUNDED":
      return `Found support for this claim in ${supporting.length} of ${total} source${total === 1 ? "" : "s"} cited alongside it.`;

    case "STALE":
      return `Claim was supported by ${supporting.length} of ${total} cited source${total === 1 ? "" : "s"}, but newer corroborating evidence demonstrates it is outdated.`;

    case "CONTRADICTED":
      return `Independent search returned refuting evidence contradicting this claim.`;

    case "CONFLATED":
      return `Claim was corroborated by independent search, but pertains to an entity other than the target.`;

    case "MISCITED":
      return `Claim was corroborated by independent search, but no support was found in the ${readable.length} readable source${readable.length === 1 ? "" : "s"} cited alongside it (${silent.length} silent, ${contradictory.length} contradictory).`;

    case "UNSOURCED":
      if (opaque.length > 0) {
        return `No support for this claim was found in the ${readable.length} readable source${readable.length === 1 ? "" : "s"} cited alongside it (${opaque.length} unreadable); independent search returned no corroboration.`;
      }
      return `No support for this claim was found in the ${total} source${total === 1 ? "" : "s"} cited alongside it; independent search returned no corroboration.`;

    case "UNVERIFIABLE":
    default:
      if (total === 0) {
        return `No sources were cited alongside this claim, and independent corroboration was inconclusive or absent.`;
      }
      if (opaque.length === total) {
        return `All ${total} cited source${total === 1 ? "" : "s"} were unreadable (paywalled, blocked, or unreachable); unable to evaluate grounding without reading cited text.`;
      }
      return `Could not verify claim: ${opaque.length} of ${total} cited source${total === 1 ? "" : "s"} were unreadable and independent corroboration was inconclusive.`;
  }
}

/**
 * Computes aggregate GroundsScore metrics for an audit across all claim clusters.
 * Returns four integer scores between 0 and 100.
 * Handles zero-cluster audits without NaN by returning 100 for all metrics.
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
        : 1.0;

    const penalty = base * harmFactor * reach * cluster.frequency;
    totalPenalty += penalty;
  }

  const overall = Math.round(Math.max(0, Math.min(100, 100 - totalPenalty)));

  // accuracy = 1 - (contradicted + unsourced) / totalScorable
  // OPINION verdicts are excluded from factual defect scoring.
  const scorableClusters = clusters.filter((c) => c.verdict !== "OPINION");
  const totalScorable = scorableClusters.length;
  let accuracy = 100;
  if (totalScorable > 0) {
    const contradicted = clusters.filter(
      (c) => c.verdict === "CONTRADICTED"
    ).length;
    const unsourced = clusters.filter((c) => c.verdict === "UNSOURCED").length;
    const errorShare = (contradicted + unsourced) / totalScorable;
    accuracy = Math.round(Math.max(0, Math.min(1, 1 - errorShare)) * 100);
  }

  // attributionIntegrity = grounded / (grounded + miscited + unsourced)
  const grounded = clusters.filter((c) => c.verdict === "GROUNDED").length;
  const miscited = clusters.filter((c) => c.verdict === "MISCITED").length;
  const unsourced = clusters.filter((c) => c.verdict === "UNSOURCED").length;
  const attributionDenominator = grounded + miscited + unsourced;
  let attributionIntegrity = 100;
  if (attributionDenominator > 0) {
    const ratio = grounded / attributionDenominator;
    attributionIntegrity = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  }

  // consistency = 1 - inconsistentClusters / totalClusters
  const inconsistentClusters = clusters.filter((c) => c.inconsistent).length;
  const totalClusters = clusters.length;
  const consistencyRatio = 1 - inconsistentClusters / totalClusters;
  const consistency = Math.round(
    Math.max(0, Math.min(1, consistencyRatio)) * 100
  );

  return {
    overall,
    accuracy,
    attributionIntegrity,
    consistency,
  };
}
