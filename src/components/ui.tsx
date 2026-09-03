import type { ReactNode, MouseEventHandler } from "react";

// ---------------------------------------------------------------------------
// 1. Bracket
// ---------------------------------------------------------------------------

export interface BracketProps {
  children: ReactNode;
  tone?: "muted" | "ink" | "red";
  className?: string;
}

/**
 * Bracketed lowercase monospace label.
 *
 * Why it exists: Serves as the core visual workhorse across the technical
 * blueprint interface. It standardizes forensic metadata tagging (locales,
 * probes, engine identifiers, statuses) inside bracketed mono notation.
 * Tone maps directly to system design tokens; the "red" tone is strictly
 * reserved for defect indicators.
 */
export function Bracket({
  children,
  tone = "muted",
  className = "",
}: BracketProps) {
  const toneClass =
    tone === "red"
      ? "text-red"
      : tone === "ink"
        ? "text-ink"
        : "text-muted";

  return (
    <span className={`bracket ${toneClass} ${className}`.trim()}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 2. Marker
// ---------------------------------------------------------------------------

export interface MarkerProps {
  tone?: "red" | "ink";
  className?: string;
}

/**
 * Geometric square datum marker.
 *
 * Why it exists: Replicates drafting-table blueprint points that terminate
 * leader lines and pin annotations to specific evidence passages. Because it
 * is purely decorative and carries no independent text content, it is hidden
 * from screen readers via aria-hidden. Tone defaults to reserved red for
 * defect tracking or ink for structural points.
 */
export function Marker({ tone = "red", className = "" }: MarkerProps) {
  const markerClass = tone === "ink" ? "marker marker-ink" : "marker";
  return (
    <span
      className={`inline-block shrink-0 ${markerClass} ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// 3. Rule
// ---------------------------------------------------------------------------

export interface RuleProps {
  className?: string;
}

/**
 * Full-width hairline divider.
 *
 * Why it exists: Emulates blueprint section delimiters using the border-rule
 * token. Strips all native browser margins so vertical spacing remains
 * strictly managed by the parent container's gap utilities.
 */
export function Rule({ className = "" }: RuleProps = {}) {
  return (
    <hr
      className={`w-full border-0 border-t border-rule m-0 p-0 ${className}`.trim()}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// 4. SectionHead
// ---------------------------------------------------------------------------

export interface SectionHeadProps {
  index?: string;
  title: string;
  note?: string;
  className?: string;
}

/**
 * Structured section header.
 *
 * Why it exists: Establishes a disciplined typographic hierarchy across case
 * file sections. Pairs an optional mono bracketed index (e.g. "01") on the left
 * with a high-contrast serif display title and an optional explanatory note
 * underneath, relying solely on flex gap rather than ad-hoc margins.
 */
export function SectionHead({
  index,
  title,
  note,
  className = "",
}: SectionHeadProps) {
  return (
    <header className={`flex flex-col gap-1 ${className}`.trim()}>
      <div className="flex items-baseline gap-2.5">
        {index ? <Bracket tone="muted">{index}</Bracket> : null}
        <h2 className="display text-[1.6rem] leading-tight text-ink">
          {title}
        </h2>
      </div>
      {note ? (
        <p className="text-muted text-sm leading-normal">{note}</p>
      ) : null}
    </header>
  );
}

// ---------------------------------------------------------------------------
// 5. PillButton
// ---------------------------------------------------------------------------

export interface PillButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
}

/**
 * Technical action trigger (button or anchor).
 *
 * Why it exists: Provides an understated, precision control surface without
 * decorative pill shapes or shadows. Renders lowercase mono text inside crisp
 * 3px rounded corners with strict token coloring (ink or surface-2). As a
 * React Server Component, onClick is typed and passed through directly without
 * client-side state hooks.
 */
export function PillButton({
  children,
  href,
  onClick,
  variant = "primary",
  disabled = false,
  type = "button",
  className = "",
}: PillButtonProps) {
  const baseStyles =
    "mono lowercase text-[14px] px-5 py-2.5 rounded-[3px] inline-flex items-center justify-center transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-1";

  const variantStyles =
    variant === "secondary"
      ? "bg-surface-2 text-ink border border-rule hover:bg-surface-3"
      : "bg-ink text-on-ink hover:opacity-90";

  if (href) {
    return (
      <a
        href={disabled ? undefined : href}
        onClick={onClick as MouseEventHandler<HTMLAnchorElement> | undefined}
        aria-disabled={disabled ? true : undefined}
        tabIndex={disabled ? -1 : undefined}
        className={`${baseStyles} ${variantStyles} ${
          disabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""
        } ${className}`.trim()}
      >
        {children}
      </a>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick as MouseEventHandler<HTMLButtonElement> | undefined}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles} disabled:opacity-40 disabled:cursor-not-allowed ${className}`.trim()}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// 6. Annotation
// ---------------------------------------------------------------------------

export interface AnnotationProps {
  label: string;
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
}

/**
 * Technical blueprint leader callout.
 *
 * Why it exists: The primary device linking analytical conclusions to source
 * testimony. Connects a bracketed mono label to target content across a dashed
 * leader line that terminates at a square datum marker. Below 720px, it drops
 * the leader line and stacks vertically to preserve legibility without squashing.
 */
export function Annotation({
  label,
  children,
  side = "left",
  className = "",
}: AnnotationProps) {
  const isRight = side === "right";

  return (
    <div
      className={`flex flex-col gap-2 min-[720px]:gap-3 min-[720px]:items-center ${
        isRight ? "min-[720px]:flex-row-reverse" : "min-[720px]:flex-row"
      } ${className}`.trim()}
    >
      <div className="shrink-0">
        <Bracket tone="muted">{label}</Bracket>
      </div>
      <span
        className="leader flex-1 min-w-[2rem] self-center hidden min-[720px]:block"
        aria-hidden="true"
      />
      <div
        className={`flex items-start gap-2 ${
          isRight ? "min-[720px]:flex-row-reverse" : "flex-row"
        }`}
      >
        <span className="shrink-0 mt-1.5">
          <Marker tone="red" />
        </span>
        <div className="text-ink text-sm leading-normal">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7. DataRow
// ---------------------------------------------------------------------------

export interface DataRowProps {
  label: string;
  value: ReactNode;
  mono?: boolean;
  className?: string;
}

/**
 * Key-value evidence record row.
 *
 * Why it exists: Presents structured audit records (hashes, search IDs,
 * timestamps) with high legibility. Bridges the bracketed key on the left to
 * the value on the right via a dashed leader line so the reader's eye does
 * not drift across wide horizontal viewports.
 */
export function DataRow({
  label,
  value,
  mono = false,
  className = "",
}: DataRowProps) {
  return (
    <div className={`flex items-baseline gap-3 w-full ${className}`.trim()}>
      <div className="shrink-0">
        <Bracket tone="muted">{label}</Bracket>
      </div>
      <span
        className="leader flex-1 min-w-[1.5rem] self-center"
        aria-hidden="true"
      />
      <div
        className={`text-sm text-ink text-right ${
          mono ? "mono break-all" : ""
        }`.trim()}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Wordmark
// ---------------------------------------------------------------------------

export interface WordmarkProps {
  text: string;
  className?: string;
}

/**
 * Page-foot typographic hallmark.
 *
 * Why it exists: Provides an architectural display-serif anchor at the base
 * of an audit dossier. Uses CSS clamp sizing to fill the container width and
 * allow intentional edge clipping within an overflow-hidden boundary. Hidden
 * via aria-hidden because the document heading already identifies the page.
 */
export function Wordmark({ text, className = "" }: WordmarkProps) {
  return (
    <div
      className={`wordmark-bleed select-none pointer-events-none ${className}`.trim()}
      aria-hidden="true"
    >
      <span className="display lowercase tracking-tight whitespace-nowrap">
        {text.toLowerCase()}
      </span>
    </div>
  );
}
