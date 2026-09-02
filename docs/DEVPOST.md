# GROUNDS

**Every AI answer about you, cross-examined against its own sources.**

---

## Inspiration

In 2025 a Google AI Overview told people searching for a Minnesota solar
installer, Wolf River Electric, that the company was being sued by the state
Attorney General. It was not. The Attorney General had filed against several
separate solar-lending companies over hidden fees; Wolf River Electric was never
a defendant in that case.

The detail that started this project is not that the answer was wrong. It is
what the answer looked like. It cited four sources. It was formatted exactly
like a grounded answer — assertion, citation, assertion, citation — and a reader
had no way to tell that the citations did not carry the claim. The company
reported losing a $150,000 contract and has brought a case against Google over
the answer; that litigation is ongoing.

We went and looked at the current answer ourselves, live, on 2026-09-02. Google
has since corrected it. Its answer now opens "No, Wolf River Electric is not the
one being sued", describes the original AI Overview as a prominent error, and
notes the company is the plaintiff. We keep that capture in the repository,
because it makes two points at once: the historical defect was real, and
generative answers change underneath you. A screenshot is not a finding. A
finding has to be a measurement, repeated.

That is the gap. There is a whole category of AI-visibility tools now, and they
all measure the same thing: is your brand mentioned, in which prompts, with what
sentiment. Not one of them checks whether the sources the AI cited beside a
sentence actually contain that sentence. We named the property they are all
missing — **attribution integrity** — and built the instrument that measures it.

## What it does

GROUNDS runs an audit of an entity the way a deposition runs: a structured line
of questioning, on the record, with every answer preserved.

1. **Docketing.** Establish the entity's canonical name, domain, aliases,
   operating locations, and — the part that matters most — a *collision set* of
   confusingly similar companies. A claim can be perfectly true and still be
   about somebody else.
2. **Line of questioning.** Generate a probe grid across five families:
   identity, adverse, commercial, qualification, operational. Adverse probes
   carry the highest harm weight, because those are the answers that cost
   contracts.
3. **Deposition.** Run every probe across every locale, recording the raw
   SerpApi payload, its search id, its SHA-256 hash, and its latency. The
   observation store is append-only. Nothing is ever rewritten.
4. **Claim decomposition.** Split each generative answer into atomic
   subject-predicate-object assertions, each carrying its character span, the
   index of the text block it came from, and the reference indices attached to
   that block. Google cites at block level, so the evidence set for a claim is
   the *union* of the block's references — never one source alone.
5. **Cross-examination.** For each claim, check every cited source. Snippet
   before page: consult SerpApi's own indexed snippet of the URL *before*
   fetching the URL, because if Google's index contains the grounding then
   Google did not hallucinate — our fetcher just failed. Then corroborate
   independently against a different engine chosen by the shape of the claim.
6. **Adjudication.** Render one of eight verdicts with a full citation trail.
7. **Divergence and scoring.** Cluster the same assertion across markets and
   engines. Frequency is the finding; a single observation never is.
8. **Remediation.** For each defect cluster, identify the *pivot source* — the
   one cited document the answer leans on hardest — and draft the specific,
   prioritised actions that address it.

The verdicts:

| Verdict | Meaning |
|---|---|
| `GROUNDED` | Cited sources support it and it checks out independently. |
| `MISCITED` | True, but the cited sources do not say it. |
| `UNSOURCED` | Cited sources silent, and no independent corroboration found. |
| `CONTRADICTED` | Independent sources refute it. |
| `STALE` | Was true; a newer source supersedes it. |
| `CONFLATED` | True of a different entity in the collision set. |
| `UNVERIFIABLE` | We could not read the sources. **Never a defect.** |
| `OPINION` | Subjective or predictive. Excluded from scoring. |

`UNVERIFIABLE` is the verdict we are proudest of, and it is the one that made
the product honest. A paywall is not evidence of anything. If a cited page is
blocked, unparseable, or unreachable, the source's stance is `opaque`, the
verdict is `UNVERIFIABLE`, it is excluded from scoring, and it produces no
remedy. An unreadable source must never become an accusation. Every other tool
in this space would report that as a miss.

There is one more thing the dossier does that we have not seen elsewhere. Every
observation carries the SerpApi search id that produced it and the hash of its
canonicalised payload. Click **Verify against archive** and the app re-fetches
that search from SerpApi's own archive, re-canonicalises it, re-hashes it, and
shows you `MATCH`. That is the difference between a finding and a screenshot: a
stranger can check it, against a third party, without trusting us.

## How we built it

Next.js 16 and TypeScript, strict, no `any`. Tailwind v4 driven entirely by CSS
custom properties, so the whole forensic palette — including dark mode and the
print stylesheet — is defined in one file and no component ever names a colour.

The architecture is four layers with one rule between each:

- **`src/lib/serpapi/client.ts` — the chokepoint.** Every search in the entire
  system goes through one function. That is what makes budgeting, deterministic
  on-disk caching, bounded concurrency, backoff, hashing, and chain of custody
  enforceable rather than aspirational. There is exactly one place that can spend
  a search, so there is exactly one place to audit.
- **`src/lib/types.ts` — the contract.** Written first, before any engine code.
  Every module imports from it and nothing redefines it locally.
- **`src/lib/engine/*` — deposition, decomposition, cross-examination,
  adjudication, remediation.** Pure decision logic separated from I/O, so the
  adjudicator can be verified exhaustively without spending a single search.
- **`src/app/*` — the dossier.** Server components almost throughout; the only
  client code is the live audit stream, the inspector drawer, the archive
  verification button, and the print control.

Two decisions did most of the work:

**Fixtures first.** The SerpApi free tier gives 250 searches. That is a real
constraint and we treated it as an architectural input rather than an
inconvenience. A committed Wolf River fixture covering all eight verdict classes
let every part of the UI be built and tested at zero spend, and the same fixture
doubles as the Judge Mode cache that lets a judge open the dossier instantly
without our key. The recorded dossier is labelled `RECORDED DOSSIER` on the page,
every time, because presenting recorded data as live would poison the one thing
this product sells.

**Verification scripts instead of a test framework.** `scripts/verify-*.ts` are
plain runnable programs — 15 assertions on the adjudicator's decision table, 9 on
Judge Mode rate limiting, 3 on the bounded-parallel batcher, plus language
discipline checks that fail the build if a banned word ever reaches output. They
run with `npx tsx`, need no keys, and take under a second.

## Challenges we ran into

**The bug that typechecking cannot catch.** `depose` stored the whole SerpApi
result envelope as `Observation.raw` instead of `result.data`. The parser then
found no `text_blocks` and dutifully reported that Google had suppressed the AI
Overview. Suppression is a legitimate, expected outcome on adverse queries — so
this total failure was indistinguishable from normal Google behaviour. It
typechecked. It ran clean. It was silently wrong about everything. It was only
caught by running the real pipeline against a real search and reading the output
with suspicion. That is why `scripts/verify-pipeline.ts` exists.

**The empty-trail guard eating good verdicts.** We have a hard rule: no verdict
without a citation trail. A judgement reached from SerpApi's indexed snippet
consults no *additional* search, so its trail came back empty and the guard
demoted well-grounded claims to `UNVERIFIABLE`. The fix was conceptual, not
mechanical: the snippet's provenance *is* the parent observation's search id.
Cross-examination now seeds the trail with it. A correctness rule with a wrong
model of provenance quietly destroys the results it was written to protect.

**A 60-second token.** SerpApi returns AI Overviews through a `page_token` from
an organic `google` search, and that token expires in about a minute. It cannot
be queued, batched, or deferred. In a pipeline built on bounded-concurrency
queues that is a genuine hazard, and the fix is a comment in capital letters plus
an immediate synchronous await in the same execution frame.

**Writing about a real company without characterising it.** This was the hardest
constraint and the most important. GROUNDS reports that no support for an
assertion was found in the sources cited with it. It does not, anywhere in the
codebase, the UI, or the drafts it generates, reach a legal conclusion. That rule
is enforced in three places: in the prompts sent to the model, in a sanitiser on
the way out, and in a verification script that greps the output and fails. The
one place forbidden words appear on screen is inside recorded third-party text
quoted verbatim as evidence — and we will not edit a recorded payload, because
the payload is the evidence.

**Deployment.** Every deployment after the first sits at `UNKNOWN` with a
zero-millisecond build and no retrievable logs, via CLI, prebuilt, and
git-triggered alike. We ruled out a build failure — `--prebuilt` skips the remote
build entirely and still lands `UNKNOWN`. It needs the Vercel dashboard, and the
public alias currently serves a stale build. Everything runs locally.

## Accomplishments we're proud of

- **Chain of custody that a stranger can check.** Search id
  `6a97eeedbadf0b0ca4fff9b6`, hash
  `376b043ecf4241ea1754550e5890830cf40bbd1acfbc7867be231bd24bc7a10b`,
  re-fetched from SerpApi's archive and re-hashed in the browser, returns
  `MATCH`. One button. No trust required.
- **`UNVERIFIABLE` as a first-class verdict**, wired all the way through scoring
  and remediation so that an unreadable source can never become an accusation.
- **Testing claims against the union of block references.** The single most
  common way to build this wrong is to test a claim against one source and
  declare a defect. Google cites at block level; a claim is flagged only when
  *every readable* source on its block is silent.
- **Snippet before page.** Checking Google's own index before fetching a URL is
  what separates "the AI made it up" from "our crawler got a 403".
- **The live capture that argues against our own fixture.** Google's corrected
  answer is shipped in the repo next to the historical dossier. It corroborates
  that the original defect was real and proves the case for continuous
  re-deposition — and it keeps us honest about which is which.

## What we learned

Non-determinism is the whole problem. We started out thinking the hard part was
detecting a wrong claim. It is not. The hard part is that generative answers
differ by market, by engine, by hour, and change entirely when the vendor patches
them. That single fact reshaped the product: it is why observations are
append-only, why the unit of finding is a cluster across markets rather than a
single answer, why divergence between markets is a first-class view, and why a
dossier is dated and labelled rather than presented as current truth.

We also learned how easily an auditing tool becomes an accusation engine. Every
ambiguity in this product resolves toward the entity: a fetch failure is not
silence, one source's silence is not the block's silence, one market is not the
world, and an opinion is not a factual claim. Those four rules cost us findings
we could have reported. That is the point — a tool that flags a paywall as a
fabrication is worse than no tool, because it is confidently wrong in the
direction that does damage.

And: run the real pipeline early. Two of the three worst bugs in this project
typechecked perfectly and produced plausible output.

## What's next

- **Continuous re-deposition.** The instrument works on today's answer; the
  product is the diff between today's and last week's. Answer changed → alert.
- **Unblock deployment**, and confirm the SSE stream survives Vercel's response
  buffering at production scale. It returned `data:` frames from production once,
  which closes the biggest risk, but the full grid has not been driven there.
- **Beyond Google.** The type contract already carries Bing, DuckDuckGo, Brave
  and Yandex. Attribution integrity is not a Google-specific property.
- **Remediation as a live stage.** The engine drafts remedies from real findings
  today; the dossier currently renders committed examples so it works without a
  key. Wiring the live path end to end is a small step from here.
- **Publisher-side view.** A pivot source is a URL somebody owns. They usually
  have no idea a generative answer is leaning on their page for a claim the page
  does not make.

---

## SerpApi integration

Every search in GROUNDS goes through one function — `serp()` in
`src/lib/serpapi/client.ts` — which stamps each response with SerpApi's
`search_metadata.id`, a SHA-256 of the canonicalised payload, and the exact
parameters sent. That chokepoint is what makes the endpoint list below
enforceable: nothing in this codebase can reach a search engine any other way.

### Search endpoints

**1. `google_ai_mode` — primary deposition.**
The subject of the audit. This is the endpoint that returns the generative answer
as structured `text_blocks` plus a `references[]` array with `index`, `title`,
`link`, `snippet` and `source`. *Nothing else we could find returns the citation
graph in machine-readable form.* Scraping the page yields prose; this yields
which sources were attached to which block, and that mapping is the entire
product. Called per probe, per locale, with `location`, `gl` and `hl`.
**Status: verified live** (sample search id `6a97eeedbadf0b0ca4fff9b6`).

**2. `google` — organic, and the gateway to AI Overviews.**
Used three ways. First, deposition: an organic search returns the `page_token`
that unlocks the AI Overview endpoint. Second, cross-examination: when a cited
source has no usable indexed snippet, we run `site:<domain> "<distinctive
phrase>"` to ask whether the phrase exists anywhere on that domain before we
conclude the source is silent. Third, remediation: one organic search establishes
where each candidate pivot source actually ranks, which is half of the pivot
score. **Status: exercised in the live pipeline run.**

**3. `google_ai_overview` — the historical-format answer.**
Consumed via the `page_token` from endpoint 2. AI Overview and AI Mode are
different surfaces with different answers, and the Wolf River case happened in an
AI Overview, so auditing only AI Mode would miss the exact class of defect that
motivated the project. Note the operational constraint: the token expires in
roughly 60 seconds, so this call is issued immediately and synchronously in the
same execution frame as the organic search. **Status: wired, exercised through
the deposition path.**

**4. `google_news` — corroboration for adverse and event claims.**
Selected automatically when a claim mentions litigation, an attorney general, an
investigation, an indictment, a settlement, or enforcement. Independent
corroboration for "is this company being sued" belongs in a news index, not in
organic results — this is the exact endpoint that answers the question at the
heart of the Wolf River case. **Status: wired and selected by claim shape; not
yet exercised against a live adverse claim.**

**5. `google_scholar` — corroboration for research claims.**
Selected when a claim cites a study, a journal, findings, or a clinical trial. An
organic search cannot distinguish a peer-reviewed source from a press release
about one; a scholarly index can. **Status: wired and selected by claim shape;
not yet exercised live.**

**6. `google_patents` — corroboration for intellectual-property claims.**
Selected when a claim asserts a patent, a trademark, or an invention. These are
matters of public registry: either the filing exists or it does not, and the
registry is the only source that settles it. **Status: wired and selected by
claim shape; not yet exercised live.**

**7. `google_maps` — corroboration for location and identity claims.**
Selected when a claim asserts an address, headquarters, phone number, or hours.
This is also where entity collisions surface: two similarly named contractors in
two states are trivially distinguishable by their business records and nearly
indistinguishable by their names. It feeds both the `CONFLATED` verdict and the
`profile_fix` remedy. **Status: wired and selected by claim shape; not yet
exercised live.**

### Archive endpoint

**8. Search Archive API — `https://serpapi.com/searches/{search_id}.json`.**
This is the endpoint that makes GROUNDS an audit rather than a report. At capture
time we record SerpApi's `search_metadata.id` and the SHA-256 of the
canonicalised payload. Later, `POST /api/verify` re-fetches that exact search
from SerpApi's archive, re-canonicalises it with the same algorithm, re-hashes
it, and compares. A `MATCH` means a third party — SerpApi, not us — still holds
the record we based a finding on, and anyone can pull it up at
`https://serpapi.com/searches/{search_id}`.

This is why our findings are checkable and a screenshot is not. It also carries
an operational consequence we surface in the UI: **SerpApi retains archives for
31 days**, so a mismatch on an older observation means the answer changed or the
archive expired — which the app says explicitly rather than implying tampering.
**Status: verified live — `MATCH` proven in the browser.**

### Why the parameter surface matters too

Divergence is a core finding, not a nice-to-have, and it only exists because
SerpApi exposes `location`, `gl` and `hl` as first-class parameters. Sampling the
same probe across eight US markets is what turns "an AI said something wrong
once" into "this assertion appears in 4 of 8 markets at 70% frequency and does
not appear in the other 4". That is a measurement. The Geographic Divergence view
in the dossier is built entirely on it.

### Counted

**7 search engines + 1 archive endpoint = 8 SerpApi endpoints**, each doing a
job no other endpoint in the set could do.

---

## Honest limits

We would rather say this ourselves than have a judge find it.

- The public deployment currently serves a stale build (see **Challenges**).
  Everything runs locally; `npm run build` passes.
- The dossier's remediation section renders committed example drafts, labelled as
  such on the page. The engine that generates them from live findings is
  implemented and verified; the page does not call it at request time so that it
  renders without an LLM key.
- `google_news`, `google_scholar`, `google_patents` and `google_maps` are wired
  and selected automatically by claim shape, but have not been exercised against
  a live query. We are marking them wired, not proven.
- The deposition grid UI has been driven by the live SSE endpoint but not
  browser-tested at full grid size.
- The Wolf River dossier is recorded, dated, and labelled `RECORDED DOSSIER`
  everywhere it appears. The one genuinely live artefact on the page is the
  captured observation with the working archive verification.
