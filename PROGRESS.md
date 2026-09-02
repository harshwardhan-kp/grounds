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

## Deployment — BLOCKED ON TWO USER ACTIONS (2026-09-02)
Project: grounds / prj_Cht4GaFBL59ra1b3hN85kfwsUb2o (team_6AVjFywJRbnsVdBXqfX68VMK)
First deploy reached Ready: grounds-m6ldjgg4s-...vercel.app

1. **Vercel Authentication (SSO) is ON**, so every deployment URL 302s to
   vercel.com/sso-api. A judge clicking the link hits a login wall. The Vercel MCP
   returns 403 because it is connected to a DIFFERENT account than the CLI
   (CLI identity: harshwardhan-250452-4621), so this must be turned off by hand:
   Vercel dashboard -> project grounds -> Settings -> Deployment Protection ->
   disable Vercel Authentication.

2. **Three later deploys sit at status UNKNOWN** with `Builds: . [0ms]` and no build
   logs — the build never started. Deployed by CLI, not git. Worth checking whether
   the project should instead be connected to the GitHub repo so pushes build
   normally, which is also better for the submission.

Decision taken with the user: deploy WITHOUT keys. The app degrades to a designed
state (503 + pointer to the recorded dossier) rather than spending search quota, so
a public URL is safe. Reason: judge-mode rate limiting is in-memory, which on
serverless is per-lambda and would not hold.

## NEXT SESSION — start here
1. Unblock deployment (see the two actions above), then confirm the SSE stream
   survives Vercel's response buffering — this is untested and could break the
   live grid in production even though it works locally.
2. Surface remediation in the dossier UI — the engine exists and is verified but
   nothing renders it yet.
4. Devpost writeup and the demo recording.
5. Re-run `npx tsx scripts/capture-observation.ts` before any demo — SerpApi
   archives expire after 31 days and the Verify button depends on a live record.

## Known gaps
- Fixture yields only 2 defect clusters; spec called for 5 verdict classes.
- Defect register table overflows horizontally on the engines column.

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
