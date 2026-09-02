# Worker brief — read this before every task

You are writing code for **GROUNDS**, a Next.js 15 + TypeScript app.

## What GROUNDS does

It audits whether Google's generative search answers (AI Overview / AI Mode) make
claims about a company that **the sources the AI itself cited do not support**.

Real case that motivates it: Google's AI Overview told searchers a solar company was
being sued by the Minnesota Attorney General. It wasn't. The Overview cited four
sources; none of them contained the claim. It cost the company a $150,000 contract.

So the core operation is: take a generative answer → split it into atomic claims →
for each claim, check whether the sources cited alongside it actually support it →
independently corroborate → render a verdict with a full evidence trail.

## Non-negotiable rules

These are correctness requirements, not style preferences. Violating any of them
makes the product produce confidently wrong accusations, which is worse than
producing nothing.

1. **`src/lib/types.ts` is the contract.** Import from it. Do not redefine its types
   locally. If you believe a type is wrong, say so in your report — do not silently
   change it.
2. **Observations are append-only.** Never mutate a stored raw payload.
3. **A fetch failure is NEVER `UNSOURCED`.** If a cited page is paywalled, blocked,
   or unparseable, the stance is `opaque` and the verdict is `UNVERIFIABLE`. We never
   claim a source is silent unless we actually read it.
4. **Test claims against the union of block references, never one source alone.**
   Google attaches citations at block level. A claim is only flagged when *every*
   readable source on its block is silent.
5. **Snippet before page.** Check SerpApi's own indexed snippet of a URL before
   fetching the URL. If Google's index contains the grounding, Google did not
   hallucinate — our fetcher just failed.
6. **No verdict without a citation trail.** Every adjudication records the SerpApi
   search ids it consulted. A verdict with an empty trail must be discarded.
7. **Language discipline.** Never emit the words "defamed", "libel", "illegal", or any
   legal conclusion. The only permitted phrasing is factual and falsifiable:
   "no support found in the cited sources".
8. **Suppression is data.** When Google returns no AI Overview (common on adverse
   queries), record `suppressed: true`. It is not an error.

## Styling rules

- Style **only** through the CSS custom properties in `src/app/globals.css`
  (Tailwind utilities like `bg-surface`, `text-muted`, `border-rule`, `text-critical`).
- **Never hardcode a hex colour.** Dark mode is token-driven; a literal breaks it.
- Aesthetic: clean, restrained, forensic. Think case file, not analytics dashboard.
  Generous whitespace, real typographic hierarchy, no decorative gradients, no emoji.
- `.meta` for metadata (ids, hashes, params), `.testimony` (serif) for quoted machine
  text, `.tabular` for aligned digits.
- Wide content goes inside `.scroll-x`. The page body must never scroll sideways.

## Code rules

- TypeScript strict. No `any` — use `unknown` and narrow.
- No new dependencies without saying so in your report. Prefer the standard library.
- Every file you create must compile. Run `npx tsc --noEmit` before you report done.
- Keep functions small and pure where possible; side effects live at the edges.
- Comment the *why*, not the *what*. Match the surrounding style.

## Reporting

End your work with a short report:
- files created/changed
- anything you could not do, and why
- any assumption you made that the brief did not settle
- confirmation that `npx tsc --noEmit` passes

Do not claim something works if you did not run it.
