# Grounds

Every AI answer about you, cross-examined against its own sources.

## The problem

In 2025, a Google AI Overview told searchers that a Minnesota solar installer was being sued by the state Attorney General. It was not. The generative answer cited four sources, and none of them contained the claim. The company reported losing a $150,000 contract and sued Google for defamation; that litigation is ongoing. Separately, courts have begun letting AI-defamation claims past the pleading stage. Google has since corrected that specific answer — which demonstrates the fundamental challenge: generative answers change continuously, requiring grounding to be measured and tracked over time.

Existing AI visibility tools measure whether a brand is mentioned, which prompts trigger visibility, and how sentiment trends. None inspect whether the sources the AI explicitly cited alongside a sentence actually contain or support that assertion. Grounds exists to measure and enforce that property: **attribution integrity**.

## What it does

1. **Docketing**: Establishes the entity record, canonical aliases, probe locales, and collision-set entities to track name confusion.
2. **Line of questioning**: Generates a structured grid of factual, operational, and adverse probes mirroring real search inquiries.
3. **Deposition**: Executes probes across locations and engines via SerpApi, recording raw payloads, latency, and suppression as append-only observations.
4. **Claim decomposition**: Extracts text blocks from generative responses and parses them into atomic, verifiable subject-predicate-object claims bound to their block citations.
5. **Cross-examination**: Evaluates each claim against cited snippets, fetched pages, and secondary corroboration searches to assess evidentiary support.
6. **Divergence and scoring**: Clusters identical assertions across locales, detects regional inconsistencies, and computes attribution integrity and Grounds scores.

## Verdicts

| Verdict | Meaning |
| :--- | :--- |
| `GROUNDED` | Cited sources directly support the assertion and independent checks confirm it. |
| `MISCITED` | The assertion is factually true, but the sources cited alongside it do not contain it. |
| `UNSOURCED` | Cited sources are silent on the assertion, and independent corroboration found no support. |
| `CONTRADICTED` | Authoritative independent sources directly refute the assertion. |
| `STALE` | The assertion was historically accurate, but newer sources refute it. |
| `CONFLATED` | The assertion is true of a different entity in the collision set rather than the target. |
| `UNVERIFIABLE` | The cited sources could not be fetched, parsed, or read (e.g., paywalls, blocks, timeouts). |
| `OPINION` | The claim is subjective, non-factual, or predictive, and is excluded from defect scoring. |

**UNVERIFIABLE is never counted as a defect, because an unreadable source must never become an accusation.**

## How SerpApi is used

| Endpoint | Why it is necessary |
| :--- | :--- |
| `google_ai_mode` | Primary evidence channel; returns always-on generative responses with structured `text_blocks` and cited `references`. |
| `google_ai_overview` | Captures inline search overview answers via `page_token` where available. |
| `google` | Executes exact-phrase and `site:` operator queries to verify page-level grounding. |
| `google_news` | Corroborates allegations, regulatory filings, and fast-moving event claims against news sources. |
| `google_scholar` | Verifies academic citations, scientific claims, and research publications. |
| `google_patents` | Cross-checks intellectual property, patent assignees, and technical claims. |
| `google_maps` / `google_local` | Verifies operational assertions including physical addresses, business hours, and phone numbers. |
| Searches Archive | Retrieves immutable search records via stable `search_id` (retained for 31 days) as third-party proof of what the engine returned. |

SerpApi is used as a measurement instrument rather than a retrieval pipe. The `location` parameter treats geography as an independent variable: generative answers diverge across regions, and an entity cannot easily observe what searchers in distant markets are shown. Furthermore, Google frequently suppresses AI Overviews on adverse queries. Grounds records suppression as valid measurement data rather than an error, relying on `google_ai_mode` as its primary channel because it consistently provides full source-linked generative responses.

## Running it

Prerequisites:
- Node.js 20+

1. Install dependencies:
