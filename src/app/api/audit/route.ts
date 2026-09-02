import { checkRateLimit, clientKeyFrom, recordRun } from "@/lib/judge-mode";
import { depose, DEFAULT_LOCALES, parseAiOverview } from "@/lib/engine/deposition";
import { decomposeClaims, crossExamineMany } from "@/lib/engine/crossexam";
import { BudgetLedger, BudgetExceededError } from "@/lib/serpapi/client";
import { completeJson } from "@/lib/engine/llm";
import type {
  AuditState,
  Engine,
  Locale,
  Observation,
  PipelineEvent,
  Probe,
  ProbeFamily,
  Claim,
  Verdict,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuditRequestBody {
  entity?: unknown;
  probeCount?: unknown;
  localeCount?: unknown;
  budget?: unknown;
}

interface ProbeGenResponse {
  probes?: Array<{
    query: string;
    family: string;
    harmWeight: number;
  }>;
}

const VALID_PROBE_FAMILIES: readonly ProbeFamily[] = [
  "identity",
  "adverse",
  "commercial",
  "qualification",
  "operational",
];

/**
 * Clamps a numeric input to [min, max], falling back to defaultValue if invalid.
 */
function clamp(val: unknown, min: number, max: number, defaultValue: number): number {
  if (typeof val !== "number" || Number.isNaN(val)) {
    return defaultValue;
  }
  return Math.min(max, Math.max(min, Math.floor(val)));
}

/**
 * POST /api/audit
 *
 * Streams live pipeline events (SSE) while conducting an automated forensic audit
 * of Google generative search answers (AI Overview / AI Mode) regarding an entity.
 *
 * Sequence:
 * 1. Probes generation via LLM (or deterministic templates fallback) -> audit_state "probes_ready"
 * 2. Deposition across locales/engines via SerpApi -> audit_state "deposing"
 * 3. Cross-examination of target factual claims -> audit_state "adjudicating"
 * 4. Completion -> audit_state "complete" followed by log "__DONE__"
 */
export async function POST(req: Request): Promise<Response> {
  /*
   * Rate limiting happens before anything else, and returns plain JSON rather
   * than opening the SSE stream. A reviewer who exhausts the shared search
   * budget must get a designed message pointing at the recorded dossier, never
   * an unhandled 429 from SerpApi part-way through a stream.
   */
  const clientKey = clientKeyFrom(req);
  const decision = checkRateLimit(clientKey);
  if (!decision.allowed) {
    return Response.json(
      {
        error: decision.reason,
        retryAfterSeconds: decision.retryAfterSeconds,
        recordedDossierUrl: "/dossier/wolf-river",
      },
      {
        status: 429,
        headers: decision.retryAfterSeconds
          ? { "retry-after": String(decision.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  let body: AuditRequestBody;
  try {
    body = (await req.json()) as AuditRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  const { entity } = body;
  if (typeof entity !== "string" || entity.trim().length === 0 || entity.length > 120) {
    return Response.json(
      { error: "Entity must be a non-empty string under 120 characters" },
      { status: 400 }
    );
  }

  const targetEntity = entity.trim();
  const probeCount = clamp(body.probeCount, 1, 4, 2);
  const localeCount = clamp(body.localeCount, 1, 4, 2);
  const budget = clamp(body.budget, 1, 25, 8);

  const auditId = crypto.randomUUID();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeClose = () => {
        if (!isClosed) {
          isClosed = true;
          try {
            controller.close();
          } catch {
            // Guard against controller double-close or abort race conditions
          }
        }
      };

      const sendEvent = (evt: PipelineEvent) => {
        if (isClosed || req.signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
        } catch {
          // Stream controller might be errored or closed downstream
        }
      };

      req.signal.addEventListener("abort", () => {
        safeClose();
      });

      const ledger = new BudgetLedger(budget);

      try {
        if (req.signal.aborted) {
          safeClose();
          return;
        }

        // -------------------------------------------------------------------
        // 1. Probes generation
        // -------------------------------------------------------------------
        let rawProbes: Array<{ query: string; family: string; harmWeight: number }> = [];

        try {
          const prompt = `Generate ${probeCount} short search questions a real person would type about the entity "${targetEntity}", biased toward adverse/reputational questions ("is ${targetEntity} being sued", "complaints about ${targetEntity}"). Return JSON conforming to: { "probes": [{ "query": string, "family": "identity" | "adverse" | "commercial" | "qualification" | "operational", "harmWeight": number between 0 and 1 }] }`;
          const result = await completeJson<ProbeGenResponse>({ prompt, schemaHint: '{"probes":[{"query":string,"family":string,"harmWeight":number}]}', maxTokens: 3000 });

          if (result && Array.isArray(result.probes) && result.probes.length > 0) {
            rawProbes = result.probes.slice(0, probeCount);
          } else {
            throw new Error("Invalid probe structure returned from LLM");
          }
        } catch {
          sendEvent({
            kind: "log",
            line: "LLM unavailable; using deterministic templates for probe generation.",
          });

          const templates = [
            { query: `is ${targetEntity} being sued`, family: "adverse", harmWeight: 0.9 },
            { query: `complaints about ${targetEntity}`, family: "adverse", harmWeight: 0.8 },
            { query: `is ${targetEntity} legitimate`, family: "qualification", harmWeight: 0.6 },
            { query: `${targetEntity} reviews`, family: "commercial", harmWeight: 0.4 },
          ];
          rawProbes = templates.slice(0, probeCount);
        }

        const probes: Probe[] = rawProbes.map((item, idx) => {
          const family = VALID_PROBE_FAMILIES.includes(item.family as ProbeFamily)
            ? (item.family as ProbeFamily)
            : "adverse";
          const harmWeight =
            typeof item.harmWeight === "number"
              ? Math.max(0, Math.min(1, item.harmWeight))
              : 0.5;

          return {
            id: `probe-${idx + 1}`,
            auditId,
            query: item.query,
            family,
            harmWeight,
            enabled: true,
          };
        });

        // Emit the line of questioning itself so the UI can label grid rows with
        // the real question rather than an opaque id.
        sendEvent({
          kind: "probes",
          probes: probes.map((p) => ({
            id: p.id,
            query: p.query,
            family: p.family,
          })),
        });

        sendEvent({
          kind: "audit_state",
          auditId,
          state: "probes_ready",
        });

        if (req.signal.aborted) {
          safeClose();
          return;
        }

        // -------------------------------------------------------------------
        // 2. Deposition
        // -------------------------------------------------------------------
        recordRun(clientKey);

        sendEvent({
          kind: "audit_state",
          auditId,
          state: "deposing",
        });

        const selectedLocales = DEFAULT_LOCALES.slice(0, localeCount);

        const observations: Observation[] = await depose({
          auditId,
          probes,
          locales: selectedLocales,
          engines: ["google_ai_mode"],
          concurrency: 2,
          budget: ledger,
          onEvent: (evt: PipelineEvent) => {
            sendEvent(evt);
          },
          signal: req.signal,
        });

        if (req.signal.aborted) {
          safeClose();
          return;
        }

        // -------------------------------------------------------------------
        // 3. Adjudication / Cross-examination
        // -------------------------------------------------------------------
        sendEvent({
          kind: "audit_state",
          auditId,
          state: "adjudicating",
        });

        for (const observation of observations) {
          if (req.signal.aborted) break;
          if (observation.suppressed) continue;

          const parsed = parseAiOverview(observation.raw);
          const claims: Claim[] = await decomposeClaims({
            observationId: observation.id,
            textBlocks: (parsed.textBlocks ?? []).map((b) => ({
              type: b.type ?? "paragraph",
              snippet: b.snippet ?? "",
            })),
            references: parsed.references ?? [],
            targetEntity,
            collisionSet: [],
          });

          sendEvent({
            kind: "log",
            line: `  ${claims.length} claims extracted — cross-examining`,
          });

          const targetFactualClaims = claims
            .filter((c) => c.isAboutTarget && c.type === "factual")
            .slice(0, 3);

          // Adjudication is the slow stage (~15s/claim). Bounded parallelism keeps a
          // modest audit from taking minutes, without hammering the model endpoint.
          await crossExamineMany({
            claims: targetFactualClaims,
            references: parsed.references ?? [],
            sourceSearchId: observation.searchId,
            concurrency: 3,
            signal: req.signal,
            onResult: (adjudication, claim) => {
              sendEvent({
                kind: "log",
                line: `  ${adjudication.verdict} — ${claim.text.slice(0, 72)}`,
              });
              sendEvent({
                kind: "claim_adjudicated",
                claimId: claim.id,
                verdict: adjudication.verdict,
              });
            },
          });
        }

        if (req.signal.aborted) {
          safeClose();
          return;
        }

        // -------------------------------------------------------------------
        // 4. Complete
        // -------------------------------------------------------------------
        sendEvent({
          kind: "audit_state",
          auditId,
          state: "complete",
        });

        sendEvent({
          kind: "log",
          line: "__DONE__",
        });
      } catch (err: unknown) {
        if (err instanceof BudgetExceededError) {
          // A spent search budget is an expected operating outcome rather than an unhandled crash
          sendEvent({
            kind: "error",
            message: "Search budget limit reached. Halting audit cleanly.",
          });
          sendEvent({
            kind: "audit_state",
            auditId,
            state: "complete",
          });
          sendEvent({
            kind: "log",
            line: "__DONE__",
          });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent({
            kind: "error",
            message,
          });
        }
      } finally {
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
