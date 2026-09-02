/**
 * Supervisor verification of the LLM gateway against the live muse endpoint.
 * Confirms that redacted_thinking blocks are filtered and JSON mode parses.
 */
import * as fs from "node:fs";
import { complete, completeJson, isLLMConfigured } from "../src/lib/engine/llm.ts";

for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) process.env[m[1]] = m[2];
}

async function main() {
  console.log("configured:", isLLMConfigured());
  const t = await complete({ prompt: "Reply with exactly: GATEWAY_OK", maxTokens: 2000 });
  console.log("complete() ->", JSON.stringify(t.trim()));
  const j = await completeJson<{ claims: string[] }>({
  prompt: 'Split into atomic claims: "Acme was founded in 1998 and is licensed in Ohio."',
  schemaHint: '{"claims": string[]}',
  maxTokens: 3000,
});
  console.log("completeJson() ->", JSON.stringify(j));
}

main().catch((e) => { console.error("FAILED:", e); process.exit(1); });
