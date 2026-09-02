"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { VerdictChip } from "@/components/Verdict";
import { localeLabel } from "@/lib/locales";
import type { PipelineEvent, Verdict } from "@/lib/types";

type CellStatus = "pending" | "running" | "done" | "suppressed" | "error";

const ALL_VERDICTS: Verdict[] = [
  "GROUNDED",
  "MISCITED",
  "UNSOURCED",
  "CONTRADICTED",
  "STALE",
  "CONFLATED",
  "UNVERIFIABLE",
  "OPINION",
];

function getCellBgClass(status: CellStatus): string {
  switch (status) {
    case "running":
      return "bg-accent-soft motion-safe:animate-pulse";
    case "done":
      return "bg-ok-soft";
    case "suppressed":
      return "bg-warn-soft";
    case "error":
      return "bg-critical-soft";
    case "pending":
    default:
      return "bg-surface-3";
  }
}

export function DepositionGrid() {
  const [entity, setEntity] = useState<string>("");
  const [running, setRunning] = useState<boolean>(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [cellStates, setCellStates] = useState<Map<string, CellStatus>>(
    new Map()
  );
  const [probes, setProbes] = useState<string[]>([]);
  const [probeQueries, setProbeQueries] = useState<Map<string, string>>(new Map());
  const [locales, setLocales] = useState<string[]>([]);
  const [budget, setBudget] = useState<{ spent: number; limit: number }>({
    spent: 0,
    limit: 0,
  });
  const [verdictCounts, setVerdictCounts] = useState<Record<Verdict, number>>({
    GROUNDED: 0,
    MISCITED: 0,
    UNSOURCED: 0,
    CONTRADICTED: 0,
    STALE: 0,
    CONFLATED: 0,
    UNVERIFIABLE: 0,
    OPINION: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logLines]);

  const totalAdjudicated = Object.values(verdictCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  const budgetPercent =
    budget.limit > 0
      ? Math.min(100, Math.max(0, Math.round((budget.spent / budget.limit) * 100)))
      : 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running || !entity.trim()) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setRunning(true);
    setError(null);
    setLogLines([]);
    setCellStates(new Map());
    setProbes([]);
    setLocales([]);
    setBudget({ spent: 0, limit: 0 });
    setVerdictCounts({
      GROUNDED: 0,
      MISCITED: 0,
      UNSOURCED: 0,
      CONTRADICTED: 0,
      STALE: 0,
      CONFLATED: 0,
      UNVERIFIABLE: 0,
      OPINION: 0,
    });

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: entity.trim() }),
        signal: controller.signal,
      });

      if (!res.ok) {
        /*
         * 503 means live audits are off on this deployment; 429 means the shared
         * demo budget is spent. Both carry a human-readable reason and a pointer
         * to the recorded dossier — surface that rather than a status code.
         */
        const detail = (await res.json().catch(() => null)) as {
          error?: string;
          recordedDossierUrl?: string;
        } | null;
        throw new Error(
          detail?.error ?? `Audit request failed with status ${res.status}`,
        );
      }

      if (!res.body) {
        throw new Error("Response body is missing");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let isDone = false;

      while (!isDone) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed) {
            continue;
          }

          let payload = trimmed;
          if (payload.startsWith("data: ")) {
            payload = payload.slice(6).trim();
          } else if (payload.startsWith("data:")) {
            payload = payload.slice(5).trim();
          }

          if (!payload) {
            continue;
          }

          try {
            const event: PipelineEvent = JSON.parse(payload);
            switch (event.kind) {
              case "budget":
                setBudget({ spent: event.spent, limit: event.budget });
                break;

              case "cell_started":
                setProbes((prev) =>
                  prev.includes(event.probeId) ? prev : [...prev, event.probeId]
                );
                setLocales((prev) =>
                  prev.includes(event.localeId)
                    ? prev
                    : [...prev, event.localeId]
                );
                setCellStates((prev) => {
                  const next = new Map(prev);
                  next.set(`${event.probeId}::${event.localeId}`, "running");
                  return next;
                });
                break;

              case "cell_done":
                setProbes((prev) =>
                  prev.includes(event.probeId) ? prev : [...prev, event.probeId]
                );
                setLocales((prev) =>
                  prev.includes(event.localeId)
                    ? prev
                    : [...prev, event.localeId]
                );
                setCellStates((prev) => {
                  const next = new Map(prev);
                  const status: CellStatus = event.suppressed
                    ? "suppressed"
                    : "done";
                  next.set(`${event.probeId}::${event.localeId}`, status);
                  return next;
                });
                break;

              case "claim_adjudicated":
                setVerdictCounts((prev) => ({
                  ...prev,
                  [event.verdict]: (prev[event.verdict] ?? 0) + 1,
                }));
                break;

              case "log":
                if (event.line === "__DONE__") {
                  isDone = true;
                  await reader.cancel();
                } else {
                  setLogLines((prev) => [...prev, event.line]);
                }
                break;

              case "error":
                setError(event.message);
                break;

              case "probes": {
                // Row order is fixed here, before any cell arrives, so rows do
                // not reshuffle as results stream in.
                setProbes(event.probes.map((pr) => pr.id));
                setProbeQueries(
                  new Map(event.probes.map((pr) => [pr.id, pr.query])),
                );
                break;
              }

              case "audit_state":
                break;
            }
          } catch {
            // Drop unparseable payload chunks
          }

          if (isDone) {
            break;
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="w-full max-w-[1100px] mx-auto flex flex-col gap-6">
      {/* 1. CONTROL ROW */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
        <input
          type="text"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="Company or organisation name"
          disabled={running}
          className="bg-surface border border-rule rounded px-3 py-2 w-full flex-1 focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={running || !entity.trim()}
          className="bg-accent text-accent-ink px-4 py-2 rounded disabled:opacity-50 font-medium whitespace-nowrap transition-opacity"
        >
          {running ? "Deposing…" : "Depose"}
        </button>
      </form>

      {/* 2. BUDGET BAR */}
      <div className="flex flex-col gap-1.5 w-full">
        <div className="meta text-xs text-muted">
          SEARCHES {budget.spent} / {budget.limit}
        </div>
        <div className="w-full bg-surface-3 h-[3px] rounded-full overflow-hidden">
          <div
            className="bg-accent h-full transition-all duration-300"
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </div>

      {/* 3. GRID */}
      <div className="flex flex-col gap-3">
        <div className="scroll-x w-full">
          {locales.length > 0 && probes.length > 0 ? (
            <div
              className="grid gap-2 w-max"
              style={{
                gridTemplateColumns: `minmax(0, 260px) repeat(${locales.length}, minmax(104px, 1fr))`,
              }}
              role="grid"
              aria-label="Deposition grid"
            >
              <div />
              {locales.map((localeId) => (
                <div
                  key={localeId}
                  className="meta text-center px-1 truncate"
                  title={localeLabel(localeId)}
                >
                  {localeLabel(localeId)}
                </div>
              ))}

              {probes.map((probeId) => (
                <Fragment key={probeId}>
                <div
                  className="pr-3 text-right text-sm text-muted truncate max-w-[280px]"
                  title={probeQueries.get(probeId) ?? probeId}
                >
                  {probeQueries.get(probeId) ?? probeId}
                </div>
                {locales.map((localeId) => {
                  const key = `${probeId}::${localeId}`;
                  const status = cellStates.get(key) ?? "pending";
                  const desc = `${probeQueries.get(probeId) ?? probeId} — ${localeLabel(localeId)} — ${status}`;
                  return (
                    <div
                      key={key}
                      title={desc}
                      aria-label={desc}
                      role="gridcell"
                      className={`h-[38px] w-full rounded border border-rule transition-colors ${getCellBgClass(
                        status
                      )}`}
                    />
                  );
                })}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted border border-rule rounded bg-surface text-sm">
              Grid will populate as deposition proceeds.
            </div>
          )}
        </div>

        {/* LEGEND */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded bg-surface-3 inline-block"
              aria-hidden="true"
            />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded bg-accent-soft motion-safe:animate-pulse inline-block"
              aria-hidden="true"
            />
            <span>Running</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded bg-ok-soft inline-block"
              aria-hidden="true"
            />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded bg-warn-soft inline-block"
              aria-hidden="true"
            />
            <span>Suppressed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded bg-critical-soft inline-block"
              aria-hidden="true"
            />
            <span>Error</span>
          </div>
        </div>
      </div>

      {/* 4. VERDICT TALLY */}
      {totalAdjudicated > 0 && (
        <div className="flex flex-wrap items-center gap-4 py-2 border-y border-rule">
          {ALL_VERDICTS.map((verdict) => {
            const count = verdictCounts[verdict] ?? 0;
            return (
              <div key={verdict} className="flex items-center gap-1.5">
                <VerdictChip verdict={verdict} />
                <span
                  className={`tabular font-mono text-sm ${
                    count > 0 ? "font-semibold" : "text-muted"
                  }`}
                >
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. LOG */}
      <div
        ref={logContainerRef}
        className="font-mono text-xs max-h-[280px] overflow-y-auto bg-surface border border-rule rounded p-3 flex flex-col gap-1"
      >
        {logLines.length === 0 ? (
          <div className="text-muted">Awaiting log stream…</div>
        ) : (
          logLines.map((line, idx) => (
            <div
              key={idx}
              className="leading-relaxed whitespace-pre-wrap break-all"
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* 6. ERROR */}
      {error && (
        <div
          role="alert"
          className="bg-critical-soft text-critical border border-rule rounded p-3 text-sm"
        >
          {error}
        </div>
      )}
    </div>
  );
}
