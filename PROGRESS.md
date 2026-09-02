# GROUNDS — build progress

Source of truth for the supervised build. Supervisor: Claude Opus 5.
Workers: agy / agy2 (gemini-3.7-flash-high), fallback `muse exec` (spark-1.2-contributor).

## Deadline
Devpost submission: **2026-09-03 10:00 PDT**. Draft submission must exist by T-4h.

## What this is
Audits whether Google's generative answers (AI Overview / AI Mode) make claims about
an entity that the sources the AI itself cited do not support. Full spec: docs/SPEC.md

## Ground rules
- `observations` is append-only. Raw SerpApi payloads are never mutated.
- No verdict without a citation trail.
- `UNVERIFIABLE` is a first-class verdict. A fetch failure is NEVER reported as `UNSOURCED`.
- Claims are tested against the UNION of sources on their block, never one source alone.
- Language discipline: never "defamed". Only "no support found in cited sources".

## Status
| # | Task | Owner | State |
|---|------|-------|-------|
| 0 | Repo + scaffold + git identity | supervisor | DONE |
| 1 | Design tokens + type contract | supervisor | DONE |
| 2 | SerpApi client chokepoint | worker | DONE — runtime-verified |
| 3 | Wolf River fixture | worker | DONE — regenerated after collision |
| 4 | Adjudication decision core | worker | DONE — 15/15 verification |
| 5 | LLM gateway (muse) | worker | DONE — live-verified |
| 6 | Deposition grid executor | worker | DONE — not yet run live |
| 7 | Verdict UI primitives | worker | DONE |
| 8 | Dossier page | worker | DONE — renders, screenshotted |
| 9 | Landing / intake page | worker | DONE — renders |
| 10 | Cross-examination engine | worker | DONE — not yet run live |
| 11 | Live audit API route (SSE) | worker | DONE — verified live |
| 12 | Deposition grid UI + /depose page | worker | DONE — not yet browser-tested |
| 13 | Forensic Inspector drawer | worker | DONE — browser-verified |
| 14 | Archive verification endpoint | worker | DONE — MATCH proven |
| 15 | Live capture + LiveCapture panel | worker | DONE |
| 16 | Judge Mode rate limiting | worker | DONE — 9/9 verification |
| 17 | Fixture: all five defect classes | supervisor | DONE |
| 18 | README | worker | DONE |
| 19 | Remediation surfaced in the dossier UI | supervisor | DONE — rendered + checked |
| 20 | Verdict distribution + geographic divergence views | supervisor | DONE — rendered + checked |
| 21 | Printable dossier | supervisor | DONE — CSS in build, not paper-tested |
| 22 | docs/DEVPOST.md | supervisor | DONE |

## Blockers
None. Keys supplied and both verified live.

## Verified working
- SerpApi: free plan, 249/250 searches left. `google_ai_mode` returns
  `text_blocks` + `references[]` exactly as specced. Sample id 6a97eeedbadf0b0ca4fff9b6.
- LLM: `muse-spark-1.2-contributor` via https://api.meta.ai/v1/messages.
  NOTE the model id has NO `[1m]` suffix — that variant 404s.
  It emits `redacted_thinking` blocks before the text block, so the gateway must
  filter to type === "text". It does. Needs generous max_tokens (~235 thinking
  tokens even for a trivial prompt).
- `npm run build` passes. Routes: / and /dossier/[id].

## Pipeline verified live — 2026-09-02
`npx tsx scripts/verify-pipeline.ts` runs depose -> decompose -> crossExamine
against real search for ~1 search. Latest run:
  6 text_blocks, 2 references, searchId 6a97eeedbadf0b0ca4fff9b6
  12 atomic claims, correctly typed and polarised; claims about Google and the
  MN Attorney General correctly marked as NOT about the target entity
  verdict GROUNDED, confidence 0.92, 1 search id in trail, no review needed

Two real bugs this caught, both of which typechecking could not have:
1. `depose` stored the whole SerpResult envelope as Observation.raw instead of
   `result.data`, so the parser saw no text_blocks and reported FALSE SUPPRESSION.
   A silent, total failure that looked like normal Google behaviour.
2. Snippet-channel judgements consult no additional search, so the citation trail
   came back empty and the empty-trail guard demoted well-grounded claims to
   UNVERIFIABLE. crossExamine now seeds the trail with the parent observation's
   search id, which is the snippet's actual provenance.

## Live audit verified through the API — 2026-09-02
POST /api/audit {"entity":"Wolf River Electric","probeCount":1,"localeCount":1}
streamed 12 SSE events: probes_ready -> deposing -> cell_started/cell_done ->
adjudicating -> 3x claim_adjudicated (all GROUNDED) -> complete.
Confirms probe generation, the deposition grid, decomposition and cross-examination
all compose behind one HTTP endpoint.

## Chain of custody proven — 2026-09-02
A payload captured by our own pipeline, re-fetched from SerpApi's archive,
re-canonicalised and re-hashed, returns MATCH in the browser:
  searchId 6a97eeedbadf0b0ca4fff9b6
  hash     376b043ecf4241ea1754550e5890830cf40bbd1acfbc7867be231bd24bc7a10b
This is the claim that distinguishes a GROUNDS finding from a screenshot, and it
is now demonstrable by a stranger clicking one button.

`npx tsx scripts/capture-observation.ts` refreshes the live capture. Archives
expire after 31 days, so re-run it before any demo.

## Deployment — PARTLY BLOCKED (2026-09-03)
Project: grounds / prj_Cht4GaFBL59ra1b3hN85kfwsUb2o (team_6AVjFywJRbnsVdBXqfX68VMK)
CLI identity: harshwardhan-250452-4621

DONE: SSO deployment protection is disabled via
`vercel project protection disable grounds --sso`. The site is publicly reachable:
  https://grounds-harshwardhan-250452-4621s-projects.vercel.app

STILL BROKEN: every deployment after the very first sits at status UNKNOWN with
`Builds: . [0ms]`, `?` duration, and no retrievable build logs. Tried and ruled out:
  - CLI `vercel deploy --prod`            -> UNKNOWN
  - `vercel build` + `deploy --prebuilt`  -> UNKNOWN (skips remote build entirely,
                                             so this is NOT a build failure)
  - git-triggered build via push          -> UNKNOWN (repo is already connected)
Only the first deploy (grounds-m6ldjgg4s, 26s) ever reached Ready.
The Vercel MCP cannot help: `list_teams` returns [] and project calls 403, so that
connection has no access to this scope. Diagnosis needs the Vercel dashboard —
likely an account-level limit or a flag the CLI does not surface.

PRACTICAL IMPACT: the public alias serves a STALE build. It lacks the keyless-guard
commit, so a reviewer who clicks "Depose" on the live site sees a raw
"SERPAPI_KEY environment variable is missing" error instead of the designed 503.
The landing page, recorded dossier and Forensic Inspector all work.

GOOD NEWS FROM THIS: SSE streams fine through Vercel — the live-audit endpoint
returned `data:` frames from production. That production risk is now closed.

## Session 2026-09-02 (cloud, no API keys) — dossier build-out
Environment had no SERPAPI_KEY and no LLM key, so nothing live was run. Only the
key-free gates were available and all of them were run before committing.

Added:
- `fixtures/remedies.ts` — worked remediation examples for the five defect
  clusters, 9 remedies total. Priorities are computed by hand to match
  `proposeRemedies` exactly (round(harm * reach * 100)), so what the page shows
  is what the engine would emit. `pivot.why` uses the engine's own sentence
  format. The UNVERIFIABLE cluster appears nowhere in the file.
- `src/components/RemediationPlan.tsx` — pivot source block, remedy cards with
  priority, effort meter, rationale, and the draft behind a native `<details>`
  (no client JS). Ordered by priority, not verdict severity, because it is a
  work queue. Filters `isDefect` as a second guard so an UNVERIFIABLE cluster
  can never earn a remedy even if the fixture changes.
- `src/components/VerdictDistribution.tsx` — three-way split (defects / sources
  held up / excluded from scoring) over per-verdict counts. UNVERIFIABLE sits in
  "excluded", visually separated so it cannot be read as a finding.
- `src/components/DivergenceMap.tsx` — cluster × locale grid. Observed / sampled
  but absent / not sampled are three distinct states; the absent cells are the
  evidence that sampling happened.
- `src/components/PrintDossier.tsx` + an `@media print` block in globals.css —
  forces the light palette, keeps chip and bar fills, unclips `.scroll-x`,
  prints URLs after links, hides `.no-print`.
- `docs/DEVPOST.md` — full writeup with a counted SerpApi endpoint section
  (7 search engines + the Search Archive API), each marked verified-live,
  exercised, or wired-but-not-exercised. Honest-limits section at the end.

Fixed:
- `--color-foreground` was never defined, so every `text-foreground` in the app
  resolved to nothing and inherited body colour. Added as an alias of `--ink`.
- Language discipline violations in our own prose: landing page, README, and two
  code comments (`types.ts`, `serpapi/client.ts`). The remaining hits are
  legitimate — prompt guardrails, the output sanitiser, the verify scripts'
  banned-word regexes, and recorded third-party payload text in
  `fixtures/live-capture.json`, which is evidence and must not be edited.
- Empty state added to the evidence trail, which previously rendered nothing at
  all when an audit had no defects.

Verified this session (all passing at commit time):
- `npm run build`, `npm run typecheck`, verify-adjudicator (15/15),
  verify-judge-mode (9/9), verify-batch (3/3).
- Rendered `/`, `/dossier/wolf-river` and `/depose` against `next start` and
  parsed the HTML: 5 defect clusters with 9 remedies and 4 distinct pivot
  domains; UNVERIFIABLE absent from the remediation section; distribution reads
  5 defects / 2 held up / 1 excluded; divergence grid renders all 8 clusters
  across 8 locales. Confirmed `@media print` and the `text-foreground` utility
  are present in the built stylesheet.

NOTE for future sessions: `npm run typecheck` FAILS on a clean checkout with
`Cannot find name 'LayoutProps'` until `npm run build` has generated
`.next/types`. Run the build first. This is not a regression.

## NEXT SESSION — start here
1. Unblock deployment (see the two actions above), then confirm the SSE stream
   survives Vercel's response buffering — this is untested and could break the
   live grid in production even though it works locally.
2. Re-run `npx tsx scripts/capture-observation.ts` before any demo — SerpApi
   archives expire after 31 days and the Verify button depends on a live record.
3. Demo recording.
4. With keys present, run `npx tsx scripts/verify-remediation.ts` and
   `verify-pipeline.ts` once more — neither could run in the cloud session.
5. Optional: wire the dossier's remediation section to the live engine behind a
   key check, falling back to `fixtures/remedies.ts` when no key is present.

## Known gaps
- Deployment: the public alias still serves a stale build (see above).
- Remediation on the dossier renders committed example drafts, not model output
  from a run. Labelled as examples on the page and in the README.
- `google_news` / `google_scholar` / `google_patents` / `google_maps` are wired
  and selected by claim shape but have never been exercised against a live
  query. DEVPOST.md marks them wired, not proven.
- The print stylesheet is present in the build but has not been checked against
  an actual print preview. Closed `<details>` drafts may not expand on paper in
  every browser; the UI tells the reader to expand what they want first.
- Deposition grid UI has not been browser-tested at full grid size.
- Defect register is wide; it scrolls inside `.scroll-x`, so the page body does
  not scroll sideways, but the engines column is the reason it is wide.

## Decisions log
- 2026-09-02: Fixtures-first architecture. Rationale: 250-search free tier means live
  runs are precious; deterministic fixtures let workers build+test without spend, and
  double as the Judge Mode cache required by the spec.

## Key finding — 2026-09-02, live SerpApi
Ran `google_ai_mode` on "is Wolf River Electric being sued" from Minneapolis.
Search id `6a97eeedbadf0b0ca4fff9b6`. Structure confirmed exactly as specced:
`text_blocks` (typed) + `references[]` with index/title/link/snippet/source, plus a
bonus `reconstructed_markdown` field.

**Google has since corrected this answer.** It now states the original AI Overview
made "a prominent error" and that the company is the plaintiff, not the defendant.

Implications, and they are good ones:
- Google's own current answer corroborates that the historical defect was real.
- Answers change over time -> continuous re-deposition is the product, not a feature.
- The demo must be honest: the fixture is labelled as the RECORDED historical
  dossier; live probes demonstrate the instrument working on today's answer.
  Do not present the fixture as a live finding.
