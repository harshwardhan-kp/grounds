import capture from "../../fixtures/live-capture.json";
import { ForensicInspector } from "@/components/ForensicInspector";
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
    <section className="bg-surface border border-rule rounded-lg p-6 space-y-6">
      {/* 1. HEADER */}
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs px-2 py-0.5 border border-ok bg-ok-soft text-ok rounded">
            LIVE CAPTURE
          </span>
          <time className="meta text-xs" dateTime={data.capturedAt}>
            {formatCapturedDate(data.capturedAt)}
          </time>
        </div>

        <div className="meta text-xs">
          <span>&ldquo;{data.query}&rdquo;</span>
          <span className="mx-1.5">&middot;</span>
          <span>{data.location}</span>
        </div>

        <p className="text-sm text-muted">
          This is a real search captured from SerpApi, retained in their archive, and independently re-checkable.
        </p>
      </header>

      {/* 2. THE ANSWER */}
      <div>
        {data.suppressed ? (
          <div className="p-4 border border-rule rounded bg-surface text-sm text-muted">
            Google returned no generative answer for this probe and this is recorded as an observation rather than an error.
          </div>
        ) : (
          <div className="space-y-3">
            {textBlocks.slice(0, 3).map((block, idx) => {
              const snippet = block.snippet ?? "";
              const text = snippet.length > 260 ? `${snippet.slice(0, 260)}...` : snippet;
              return (
                <p key={idx} className="testimony text-base leading-relaxed">
                  {text}
                </p>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. CITED SOURCES */}
      <div className="space-y-2">
        <div className="meta text-xs uppercase tracking-wider">
          Cited sources ({references.length})
        </div>

        {references.length > 0 ? (
          <div className="scroll-x">
            <ul className="divide-y divide-rule border-t border-b border-rule min-w-full">
              {references.map((ref) => (
                <li
                  key={ref.index}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="meta text-xs tabular mr-2">[{ref.index}]</span>
                    <span className="font-medium">{ref.title}</span>
                    {ref.source ? (
                      <span className="meta text-xs text-muted ml-2">({ref.source})</span>
                    ) : null}
                  </div>
                  <a
                    href={ref.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="meta text-xs text-muted hover:underline truncate max-w-xs shrink-0"
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

      {/* 5. CLOSING */}
      <footer className="meta text-xs text-muted">
        SerpApi retains archives for 31 days, so if the Verify button reports the record has expired, re-run{" "}
        <code className="font-mono">npx tsx scripts/capture-observation.ts</code> to refresh it.
      </footer>
    </section>
  );
}
