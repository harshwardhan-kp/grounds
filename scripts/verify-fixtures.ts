/**
 * Supervisor verification of demo fixture integrity.
 *
 * The fixtures ARE the public demo — the deployment runs without a SerpApi key, so
 * everything a reviewer sees comes from here. A silent inconsistency (a locale id
 * that does not resolve, a cluster pointing at a missing claim) degrades the demo
 * without failing a typecheck, which is exactly how the St. Paul column ended up
 * rendering as "US-MN-STPAUL".
 */
import { WOLF_RIVER_FIXTURE } from "../fixtures/wolf-river.ts";
import { DEFAULT_LOCALES } from "../src/lib/locales.ts";
import { isDefect } from "../src/lib/types.ts";

let pass = 0, fail = 0;
const check = (n: string, a: unknown, e: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${ok ? "" : ` — expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`}`);
};

const f = WOLF_RIVER_FIXTURE;
const canon = new Set(DEFAULT_LOCALES.map((l) => l.id));
const claimIds = new Set(f.claims.map((c) => c.id));
const obsIds = new Set(f.observations.map((o) => o.id));

const localeIds = new Set<string>([
  ...f.observations.map((o) => o.localeId),
  ...f.clusters.flatMap((c) => [...c.observedInLocales, ...c.absentInLocales]),
  ...f.audit.locales.map((l) => l.id),
]);
check("every locale id resolves to a real locale", [...localeIds].filter((i) => !canon.has(i)), []);

check("every observation belongs to a real probe",
  f.observations.filter((o) => !f.probes.some((p) => p.id === o.probeId)).map((o) => o.id), []);
check("every claim belongs to a real observation",
  f.claims.filter((c) => !obsIds.has(c.observationId)).map((c) => c.id), []);
check("every adjudication points at a real claim",
  f.adjudications.filter((a) => !claimIds.has(a.claimId)).map((a) => a.claimId), []);
check("every cluster member is a real claim",
  f.clusters.flatMap((c) => c.memberClaimIds).filter((id) => !claimIds.has(id)), []);

check("no observation reuses a payload hash",
  f.observations.length - new Set(f.observations.map((o) => o.payloadHash)).size, 0);
check("every non-suppressed observation carries a search id",
  f.observations.filter((o) => !o.suppressed && !o.searchId).map((o) => o.id), []);

// The claim that distinguishes the product: a defect must carry its evidence trail.
check("every defect adjudication has a citation trail",
  f.adjudications.filter((a) => isDefect(a.verdict) && a.citationTrail.length === 0).map((a) => a.claimId), []);

// The rule that prevents false accusations, enforced in the demo data too.
check("no UNVERIFIABLE cluster is counted as a defect",
  f.clusters.filter((c) => c.verdict === "UNVERIFIABLE" && isDefect(c.verdict)).length, 0);

const verdicts = new Set(f.adjudications.map((a) => a.verdict));
check("the demo exercises all eight verdicts", verdicts.size, 8);

const BANNED = /defam|libel|slander|\billegal\b/i;
const prose = [
  ...f.adjudications.map((a) => a.reasoning),
  ...f.clusters.map((c) => c.canonicalText),
  ...f.claims.map((c) => c.text),
].join(" ");
check("fixture prose states no legal conclusion", BANNED.test(prose), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
