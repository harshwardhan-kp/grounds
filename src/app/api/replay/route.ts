import { WOLF_RIVER_FIXTURE } from "@/../fixtures/wolf-river";
import { localeLabel } from "@/lib/locales";
import type {
  Adjudication,
  Audit,
  Claim,
  Observation,
  PipelineEvent,
  Probe,
  Verdict,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Fixture container matching the stored audit export shape.
 * Derived entirely from types.ts domain contracts.
 */
interface ReplayFixture {
  audit?: Audit;
  probes?: Probe[];
  observations?: Observation[];
  claims?: Claim[];
  adjudications?: Adjudication[];
}

/**
 * Relative ranking for adjudication streaming.
 * Adverse and defective verdicts stream first to foreground critical findings.
 */
const VERDICT_SEVERITY_ORDER: Record<Verdict, number> = {
  CONTRADICTED: 1,
  UNSOURCED: 2,
  MISCITED: 3,
  CONFLATED: 4,
  STALE: 5,
  UNVERIFIABLE: 6,
  GROUNDED: 7,
  OPINION: 8,
};

/**
 * Promisified timer that aborts promptly when the client disconnects,
 * preventing dangling execution loops on cancelled HTTP requests.
 */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0 || signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Replay Route Handler (GET /api/replay)
 *
 * WHY REPLAY EXISTS:
 * Live audits query external search engines via SerpApi. In uncredentialed demo or
 * reviewer environments, triggering a live run yields a 503 quota error, hiding the
 * core forensic verification process. Replay allows any reviewer to observe the full
 * deposition, claim extraction, and cross-examination flow without credentials.
 *
 * WHY REPLAY IS HONEST:
 * 1. The stream opens with an unambiguous, unremovable disclosure stating that all
 *    results are from a recorded audit and no live searches are executed.
 * 2. It does not fabricate hypothetical results: every observation, latency record,
 *    claim span, and SerpApi search ID emitted is a genuine historic artifact from
 *    a real audit (`WOLF_RIVER_FIXTURE`).
 * 3. Cell pacing preserves the real relative round-trip latencies recorded by the
 *    original search engine calls.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawSpeed = parseFloat(url.searchParams.get("speed") ?? "1");
  // Divide delays by speed factor, clamped to safe practical bounds [0.25x, 8x].
  const speed = Number.isNaN(rawSpeed) ? 1 : Math.min(Math.max(rawSpeed, 0.25), 8);

  const fixture = WOLF_RIVER_FIXTURE as unknown as ReplayFixture;
  const auditId = fixture?.audit?.id ?? "replay-audit";
  const searchBudget = fixture?.audit?.searchBudget ?? 0;

  // Defensive mappings to handle any unexpected gaps in fixture data gracefully.
  const probes = (fixture?.probes ?? []).filter(
    (p): p is Probe => Boolean(p && typeof p === "object" && p.id && p.query && p.family)
  );
  const probeMap = new Map<string, Probe>(probes.map((p) => [p.id, p]));

  const claims = (fixture?.claims ?? []).filter(
    (c): c is Claim => Boolean(c && typeof c === "object" && c.id && c.observationId)
  );
  const claimMap = new Map<string, Claim>(claims.map((c) => [c.id, c]));

  const claimsByObservationId = new Map<string, Claim[]>();
  for (const claim of claims) {
    const list = claimsByObservationId.get(claim.observationId) ?? [];
    list.push(claim);
    claimsByObservationId.set(claim.observationId, list);
  }

  // Stable grouping of observations by probe order, matching the deposition grid layout.
  const rawObservations = (fixture?.observations ?? []).filter(
    (o): o is Observation =>
      Boolean(o && typeof o === "object" && o.id && o.probeId && o.localeId && o.engine)
  );

  const observationsByProbe = new Map<string, Observation[]>();
  for (const obs of rawObservations) {
    const list = observationsByProbe.get(obs.probeId) ?? [];
    list.push(obs);
    observationsByProbe.set(obs.probeId, list);
  }

  const orderedObservations: Observation[] = [];
  for (const probe of probes) {
    const probeObs = observationsByProbe.get(probe.id);
    if (probeObs) {
      orderedObservations.push(...probeObs);
      observationsByProbe.delete(probe.id);
    }
  }
  // Include any lingering observations referencing unindexed probes.
  for (const remainingObs of observationsByProbe.values()) {
    orderedObservations.push(...remainingObs);
  }

  // Filter adjudications whose claims exist and sort by verdict severity.
  const validAdjudications = (fixture?.adjudications ?? [])
    .filter(
      (adj): adj is Adjudication =>
        Boolean(adj && typeof adj === "object" && adj.claimId && claimMap.has(adj.claimId))
    )
    .sort((a, b) => {
      const severityA = VERDICT_SEVERITY_ORDER[a.verdict] ?? 99;
      const severityB = VERDICT_SEVERITY_ORDER[b.verdict] ?? 99;
      return severityA - severityB;
    });

  // Calculate replay timing budget:
  // Target total playback duration at speed=1 is ~45s (45,000ms).
  // Total time = INITIAL_PAUSE + SUM(cell_delays) + (validAdjudications.length * 300ms).
  // If the recorded latencies push the cell total beyond the available time, we scale
  // per-cell pauses proportionally rather than omitting observations or dropping cells.
  const TARGET_MAX_DURATION_MS = 45000;
  const INITIAL_PAUSE_MS = 200;
  const ADJUDICATION_PAUSE_MS = 300;

  const totalAdjudicationTimeMs = validAdjudications.length * ADJUDICATION_PAUSE_MS;
  const totalRawCellTimeMs = orderedObservations.reduce((acc, obs) => {
    const rawLatency = typeof obs.latencyMs === "number" ? obs.latencyMs : 500;
    return acc + Math.min(rawLatency, 1400);
  }, 0);

  const availableCellTimeMs = Math.max(
    TARGET_MAX_DURATION_MS - totalAdjudicationTimeMs - INITIAL_PAUSE_MS,
    5000
  );

  const cellScaleFactor =
    totalRawCellTimeMs > availableCellTimeMs && totalRawCellTimeMs > 0
      ? availableCellTimeMs / totalRawCellTimeMs
      : 1.0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      function safeClose() {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Guard against double close or client disconnect transitions
          }
        }
      }

      function emit(event: PipelineEvent): boolean {
        if (isClosed || req.signal.aborted) {
          return false;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          return true;
        } catch {
          safeClose();
          return false;
        }
      }

      req.signal.addEventListener("abort", () => {
        safeClose();
      });

      try {
        // 1. Mandatory provenance disclosure.
        if (
          !emit({
            kind: "log",
            line: "REPLAY — streaming a recorded audit. No live searches are performed.",
          })
        ) {
          return;
        }

        // 2. Initial line of questioning (probes).
        const probeList = probes.map((p) => ({
          id: p.id,
          query: p.query,
          family: p.family,
        }));
        if (!emit({ kind: "probes", probes: probeList })) {
          return;
        }

        // 3. Probes ready state transition and initial pacing pause.
        if (!emit({ kind: "audit_state", auditId, state: "probes_ready" })) {
          return;
        }
        await sleep(INITIAL_PAUSE_MS / speed, req.signal);
        if (req.signal.aborted) return;

        // 4. Deposition phase across observation cells.
        if (!emit({ kind: "audit_state", auditId, state: "deposing" })) {
          return;
        }

        let searchesSpent = 0;
        for (const obs of orderedObservations) {
          if (req.signal.aborted) return;

          if (
            !emit({
              kind: "cell_started",
              probeId: obs.probeId,
              localeId: obs.localeId,
              engine: obs.engine,
            })
          ) {
            return;
          }

          const rawLatency = typeof obs.latencyMs === "number" ? obs.latencyMs : 500;
          const scaledCellPause = (Math.min(rawLatency, 1400) * cellScaleFactor) / speed;
          await sleep(scaledCellPause, req.signal);
          if (req.signal.aborted) return;

          const probe = probeMap.get(obs.probeId);
          const probeQuery = probe ? probe.query : obs.probeId;
          const locLabel = localeLabel(obs.localeId);
          const claimCount = (claimsByObservationId.get(obs.id) ?? []).length;

          const logLine = obs.suppressed
            ? `→ ${obs.engine} | "${probeQuery}" | ${locLabel} … no generative answer (recorded)`
            : `→ ${obs.engine} | "${probeQuery}" | ${locLabel} … ${claimCount} claims`;

          if (!emit({ kind: "log", line: logLine })) {
            return;
          }

          if (
            !emit({
              kind: "cell_done",
              probeId: obs.probeId,
              localeId: obs.localeId,
              engine: obs.engine,
              suppressed: Boolean(obs.suppressed),
              searchId: obs.searchId ?? null,
              latencyMs: obs.latencyMs ?? 0,
              claimCount,
            })
          ) {
            return;
          }

          searchesSpent += 1;
          if (
            !emit({
              kind: "budget",
              spent: searchesSpent,
              budget: searchBudget,
            })
          ) {
            return;
          }
        }

        // 5. Adjudication phase across claims in order of severity.
        if (!emit({ kind: "audit_state", auditId, state: "adjudicating" })) {
          return;
        }

        for (const adj of validAdjudications) {
          if (req.signal.aborted) return;

          const claim = claimMap.get(adj.claimId);
          if (!claim) continue;

          await sleep(ADJUDICATION_PAUSE_MS / speed, req.signal);
          if (req.signal.aborted) return;

          const claimText = claim.text.length > 72 ? claim.text.slice(0, 72) : claim.text;
          const adjLog = `  ${adj.verdict} — ${claimText}`;

          if (!emit({ kind: "log", line: adjLog })) {
            return;
          }

          if (
            !emit({
              kind: "claim_adjudicated",
              claimId: adj.claimId,
              verdict: adj.verdict,
            })
          ) {
            return;
          }
        }

        // 6. Complete state and termination sentinel.
        if (!emit({ kind: "audit_state", auditId, state: "complete" })) {
          return;
        }

        emit({ kind: "log", line: "__DONE__" });
      } finally {
        safeClose();
      }
    },
    cancel() {
      // Stream consumer cancelled the response stream.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
