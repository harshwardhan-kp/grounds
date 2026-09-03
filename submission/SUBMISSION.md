# Devpost submission — copy/paste pack

Everything below is final text for the Devpost form. Fields appear in the order the
form asks for them. Anything I could not execute is called out in
[WHAT I COULD NOT DO](#what-i-could-not-do) at the bottom.

Deadline: **2026-09-03, 10:00 PDT**.

---

## 1. Project overview

### Project name *(60 char limit)*

```
Grounds
```

### Elevator pitch *(200 char limit — this is 139)*

```
Generative search cites sources when it answers questions about your company. Grounds checks whether those sources actually say what the AI claims.
```

---

## 2. Project details

### "Try it out" links

```
https://grounds-sigma.vercel.app
```
```
https://github.com/harshwardhan-kp/grounds
```

### Built with *(tags — put serpapi first)*

```
serpapi
google-ai-mode
google-ai-overview
next.js
react
typescript
tailwindcss
node.js
vercel
server-sent-events
anthropic-messages-api
sha-256
```

### About the project *(paste as Markdown)*

## Inspiration

In 2025 a Google AI Overview told people searching for a Minnesota solar installer,
Wolf River Electric, that the company was being sued by the state Attorney General. It
was not. The Attorney General had filed against several separate solar-lending
companies; Wolf River Electric was never a defendant.

The detail that started this project is not that the answer was wrong. It is what the
answer looked like. It cited four sources. It was formatted exactly like a grounded
answer — assertion, citation, assertion, citation — and a reader had no way to tell
that the citations did not carry the claim. The company reported losing a $150,000
contract and sued Google; that litigation is ongoing.

We went and looked at the current answer ourselves, live, on 2026-09-02. Google has
since corrected it. Its answer now opens "No, Wolf River Electric is not the one being
sued," describes the original AI Overview as a prominent error, and notes the company
is the plaintiff. We keep that capture in the repository, because it makes two points
at once: the historical defect was real, and generative answers change underneath you.
A screenshot is not a finding. A finding has to be a measurement, repeated.

That is the gap. There is a whole category of AI-visibility tools now, and they all
measure the same thing: is your brand mentioned, in which prompts, with what sentiment.
Not one of them checks whether the sources the AI cited beside a sentence actually
contain that sentence. We named the property they are all missing — **attribution
integrity** — and built the instrument that measures it.

## What it does

Grounds audits an entity the way a deposition runs: a structured line of questioning,
on the record, with every answer preserved.

1. **Docketing** — establish the entity's canonical name, aliases, operating locations,
   and a *collision set* of confusingly similar companies. A claim can be perfectly
   true and still be about somebody else.
2. **Line of questioning** — generate a probe grid across five families: identity,
   adverse, commercial, qualification, operational. Adverse probes carry the highest
   harm weight, because those are the answers that cost contracts.
3. **Deposition** — run every probe across every market, recording the raw SerpApi
   payload, its search id, a SHA-256 of the canonicalised response, and its latency.
   The observation store is append-only. Nothing is ever rewritten.
4. **Claim decomposition** — split each generative answer into atomic assertions, each
   carrying the index of the text block it came from and the reference indices attached
   to that block. Google cites at block level, so the evidence set for a claim is the
   *union* of the block's references — never one source alone.
5. **Cross-examination** — for each claim, check every cited source, then corroborate
   independently. Snippet before page: consult SerpApi's own indexed snippet of a URL
   *before* fetching the URL, because if Google's index carries the grounding then
   Google did not hallucinate — our fetcher just failed.
6. **Divergence and scoring** — cluster the same assertion across markets and engines.
   A single observation is never a finding; frequency is the finding.

Every assertion lands on one of eight verdicts:

| Verdict | Meaning |
| :--- | :--- |
| `GROUNDED` | Cited sources support it and independent checks agree. |
| `MISCITED` | True, but the sources cited beside it do not contain it. |
| `UNSOURCED` | Cited sources are silent and no independent corroboration exists. |
| `CONTRADICTED` | Independent sources refute it. |
| `STALE` | Was true; a newer source refutes it. |
| `CONFLATED` | True of a different entity in the collision set. |
| `UNVERIFIABLE` | We could not read the cited sources. |
| `OPINION` | Subjective or predictive; excluded from scoring. |

**`UNVERIFIABLE` is never counted as a defect, because an unreadable source must never
become an accusation.** That rule is enforced in the decision core and covered by tests.

## How we built it

Next.js 15 and TypeScript on Vercel. Every search in the app goes through one function
— `serp()` — which stamps each response with SerpApi's `search_metadata.id`, a SHA-256
of the canonicalised payload, and the exact parameters sent. Nothing in the codebase can
reach a search engine any other way, which is what makes the endpoint list below
enforceable rather than aspirational.

The adjudication core is deliberately pure: no I/O, no model call, no randomness. Source
stances and corroboration outcomes go in, a verdict comes out, and the whole decision
table is unit-tested. The model is used for the things models are good at — splitting
prose into atomic claims, judging entailment, arguing against a verdict in an
adversarial second pass — and is kept out of the part that has to be deterministic.

A live audit streams over Server-Sent Events so the grid fills in as the searches land.

**Chain of custody.** At capture time we store the search id and the payload hash.
`POST /api/verify` re-fetches that exact search from SerpApi's archive, re-canonicalises
it with the same algorithm, re-hashes it, and compares. We proved `MATCH` in the browser
against a real record — search id `6a97eeedbadf0b0ca4fff9b6`. That is the difference
between a finding and a screenshot.

## SerpApi integration

**8 endpoints**, each doing a job no other endpoint in the set could do.

| Endpoint | Why it is necessary | Status |
| :--- | :--- | :--- |
| `google_ai_mode` | The subject of the audit. Returns the generative answer as structured `text_blocks` plus a `references[]` array with index, title, link, snippet and source. This citation graph in machine-readable form *is* the product — scraping the page yields prose, this yields which sources were attached to which block. | Verified live |
| `google` | Three jobs: returns the `page_token` that unlocks AI Overviews; runs `site:<domain> "<phrase>"` to ask whether a phrase exists on a domain before we conclude a source is silent; establishes organic rank for pivot-source scoring. | Verified live |
| `google_ai_overview` | Consumed via `page_token`. AI Overview and AI Mode are different surfaces with different answers, and the Wolf River case happened in an AI Overview — auditing only AI Mode would miss the exact defect class that motivated this. | Wired through the deposition path |
| `google_news` | Corroboration for adverse and event claims, selected automatically when a claim mentions litigation, an attorney general, an investigation or a settlement. "Is this company being sued" belongs in a news index. | Verified live |
| `google_patents` | Corroboration for IP claims. Public registry: either the filing exists or it does not. | Verified live |
| `google_scholar` | Corroboration for research claims. Organic search cannot distinguish a peer-reviewed source from a press release about one. | Wired, routes by claim shape |
| `google_maps` | Corroboration for address, headquarters and hours claims. Also where entity collisions surface, feeding the `CONFLATED` verdict. | Wired, routes by claim shape |
| **Search Archive API** | The endpoint that makes this an audit rather than a report. Re-fetch, re-hash, compare. Retention is 31 days, which the app states rather than hiding. | Verified live — `MATCH` proven |

**The parameter surface matters too.** Divergence is a core finding, and it exists only
because SerpApi exposes `location`, `gl` and `hl` as first-class parameters. Sampling one
probe across eight US markets turns "an AI said something wrong once" into "this
assertion appears in 4 of 8 markets at 70% frequency and is absent from the other 4."
That is a measurement.

## Challenges we ran into

**Google suppresses AI Overviews on exactly the queries we care about.** Adverse and
YMYL probes frequently return no Overview at all. We made `google_ai_mode` the primary
evidence channel because it is always-on, and we record suppression as data rather than
as an error — an entity whose adverse probes trigger answers in six markets and
suppression in eight has told you something real.

**`page_token` expires in about 60 seconds.** The AI Overview follow-up has to be issued
synchronously in the same execution frame as its parent search. A queued worker
architecture returns empty Overviews for an entire run and looks exactly like normal
Google behaviour while doing it.

**A fetch failure is not a silent source.** Cited pages are often paywalled or blocked.
The naive implementation reads a 403 as "the source doesn't say it" and accuses Google
of fabricating when in fact our own fetcher failed. So entailment is tested against
SerpApi's indexed snippet first, and anything unreadable becomes `UNVERIFIABLE` — never
a defect. We found the same class of bug twice more in review: a corroboration search
that *errored* was returning "absent," and "absent" is one of the two inputs that
produce `UNSOURCED`. A transient network failure could have pushed a claim to the most
serious verdict in the system. Errors now return `inconclusive`, which carries no defect
weight.

**The model burns its token budget on hidden reasoning.** Our endpoint fronts a
reasoning model that emits thinking blocks before any text. When the budget ran out
mid-reasoning the response came back well-formed with an *empty* text block, surfacing
downstream as "unexpected end of JSON input" with nothing to inspect. The gateway now
detects that exact shape and retries with a larger budget.

## Accomplishments that we're proud of

Chain of custody that a stranger can check. Click "verify against archive" in the
dossier and the app re-fetches the record from SerpApi, re-hashes it, and shows you
`MATCH`. We are not asking anyone to trust our screenshot.

The discipline around not accusing anyone. `UNVERIFIABLE` never scores as a defect,
verdicts with an empty citation trail are discarded rather than softened, borderline
findings go to a human review queue, and the app never uses the word "defamation" — its
strongest permitted claim is that no support for an assertion was found in the sources
cited beside it. Those are enforced by tests, not by intention.

And the demo is honest without being crippled. Running new searches is gated off in
production so the deployment cannot spend quota, and a replay streams a real recorded
audit through the identical event contract, paced by each observation's actually-recorded
latency — labelled as a replay in three places, with its counter reading "recorded
searches." But because retrieving an archived search costs nothing, the archive
verification is genuinely live: a judge can click "verify against archive" on the
deployed site and watch it re-fetch and re-hash a real SerpApi record.

## What we learned

That the interesting use of a search API is not retrieval but **measurement**. We did
not use SerpApi to fetch facts for a model. We used it as an instrument to observe what
the world's largest generative answer engine asserts, under controlled conditions,
reproducibly across geography and time.

And that the hard part of auditing an AI is not catching it being wrong. It is not
accusing it wrongly.

## What's next for Grounds

Extending the same audit to other answer engines. Continuous re-deposition with alerting
when a new unsourced adverse claim appears — the Wolf River answer changed between the
incident and today, which is the entire argument for monitoring rather than checking.
And persistence, so audits accumulate into a longitudinal record instead of a single run.

---

## 3. Additional info

**Sponsor / Special Prizes:** select **SerpApi — Best AI Use Case**.

---

## What I could not do

These need a human:

1. **The demo video.** Devpost requires a YouTube/Vimeo link plus a downloadable MP4
   backup. I cannot record, narrate, or upload video. A shot-by-shot script with
   timings is in `submission/VIDEO_SCRIPT.md` — it is built so you can record it in one
   pass against the live site.
2. **Uploading the gallery images.** Five 1440×960 (3:2) PNGs are ready in
   `submission/gallery/`. You drag them into the form.
3. **Pressing submit**, and selecting the SerpApi prize from the dropdown.

## What I did do

- Made the repository public so judges can read the code — verified first that no key
  is tracked and that neither key ever appeared in git history.
- Confirmed the live site serves the current build on all three routes.
- Verified every "Verified live" claim in the endpoint table above against the running
  code before writing it. Two endpoints were upgraded from "wired" to "verified live"
  only after I exercised them and saw a real search id come back.
