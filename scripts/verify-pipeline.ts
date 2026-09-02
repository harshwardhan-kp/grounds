/**
 * Supervisor end-to-end verification against LIVE search.
 *
 * Deliberately tiny: 1 probe x 1 locale x 1 engine, so a full run costs a handful
 * of searches out of a 250/month budget. The point is not coverage — it is proving
 * that depose -> decompose -> crossExamine actually composes against real payloads
 * rather than only typechecking.
 *
 *   npx tsx scripts/verify-pipeline.ts "<entity>" "<probe question>"
 */

import * as fs from "node:fs";
import { depose, DEFAULT_LOCALES, parseAiOverview } from "../src/lib/engine/deposition.ts";
import { decomposeClaims, crossExamine } from "../src/lib/engine/crossexam.ts";
import { BudgetLedger } from "../src/lib/serpapi/client.ts";
import type { Probe, Reference } from "../src/lib/types.ts";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}

const ENTITY = process.argv[2] ?? "Wolf River Electric";
const QUESTION = process.argv[3] ?? `is ${ENTITY} being sued`;

async function main() {
  const budget = new BudgetLedger(12);
  const probe: Probe = {
    id: "p1",
    auditId: "verify",
    query: QUESTION,
    family: "adverse",
    harmWeight: 1,
    enabled: true,
  };

  console.log(`\nentity   : ${ENTITY}`);
  console.log(`probe    : "${QUESTION}"`);
  console.log(`locale   : ${DEFAULT_LOCALES[0].label}\n`);

  console.log("— stage 2: deposition —");
  const observations = await depose({
    auditId: "verify",
    probes: [probe],
    locales: [DEFAULT_LOCALES[0]],
    engines: ["google_ai_mode"],
    budget,
    concurrency: 1,
    onEvent: (e) => {
      if (e.kind === "log") console.log("  " + e.line);
      if (e.kind === "error") console.log("  ERROR: " + e.message);
    },
  });

  console.log(`  observations: ${observations.length}`);
  const obs = observations[0];
  if (!obs) throw new Error("no observations returned");
  console.log(`  searchId    : ${obs.searchId}`);
  console.log(`  hash        : ${obs.payloadHash.slice(0, 24)}…`);
  console.log(`  latency     : ${obs.latencyMs}ms`);
  console.log(`  suppressed  : ${obs.suppressed}`);

  const parsed = parseAiOverview(obs.raw);
  const blocks = parsed.textBlocks ?? [];
  const refs: Reference[] = parsed.references ?? [];
  console.log(`  text_blocks : ${blocks.length}`);
  console.log(`  references  : ${refs.length}`);
  if (blocks.length === 0) {
    console.log("\n  Google returned no generative answer for this probe.");
    console.log("  That is a recorded observation, not a failure.\n");
    return;
  }

  console.log("\n— stage 3: claim decomposition —");
  const claims = await decomposeClaims({
    observationId: obs.id,
    textBlocks: blocks.map((b) => ({ type: b.type ?? "paragraph", snippet: b.snippet ?? "" })),
    references: refs,
    targetEntity: ENTITY,
    collisionSet: [],
  });
  console.log(`  atomic claims: ${claims.length}`);
  for (const c of claims.slice(0, 6)) {
    console.log(`   [${c.type}/${c.polarity}${c.isAboutTarget ? "" : "/other-entity"}] ${c.text.slice(0, 95)}`);
  }

  const factual = claims.filter((c) => c.type === "factual" && c.isAboutTarget);
  if (factual.length === 0) {
    console.log("\n  No factual claims about the target to adjudicate.\n");
    return;
  }

  console.log("\n— stage 4: cross-examination (first factual claim) —");
  const adj = await crossExamine({ claim: factual[0], references: refs, sourceSearchId: obs.searchId });
  console.log(`  claim    : ${factual[0].text.slice(0, 95)}`);
  console.log(`  verdict  : ${adj.verdict}`);
  console.log(`  confidence: ${adj.confidence}`);
  console.log(`  sources  : ${adj.sourceJudgements.map((s) => s.stance).join(", ") || "none"}`);
  console.log(`  corroboration: ${adj.corroboration?.outcome ?? "n/a"}`);
  console.log(`  trail    : ${adj.citationTrail.length} search ids`);
  console.log(`  review?  : ${adj.needsHumanReview}`);
  console.log(`  reasoning: ${adj.reasoning.slice(0, 220)}`);

  // The invariant that matters most: a published verdict must cite evidence.
  if (adj.citationTrail.length === 0 && adj.verdict !== "UNVERIFIABLE") {
    throw new Error("INVARIANT VIOLATED: verdict published with an empty citation trail");
  }

  console.log(`\nsearches spent: ${budget.spent}/${budget.limit}\n`);
}

main().catch((e) => {
  console.error("\nFAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
