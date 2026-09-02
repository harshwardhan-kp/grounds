/**
 * Supervisor verification of the adjudication decision core.
 *
 * These are not unit tests for coverage's sake. Each case encodes a rule that,
 * if broken, makes GROUNDS publish a confident false accusation — the single
 * worst failure mode this product has. Run with: npx tsx scripts/verify-adjudicator.ts
 */

import {
  adjudicate,
  scoreAudit,
  explain,
} from "../src/lib/engine/adjudicate.ts";
import type {
  SourceJudgement,
  CorroborationResult,
  ClaimCluster,
  Verdict,
} from "../src/lib/types.ts";

let pass = 0;
let fail = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}\n       expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function sj(stance: SourceJudgement["stance"], i = 0): SourceJudgement {
  return {
    claimId: "c1",
    referenceIndex: i,
    stance,
    channel: stance === "opaque" ? "unreachable" : "serpapi_snippet",
    evidenceQuote: stance === "supports" ? "the quoted supporting text" : null,
    searchIds: ["68b7c1f2a4e3d5b6c7891234"],
    confidence: 0.9,
    reasoning: "test fixture",
  };
}

function corr(outcome: CorroborationResult["outcome"]): CorroborationResult {
  return {
    claimId: "c1",
    outcome,
    enginesUsed: ["google_news"],
    searchIds: ["68b7c1f2a4e3d5b6c7891299"],
    evidenceQuote: null,
    reasoning: "test fixture",
  };
}

const factual = { polarity: "adverse", type: "factual", isAboutTarget: true } as const;

console.log("\nDecision table");

check(
  "all sources silent + no corroboration -> UNSOURCED (the hero finding)",
  adjudicate({ claim: factual, sourceJudgements: [sj("silent", 0), sj("silent", 1), sj("silent", 2), sj("silent", 3)], corroboration: corr("absent") }).verdict,
  "UNSOURCED",
);

check(
  "a supporting source -> GROUNDED",
  adjudicate({ claim: factual, sourceJudgements: [sj("silent", 0), sj("supports", 1)], corroboration: corr("confirmed") }).verdict,
  "GROUNDED",
);

check(
  "silent sources but independently confirmed -> MISCITED",
  adjudicate({ claim: factual, sourceJudgements: [sj("silent", 0), sj("silent", 1)], corroboration: corr("confirmed") }).verdict,
  "MISCITED",
);

check(
  "independently refuted -> CONTRADICTED",
  adjudicate({ claim: factual, sourceJudgements: [sj("silent", 0)], corroboration: corr("refuted") }).verdict,
  "CONTRADICTED",
);

check(
  "opinion is never a defect",
  adjudicate({ claim: { ...factual, type: "opinion" }, sourceJudgements: [sj("silent")], corroboration: corr("absent") }).verdict,
  "OPINION",
);

check(
  "claim about another entity + confirmed -> CONFLATED",
  adjudicate({ claim: { ...factual, isAboutTarget: false }, sourceJudgements: [sj("supports")], corroboration: corr("confirmed") }).verdict,
  "CONFLATED",
);

console.log("\nThe rule that prevents false accusations");

check(
  "ALL sources opaque -> UNVERIFIABLE, never UNSOURCED",
  adjudicate({ claim: factual, sourceJudgements: [sj("opaque", 0), sj("opaque", 1)], corroboration: corr("absent") }).verdict,
  "UNVERIFIABLE",
);

check(
  "no cited sources at all -> UNVERIFIABLE",
  adjudicate({ claim: factual, sourceJudgements: [], corroboration: corr("absent") }).verdict,
  "UNVERIFIABLE",
);

check(
  "opaque is EXCLUDED from the silent set, not counted as silent",
  adjudicate({ claim: factual, sourceJudgements: [sj("opaque", 0), sj("supports", 1)], corroboration: corr("confirmed") }).verdict,
  "GROUNDED",
);

const mixed = adjudicate({
  claim: factual,
  sourceJudgements: [sj("opaque", 0), sj("silent", 1)],
  corroboration: corr("absent"),
});
check("a defect with an unreadable source is flagged for human review", mixed.needsHumanReview, true);

console.log("\nLanguage discipline");

const banned = /defam|libel|illegal|slander/i;
const phrases: string[] = [];
for (const v of ["UNSOURCED", "MISCITED", "CONTRADICTED", "CONFLATED", "STALE", "UNVERIFIABLE"] as Verdict[]) {
  phrases.push(explain({ claim: factual, sourceJudgements: [sj("silent", 0), sj("silent", 1)], corroboration: corr("absent") }, v));
}
check("no explanation contains a legal conclusion", phrases.some((p) => banned.test(p)), false);

console.log("\nScoring");

check("an audit with no clusters scores 100, not NaN", scoreAudit([]), {
  overall: 100, accuracy: 100, attributionIntegrity: 100, consistency: 100,
});

const cluster = (verdict: Verdict, inconsistent = false): ClaimCluster => ({
  id: "cl1", auditId: "a1", canonicalText: "t", verdict, polarity: "adverse",
  observedInLocales: ["a", "b", "c", "d"], absentInLocales: ["e", "f", "g", "h"],
  enginesObserved: ["google_ai_mode"], frequency: 0.7, sampleCount: 10,
  inconsistent, memberClaimIds: ["c1"],
});

const scored = scoreAudit([cluster("UNSOURCED"), cluster("GROUNDED"), cluster("MISCITED", true)]);
console.log(`  score: ${JSON.stringify(scored)}`);
check("overall stays within 0..100", scored.overall >= 0 && scored.overall <= 100, true);
check("a defect audit does not score a clean 100", scored.overall < 100, true);
check("UNVERIFIABLE alone is not penalised", scoreAudit([cluster("UNVERIFIABLE")]).overall, 100);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
