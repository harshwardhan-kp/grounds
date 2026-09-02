import { ForensicInspector } from "@/components/ForensicInspector";
import { LiveCapture } from "@/components/LiveCapture";
import { DivergenceMap } from "@/components/DivergenceMap";
import { PrintDossier } from "@/components/PrintDossier";
import { RemediationPlan } from "@/components/RemediationPlan";
import { VerdictDistribution } from "@/components/VerdictDistribution";
import { WOLF_RIVER_FIXTURE } from "../../../../fixtures/wolf-river";
import {
  VerdictChip,
  EvidencePanel,
  SourceStanceRow,
  ScoreDial,
} from "@/components/Verdict";
import {
  isDefect,
  type Audit,
  type Claim,
  type ClaimCluster,
  type Adjudication,
  type Observation,
  type Probe,
  type Reference,
  type Verdict,
} from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface FixturePayload {
  audit: Audit;
  probes?: Probe[];
  observations?: Observation[];
  claims?: Claim[];
  adjudications?: Adjudication[];
  clusters?: ClaimCluster[];
}

const SEVERITY_ORDER: Record<string, number> = {
  CONTRADICTED: 1,
  UNSOURCED: 2,
  MISCITED: 3,
  CONFLATED: 4,
  STALE: 5,
};

function truncate(str: string, maxLen = 80): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/** Pull the typed text blocks out of a raw SerpApi payload for the inspector. */
function extractTextBlocks(obs?: Observation): { type: string; snippet: string }[] {
  if (!obs?.raw || typeof obs.raw !== "object") return [];
  const rawObj = obs.raw as Record<string, unknown>;
  const nested = (rawObj.ai_overview as Record<string, unknown> | undefined)
    ?.text_blocks;
  const blocks = Array.isArray(rawObj.text_blocks)
    ? rawObj.text_blocks
    : Array.isArray(nested)
      ? nested
      : [];
  return blocks.map((b) => {
    const o = (b ?? {}) as Record<string, unknown>;
    return {
      type: typeof o.type === "string" ? o.type : "paragraph",
      snippet: typeof o.snippet === "string" ? o.snippet : "",
    };
  });
}

function extractReferences(obs?: Observation): Reference[] {
  if (!obs) return [];
  const direct = (obs as unknown as { references?: unknown }).references;
  if (Array.isArray(direct)) {
    return direct as Reference[];
  }
  if (obs.raw && typeof obs.raw === "object") {
    const rawObj = obs.raw as Record<string, unknown>;
    if (Array.isArray(rawObj.references)) {
      return rawObj.references as Reference[];
    }
    if (rawObj.ai_overview && typeof rawObj.ai_overview === "object") {
      const aiOverview = rawObj.ai_overview as Record<string, unknown>;
      if (Array.isArray(aiOverview.references)) {
        return aiOverview.references as Reference[];
      }
    }
  }
  return [];
}

export default async function DossierPage({ params }: PageProps) {
  const { id } = await params;
  void id;
  void SourceStanceRow;

  const fixture = WOLF_RIVER_FIXTURE as unknown as (FixturePayload & Partial<Audit>);
  const audit: Audit =
    "audit" in fixture && fixture.audit ? fixture.audit : (fixture as unknown as Audit);

  const probes: Probe[] = fixture.probes ?? [];
  const observations: Observation[] = fixture.observations ?? [];
  const claims: Claim[] = fixture.claims ?? [];
  const adjudications: Adjudication[] = fixture.adjudications ?? [];
  const clusters: ClaimCluster[] = fixture.clusters ?? [];

  const entityName =
    audit.entityCard?.canonicalName || audit.entityQuery || "Entity Dossier";

  const auditDate = audit.createdAt
    ? audit.createdAt.includes("T")
      ? audit.createdAt.split("T")[0]
      : audit.createdAt.slice(0, 10)
    : "";

  const totalLocales = audit.locales?.length ?? 0;

  const engineSet = new Set<string>();
  observations.forEach((o) => {
    if (o.engine) engineSet.add(o.engine);
  });
  clusters.forEach((c) => {
    c.enginesObserved?.forEach((e) => engineSet.add(e));
  });
  const engineCount = engineSet.size;

  const overallScore = audit.score?.overall ?? 0;
  const accuracyScore = audit.score?.accuracy ?? 0;
  const attributionScore = audit.score?.attributionIntegrity ?? 0;
  const consistencyScore = audit.score?.consistency ?? 0;

  const defectClusters = clusters.filter((c) => isDefect(c.verdict));
  const adverseDefects = defectClusters.filter((c) => c.polarity === "adverse");

  const affectedMarketsSet = new Set<string>();
  defectClusters.forEach((c) => {
    c.observedInLocales?.forEach((loc) => affectedMarketsSet.add(loc));
  });
  const affectedMarketCount = affectedMarketsSet.size;

  let summarySentence = "";
  if (defectClusters.length === 0) {
    summarySentence = `No unsupported claims observed across ${totalLocales} sampled markets.`;
  } else if (adverseDefects.length > 0) {
    summarySentence = `${adverseDefects.length} unsupported adverse claim${
      adverseDefects.length === 1 ? "" : "s"
    } across ${affectedMarketCount} of ${totalLocales} markets.`;
  } else {
    summarySentence = `${defectClusters.length} unsupported claim${
      defectClusters.length === 1 ? "" : "s"
    } across ${affectedMarketCount} of ${totalLocales} markets.`;
  }

  const sortedDefects = [...defectClusters].sort((a, b) => {
    const rankA = SEVERITY_ORDER[a.verdict] ?? 99;
    const rankB = SEVERITY_ORDER[b.verdict] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (b.frequency ?? 0) - (a.frequency ?? 0);
  });

  return (
    <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10 sm:gap-12">
      {/* 1. HEADER BAR */}
      <header className="flex flex-col gap-4 border-b border-rule pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-3xl sm:text-4xl font-serif text-foreground tracking-tight">
            {entityName}
          </h1>
          {audit.fromFixture && (
            <span className="inline-flex items-center px-2.5 py-0.5 border border-rule text-xs tracking-wider uppercase font-medium bg-surface text-muted">
              RECORDED DOSSIER · {auditDate}
            </span>
          )}
        </div>

        <div className="meta flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted">
          <span>Date: {auditDate}</span>
          <span>{probes.length} Probes</span>
          <span>{totalLocales} Locales</span>
          <span>{engineCount} Engines</span>
          <span>
            {audit.searchesSpent} / {audit.searchBudget} Searches Spent
          </span>
        </div>

        <PrintDossier />
      </header>

      {/* 2. SCORE STRIP */}
      <section className="flex flex-col gap-3">
        <div className="border border-rule bg-surface p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 items-center justify-items-center">
            <ScoreDial
              label="Grounds Score"
              {...{ score: overallScore, value: overallScore }}
            />
            <ScoreDial
              label="Accuracy"
              {...{ score: accuracyScore, value: accuracyScore }}
            />
            <ScoreDial
              label="Attribution Integrity"
              {...{ score: attributionScore, value: attributionScore }}
            />
            <ScoreDial
              label="Consistency"
              {...{ score: consistencyScore, value: consistencyScore }}
            />
          </div>
        </div>
      </section>

      {/* 3. EXECUTIVE SUMMARY */}
      <section className="flex flex-col gap-2 border-l-2 border-rule pl-4 py-1">
        <p className="text-lg sm:text-xl font-serif text-foreground leading-relaxed">
          {summarySentence}
        </p>
        <p className="text-xs text-muted">
          Sources that cannot be retrieved or parsed receive an{" "}
          <span className="meta">UNVERIFIABLE</span> stance and are strictly
          excluded from defect scoring.
        </p>
      </section>

      {/* 3b. VERDICT DISTRIBUTION */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-serif text-ink uppercase tracking-wider">
            Verdict Distribution
          </h2>
          <p className="text-xs text-muted">
            Every adjudicated cluster in this audit, grouped by what its cited
            sources turned out to say.
          </p>
        </div>
        <VerdictDistribution clusters={clusters} />
      </section>

      {/* Genuine capture, so a reviewer can re-verify one finding for real. */}
      <section className="flex flex-col gap-3">
        <h2 className="meta">Today&rsquo;s answer, captured live</h2>
        <p className="max-w-[68ch] text-sm text-muted">
          The dossier below is a recorded audit. This one observation is real and
          its SerpApi archive record still exists, so the verification in its
          inspector can be checked against SerpApi rather than taken on trust.
        </p>
        <LiveCapture />
      </section>

      {/* 4. DEFECT REGISTER */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-serif text-foreground uppercase tracking-wider">
            Defect Register
          </h2>
          <p className="text-xs text-muted">
            Aggregated clusters exhibiting citation failure or contradictory
            evidence, ranked by severity.
          </p>
        </div>

        <div className="scroll-x border border-rule bg-surface">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-rule meta text-muted text-xs uppercase tracking-wider">
                <th className="p-3 sm:p-4 font-normal">Claim</th>
                <th className="p-3 sm:p-4 font-normal">Verdict</th>
                <th className="p-3 sm:p-4 font-normal">Polarity</th>
                <th className="p-3 sm:p-4 font-normal">Markets</th>
                <th className="p-3 sm:p-4 font-normal">Frequency</th>
                <th className="p-3 sm:p-4 font-normal">Engines</th>
              </tr>
            </thead>
            <tbody>
              {sortedDefects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted text-sm">
                    No defects identified in this audit.
                  </td>
                </tr>
              ) : (
                sortedDefects.map((cluster) => {
                  const observedCount = cluster.observedInLocales?.length ?? 0;
                  const freqPct = Math.round((cluster.frequency ?? 0) * 100);
                  const enginesLabel =
                    cluster.enginesObserved && cluster.enginesObserved.length > 0
                      ? cluster.enginesObserved.join(", ")
                      : "—";

                  return (
                    <tr
                      key={cluster.id}
                      className="border-b border-rule last:border-b-0 hover:bg-surface/50 transition-colors"
                    >
                      <td
                        className="p-3 sm:p-4 text-foreground font-normal max-w-xs sm:max-w-md truncate"
                        title={cluster.canonicalText}
                      >
                        {truncate(cluster.canonicalText, 80)}
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap">
                        <VerdictChip verdict={cluster.verdict} />
                      </td>
                      <td className="p-3 sm:p-4 meta capitalize whitespace-nowrap text-muted">
                        {cluster.polarity}
                      </td>
                      <td className="p-3 sm:p-4 meta whitespace-nowrap text-muted">
                        <span className="tabular">
                          {observedCount}/{totalLocales}
                        </span>
                      </td>
                      <td className="p-3 sm:p-4 whitespace-nowrap text-foreground">
                        <span className="tabular">{freqPct}%</span>
                      </td>
                      <td className="p-3 sm:p-4 meta whitespace-nowrap text-muted">
                        {enginesLabel}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4b. GEOGRAPHIC DIVERGENCE */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-serif text-ink uppercase tracking-wider">
            Geographic Divergence
          </h2>
          <p className="max-w-[72ch] text-xs text-muted leading-relaxed">
            Which markets produced each assertion, and which markets were
            sampled and did not. Generative answers are not the same everywhere,
            so an assertion present in one market and absent in another is the
            reason a single screenshot cannot be a finding.
          </p>
        </div>
        <DivergenceMap clusters={clusters} locales={audit.locales ?? []} />
      </section>

      {/* 5. EVIDENCE */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-serif text-foreground uppercase tracking-wider">
            Evidence Trail
          </h2>
          <p className="text-xs text-muted">
            Forensic cross-examination of each defect cluster against cited sources
            and independent corroboration probes.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {sortedDefects.length === 0 ? (
            <div className="border border-rule bg-surface p-6 text-sm text-muted">
              No defect cluster was recorded, so there is nothing to cross-examine
              here. Every assertion sampled either held up against the sources
              cited with it, or was excluded from scoring.
            </div>
          ) : null}
          {sortedDefects.map((cluster) => {
            const firstClaimId = cluster.memberClaimIds?.[0];
            const claim = firstClaimId
              ? claims.find((c) => c.id === firstClaimId)
              : undefined;

            const adjudication = firstClaimId
              ? adjudications.find((a) => a.claimId === firstClaimId)
              : undefined;

            const observation = claim
              ? observations.find((o) => o.id === claim.observationId)
              : undefined;

            const references = extractReferences(observation);

            const mappedSources = (adjudication?.sourceJudgements ?? []).map(
              (judgement) => {
                const reference =
                  references.find((r) => r.index === judgement.referenceIndex) ??
                  null;
                return {
                  ...judgement,
                  judgement,
                  reference,
                };
              }
            );

            const trailSearchIds = adjudication?.citationTrail?.length
              ? adjudication.citationTrail
              : observation?.searchId
              ? [observation.searchId]
              : [];

            const trailText =
              trailSearchIds.length > 0
                ? trailSearchIds.join(", ")
                : "none recorded";

            const hash16 = observation?.payloadHash
              ? observation.payloadHash.slice(0, 16)
              : "—";

            const corroborationNote = adjudication?.corroboration
              ? adjudication.corroboration.reasoning ||
                adjudication.corroboration.outcome
              : null;

            // EvidencePanel needs a concrete Reference per source. Sources whose
            // reference could not be resolved are dropped rather than rendered
            // as an unattributed row — an unlabelled strike-through would imply
            // a source was silent when we cannot even name it.
            const panelProps = {
              claimText: claim?.text ?? cluster.canonicalText,
              verdict: adjudication?.verdict ?? cluster.verdict,
              sources: mappedSources
                .filter((s) => s.reference !== null)
                .map((s) => ({
                  reference: s.reference as Reference,
                  stance: s.stance,
                  evidenceQuote: s.evidenceQuote,
                })),
              corroborationNote,
            };

            return (
              <div key={cluster.id} className="flex flex-col gap-2">
                <div className="meta flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted px-1">
                  <span>
                    Citation trail:{" "}
                    <span className="text-foreground">{trailText}</span>
                  </span>
                  <span>
                    Observation hash:{" "}
                    <span className="font-mono text-foreground">{hash16}</span>
                  </span>
                </div>

                {adjudication ? (
                  <>
                    <EvidencePanel {...panelProps} />
                    {observation ? (
                      <ForensicInspector
                        observationId={observation.id}
                        searchId={observation.searchId}
                        payloadHash={observation.payloadHash}
                        params={observation.params}
                        latencyMs={observation.latencyMs}
                        capturedAt={observation.capturedAt}
                        textBlocks={extractTextBlocks(observation)}
                        references={references}
                        suppressed={observation.suppressed}
                      />
                    ) : null}
                  </>
                ) : (
                  <div className="border border-rule bg-surface p-4 text-sm text-muted">
                    No adjudication record available for claim{" "}
                    <span className="meta">{firstClaimId ?? cluster.canonicalText}</span>.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. REMEDIATION */}
      <RemediationPlan clusters={sortedDefects} totalLocales={totalLocales} />

      {/* 7. FOOTER */}
      <footer className="mt-8 pt-8 border-t border-rule text-xs text-muted flex flex-col gap-4">
        <div className="meta uppercase tracking-wider text-muted">
          Methodology & Chain of Custody
        </div>
        <p className="leading-relaxed">
          Verdicts are reached through automated cross-examination of generative
          search answers against cited sources. An assertion is flagged only when all
          readable cited sources on its containing text block provide no factual
          support. Unreachable or unparseable sources receive an unverified stance
          and are never classified as defects.
        </p>
        <p className="leading-relaxed">
          GROUNDS reports empirical observations of generative search output and source
          attribution fidelity. It does not provide legal conclusions, characterizations,
          or assessments of legality.
        </p>
      </footer>
    </main>
  );
}
