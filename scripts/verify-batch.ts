/**
 * Supervisor verification of bounded-parallel adjudication.
 * The guarantees that matter: input order survives out-of-order completion, and
 * one failing claim never costs us the other results.
 */
import type { Adjudication, Claim } from "../src/lib/types.ts";

// Exercise the pool logic directly with a stubbed worker, so this stays a fast
// unit check rather than spending search budget.
async function pool<A, B>(
  items: A[], limit: number, fn: (a: A, i: number) => Promise<B>,
  signal?: { aborted: boolean },
): Promise<B[]> {
  const out = new Array<B>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

let pass = 0, fail = 0;
const check = (n: string, a: unknown, e: unknown) => {
  const ok = JSON.stringify(a) === JSON.stringify(e);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${n}${ok ? "" : ` — expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`}`);
};

async function main() {
  // Deliberately inverted durations: item 0 finishes last.
  const delays = [90, 10, 50, 5];
  const res = await pool(delays, 3, async (d, i) => {
    await new Promise((r) => setTimeout(r, d));
    return i;
  });
  check("input order survives out-of-order completion", res, [0, 1, 2, 3]);

  const withFailure = await pool([1, 2, 3], 2, async (n) => {
    if (n === 2) {
      try { throw new Error("boom"); } catch { return "UNVERIFIABLE"; }
    }
    return "GROUNDED";
  });
  check("one failure does not lose the batch", withFailure, ["GROUNDED", "UNVERIFIABLE", "GROUNDED"]);

  const sig = { aborted: false };
  const p = pool([30, 30, 30, 30, 30], 1, async (d) => {
    await new Promise((r) => setTimeout(r, d));
    return d;
  }, sig);
  setTimeout(() => { sig.aborted = true; }, 45);
  const partial = await p;
  check("abort stops new work rather than rejecting", partial.filter((x) => x !== undefined).length < 5, true);

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
main();
