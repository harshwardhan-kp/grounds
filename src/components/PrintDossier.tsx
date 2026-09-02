"use client";

/**
 * Print control for the dossier.
 *
 * A dossier ends up in front of somebody who was not at the screen — a client,
 * an adviser, a publisher's editor. The print stylesheet in globals.css does the
 * real work (light palette, no clipped tables, URLs printed after their links);
 * this is just the affordance, and it removes itself from the printed page.
 */
export function PrintDossier() {
  return (
    <div className="no-print flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => window.print()}
        className="border border-rule bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-rule-strong"
      >
        Print or save as PDF
      </button>
      <span className="text-xs text-muted">
        Expand any example drafts you want included before printing.
      </span>
    </div>
  );
}
