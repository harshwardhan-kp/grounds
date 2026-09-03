"use client";

import { useState, useId, useMemo } from "react";
import type { Reference } from "@/lib/types";
import { Bracket, Marker, DataRow } from "@/components/ui";

export interface ForensicInspectorProps {
  observationId: string;
  searchId: string | null;
  payloadHash: string;
  params: Record<string, string>;
  latencyMs: number;
  capturedAt: string;
  textBlocks: { type: string; snippet: string }[];
  references: Reference[];
  suppressed: boolean;
}

type TabKey = "parsed" | "archive" | "request";
type VerifyOutcome = "MATCH" | "MISMATCH" | "UNAVAILABLE";

interface VerifyResult {
  outcome: VerifyOutcome;
  message: string;
}

const GEO_PARAM_KEYS = new Set(["location", "gl", "hl", "uule"]);

function formatCapturedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
    }
  } catch {
    // Preserve raw string on parse failure
  }
  return isoString;
}

export function ForensicInspector({
  observationId,
  searchId,
  payloadHash,
  params,
  latencyMs,
  capturedAt,
  textBlocks,
  references,
  suppressed,
}: ForensicInspectorProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<TabKey>("parsed");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [hasCopiedCurl, setHasCopiedCurl] = useState<boolean>(false);

  const instanceId = useId();
  const panelId = `inspector-panel-${observationId}-${instanceId}`;
  const tabParsedId = `tab-parsed-${observationId}-${instanceId}`;
  const tabArchiveId = `tab-archive-${observationId}-${instanceId}`;
  const tabRequestId = `tab-request-${observationId}-${instanceId}`;
  const panelParsedId = `panel-parsed-${observationId}-${instanceId}`;
  const panelArchiveId = `panel-archive-${observationId}-${instanceId}`;
  const panelRequestId = `panel-request-${observationId}-${instanceId}`;

  const curlCommand = useMemo(() => {
    const searchParams = new URLSearchParams(params);
    searchParams.set("api_key", "YOUR_KEY");
    return `curl -s "https://serpapi.com/search.json?${searchParams.toString()}"`;
  }, [params]);

  const handleVerify = async () => {
    if (!searchId || isVerifying) return;

    setIsVerifying(true);
    setVerifyResult(null);

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ searchId, payloadHash }),
      });

      const data: unknown = await response.json().catch(() => null);

      let outcome: VerifyOutcome = "UNAVAILABLE";
      let message = "";

      if (typeof data === "object" && data !== null) {
        const obj = data as Record<string, unknown>;

        if (typeof obj.message === "string") {
          message = obj.message;
        }

        const candidate = obj.result ?? obj.status ?? obj.verdict;
        if (typeof candidate === "string") {
          const upper = candidate.toUpperCase();
          if (upper === "MATCH" || upper === "MISMATCH" || upper === "UNAVAILABLE") {
            outcome = upper;
          }
        } else if (typeof obj.match === "boolean") {
          outcome = obj.match ? "MATCH" : "MISMATCH";
        }
      }

      if (!response.ok && !message) {
        message = `Server responded with status ${response.status}`;
      }

      setVerifyResult({ outcome, message });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network request failed";
      setVerifyResult({
        outcome: "UNAVAILABLE",
        message,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyCurl = async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setHasCopiedCurl(true);
      setTimeout(() => setHasCopiedCurl(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  return (
    <div className="w-full text-xs">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="mono lowercase text-xs px-3 py-1.5 rounded-[3px] border border-rule bg-surface-2 text-ink hover:bg-surface-3 transition-colors inline-flex items-center gap-1.5"
      >
        <span>inspect serpapi trace</span>
        <Bracket tone="muted">{isOpen ? "close" : "open"}</Bracket>
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="mt-3 border border-rule rounded-[3px] bg-surface p-4 text-ink flex flex-col gap-4"
        >
          {/* Tab Navigation */}
          <div
            role="tablist"
            aria-label="Forensic Inspector Tabs"
            className="flex gap-4 border-b border-rule"
          >
            <button
              type="button"
              role="tab"
              id={tabParsedId}
              aria-selected={activeTab === "parsed"}
              aria-controls={panelParsedId}
              onClick={() => setActiveTab("parsed")}
              className={`pb-2 mono text-xs transition-colors ${
                activeTab === "parsed"
                  ? "border-b-2 border-ink text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              parsed response
            </button>
            <button
              type="button"
              role="tab"
              id={tabArchiveId}
              aria-selected={activeTab === "archive"}
              aria-controls={panelArchiveId}
              onClick={() => setActiveTab("archive")}
              className={`pb-2 mono text-xs transition-colors ${
                activeTab === "archive"
                  ? "border-b-2 border-ink text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              archive verification
            </button>
            <button
              type="button"
              role="tab"
              id={tabRequestId}
              aria-selected={activeTab === "request"}
              aria-controls={panelRequestId}
              onClick={() => setActiveTab("request")}
              className={`pb-2 mono text-xs transition-colors ${
                activeTab === "request"
                  ? "border-b-2 border-ink text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              request
            </button>
          </div>

          {/* Tab 1: Parsed response */}
          <div
            role="tabpanel"
            id={panelParsedId}
            aria-labelledby={tabParsedId}
            hidden={activeTab !== "parsed"}
          >
            {activeTab === "parsed" && (
              <div className="flex flex-col gap-4">
                <div className="meta text-muted flex items-center gap-2">
                  <Bracket tone="muted">summary</Bracket>
                  <span>
                    {textBlocks.length} text blocks · {references.length} references · suppressed{" "}
                    {suppressed ? "yes" : "no"}
                  </span>
                </div>

                {suppressed ? (
                  <div className="border border-rule rounded-[3px] bg-surface-2 p-3 flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Bracket tone="muted">suppressed</Bracket>
                      <p className="font-medium text-ink">
                        Google returned no generative answer for this probe.
                      </p>
                    </div>
                    <p className="meta text-muted">
                      This suppression is recorded as an observation, not an error. Google withholds
                      AI Overviews on adverse or sensitive queries.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Bracket tone="muted">text blocks</Bracket>
                        <span className="meta text-muted tabular">({textBlocks.length})</span>
                      </div>
                      {textBlocks.length === 0 ? (
                        <p className="meta text-muted">No text blocks recorded in response.</p>
                      ) : (
                        <ol className="divide-y divide-rule border-y border-rule">
                          {textBlocks.map((block, idx) => {
                            const isLong = block.snippet.length > 240;
                            const text = isLong
                              ? `${block.snippet.slice(0, 240)}…`
                              : block.snippet;
                            return (
                              <li key={idx} className="py-2 flex items-baseline gap-2">
                                <span className="shrink-0">
                                  <Bracket tone="muted">{block.type}</Bracket>
                                </span>
                                <span className="testimony text-ink">{text}</span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Bracket tone="muted">references</Bracket>
                        <span className="meta text-muted tabular">({references.length})</span>
                      </div>
                      {references.length === 0 ? (
                        <p className="meta text-muted">No cited references recorded.</p>
                      ) : (
                        <ul className="flex flex-col gap-2">
                          {references.map((ref) => (
                            <li
                              key={ref.index}
                              className="border border-rule rounded-[3px] bg-surface-2 p-2.5 flex flex-col gap-1"
                            >
                              <div className="flex items-baseline gap-2">
                                <Bracket tone="muted">{String(ref.index)}</Bracket>
                                <a
                                  href={ref.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-ink underline hover:text-muted font-medium break-all"
                                >
                                  {ref.title || ref.link}
                                </a>
                              </div>
                              {ref.source && (
                                <div className="meta text-muted">
                                  source: <span className="text-ink">{ref.source}</span>
                                </div>
                              )}
                              {ref.snippet && (
                                <div className="testimony text-muted italic">
                                  "{ref.snippet}"
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Tab 2: Archive verification */}
          <div
            role="tabpanel"
            id={panelArchiveId}
            aria-labelledby={tabArchiveId}
            hidden={activeTab !== "archive"}
          >
            {activeTab === "archive" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Bracket tone="muted">serpapi search id</Bracket>
                  {searchId ? (
                    <div className="flex items-center gap-3">
                      <span className="mono text-ink text-xs">{searchId}</span>
                      <a
                        href={`https://serpapi.com/searches/${searchId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono text-xs text-ink underline hover:text-muted"
                      >
                        open serpapi archive record
                      </a>
                    </div>
                  ) : (
                    <div className="meta text-muted">
                      <span className="mono">null</span> — this observation has no archive record.
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Bracket tone="muted">stored sha-256 payload hash</Bracket>
                  <div className="scroll-x">
                    <div className="mono text-xs break-all bg-surface-2 p-2.5 border border-rule rounded-[3px] select-all text-ink">
                      {payloadHash}
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!searchId || isVerifying}
                      onClick={handleVerify}
                      className="mono lowercase text-xs px-3 py-1.5 rounded-[3px] border border-rule bg-surface-2 text-ink hover:bg-surface-3 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? "verifying…" : "verify against archive"}
                    </button>

                    {verifyResult && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`mono text-xs px-2 py-0.5 rounded-[3px] font-medium inline-flex items-center gap-1.5 ${
                            verifyResult.outcome === "MISMATCH"
                              ? "bg-red-soft text-red border border-red-rule"
                              : verifyResult.outcome === "MATCH"
                              ? "bg-surface-2 text-ink border border-rule"
                              : "bg-surface-2 text-muted border border-rule"
                          }`}
                        >
                          {verifyResult.outcome === "MISMATCH" && <Marker tone="red" />}
                          {verifyResult.outcome}
                        </span>
                        {verifyResult.message && (
                          <span className="meta text-muted">{verifyResult.message}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {!searchId && (
                    <p className="meta text-muted">
                      Verification requires an active third-party search record. This observation
                      does not have a registered SerpApi searchId.
                    </p>
                  )}

                  <p className="meta text-muted">
                    SerpApi retains archived searches for 31 days, so the local payload hash is the
                    durable record and the archive is third-party corroboration.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Tab 3: Request */}
          <div
            role="tabpanel"
            id={panelRequestId}
            aria-labelledby={tabRequestId}
            hidden={activeTab !== "request"}
          >
            {activeTab === "request" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 pb-3 border-b border-rule">
                  <DataRow
                    label="captured_at"
                    value={formatCapturedAt(capturedAt)}
                    mono
                  />
                  <DataRow
                    label="latency"
                    value={<span className="tabular">{latencyMs} ms</span>}
                    mono
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Bracket tone="muted">request parameters</Bracket>
                    <span className="meta text-muted tabular">({Object.keys(params).length})</span>
                  </div>
                  <dl className="border border-rule rounded-[3px] bg-surface-2 divide-y divide-rule">
                    {Object.entries(params).length === 0 ? (
                      <div className="p-3 meta text-muted">No request parameters recorded.</div>
                    ) : (
                      Object.entries(params).map(([key, value]) => {
                        const isGeo = GEO_PARAM_KEYS.has(key);
                        return (
                          <div
                            key={key}
                            className={`flex items-baseline justify-between py-1.5 px-3 ${
                              isGeo ? "bg-surface" : ""
                            }`}
                          >
                            <dt className="meta text-muted flex items-center gap-1.5">
                              <span className="mono">{key}</span>
                              {isGeo && (
                                <Bracket tone="ink" className="text-[10px]">geo</Bracket>
                              )}
                            </dt>
                            <dd className="mono text-ink text-right ml-4 break-all">
                              {value}
                            </dd>
                          </div>
                        );
                      })
                    )}
                  </dl>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Bracket tone="muted">curl reconstruction</Bracket>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      className="meta mono text-muted hover:text-ink underline transition-colors"
                    >
                      {hasCopiedCurl ? "[copied]" : "[copy]"}
                    </button>
                  </div>
                  <div className="scroll-x">
                    <pre className="mono text-xs p-3 bg-surface-2 border border-rule rounded-[3px] text-ink whitespace-pre">
                      {curlCommand}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
