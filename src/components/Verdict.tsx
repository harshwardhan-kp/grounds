import type { Reference, SourceStance, Verdict } from "@/lib/types";
import { Bracket, Marker } from "@/components/ui";

function extractDomain(link: string, fallbackSource: string | null): string {
  try {
    const url = new URL(link.startsWith("http") ? link : `https://${link}`);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return fallbackSource ?? "";
  }
}

export function VerdictChip({
  verdict,
  size = "md",
}: {
  verdict: Verdict;
  size?: "sm" | "md";
}) {
  const hasMarker =
    verdict === "UNSOURCED" ||
    verdict === "CONTRADICTED" ||
    verdict === "MISCITED" ||
    verdict === "STALE" ||
    verdict === "CONFLATED";

  const textColor =
    verdict === "UNSOURCED" || verdict === "CONTRADICTED"
      ? "text-red"
      : verdict === "UNVERIFIABLE" || verdict === "OPINION"
        ? "text-faint"
        : "text-ink";

  const sizeClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClass}`}>
      {hasMarker && <Marker tone="red" />}
      <span className={`bracket ${textColor}`}>
        {verdict.toLowerCase()}
      </span>
    </span>
  );
}

export function SourceStanceRow({
  reference,
  stance,
  evidenceQuote,
}: {
  reference: Reference;
  stance: SourceStance;
  evidenceQuote?: string | null;
}) {
  const domain = extractDomain(reference.link, reference.source);

  const titleClass =
    stance === "silent"
      ? "line-through text-faint"
      : stance === "opaque"
        ? "text-faint"
        : "text-ink";

  return (
    <div className="flex flex-col gap-2 py-3 border-b border-rule last:border-b-0 first:pt-0 last:pb-0">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-2 flex-wrap">
          {reference.link ? (
            <a
              href={reference.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:underline text-sm ${titleClass}`}
            >
              {reference.title}
            </a>
          ) : (
            <span className={`text-sm ${titleClass}`}>
              {reference.title}
            </span>
          )}
          {stance === "opaque" && (
            <span className="bracket text-faint text-xs">could not read</span>
          )}
        </div>
        {domain ? (
          <span className="mono text-xs text-muted">{domain}</span>
        ) : null}
      </div>

      {evidenceQuote && stance === "supports" && (
        <blockquote className="testimony text-sm text-ink pl-3 border-l border-rule">
          {evidenceQuote}
        </blockquote>
      )}

      {evidenceQuote && stance === "contradicts" && (
        <blockquote className="testimony text-sm text-red pl-3 border-l border-red-rule">
          {evidenceQuote}
        </blockquote>
      )}
    </div>
  );
}

export function EvidencePanel({
  claimText,
  verdict,
  sources,
  corroborationNote,
}: {
  claimText: string;
  verdict: Verdict;
  sources: {
    reference: Reference;
    stance: SourceStance;
    evidenceQuote?: string | null;
  }[];
  corroborationNote?: string | null;
}) {
  return (
    <div className="bg-surface p-6">
      <div className="grid grid-cols-1 min-[720px]:grid-cols-2">
        <div className="flex flex-col gap-4 items-start pb-6 min-[720px]:pb-0 min-[720px]:pr-8 border-b min-[720px]:border-b-0 min-[720px]:border-r border-rule">
          <Bracket tone="muted">what the AI said</Bracket>
          <p className="testimony text-lg min-[720px]:text-xl leading-relaxed text-ink">
            {claimText}
          </p>
          <div className="mt-auto pt-2">
            <VerdictChip verdict={verdict} />
          </div>
        </div>

        <div className="flex flex-col gap-4 pt-6 min-[720px]:pt-0 min-[720px]:pl-8">
          <Bracket tone="muted">what its cited sources say</Bracket>
          <div className="flex flex-col">
            {sources.map((source, idx) => (
              <SourceStanceRow
                key={
                  source.reference.link
                    ? `${source.reference.link}-${idx}`
                    : `${source.reference.index}-${idx}`
                }
                reference={source.reference}
                stance={source.stance}
                evidenceQuote={source.evidenceQuote}
              />
            ))}
          </div>
          {corroborationNote && (
            <p className="text-xs text-muted leading-relaxed">
              {corroborationNote}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ScoreDial({
  score,
  label,
}: {
  score: number;
  label: string;
}) {
  const isCritical = score < 55;
  const isWarning = score >= 55 && score < 80;
  const scoreColor = isCritical ? "text-red" : "text-ink";

  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex items-center gap-2">
        <span
          className={`display tabular text-4xl sm:text-5xl leading-none ${scoreColor}`}
        >
          {score}
        </span>
        {isWarning && <Marker tone="red" />}
      </div>
      <Bracket tone="muted">{label.toLowerCase()}</Bracket>
    </div>
  );
}
