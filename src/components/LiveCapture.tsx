import capture from "../../fixtures/live-capture.json";
import { ForensicInspector } from "@/components/ForensicInspector";
import { Bracket, Rule, SectionHead } from "@/components/ui";
import type { Reference } from "@/lib/types";

interface LiveCaptureRecord {
  capturedAt: string;
  query: string;
  location: string;
  searchId: string | null;
  payloadHash: string;
  latencyMs: number;
  params: Record<string, string>;
  archiveUrl?: string;
  suppressed: boolean;
  textBlocks: Array<{
    type?: string;
    snippet?: string;
  }>;
  references: Reference[];
  raw?: unknown;
}

const data = capture as unknown as LiveCaptureRecord;

function formatCapturedDate(iso: string): string {
  try {
    return new Date(iso).toUTCString();
  } catch {
    return iso;
  }
}

export function LiveCapture() {
  const textBlocks = data.textBlocks ?? [];
  const references = data.references ?? [];

  return (
    <section className="bg-surface border border-rule p-6 sm:p-8 flex flex-col gap-6">
      {/* 1. HEADER */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <SectionHead
            index="capture"
            title="Live Capture"
            note="This is a real search captured from SerpApi, retained in their archive, and independently re-checkable."
          />
          <time
            className="meta text-xs text-muted tabular shrink-0 sm:pt-1"
            dateTime={data.capturedAt}
          >
            {formatCapturedDate(data.capturedAt)}
          </time>
        </div>

        <div className="meta text-xs text-muted flex flex-wrap items-baseline">
          <span className="text-ink">&ldquo;{data.query}&rdquo;</span>
          <span className="mx-1.5 text-faint">&middot;</span>
          <span>{data.location}</span>
        </div>
      </div>

      <Rule />

      {/* 2. THE ANSWER */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Bracket tone="muted">generative answer</Bracket>
          {data.suppressed ? (
            <span className="meta text-xs text-muted">(suppressed)</span>
          ) : null}
        </div>

        {data.suppressed ? (
          <div className="p-4 border border-rule bg-surface-2 text-sm text-muted">
            Google returned no generative answer for this probe and this is recorded as an observation rather than an error.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {textBlocks.slice(0, 3).map((block, idx) => {
              const snippet = block.snippet ?? "";
              const text =
                snippet.length > 260 ? `${snippet.slice(0, 260)}...` : snippet;
              return (
                <p key={idx} className="testimony text-base leading-relaxed text-ink">
                  {text}
                </p>
              );
            })}
          </div>
        )}
      </div>

      <Rule />

      {/* 3. CITED SOURCES */}
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline gap-2">
          <Bracket tone="muted">cited sources</Bracket>
          <span className="meta text-xs tabular text-muted">
            ({references.length})
          </span>
        </div>

        {references.length > 0 ? (
          <div className="scroll-x">
            <ul className="divide-y divide-rule border-t border-b border-rule min-w-full">
              {references.map((ref) => (
                <li
                  key={ref.index}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex flex-wrap items-baseline gap-2">
                    <Bracket tone="muted" className="tabular shrink-0">
                      {ref.index}
                    </Bracket>
                    <span className="text-ink font-normal">{ref.title}</span>
                    {ref.source ? (
                      <span className="meta text-xs text-muted">
                        ({ref.source})
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={ref.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="meta text-xs text-muted hover:text-ink hover:underline truncate max-w-xs shrink-0 transition-colors"
                  >
                    {ref.link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted">No cited references recorded.</p>
        )}
      </div>

      <Rule />

      {/* 4. INSPECTOR */}
      <ForensicInspector
        observationId="live-capture"
        searchId={data.searchId}
        payloadHash={data.payloadHash}
        params={data.params}
        latencyMs={data.latencyMs}
        capturedAt={data.capturedAt}
        textBlocks={data.textBlocks.map((b) => ({
          type: b.type ?? "paragraph",
          snippet: b.snippet ?? "",
        }))}
        references={data.references}
        suppressed={data.suppressed}
      />

      <Rule />

      {/* 5. CLOSING */}
      <footer className="meta text-xs text-muted leading-relaxed">
        SerpApi retains archives for 31 days, so if the Verify button reports the record has expired, re-run{" "}
        <code className="mono text-ink">npx tsx scripts/capture-observation.ts</code> to refresh it.
      </footer>
    </section>
  );
}
