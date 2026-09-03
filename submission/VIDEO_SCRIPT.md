# Demo video — shot list and script

Target **2:45**. Devpost wants a YouTube/Vimeo link plus a downloadable MP4 backup.

## Before you hit record

1. Refresh the archive proof — SerpApi archives expire after 31 days and the
   `MATCH` in beat 5 depends on a live record:
   ```
   cd ~/Claude/grounds && npx tsx scripts/capture-observation.ts && git add -A && git commit -m "chore: refresh live capture" && git push
   ```
   Wait for the Vercel deploy to go Ready before recording.
2. Open **https://grounds-sigma.vercel.app** in a clean window. Hide bookmarks and
   extensions. 1440×900, browser zoom 100%.
3. Have a second tab already on `/dossier/wolf-river`, scrolled to the evidence panel,
   so beat 4 is a tab switch and not a scroll hunt.
4. Do a silent dry run of the replay once so it is warm.

## Script

Bracketed text is what is on screen. Unbracketed is what you say.

---

**0:00–0:22 — the hook**
*[Landing page, static. Do not scroll yet.]*

> In 2025, Google's AI Overview told people searching for a Minnesota solar installer
> that the company was being sued by the state Attorney General. It wasn't. The answer
> cited four sources — and not one of them contained that claim. The company says it
> lost a hundred and fifty thousand dollar contract. It sued Google, and that case is
> still going.

---

**0:22–0:38 — the turn**
*[Scroll slowly to section 02, "what nobody measures". Let the red "attribution
integrity" land on screen as you say it.]*

> There's a whole category of AI-visibility tools now. Every one of them measures the
> same thing: are you mentioned, in which prompts, with what sentiment. Not one of them
> checks whether the sources the AI cited actually say what it claimed. That's the
> property we named — attribution integrity — and Grounds is the instrument that
> measures it.

---

**0:38–1:20 — watch it run**
*[Go to /depose. Click "replay recorded audit". Let the grid fill. Do not talk over the
first three seconds — let the cells move.]*

> Grounds asks the questions a customer or a journalist would actually type, across
> eight US markets, and records every answer. Rows are questions, columns are markets.
>
> *[point at an amber cell]* These are markets where Google returned no generative
> answer at all — it suppresses AI Overviews on exactly the adverse queries that
> matter. We record that as data, not as an error.
>
> *[as verdicts appear]* Then every assertion gets split into atomic claims and tested
> against the sources cited beside it.

*Note: say the word "replay" out loud here. The banner says it, but say it too.*

---

**1:20–2:00 — the evidence**
*[Switch to the dossier tab, on the evidence panel.]*

> This is the finding. On the left, what the AI said. On the right, the four sources it
> cited — struck through, because we read every one and none of them carry the claim.
> Independent search returned nothing either. Verdict: unsourced.
>
> And notice what we don't say. We never say defamation. The strongest claim this tool
> makes is that no support was found in the cited sources — with the search IDs to
> check it.

---

**2:00–2:20 — the proof**
*[Click "inspect serpapi trace", open the Archive tab, click "verify against archive".
Wait for MATCH.]*

> Here's why this is evidence and not a screenshot. We stored SerpApi's search ID and a
> hash of the payload at capture time. This button re-fetches that search from SerpApi's
> own archive, re-hashes it, and compares. Match. A third party still holds the record
> this finding is based on.

---

**2:20–2:35 — divergence**
*[Scroll to Geographic Divergence.]*

> And it doesn't say the same thing everywhere. This claim appears in four of eight
> markets. Which is exactly why the company never found it themselves — you don't see
> what another market is being told.

---

**2:35–2:45 — close**
*[Scroll to the wordmark, or back to the landing page.]*

> Grounds. Every AI answer about you, cross-examined against its own sources. Eight
> SerpApi endpoints, and it could not be built without them.

---

## If a live run is asked for

Don't. The public deployment runs without a SerpApi key on purpose so it cannot spend
quota, and the replay is a real recorded audit paced by real latencies. If a judge wants
live, run it locally with a key — but never present the replay as live. Say the word
"replay" in the narration and let the banner stay on screen.

## Honesty checklist before you upload

- [ ] You said "replay" out loud during beat 3.
- [ ] The `[replay]` banner is visible in the recording, not cropped out.
- [ ] The "recorded dossier · 2026-09-01" chip is visible at least once.
- [ ] You did not claim the Wolf River answer is wrong *today* — Google corrected it.
      The claim is that it was wrong then, and that answers change.
- [ ] Nothing in the narration says defamation, libel, or illegal.
