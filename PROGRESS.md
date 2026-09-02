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
| 11 | Live audit API route + deposition UI | worker | NOT STARTED |
| 12 | Forensic Inspector drawer | worker | NOT STARTED |
| 13 | Judge Mode caching | worker | NOT STARTED |

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

## Known gaps
- The pipeline (depose -> decompose -> crossExamine) is written and typechecks but
  has NOT been run end to end against live search. That is the next task.
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
