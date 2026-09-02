/**
 * Capture a real observation and write it to fixtures/live-capture.json.
 *
 * Why this exists: the recorded dossier is illustrative, so its search ids are
 * synthetic and "Verify against archive" correctly reports UNAVAILABLE. That is
 * honest but it is a poor demonstration of the one claim that distinguishes
 * GROUNDS — that a finding can be re-verified against SerpApi's own record.
 *
 * This captures a genuine search so the archive check returns MATCH against a
 * real third-party record. Re-run it to refresh the demo; archives expire after
 * 31 days.
 *
 *   npx tsx scripts/capture-observation.ts "<query>" ["<location>"]
 */

import * as fs from "node:fs";
import { serp, BudgetLedger } from "../src/lib/serpapi/client.ts";
import { DEFAULT_LOCALES } from "../src/lib/locales.ts";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}

const QUERY = process.argv[2] ?? "is Wolf River Electric being sued";
const LOCATION = process.argv[3] ?? DEFAULT_LOCALES[0].location;

async function main() {
  const budget = new BudgetLedger(3);
  const params = {
    engine: "google_ai_mode",
    q: QUERY,
    location: LOCATION,
    gl: "us",
    hl: "en",
  };

  // noCache so we get a fresh archive record rather than replaying a cached one.
  const res = await serp(params, { budget, noCache: true });
  const data = res.data as Record<string, unknown>;

  const blocks = Array.isArray(data.text_blocks) ? data.text_blocks : [];
  const refs = Array.isArray(data.references) ? data.references : [];

  const capture = {
    capturedAt: res.capturedAt,
    query: QUERY,
    location: LOCATION,
    searchId: res.searchId,
    payloadHash: res.payloadHash,
    latencyMs: res.latencyMs,
    params: res.params,
    archiveUrl: res.searchId ? `https://serpapi.com/searches/${res.searchId}` : null,
    suppressed: blocks.length === 0,
    textBlocks: blocks.map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      return {
        type: typeof o.type === "string" ? o.type : "paragraph",
        snippet: typeof o.snippet === "string" ? o.snippet : "",
      };
    }),
    references: refs.map((r, i) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        index: typeof o.index === "number" ? o.index : i,
        title: typeof o.title === "string" ? o.title : "",
        link: typeof o.link === "string" ? o.link : "",
        snippet: typeof o.snippet === "string" ? o.snippet : null,
        source: typeof o.source === "string" ? o.source : null,
      };
    }),
    raw: data,
  };

  const out = new URL("../fixtures/live-capture.json", import.meta.url);
  fs.writeFileSync(out, JSON.stringify(capture, null, 2));

  console.log(`\ncaptured   : "${QUERY}"`);
  console.log(`location   : ${LOCATION}`);
  console.log(`searchId   : ${capture.searchId}`);
  console.log(`hash       : ${capture.payloadHash}`);
  console.log(`archive    : ${capture.archiveUrl}`);
  console.log(`blocks/refs: ${capture.textBlocks.length}/${capture.references.length}`);
  console.log(`suppressed : ${capture.suppressed}`);
  console.log(`\nwritten to fixtures/live-capture.json`);
  console.log(`searches spent: ${budget.spent}\n`);
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
