"use client";

import { useState, useId, useMemo } from "react";
import type { Reference } from "@/lib/types";

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
    <div className="w-full font-sans text-xs">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="font-mono text-xs px-2 py-1 rounded border border-rule bg-surface-2 text-ink hover:border-accent transition-colors"
      >
        Inspect SerpApi trace
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="mt-2 border border-rule rounded bg-surface p-4 text-ink shadow-sm"
        >
          {/* Tab Navigation */}
          <div
            role="tablist"
            aria-label="Forensic Inspector Tabs"
            className="flex gap-4 border-b border-rule mb-4"
          >
            <button
              type="button"
              role="tab"
              id={tabParsedId}
              aria-selected={activeTab === "parsed"}
              aria-controls={panelParsedId}
              onClick={() => setActiveTab("parsed")}
              className={`pb-2 font-mono text-xs transition-colors ${
                activeTab === "parsed"
                  ? "border-b-2 border-accent text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              Parsed response
            </button>
            <button
              type="button"
              role="tab"
              id={tabArchiveId}
              aria-selected={activeTab === "archive"}
              aria-controls={panelArchiveId}
              onClick={() => setActiveTab("archive")}
              className={`pb-2 font-mono text-xs transition-colors ${
                activeTab === "archive"
                  ? "border-b-2 border-accent text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              Archive verification
            </button>
            <button
              type="button"
              role="tab"
              id={tabRequestId}
              aria-selected={activeTab === "request"}
              aria-controls={panelRequestId}
              onClick={() => setActiveTab("request")}
              className={`pb-2 font-mono text-xs transition-colors ${
                activeTab === "request"
                  ? "border-b-2 border-accent text-ink font-medium"
                  : "text-muted hover:text-ink"
              }`}
            >
              Request
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
              <div className="space-y-4">
                <div className="meta text-muted">
                  {textBlocks.length} text blocks · {references.length} references · suppressed{" "}
                  {suppressed ? "yes" : "no"}
                </div>

                {suppressed ? (
                  <div className="border border-rule rounded bg-surface-2 p-3 space-y-1">
                    <p className="font-medium text-ink">
                      Google returned no generative answer for this probe.
                    </p>
                    <p className="meta text-muted">
                      This suppression is recorded as an observation, not an error. Google withholds
                      AI Overviews on adverse or sensitive queries.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="meta text-muted uppercase tracking-wider mb-2">
                        Text Blocks
                      </div>
                      {textBlocks.length === 0 ? (
                        <p className="meta text-muted">No text blocks recorded in response.</p>
                      ) : (
                        <ol className="list-decimal list-inside space-y-2">
                          {textBlocks.map((block, idx) => {
                            const isLong = block.snippet.length > 240;
                            const text = isLong
                              ? `${block.snippet.slice(0, 240)}…`
                              : block.snippet;
                            return (
                              <li
                                key={idx}
                                className="border-b border-rule pb-2 last:border-b-0"
                              >
                                <span className="meta text-muted mr-2">[{block.type}]</span>
                                <span className="testimony">{text}</span>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>

                    <div>
                      <div className="meta text-muted uppercase tracking-wider mb-2">
                        References
                      </div>
                      {references.length === 0 ? (
                        <p className="meta text-muted">No cited references recorded.</p>
                      ) : (
                        <ul className="space-y-2">
                          {references.map((ref) => (
                            <li
                              key={ref.index}
                              className="border border-rule rounded bg-surface-2 p-2.5 space-y-1"
                            >
                              <div className="flex items-baseline gap-2">
                                <span className="meta font-mono text-muted">[{ref.index}]</span>
                                <a
                                  href={ref.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-ink underline hover:text-accent font-medium break-all"
                                >
                                  {ref.title || ref.link}
                                </a>
                              </div>
                              {ref.source && (
                                <div className="meta text-muted">Source: {ref.source}</div>
                              )}
                              {ref.snippet && (
                                <div className="testimony text-muted italic">
                                  {ref.snippet}
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
              <div className="space-y-4">
                <div>
                  <div className="meta text-muted uppercase tracking-wider mb-1">
                    SerpApi Search ID
                  </div>
                  {searchId ? (
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-ink">{searchId}</span>
                      <a
                        href={`https://serpapi.com/searches/${searchId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink underline hover:text-accent"
                      >
                        Open SerpApi archive record
                      </a>
                    </div>
                  ) : (
                    <div className="meta text-muted">
                      <span className="font-mono">null</span> — This observation has no archive
                      record.
                    </div>
                  )}
                </div>

                <div>
                  <div className="meta text-muted uppercase tracking-wider mb-1">
                    Stored SHA-256 Payload Hash
                  </div>
                  <div className="font-mono text-xs break-all bg-surface-2 p-2.5 border border-rule rounded select-all text-ink">
                    {payloadHash}
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!searchId || isVerifying}
                      onClick={handleVerify}
                      className="font-mono text-xs px-3 py-1.5 rounded border border-rule bg-surface-2 text-ink hover:border-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isVerifying ? "Verifying…" : "Verify against archive"}
                    </button>

                    {verifyResult && (
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded font-medium ${
                            verifyResult.outcome === "MATCH"
                              ? "bg-ok-soft text-ok"
                              : verifyResult.outcome === "MISMATCH"
                              ? "bg-critical-soft text-critical"
                              : "bg-warn-soft text-warn"
                          }`}
                        >
                          {verifyResult.outcome}
                        </span>
                        {verifyResult.message && (
                          <span className="meta text-muted">{verifyResult.message}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {!searchId && (
                    <p className="meta text-muted mt-2">
                      Verification requires an active third-party search record. This observation
                      does not have a registered SerpApi searchId.
                    </p>
                  )}

                  <p className="meta text-muted mt-3">
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-rule">
                  <div>
                    <div className="meta text-muted uppercase tracking-wider mb-1">
                      Captured At
                    </div>
                    <div className="font-mono text-ink">{formatCapturedAt(capturedAt)}</div>
                  </div>
                  <div>
                    <div className="meta text-muted uppercase tracking-wider mb-1">Latency</div>
                    <div className="tabular font-mono text-ink">{latencyMs} ms</div>
                  </div>
                </div>

                <div>
                  <div className="meta text-muted uppercase tracking-wider mb-2">
                    Request Parameters
                  </div>
                  <dl className="space-y-1.5 border border-rule rounded bg-surface-2 p-3">
                    {Object.entries(params).length === 0 ? (
                      <div className="meta text-muted">No request parameters recorded.</div>
                    ) : (
                      Object.entries(params).map(([key, value]) => {
                        const isGeo = GEO_PARAM_KEYS.has(key);
                        return (
                          <div
                            key={key}
                            className={`flex items-baseline justify-between py-1 px-1.5 rounded ${
                              isGeo ? "bg-surface border-l-2 border-accent" : ""
                            }`}
                          >
                            <dt className="meta text-muted flex items-center gap-1.5">
                              <span>{key}</span>
                              {isGeo && (
                                <span className="meta text-[10px] text-accent border border-rule px-1 rounded uppercase">
                                  geo
                                </span>
                              )}
                            </dt>
                            <dd className="font-mono text-ink text-right ml-4 break-all">
                              {value}
                            </dd>
                          </div>
                        );
                      })
                    )}
                  </dl>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="meta text-muted uppercase tracking-wider">
                      cURL Reconstruction
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      className="meta text-muted hover:text-ink font-mono underline"
                    >
                      {hasCopiedCurl ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="scroll-x">
                    <pre className="font-mono text-xs p-3 bg-surface-2 border border-rule rounded text-ink whitespace-pre">
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
