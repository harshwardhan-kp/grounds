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
| 1 | Design tokens + shell UI | supervisor | IN PROGRESS |
| 2 | SerpApi client wrapper + observations store | worker | PENDING |
| 3 | Fixtures (recorded payloads for offline dev) | worker | PENDING |
| 4 | Claim decomposition | worker | PENDING |
| 5 | Cross-examination / adjudicator | worker | PENDING |
| 6 | Scoring + divergence | worker | PENDING |
| 7 | UI screens | worker | PENDING |
| 8 | Forensic Inspector + Judge Mode | worker | PENDING |

## Blockers
- SERPAPI_KEY and ANTHROPIC_API_KEY not yet provided. Requested from user.
  Build proceeds fixtures-first; live mode gated behind key presence.

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
