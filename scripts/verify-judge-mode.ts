/**
 * Supervisor verification of demo protection.
 * A reviewer must never see an unhandled 429 from SerpApi part-way through a run.
 */
import { checkRateLimit, recordRun, clientKeyFrom } from "../src/lib/judge-mode.ts";

let pass = 0, fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
};

const ip = "203.0.113.7";
check("first run allowed", checkRateLimit(ip).allowed, true);
recordRun(ip);
recordRun(ip);
check("still allowed at 2 runs", checkRateLimit(ip).allowed, true);
recordRun(ip);
const blocked = checkRateLimit(ip);
check("blocked after 3 runs in the hour", blocked.allowed, false);
check("gives a retry-after", typeof blocked.retryAfterSeconds === "number", true);
check("reason mentions the recorded dossier", /dossier|recorded/i.test(blocked.reason ?? ""), true);
check("reason is non-technical (no status codes)", /429|rate.?limit|quota exceeded/i.test(blocked.reason ?? ""), false);

check("a different client is unaffected", checkRateLimit("198.51.100.2").allowed, true);

const req = new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" } });
check("clientKeyFrom takes the first forwarded entry", clientKeyFrom(req), "9.9.9.9");
check("clientKeyFrom never throws", clientKeyFrom(new Request("http://x")), "unknown");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
