"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Bracket, PillButton } from "@/components/ui";
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
      return "bg-surface-3 border-rule-strong motion-safe:animate-pulse text-ink";
    case "done":
      return "bg-surface-2 border-rule text-ink";
    case "suppressed":
      return "bg-surface border-rule border-dashed text-muted";
    case "error":
      return "bg-red-soft border-red-rule text-red";
    case "pending":
    default:
      return "bg-ground border-rule text-faint";
  }
}

export function DepositionGrid() {
  const [entity, setEntity] = useState<string>("");
  const [mode, setMode] = useState<"idle" | "live" | "replay">("idle");
  const [liveDisabled, setLiveDisabled] = useState<boolean>(false);
  const [running, setRunning] = useState<boolean>(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [cellStates, setCellStates] = useState<Map<string, CellStatus>>(
    new Map()
  );
  const [probes, setProbes] = useState<string[]>([]);
  const [probeQueries, setProbeQueries] = useState<Map<string, string>>(
    new Map()
  );
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
      ? Math.min(
          100,
          Math.max(0, Math.round((budget.spent / budget.limit) * 100))
        )
      : 0;

  function resetRunState() {
    setError(null);
    setLogLines([]);
    setCellStates(new Map());
    setProbes([]);
    setProbeQueries(new Map());
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
  }

  async function consumeStream(res: Response) {
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
                new Map(event.probes.map((pr) => [pr.id, pr.query]))
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
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (running || !entity.trim()) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMode("live");
    setRunning(true);
    resetRunState();

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
          liveDisabled?: boolean;
          recordedDossierUrl?: string;
        } | null;

        if (res.status === 503 || detail?.liveDisabled) {
          setLiveDisabled(true);
          setMode("idle");
          return;
        }

        throw new Error(
          detail?.error ?? `Audit request failed with status ${res.status}`
        );
      }

      await consumeStream(res);
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

  async function handleReplay() {
    if (running) {
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMode("replay");
    setRunning(true);
    resetRunState();

    try {
      const res = await fetch("/api/replay", {
        method: "GET",
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detail?.error ?? `Replay request failed with status ${res.status}`
        );
      }

      await consumeStream(res);
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
    <div className="w-full max-w-[1080px] mx-auto flex flex-col gap-8">
      {/* 1. CONTROL ROW */}
      <form
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-3 w-full max-w-[1080px] mx-auto"
      >
        <input
          type="text"
          value={entity}
          onChange={(e) => setEntity(e.target.value)}
          placeholder="company or organisation name"
          disabled={running}
          className="bg-surface border border-rule rounded-[3px] px-5 py-2.5 w-full flex-1 text-ink text-[14px] placeholder:text-faint focus:outline-none focus:border-rule-strong disabled:opacity-40 transition-colors"
        />
        <PillButton
          type="submit"
          variant="primary"
          disabled={running || !entity.trim()}
          className="whitespace-nowrap"
        >
          {running && mode === "live" ? "deposing…" : "depose"}
        </PillButton>
        <PillButton
          type="button"
          variant="secondary"
          onClick={handleReplay}
          disabled={running}
          className="whitespace-nowrap"
        >
          {running && mode === "replay" ? "replaying…" : "replay recorded audit"}
        </PillButton>
      </form>

      {/* LIVE DISABLED NOTICE */}
      {liveDisabled && (
        <div className="bg-surface-2 border border-rule p-4 rounded-[3px] text-[1.02rem] leading-relaxed flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-[1080px] w-full mx-auto">
          <div className="flex items-start gap-2.5 max-w-[64ch]">
            <Bracket tone="muted">notice</Bracket>
            <span className="text-muted leading-relaxed">
              Live audits are off on this deployment so it cannot spend search quota.
              The replay shows a real recorded audit instead.
            </span>
          </div>
          <PillButton
            type="button"
            variant="secondary"
            onClick={handleReplay}
            disabled={running}
            className="self-start sm:self-auto shrink-0 whitespace-nowrap"
          >
            {running && mode === "replay"
              ? "replaying…"
              : "replay recorded audit"}
          </PillButton>
        </div>
      )}

      {/* 2. BUDGET BAR */}
      <div className="flex flex-col gap-2 w-full max-w-[1080px] mx-auto">
        <div className="flex items-baseline justify-between text-xs">
          <Bracket tone="muted">
            {mode === "replay" ? "recorded searches" : "searches"}
          </Bracket>
          <span className="tabular font-mono text-xs text-muted">
            <span className="text-ink">{budget.spent}</span> / {budget.limit}
          </span>
        </div>
        <div className="w-full bg-surface-2 h-[2px] overflow-hidden rounded-[1px]">
          <div
            className="bg-ink h-full transition-all duration-300"
            style={{ width: `${budgetPercent}%` }}
          />
        </div>
      </div>

      {/* 3. GRID */}
      <div className="flex flex-col gap-5 w-full max-w-[1080px] mx-auto">
        {mode === "replay" && (
          <div className="flex items-baseline justify-center gap-2 text-xs text-muted text-center">
            <Bracket tone="ink">replay</Bracket>
            <span>Streaming a recorded audit. No live searches are performed.</span>
          </div>
        )}

        <div className="scroll-x w-full">
          {locales.length > 0 && probes.length > 0 ? (
            <div
              className="grid gap-2 w-max mx-auto"
              style={{
                gridTemplateColumns: `minmax(0, 280px) repeat(${locales.length}, minmax(104px, 1fr))`,
              }}
              role="grid"
              aria-label="Deposition grid"
            >
              <div />
              {locales.map((localeId) => (
                <div
                  key={localeId}
                  className="text-center px-1 truncate"
                  title={localeLabel(localeId)}
                >
                  <Bracket tone="muted">{localeLabel(localeId).toLowerCase()}</Bracket>
                </div>
              ))}

              {probes.map((probeId) => (
                <Fragment key={probeId}>
                  <div
                    className="pr-3 text-right text-xs text-muted truncate max-w-[280px] mono self-center"
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
                        className={`h-[40px] w-full rounded-[2px] border transition-colors flex items-center justify-center px-1 text-center ${getCellBgClass(
                          status
                        )}`}
                      >
                        <span className="mono text-[11px] leading-none select-none truncate">
                          {status === "pending"
                            ? "—"
                            : status === "running"
                              ? "deposing…"
                              : status === "done"
                                ? "done"
                                : status === "suppressed"
                                  ? "suppressed"
                                  : "error"}
                        </span>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center text-muted border border-rule rounded-[3px] bg-surface text-xs mono flex items-center justify-center gap-2">
              <Bracket tone="muted">pending</Bracket>{" "}
              <span className="text-muted">grid will populate as deposition proceeds.</span>
            </div>
          )}
        </div>

        {/* LEGEND */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[2px] bg-ground border border-rule inline-block"
              aria-hidden="true"
            />
            <span className="mono lowercase">pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[2px] bg-surface-3 border border-rule-strong motion-safe:animate-pulse inline-block"
              aria-hidden="true"
            />
            <span className="mono lowercase">running</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[2px] bg-surface-2 border border-rule inline-block"
              aria-hidden="true"
            />
            <span className="mono lowercase">done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[2px] bg-surface border border-rule border-dashed inline-block"
              aria-hidden="true"
            />
            <span className="mono lowercase">suppressed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-3.5 h-3.5 rounded-[2px] bg-red-soft border border-red-rule inline-block"
              aria-hidden="true"
            />
            <span className="mono lowercase text-red">error</span>
          </div>
        </div>
      </div>

      {/* 4. VERDICT TALLY */}
      {totalAdjudicated > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 border-y border-rule w-full max-w-[1080px] mx-auto">
          {ALL_VERDICTS.map((verdict) => {
            const count = verdictCounts[verdict] ?? 0;
            return (
              <div key={verdict} className="flex items-center gap-2">
                <VerdictChip verdict={verdict} />
                <span
                  className={`tabular font-mono text-xs ${
                    count > 0 ? "text-ink font-medium" : "text-faint"
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
      <div className="flex flex-col gap-2 w-full max-w-[1080px] mx-auto">
        <div className="flex items-center justify-between text-xs">
          <Bracket tone="muted">log stream</Bracket>
          {logLines.length > 0 && (
            <span className="tabular font-mono text-[11px] text-faint">
              {logLines.length} {logLines.length === 1 ? "line" : "lines"}
            </span>
          )}
        </div>
        <div
          ref={logContainerRef}
          className="font-mono text-xs max-h-[260px] overflow-y-auto bg-surface border border-rule rounded-[3px] p-4 flex flex-col gap-1.5 text-ink"
        >
          {logLines.length === 0 ? (
            <div className="text-faint">awaiting log stream…</div>
          ) : (
            logLines.map((line, idx) => (
              <div
                key={idx}
                className="leading-relaxed whitespace-pre-wrap break-all text-muted"
              >
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 6. ERROR */}
      {error && (
        <div
          role="alert"
          className="bg-red-soft text-red border border-red-rule rounded-[3px] p-4 text-[1.02rem] leading-relaxed flex items-start gap-2.5 w-full max-w-[1080px] mx-auto"
        >
          <Bracket tone="red">error</Bracket>
          <span className="leading-relaxed">{error}</span>
        </div>
      )}
    </div>
  );
}
