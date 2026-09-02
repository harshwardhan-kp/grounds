import type { Reference, SourceStance, Verdict } from "@/lib/types";

const VERDICT_STYLES: Record<Verdict, string> = {
  GROUNDED: "bg-ok-soft text-ok border-ok",
  MISCITED: "bg-warn-soft text-warn border-warn",
  STALE: "bg-warn-soft text-warn border-warn",
  CONFLATED: "bg-warn-soft text-warn border-warn",
  UNVERIFIABLE: "bg-warn-soft text-warn border-warn",
  UNSOURCED: "bg-critical-soft text-critical border-critical",
  CONTRADICTED: "bg-critical-soft text-critical border-critical",
  OPINION: "bg-neutral-soft text-neutral border-neutral",
};

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
  const colorClasses = VERDICT_STYLES[verdict];
  const sizeClasses =
    size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";

  return (
    <span
      className={`inline-flex items-center font-mono uppercase tracking-wide border rounded-[3px] font-medium leading-none ${sizeClasses} ${colorClasses}`}
    >
      {verdict}
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

  const titleClasses =
    stance === "silent"
      ? "line-through text-muted"
      : stance === "opaque"
        ? "text-muted"
        : "text-foreground";

  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex items-baseline gap-2 flex-wrap">
        {reference.link ? (
          <a
            href={reference.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`hover:underline font-medium ${titleClasses}`}
          >
            {reference.title}
          </a>
        ) : (
          <span className={`font-medium ${titleClasses}`}>
            {reference.title}
          </span>
        )}
        {domain && <span className="meta text-xs text-muted">{domain}</span>}
        {stance === "opaque" && (
          <span className="meta text-xs text-muted italic">could not read</span>
        )}
      </div>

      {evidenceQuote && stance === "supports" && (
        <blockquote className="testimony text-sm text-foreground pl-3 border-l-2 border-rule">
          {evidenceQuote}
        </blockquote>
      )}

      {evidenceQuote && stance === "contradicts" && (
        <blockquote className="testimony text-sm text-critical pl-3 border-l-2 border-critical">
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
    <div className="bg-surface border border-rule rounded p-5 sm:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3 items-start">
          <div className="meta text-xs uppercase tracking-wide text-muted">
            What the AI said
          </div>
          <p className="testimony text-base leading-relaxed text-foreground">
            {claimText}
          </p>
          <VerdictChip verdict={verdict} />
        </div>

        <div className="flex flex-col gap-3">
          <div className="meta text-xs uppercase tracking-wide text-muted">
            What its cited sources say
          </div>
          <div className="flex flex-col gap-3">
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
  const scoreColor =
    score >= 80 ? "text-ok" : score >= 55 ? "text-warn" : "text-critical";

  return (
    <div className="flex flex-col gap-1">
      <div
        className={`tabular text-3xl sm:text-4xl font-semibold leading-none ${scoreColor}`}
      >
        {score}
      </div>
      <div className="meta text-xs text-muted">{label}</div>
    </div>
  );
}
