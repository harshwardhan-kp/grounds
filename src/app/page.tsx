import Link from "next/link";
import { VerdictChip } from "@/components/Verdict";
import type { Verdict } from "@/lib/types";

interface VerdictExplanation {
  verdict: Verdict;
  description: string;
}

const VERDICT_EXPLANATIONS: VerdictExplanation[] = [
  {
    verdict: "GROUNDED",
    description: "Cited sources support the claim and independent corroboration checks out.",
  },
  {
    verdict: "MISCITED",
    description: "True, but the cited sources do not contain or support the claim.",
  },
  {
    verdict: "UNSOURCED",
    description: "Cited sources are silent and no independent corroboration was found.",
  },
  {
    verdict: "CONTRADICTED",
    description: "Independent authoritative sources directly refute the assertion.",
  },
  {
    verdict: "STALE",
    description: "Was true previously, but a newer source refutes it.",
  },
  {
    verdict: "CONFLATED",
    description: "True of a different entity in the collision set, wrongly attributed to the target.",
  },
  {
    verdict: "UNVERIFIABLE",
    description:
      "Cited sources could not be retrieved, paywalled, or parsed; never counted as a defect because an unreadable source must never become an accusation.",
  },
  {
    verdict: "OPINION",
    description: "Subjective, evaluative, or predictive statements excluded from defect scoring.",
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-[900px] flex-col gap-12 px-6 py-16 sm:gap-16 sm:py-24">
      {/* 1. WORDMARK */}
      <header className="flex flex-col gap-4">
        <div className="meta tracking-widest text-xs uppercase text-muted">
          GROUNDS
        </div>

        {/* 2. HEADLINE */}
        <h1 className="font-serif text-[clamp(2rem,4.5vw,3.2rem)] font-normal leading-tight [text-wrap:balance]">
          Every AI answer about you, cross-examined against its own sources.
        </h1>

        {/* 3. DECK */}
        <p className="max-w-[60ch] text-base leading-relaxed text-muted">
          Generative search now answers questions about companies directly, citing
          sources alongside its assertions, but nobody checks whether those sources
          actually support what the AI says. GROUNDS makes this gap measurable,
          systematic, and forensically auditable.
        </p>
      </header>

      {/* 4. THE CASE */}
      <section className="border border-rule border-l-2 border-l-critical bg-surface p-6 sm:p-8">
        <div className="meta mb-3 text-xs uppercase tracking-wider text-muted">
          THE CASE THAT MOTIVATES THIS
        </div>
        <p className="text-base leading-relaxed">
          In 2025 an AI Overview told searchers a Minnesota solar installer was
          being sued by the state Attorney General. It was not. The answer cited
          four sources; none of them contained the claim. The company reported
          losing a $150,000 contract. In July 2026 a judge denied Google&apos;s
          motion to dismiss the resulting defamation suit.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Google has since corrected that answer — which is exactly why this has
          to be measured continuously rather than once.
        </p>
      </section>

      {/* 5. ACTION ROW */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/dossier/wolf-river"
            className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink no-underline transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Open the recorded dossier
          </Link>
          <Link
            href="#method"
            className="rounded border border-rule bg-surface px-5 py-2.5 text-sm font-medium no-underline transition-colors hover:border-rule-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            How it works
          </Link>
        </div>
        <div className="meta text-xs text-muted">
          Recorded 2026-09-01 · 148 SerpApi searches · 8 markets
        </div>
      </section>

      {/* 6. METHOD */}
      <section id="method" className="flex flex-col gap-6 pt-4">
        <h2 className="text-lg font-semibold tracking-tight">Method</h2>
        <ol className="flex flex-col gap-4">
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">01</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Docketing</strong>
              {" — "}
              Establish the canonical entity card, domain, aliases, operating locations, and a collision set of confusingly-similar entities.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">02</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Line of questioning</strong>
              {" — "}
              Compile a structured probe grid across identity, adverse, commercial, qualification, and operational query families.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">03</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Deposition</strong>
              {" — "}
              Execute queries across multiple locales and engines, recording raw payloads in an immutable, append-only chain of custody.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">04</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Claim decomposition</strong>
              {" — "}
              Segment generative responses into atomic subject-predicate-object assertions with character spans and containing block references.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">05</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Cross-examination</strong>
              {" — "}
              Check claims against the union of cited block references via indexed snippets before fetching, followed by independent corroboration.
            </p>
          </li>
          <li className="flex items-start gap-4">
            <span className="tabular meta shrink-0 text-muted">06</span>
            <p className="text-sm leading-relaxed">
              <strong className="font-semibold text-foreground">Divergence and scoring</strong>
              {" — "}
              Cluster repeated assertions across markets, evaluate frequency and cross-locale inconsistencies, and produce composite grounds scores.
            </p>
          </li>
        </ol>
      </section>

      {/* 7. VERDICT KEY */}
      <section className="flex flex-col gap-6 pt-4">
        <h2 className="text-lg font-semibold tracking-tight">Verdict taxonomy</h2>
        <div className="scroll-x">
          <dl className="flex min-w-[600px] flex-col divide-y divide-rule border-y border-rule">
            {VERDICT_EXPLANATIONS.map(({ verdict, description }) => (
              <div
                key={verdict}
                className="flex items-baseline gap-6 py-3"
              >
                <dt className="w-36 shrink-0">
                  <VerdictChip verdict={verdict} />
                </dt>
                <dd className="text-sm leading-relaxed text-muted">
                  {description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 8. FOOTER */}
      <footer className="border-t border-rule pt-8">
        <p className="meta text-xs text-muted">
          GROUNDS reports observations, not legal conclusions.
        </p>
      </footer>
    </main>
  );
}
