import { VerdictChip } from "@/components/Verdict";
import { isDefect, type ClaimCluster, type Verdict } from "@/lib/types";

/**
 * Verdict distribution across the audit's clusters.
 *
 * WHY THE THREE-WAY SPLIT AT THE TOP
 * The single most misreadable number in an audit like this is "how much was
 * wrong". Clusters fall into three groups that must never be added together:
 * ones whose sources held up, ones that count as defects, and ones excluded
 * from scoring entirely. UNVERIFIABLE lives in the third group — we could not
 * read the sources, which is a limit of the audit and not a finding against the
 * entity. Showing the split first makes that impossible to conflate.
 */

/** Display order: supported first, then defects by severity, then excluded. */
const VERDICT_ORDER: Verdict[] = [
  "GROUNDED",
  "CONTRADICTED",
  "UNSOURCED",
  "MISCITED",
  "CONFLATED",
  "STALE",
  "UNVERIFIABLE",
  "OPINION",
];

type Family = "supported" | "defect" | "excluded";

function familyOf(verdict: Verdict): Family {
  if (isDefect(verdict)) return "defect";
  if (verdict === "GROUNDED") return "supported";
  return "excluded";
}

const FAMILY_FILL: Record<Family, string> = {
  supported: "bg-ok",
  defect: "bg-critical",
  excluded: "bg-neutral",
};

const FAMILY_LABEL: Record<Family, string> = {
  supported: "Sources held up",
  defect: "Counted as defects",
  excluded: "Excluded from scoring",
};

const FAMILY_ORDER: Family[] = ["defect", "supported", "excluded"];

export function VerdictDistribution({
  clusters,
}: {
  clusters: ClaimCluster[];
}) {
  const total = clusters.length;

  if (total === 0) {
    return (
      <div className="border border-rule bg-surface p-6 text-sm text-muted">
        No clusters were adjudicated in this audit, so there is no distribution
        to report.
      </div>
    );
  }

  const byVerdict = new Map<Verdict, number>();
  const byFamily = new Map<Family, number>();
  for (const cluster of clusters) {
    byVerdict.set(cluster.verdict, (byVerdict.get(cluster.verdict) ?? 0) + 1);
    const family = familyOf(cluster.verdict);
    byFamily.set(family, (byFamily.get(family) ?? 0) + 1);
  }

  const present = VERDICT_ORDER.filter((v) => (byVerdict.get(v) ?? 0) > 0);
  const maxCount = Math.max(...present.map((v) => byVerdict.get(v) ?? 0));

  return (
    <div className="border border-rule bg-surface p-5 sm:p-6 flex flex-col gap-5">
      {/* Three-way split. Adding these together would be the wrong reading. */}
      <div className="flex flex-col gap-2">
        <div className="flex h-2.5 w-full overflow-hidden border border-rule">
          {FAMILY_ORDER.map((family) => {
            const count = byFamily.get(family) ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={family}
                className={FAMILY_FILL[family]}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${FAMILY_LABEL[family]}: ${count} of ${total}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
          {FAMILY_ORDER.map((family) => {
            const count = byFamily.get(family) ?? 0;
            if (count === 0) return null;
            return (
              <span key={family} className="inline-flex items-center gap-2">
                <span
                  className={`inline-block h-2.5 w-2.5 ${FAMILY_FILL[family]}`}
                />
                <span className="meta text-muted">
                  {FAMILY_LABEL[family]}
                </span>
                <span className="tabular text-xs text-ink">{count}</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Per-verdict counts. */}
      <dl className="flex flex-col divide-y divide-rule border-t border-rule">
        {present.map((verdict) => {
          const count = byVerdict.get(verdict) ?? 0;
          return (
            <div
              key={verdict}
              className="flex items-center gap-4 py-2.5"
            >
              <dt className="w-32 shrink-0">
                <VerdictChip verdict={verdict} size="sm" />
              </dt>
              <dd className="flex flex-1 items-center gap-3">
                <span className="flex h-1.5 flex-1 min-w-16">
                  <span
                    className={FAMILY_FILL[familyOf(verdict)]}
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </span>
                <span className="tabular w-8 shrink-0 text-right text-sm text-ink">
                  {count}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className="text-xs leading-relaxed text-muted">
        Counts are clusters, not individual observations: the same assertion seen
        in four markets is one cluster. UNVERIFIABLE means the cited sources
        could not be read, so it is excluded from scoring rather than counted
        against the entity.
      </p>
    </div>
  );
}
