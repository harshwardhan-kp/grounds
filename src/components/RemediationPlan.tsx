import { VerdictChip } from "@/components/Verdict";
import type { ClaimCluster } from "@/lib/types";
import { isDefect } from "@/lib/types";
import type { PivotSource, Remedy, RemedyKind } from "@/lib/engine/remediation";
import { remediationFor } from "../../fixtures/remedies";

/**
 * Remediation surface for the recorded dossier.
 *
 * The engine (`src/lib/engine/remediation.ts`) drafts these by calling the LLM
 * gateway at request time. A dossier page has to render deterministically and
 * without a key, so the recorded dossier reads pre-written examples from
 * `fixtures/remedies.ts` instead. That difference is stated on the page — an
 * example draft must never be mistaken for something a model just produced.
 */

const KIND_LABEL: Record<RemedyKind, string> = {
  correction_request: "Correction request",
  counter_content: "Counter-content",
  profile_fix: "Profile fix",
  escalation: "Escalation",
};

/** What the remedy actually asks somebody to do, in one line. */
const KIND_TARGET: Record<RemedyKind, string> = {
  correction_request: "Sent to the publisher of the pivot source",
  counter_content: "Published on the entity's own domain",
  profile_fix: "Applied to entity records and directory listings",
  escalation: "Prepared for review by the entity's own advisers",
};

const EFFORT_BARS: Record<Remedy["effort"], number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const BAR_HEIGHTS = ["h-1.5", "h-2.5", "h-3.5"];

function EffortMeter({ effort }: { effort: Remedy["effort"] }) {
  const filled = EFFORT_BARS[effort];
  return (
    <span className="inline-flex items-center gap-2">
      <span className="meta text-muted">Effort {effort}</span>
      <span className="inline-flex items-end gap-0.5" aria-hidden="true">
        {BAR_HEIGHTS.map((height, idx) => (
          <span
            key={height}
            className={`w-1 border ${height} ${
              idx < filled
                ? "bg-rule-strong border-rule-strong"
                : "border-rule"
            }`}
          />
        ))}
      </span>
    </span>
  );
}

function PivotSourceBlock({ pivot }: { pivot: PivotSource }) {
  return (
    <div className="border-l-2 border-accent bg-surface-2 px-4 py-3 flex flex-col gap-1">
      <div className="meta text-muted">Pivot source</div>
      <a
        href={pivot.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-accent hover:underline break-words"
      >
        {pivot.title}
      </a>
      <div className="meta text-muted flex flex-wrap gap-x-4 gap-y-1">
        <span className="normal-case tracking-normal">{pivot.domain}</span>
        <span className="tabular">
          Cited {pivot.citationCount}&times;
        </span>
        <span className="tabular">
          {pivot.organicRank === null
            ? "Unranked in top 20"
            : `Organic #${pivot.organicRank}`}
        </span>
        <span className="tabular">Score {pivot.score.toFixed(1)}</span>
      </div>
      <p className="text-xs text-muted leading-relaxed">{pivot.why}</p>
    </div>
  );
}

function RemedyCard({ remedy }: { remedy: Remedy }) {
  return (
    <article className="border border-rule bg-surface flex flex-col">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-rule px-4 py-3">
        <div className="flex flex-col gap-1 min-w-[16rem] flex-1">
          <span className="meta text-muted">{KIND_LABEL[remedy.kind]}</span>
          <h4 className="text-sm font-medium text-ink">{remedy.title}</h4>
          <span className="text-xs text-muted">{KIND_TARGET[remedy.kind]}</span>
        </div>
        <div className="flex items-center gap-5 shrink-0">
          <EffortMeter effort={remedy.effort} />
          <div className="flex flex-col items-end">
            <span className="tabular text-xl leading-none text-ink">
              {remedy.priority}
            </span>
            <span className="meta text-muted">Priority</span>
          </div>
        </div>
      </header>

      <p className="px-4 py-3 text-sm leading-relaxed text-muted">
        {remedy.rationale}
      </p>

      <details className="group border-t border-rule">
        <summary className="cursor-pointer list-none px-4 py-2.5 meta text-muted hover:text-ink select-none">
          <span className="group-open:hidden">Show example draft</span>
          <span className="hidden group-open:inline">Hide example draft</span>
        </summary>
        <div className="scroll-x border-t border-rule bg-surface-2 px-4 py-4">
          <pre className="testimony whitespace-pre text-ink text-[0.85rem] leading-relaxed">
            {remedy.draft}
          </pre>
        </div>
      </details>
    </article>
  );
}

export function RemediationPlan({
  clusters,
  totalLocales,
}: {
  /** Already severity-sorted defect clusters from the dossier. */
  clusters: ClaimCluster[];
  totalLocales: number;
}) {
  // An UNVERIFIABLE cluster is not a defect and must never earn a remedy. The
  // fixture holds none, and this guard keeps that true if the fixture changes.
  const plans = clusters
    .filter((cluster) => isDefect(cluster.verdict))
    .map((cluster) => ({ cluster, plan: remediationFor(cluster.id) }))
    .filter(
      (entry): entry is { cluster: ClaimCluster; plan: NonNullable<ReturnType<typeof remediationFor>> } =>
        entry.plan !== null && entry.plan.remedies.length > 0
    );

  // The register and evidence trail above are ordered by verdict severity. This
  // section is a work queue, so it is ordered the way the engine ranks remedies:
  // priority first, which folds harm and cross-market reach together. A widely
  // repeated adverse assertion outranks a narrow one of a graver verdict class.
  plans.sort((a, b) => {
    const top = (p: typeof a) =>
      Math.max(...p.plan.remedies.map((r) => r.priority));
    return top(b) - top(a);
  });

  const remedyCount = plans.reduce((n, p) => n + p.plan.remedies.length, 0);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-serif text-ink uppercase tracking-wider">
            Remediation Plan
          </h2>
          <span className="inline-flex items-center border border-rule bg-surface px-2.5 py-0.5 meta text-muted">
            Example drafts
          </span>
        </div>
        <p className="max-w-[72ch] text-xs text-muted leading-relaxed">
          {remedyCount} action{remedyCount === 1 ? "" : "s"} across{" "}
          {plans.length} defect cluster{plans.length === 1 ? "" : "s"}. Each is
          anchored to its pivot source — the cited document the answer leans on
          hardest, scored by how often it was cited in this cluster and how
          highly it ranks organically — so an approach is aimed at one URL rather
          than spread across a results page. Ordered by priority, which is harm
          weight multiplied by the share of sampled markets the assertion reached,
          rather than by verdict severity.
        </p>
        <p className="max-w-[72ch] text-xs text-muted leading-relaxed">
          The drafts below are pre-written examples of what the remediation stage
          produces, committed with the recorded dossier so this page renders
          without calling a model. A live audit drafts them at request time from
          its own findings. Clusters whose sources could not be read produce no
          remedy at all.
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="border border-rule bg-surface p-6 text-sm text-muted">
          No remediation drafted. Either no defect cluster was recorded, or the
          clusters recorded have no example plan committed alongside them.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {plans.map(({ cluster, plan }) => {
            const observed = cluster.observedInLocales?.length ?? 0;
            return (
              <div key={cluster.id} className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 border-b border-rule pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <VerdictChip verdict={cluster.verdict} size="sm" />
                    <span className="meta text-muted tabular">
                      {observed}/{totalLocales} markets
                    </span>
                    <span className="meta text-muted tabular">
                      {Math.round((cluster.frequency ?? 0) * 100)}% frequency
                    </span>
                  </div>
                  <p className="testimony text-ink leading-relaxed max-w-[72ch]">
                    {cluster.canonicalText}
                  </p>
                </div>

                {plan.pivot ? (
                  <PivotSourceBlock pivot={plan.pivot} />
                ) : (
                  <div className="border-l-2 border-rule bg-surface-2 px-4 py-3 text-xs text-muted">
                    No pivot source resolved. No single cited document stood out,
                    so remediation targets the entity&rsquo;s own record rather
                    than a publisher.
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {plan.remedies.map((remedy, idx) => (
                    <RemedyCard key={`${cluster.id}-${idx}`} remedy={remedy} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
