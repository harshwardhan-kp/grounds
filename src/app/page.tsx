import Link from "next/link";
import type { Verdict } from "@/lib/types";
import {
  Bracket,
  Rule,
  SectionHead,
  PillButton,
  Annotation,
  Wordmark,
} from "@/components/ui";
import { VerdictChip } from "@/components/Verdict";

interface Stage {
  name: string;
  description: string;
}

const STAGES: Stage[] = [
  {
    name: "docketing",
    description:
      "Target entity is registered, aliases and collision-set neighbours are indexed, and the search budget is established.",
  },
  {
    name: "line of questioning",
    description:
      "Deterministic probe families are compiled across identity, adverse, commercial, qualification, and operational queries.",
  },
  {
    name: "deposition",
    description:
      "Probes are dispatched across a geographic locale grid, capturing append-only raw engine observations and suppression records.",
  },
  {
    name: "claim decomposition",
    description:
      "Generative answers are parsed into atomic factual assertions mapped to their containing block text and cited reference indices.",
  },
  {
    name: "cross-examination",
    description:
      "Every atomic assertion is tested against the union of its block citations via SerpApi snippet evaluation and verified page retrieval.",
  },
  {
    name: "divergence and scoring",
    description:
      "Observed assertions are clustered across locales and engines to compute attribution integrity, consistency, and overall grounds scores.",
  },
];

interface VerdictDefinition {
  verdict: Verdict;
  meaning: string;
}

const VERDICTS: VerdictDefinition[] = [
  {
    verdict: "GROUNDED",
    meaning:
      "Cited sources support the claim and independent corroboration checks out.",
  },
  {
    verdict: "MISCITED",
    meaning:
      "The claim may be true, but the sources Google cited do not contain it.",
  },
  {
    verdict: "UNSOURCED",
    meaning:
      "Cited sources are silent on the claim and no independent corroboration exists.",
  },
  {
    verdict: "CONTRADICTED",
    meaning:
      "Independent corroborating sources directly refute the assertion.",
  },
  {
    verdict: "STALE",
    meaning:
      "The assertion was previously true, but a newer authoritative source refutes it.",
  },
  {
    verdict: "CONFLATED",
    meaning:
      "The assertion is true of a different entity in the collision set.",
  },
  {
    verdict: "UNVERIFIABLE",
    meaning:
      "Cited sources could not be read due to paywalls, blocks, or unparseable formats.",
  },
  {
    verdict: "OPINION",
    meaning:
      "Subjective value judgement or prediction, excluded from scoring.",
  },
];

export default function HomePage() {
  return (
    <div className="max-w-[1080px] mx-auto px-6 flex flex-col gap-20 pt-8 pb-0">
      {/* 1. TOP BAR */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="mono lowercase text-sm text-ink hover:text-red active:text-red transition-colors"
          >
            grounds
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/depose"
              className="group text-muted hover:text-red active:text-red transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
            >
              <Bracket className="group-hover:text-red group-active:text-red transition-colors">
                deposition
              </Bracket>
            </Link>
            <Link
              href="/dossier/wolf-river"
              className="group text-muted hover:text-red active:text-red transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1"
            >
              <Bracket className="group-hover:text-red group-active:text-red transition-colors">
                recorded dossier
              </Bracket>
            </Link>
          </nav>
        </div>
        <Rule />
      </header>

      {/* 2. HERO */}
      <section className="flex flex-col gap-6 text-center">
        <h1 className="display lowercase text-[clamp(2.6rem,7vw,5rem)] leading-[1.08] text-ink tracking-tight [text-wrap:balance] text-center m-0">
          every ai answer about you,{" "}
          <span className="italic">cross-examined</span> against its own sources
        </h1>
        <p className="text-muted text-[1.15rem] leading-relaxed max-w-[54ch] mx-auto text-center m-0">
          generative search now answers questions about companies directly and cites
          sources, and nobody checks whether those sources actually support what it says.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <PillButton href="/dossier/wolf-river" variant="primary">
            open the recorded dossier
          </PillButton>
          <PillButton href="/depose" variant="secondary">
            watch a deposition
          </PillButton>
        </div>
        <p className="meta text-xs text-muted text-center m-0">
          <Bracket tone="muted">
            recorded 2026-09-01 · 148 searches · 8 markets
          </Bracket>
        </p>
      </section>

      {/* 3. THE CASE */}
      <section className="flex flex-col gap-6">
        <SectionHead
          index="01"
          title="the case that started this"
          className="w-full items-center text-center [&>div]:justify-center [&_h2]:text-[2rem]"
        />
        <div className="flex flex-col gap-4 max-w-[64ch] mx-auto w-full">
          <p className="text-ink text-[1.05rem] leading-relaxed max-w-[64ch] mx-auto m-0">
            In 2025 a Google AI Overview told searchers a Minnesota solar installer was being
            sued by the state Attorney General. It was not. The answer cited four sources and
            none of them contained the claim. The company reported losing a $150,000 contract
            and sued Google; that litigation is ongoing.
          </p>
          <p className="text-muted text-[1.05rem] leading-relaxed max-w-[64ch] mx-auto m-0">
            Google has since corrected that answer, which is the point — generative answers
            change underneath you, so this has to be measured continuously rather than once.
          </p>
        </div>
        <div className="flex flex-col gap-3 max-w-[64ch] mx-auto w-full">
          <Annotation label="cited">
            four sources, formatted exactly like a grounded answer
          </Annotation>
          <Annotation label="contained">
            none of them carried the claim
          </Annotation>
          <Annotation label="cost">
            a $150,000 contract
          </Annotation>
        </div>
      </section>

      {/* 4. THE GAP */}
      <section className="flex flex-col gap-4">
        <SectionHead
          index="02"
          title="what nobody measures"
          className="w-full items-center text-center [&>div]:justify-center [&_h2]:text-[2rem]"
        />
        <div className="flex flex-col gap-4 max-w-[64ch] mx-auto w-full">
          <p className="text-ink text-[1.05rem] leading-relaxed max-w-[64ch] mx-auto m-0">
            There is a whole category of AI-visibility tools and they all measure the
            same thing — is the brand mentioned, in which prompts, with what sentiment.
          </p>
          <p className="text-muted text-[1.05rem] leading-relaxed max-w-[64ch] mx-auto m-0">
            None of them check whether the sources cited beside a sentence actually
            contain that sentence. The missing property is{" "}
            <span className="text-red">attribution integrity</span>.
          </p>
        </div>
      </section>

      {/* 5. METHOD */}
      <section className="flex flex-col gap-6">
        <SectionHead
          index="03"
          title="how a deposition runs"
          className="w-full items-center text-center [&>div]:justify-center [&_h2]:text-[2rem]"
        />
        <ol className="flex flex-col gap-8 list-none p-0 m-0 max-w-[860px] mx-auto w-full">
          {STAGES.map((stage, idx) => (
            <li
              key={stage.name}
              className="grid grid-cols-1 min-[720px]:grid-cols-[200px_1fr] items-baseline gap-2 min-[720px]:gap-6 text-left"
            >
              <div className="flex items-baseline gap-2.5">
                <span className="tabular mono text-muted text-xs">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <Bracket tone="ink" className="text-[1.02rem]">
                  {stage.name}
                </Bracket>
              </div>
              <p className="text-muted text-[1.02rem] leading-relaxed m-0">
                {stage.description}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* 6. VERDICTS */}
      <section className="flex flex-col gap-6">
        <SectionHead
          index="04"
          title="the eight verdicts"
          className="w-full items-center text-center [&>div]:justify-center [&_h2]:text-[2rem]"
        />
        <dl className="flex flex-col gap-6 m-0 p-0 max-w-[860px] mx-auto w-full">
          {VERDICTS.map(({ verdict, meaning }) => (
            <div
              key={verdict}
              className="grid grid-cols-1 min-[720px]:grid-cols-[180px_1fr] items-baseline gap-2 min-[720px]:gap-6 text-left"
            >
              <dt className="m-0">
                <VerdictChip verdict={verdict} />
              </dt>
              <dd className="text-muted text-[1.02rem] leading-relaxed m-0">
                {meaning}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted text-[1.05rem] leading-relaxed pt-6 border-t border-rule max-w-[860px] mx-auto w-full m-0">
          <span className="mono text-ink">UNVERIFIABLE</span> is never counted as a
          defect, because an unreadable source must never become an accusation.
        </p>
      </section>

      {/* 7. FOOT */}
      <footer className="flex flex-col gap-8">
        <Rule />
        <p className="meta text-xs text-muted text-center m-0">
          <Bracket tone="muted">
            grounds reports observations, not legal conclusions
          </Bracket>
        </p>
        <Wordmark text="grounds" />
      </footer>
    </div>
  );
}
