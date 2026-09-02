/**
 * Supervisor verification of the remediation stage.
 * Two rules carry legal weight: an unverifiable finding must never generate an
 * action, and no generated text may state a legal conclusion.
 */
import * as fs from "node:fs";
import { proposeRemedies, sortRemedies } from "../src/lib/engine/remediation.ts";
import type { Adjudication, ClaimCluster, Remedy, Verdict } from "../src/lib/types.ts";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}

let pass = 0, fail = 0;
const check = (n: string, a: unknown, e: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${ok ? "" : ` — expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`}`);
};

const cluster = (verdict: Verdict): ClaimCluster => ({
  id: "cl", auditId: "a", canonicalText: "The company is subject to a state enforcement action.",
  verdict, polarity: "adverse", observedInLocales: ["a", "b"], absentInLocales: ["c", "d"],
  enginesObserved: ["google_ai_mode"], frequency: 0.6, sampleCount: 10,
  inconsistent: false, memberClaimIds: ["c1"],
});
const adj = (verdict: Verdict): Adjudication => ({
  id: "adj", claimId: "c1", verdict, confidence: 0.9, reasoning: "test",
  sourceJudgements: [], corroboration: null, citationTrail: ["68b7c1f2a4e3d5b6c7891234"],
  survivedReview: true, needsHumanReview: false,
});

const BANNED = /defam|libel|illegal|slander|false statement/i;

async function main() {
  const unver = await proposeRemedies({
    entityName: "Acme Solar", cluster: cluster("UNVERIFIABLE"),
    adjudication: adj("UNVERIFIABLE"), pivot: null,
  });
  check("UNVERIFIABLE produces no remedy at all", unver.length, 0);

  const grounded = await proposeRemedies({
    entityName: "Acme Solar", cluster: cluster("GROUNDED"),
    adjudication: adj("GROUNDED"), pivot: null,
  });
  check("GROUNDED produces no remedy", grounded.length, 0);

  const all: Remedy[] = [];
  for (const v of ["UNSOURCED", "CONTRADICTED", "CONFLATED", "STALE"] as Verdict[]) {
    const rs = await proposeRemedies({
      entityName: "Acme Solar", cluster: cluster(v), adjudication: adj(v), pivot: null,
    });
    console.log(`     ${v}: ${rs.map((r) => r.kind).join(", ") || "(none)"}`);
    check(`${v} produces at least one remedy`, rs.length > 0, true);
    all.push(...rs);
  }

  const offending = all.filter((r) => BANNED.test(r.draft) || BANNED.test(r.rationale) || BANNED.test(r.title));
  if (offending.length) console.log("     offending:", offending.map((o) => o.kind));
  check("no generated text states a legal conclusion", offending.length, 0);

  const sorted = sortRemedies([
    { kind: "counter_content", title: "b", rationale: "", draft: "", effort: "high", priority: 10 },
    { kind: "correction_request", title: "a", rationale: "", draft: "", effort: "low", priority: 90 },
    { kind: "profile_fix", title: "c", rationale: "", draft: "", effort: "low", priority: 90 },
  ]);
  check("sorted by priority desc then effort asc", sorted.map((r) => r.title), ["a", "c", "b"]);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
