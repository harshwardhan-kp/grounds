import { VerdictChip } from "@/components/Verdict";
import { isDefect, type ClaimCluster, type Locale } from "@/lib/types";

/**
 * Geographic divergence — which markets an assertion appeared in, and which
 * markets were sampled and did not produce it.
 *
 * WHY THIS IS A VIEW AND NOT A FOOTNOTE
 * Generative answers are not the same everywhere. An assertion that surfaces in
 * Minneapolis and not in Austin is not a rounding error; it is the reason a
 * single screenshot cannot be a finding, and the reason the audit samples a
 * grid. The absent cells carry as much weight as the present ones: they are the
 * evidence that the sampling actually happened.
 */

type Presence = "observed" | "absent" | "not-sampled";

function presenceIn(cluster: ClaimCluster, localeId: string): Presence {
  if (cluster.observedInLocales?.includes(localeId)) return "observed";
  if (cluster.absentInLocales?.includes(localeId)) return "absent";
  return "not-sampled";
}

const CELL_STYLES: Record<Presence, string> = {
  observed: "bg-accent-soft border-accent",
  absent: "bg-surface-2 border-rule",
  "not-sampled": "border-rule border-dashed",
};

const DEFECT_CELL = "bg-critical-soft border-critical";

const CELL_LABEL: Record<Presence, string> = {
  observed: "observed",
  absent: "sampled, did not appear",
  "not-sampled": "not sampled",
};

function Cell({
  presence,
  defect,
  label,
}: {
  presence: Presence;
  defect: boolean;
  label: string;
}) {
  const style =
    presence === "observed" && defect ? DEFECT_CELL : CELL_STYLES[presence];
  return (
    <span
      title={label}
      aria-label={label}
      className={`block h-4 w-full min-w-4 border ${style}`}
    />
  );
}

function LegendKey({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3 w-4 border ${className}`} />
      <span className="meta text-muted">{children}</span>
    </span>
  );
}

export function DivergenceMap({
  clusters,
  locales,
}: {
  clusters: ClaimCluster[];
  locales: Locale[];
}) {
  if (clusters.length === 0 || locales.length === 0) {
    return (
      <div className="border border-rule bg-surface p-6 text-sm text-muted">
        No clusters were recorded across the sampled markets, so there is no
        divergence to show.
      </div>
    );
  }

  // Defects first, then everything else — the eye should land on the rows that
  // change from market to market.
  const rows = [...clusters].sort((a, b) => {
    const defectDelta = Number(isDefect(b.verdict)) - Number(isDefect(a.verdict));
    if (defectDelta !== 0) return defectDelta;
    return (b.frequency ?? 0) - (a.frequency ?? 0);
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-x border border-rule bg-surface">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-rule">
              <th className="meta p-3 font-normal align-bottom min-w-[18rem]">
                Assertion
              </th>
              {locales.map((locale) => (
                <th
                  key={locale.id}
                  className="meta p-3 font-normal align-bottom whitespace-nowrap"
                  title={locale.location}
                >
                  {locale.label}
                </th>
              ))}
              <th className="meta p-3 font-normal align-bottom whitespace-nowrap text-right">
                Seen in
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((cluster) => {
              const defect = isDefect(cluster.verdict);
              const observedCount = cluster.observedInLocales?.length ?? 0;
              return (
                <tr key={cluster.id} className="border-b border-rule last:border-b-0">
                  <td className="p-3 align-middle">
                    <div className="flex flex-col gap-1.5">
                      <VerdictChip verdict={cluster.verdict} size="sm" />
                      <span className="text-xs leading-snug text-muted max-w-[26rem]">
                        {cluster.canonicalText}
                      </span>
                    </div>
                  </td>
                  {locales.map((locale) => {
                    const presence = presenceIn(cluster, locale.id);
                    return (
                      <td key={locale.id} className="p-3 align-middle">
                        <Cell
                          presence={presence}
                          defect={defect}
                          label={`${locale.label}: ${CELL_LABEL[presence]}`}
                        />
                      </td>
                    );
                  })}
                  <td className="p-3 align-middle text-right">
                    <span className="tabular text-xs text-muted">
                      {observedCount}/{locales.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <LegendKey className={DEFECT_CELL}>Observed, defect</LegendKey>
        <LegendKey className={CELL_STYLES.observed}>Observed</LegendKey>
        <LegendKey className={CELL_STYLES.absent}>
          Sampled, did not appear
        </LegendKey>
        <LegendKey className={CELL_STYLES["not-sampled"]}>Not sampled</LegendKey>
      </div>
    </div>
  );
}
