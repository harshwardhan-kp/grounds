/**
 * GROUNDS — worked remediation examples for the recorded Wolf River dossier.
 *
 * WHY THIS FILE EXISTS
 * `src/lib/engine/remediation.ts` drafts remedies by calling the LLM gateway at
 * request time. A dossier page must render without an LLM key and must render
 * the same thing twice, so the recorded dossier reads its remediation plan from
 * here instead. These are pre-written EXAMPLES of the shape the engine produces,
 * not model output captured from a run — the UI labels them as such and must
 * keep doing so.
 *
 * Everything here is held to the same rules as engine output:
 *  - No legal conclusion is asserted anywhere. The strongest phrasing available
 *    is that no support for an assertion was found in the sources cited with it.
 *  - UNVERIFIABLE clusters appear NOWHERE in this file. An unreadable source is
 *    not a defect and must never become an accusation, so it earns no remedy.
 *  - `priority` is computed exactly as `proposeRemedies` computes it —
 *    round(harm * reach * 100), harm 1.0 adverse / 0.5 neutral / 0.3 positive,
 *    reach = observedInLocales / (observedInLocales + absentInLocales) — so the
 *    numbers a reviewer sees here are the numbers the engine would emit.
 *  - `pivot.why` uses the engine's own sentence format.
 */

import type { PivotSource, Remedy } from "@/lib/engine/remediation";

/** One cluster's remediation plan: the document to approach, and what to do. */
export interface RemediationExample {
  /** ClaimCluster.id this plan addresses. */
  clusterId: string;
  /** Highest-scoring cited document behind the assertion, if one resolved. */
  pivot: PivotSource | null;
  /** Already sorted by `sortRemedies` order: priority desc, then effort asc. */
  remedies: Remedy[];
}

export const EXAMPLE_REMEDIATION: RemediationExample[] = [
  // -------------------------------------------------------------------------
  // UNSOURCED · adverse · observed 4 of 8 markets · priority round(1.0 * 0.5 * 100)
  // -------------------------------------------------------------------------
  {
    clusterId: "cls_unsourced_lawsuit",
    pivot: {
      url: "https://cleanenergydirectory.example.org/contractors/midwest-solar",
      domain: "cleanenergydirectory.example.org",
      title: "Upper Midwest Clean Energy Directory: Contractor Profiles",
      citationCount: 4,
      organicRank: 3,
      score: 9.8,
      why: "Cited across 4 adjudications in this cluster with organic search position #3.",
    },
    remedies: [
      {
        kind: "correction_request",
        title: "Editorial review inquiry to cleanenergydirectory.example.org",
        rationale:
          "The generative search answer cites cleanenergydirectory.example.org, but no support for the assertion was found in the cited sources. A courteous inquiry requests review of the cited passage without asserting any legal conclusion.",
        effort: "low",
        priority: 50,
        draft: [
          "Subject: Request to review a page cited by Google's AI answer",
          "",
          "Dear Editors,",
          "",
          "I am writing on behalf of Wolf River Electric, a solar installation",
          "contractor headquartered in Isanti, Minnesota.",
          "",
          "When we query Google's generative search for \"is Wolf River Electric being",
          "sued by minnesota attorney general\", the answer states that the company is",
          "facing a lawsuit filed by the Minnesota Attorney General alleging deceptive",
          "sales practices. Your page is listed among the sources cited alongside that",
          "statement:",
          "",
          "  https://cleanenergydirectory.example.org/contractors/midwest-solar",
          "",
          "We have read the cited page carefully and found no support for that",
          "assertion in it. The same is true of the other sources cited on the same",
          "block of the answer. We are not suggesting your page contains an error, and",
          "we are not asking you to remove or alter anything.",
          "",
          "Our request is narrower: because your page is being used by a generative",
          "search engine as grounding for a statement it does not appear to contain,",
          "we would be grateful if your editorial team could review the passage and",
          "consider whether anything on the page could be read as implying it. If a",
          "clarifying line would help, we are happy to supply the public record.",
          "",
          "For your reference, the observation is archived with SerpApi search id",
          "68b7c1f2a4e3d5b6c7891001, and we can share the full recorded payload and",
          "its hash on request so you can reproduce what we saw.",
          "",
          "Thank you for your time.",
          "",
          "— Communications, Wolf River Electric",
        ].join("\n"),
      },
      {
        kind: "counter_content",
        title: "Authoritative reference counter-content",
        rationale:
          "Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.",
        effort: "medium",
        priority: 50,
        draft: [
          "PUBLISHING BRIEF — /legal-and-regulatory-record",
          "",
          "1. DIRECT ANSWER (lead paragraph, verbatim)",
          "",
          "   Wolf River Electric is not a defendant in any action brought by the",
          "   Minnesota Attorney General. The company has never been named in such an",
          "   action. This page records the company's regulatory and litigation status",
          "   and the primary records that establish it.",
          "",
          "2. DATED SPECIFICS TO INCLUDE",
          "",
          "   - Date of incorporation and the Minnesota Secretary of State file number.",
          "   - Current standing on the Minnesota Department of Labor and Industry",
          "     contractor licence register, with the licence number and renewal date.",
          "   - A dated statement of pending and closed matters, updated quarterly, with",
          "     the review date printed on the page so crawlers can see it is current.",
          "",
          "3. PRIMARY SOURCES TO CITE INLINE",
          "",
          "   - Minnesota Attorney General public case index (link to the search, not a",
          "     screenshot, so a reader can run the query themselves).",
          "   - Minnesota Secretary of State business filings record.",
          "   - Department of Labor and Industry licence lookup.",
          "",
          "4. SUGGESTED JSON-LD",
          "",
          "   {",
          "     \"@context\": \"https://schema.org\",",
          "     \"@type\": \"FAQPage\",",
          "     \"mainEntity\": [{",
          "       \"@type\": \"Question\",",
          "       \"name\": \"Is Wolf River Electric subject to an action by the Minnesota Attorney General?\",",
          "       \"acceptedAnswer\": {",
          "         \"@type\": \"Answer\",",
          "         \"text\": \"No. Wolf River Electric is not a defendant in any action brought by the Minnesota Attorney General.\"",
          "       }",
          "     }]",
          "   }",
          "",
          "5. TONE",
          "",
          "   State the record. Do not characterise the search engine, and do not",
          "   describe the assertion as anything other than unsupported by the sources",
          "   cited with it.",
        ].join("\n"),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // MISCITED · neutral · observed 3 of 8 markets · priority round(0.5 * 0.375 * 100)
  // -------------------------------------------------------------------------
  {
    clusterId: "cls_miscited_pricing",
    pivot: {
      url: "https://consumerenergywatch.example.org/hardware/inverter-comparisons",
      domain: "consumerenergywatch.example.org",
      title: "Homeowner Clean Energy Handbook: Inverters & Hardware",
      citationCount: 2,
      organicRank: 7,
      score: 5.4,
      why: "Cited across 2 adjudications in this cluster with organic search position #7.",
    },
    remedies: [
      {
        kind: "correction_request",
        title: "Editorial review inquiry to consumerenergywatch.example.org",
        rationale:
          "The generative search answer cites consumerenergywatch.example.org, but no support for the assertion was found in the cited sources. A courteous inquiry requests review of the cited passage without asserting any legal conclusion.",
        effort: "low",
        priority: 19,
        draft: [
          "Subject: A pricing figure attributed to your handbook",
          "",
          "Dear Editors,",
          "",
          "Google's generative answer for \"Wolf River Electric solar panel cost and",
          "battery storage pricing\" states that a standard residential 8kW rooftop",
          "installation through our company costs approximately $21,500 before federal",
          "tax credits, and cites your hardware comparison page alongside it.",
          "",
          "Your page discusses inverter hardware and does not appear to quote a price",
          "for our installations, so the figure does not seem to originate with you.",
          "We are not asking for a correction to your page. We are flagging that it is",
          "being used as grounding for a number it does not contain, in case that is",
          "useful to your team.",
          "",
          "Our current published pricing, with the assumptions it depends on, is",
          "maintained at our own pricing page and we are glad to keep it linkable and",
          "machine-readable so any figure attributed to us can be checked.",
          "",
          "Thank you for your time.",
          "",
          "— Communications, Wolf River Electric",
        ].join("\n"),
      },
      {
        kind: "counter_content",
        title: "Authoritative reference counter-content",
        rationale:
          "Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.",
        effort: "medium",
        priority: 19,
        draft: [
          "PUBLISHING BRIEF — /residential-solar-pricing",
          "",
          "1. DIRECT ANSWER (lead paragraph, verbatim)",
          "",
          "   A standard 8kW residential rooftop system installed by Wolf River",
          "   Electric is quoted at $X before incentives, as of <review date>. The",
          "   figure below is the company's own published price; any other figure",
          "   attributed to us did not come from us.",
          "",
          "2. DATED SPECIFICS TO INCLUDE",
          "",
          "   - A price table by system size, each row carrying its effective date.",
          "   - What the quoted price includes and excludes: panels, inverter, racking,",
          "     permits, interconnection fees, roof work, monitoring.",
          "   - The federal and state incentives applied, each with the statute or",
          "     programme identifier and the year it applies to.",
          "   - A visible \"last reviewed\" date. Stale pricing is how a correct page",
          "     becomes an incorrect citation twelve months later.",
          "",
          "3. SUGGESTED JSON-LD",
          "",
          "   Offer / PriceSpecification with priceCurrency, price, validFrom and",
          "   validThrough, so the figure carries its own expiry.",
        ].join("\n"),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CONTRADICTED · neutral · observed 2 of 8 markets · priority round(0.5 * 0.25 * 100)
  // -------------------------------------------------------------------------
  {
    clusterId: "cls_contradicted_founding",
    pivot: {
      url: "https://localbusinessjournal.example.org/profiles/wolf-river-electric",
      domain: "localbusinessjournal.example.org",
      title: "Local Business Registry: Regional Contractor Profile",
      citationCount: 2,
      organicRank: 11,
      score: 5.0,
      why: "Cited across 2 adjudications in this cluster with organic search position #11.",
    },
    remedies: [
      {
        kind: "counter_content",
        title: "Authoritative reference counter-content",
        rationale:
          "Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.",
        effort: "medium",
        priority: 13,
        draft: [
          "PUBLISHING BRIEF — /about/company-history",
          "",
          "1. DIRECT ANSWER (lead paragraph, verbatim)",
          "",
          "   Wolf River Electric was incorporated in Minnesota in <year> and has",
          "   operated as a residential solar installer since <year>. The state",
          "   incorporation record is linked below and is the controlling document.",
          "",
          "2. DATED SPECIFICS TO INCLUDE",
          "",
          "   - Incorporation date and Secretary of State file number, linked to the",
          "     public filing rather than transcribed.",
          "   - A short milestone list with years: first installation, first licence,",
          "     each office opening.",
          "   - An explicit line naming the founding year, phrased so a sentence-level",
          "     extractor cannot lift it without the year attached.",
          "",
          "3. WHY THIS ONE MATTERS DISPROPORTIONATELY",
          "",
          "   Founding year is the field most often mixed between similarly named",
          "   contractors, and it propagates: directories copy each other. Fixing the",
          "   primary record and the directory records together is what makes it stick.",
          "",
          "4. SUGGESTED JSON-LD",
          "",
          "   Organization with foundingDate, legalName, identifier (state file",
          "   number) and sameAs links to the state filing and licence records.",
        ].join("\n"),
      },
      {
        kind: "escalation",
        title: "Factual audit briefing for counsel evaluation",
        rationale:
          "Independent sources contradict the generative search answer. A strictly factual summary of evidence and citation trails is prepared for counsel review without reaching legal conclusions.",
        effort: "high",
        priority: 13,
        draft: [
          "DISCLAIMER: This document is a technical audit summary, does not",
          "constitute legal advice, and reaches no legal conclusions.",
          "",
          "SUBJECT",
          "  Assertion: \"Wolf River Electric was established in 2008 as a rural",
          "  electrical contractor.\"",
          "  Verdict recorded by the audit: CONTRADICTED",
          "",
          "WHAT WAS OBSERVED",
          "  The assertion appeared in generative answers sampled from 2 of 8 markets",
          "  (Minneapolis MN, Chicago IL) across google_ai_mode and",
          "  google_ai_overview. It did not appear in the other 6 sampled markets.",
          "  Observed frequency 0.4 over 10 samples. The cluster is marked",
          "  inconsistent: sampled answers did not agree with each other.",
          "",
          "WHAT THE CITED SOURCES SAY",
          "  The sources cited on the containing block were read through SerpApi's",
          "  indexed snippet before any page fetch was attempted. None of them",
          "  supports the founding year given in the answer, and an independent",
          "  corroboration probe returned a different year from a primary record.",
          "",
          "CITATION TRAIL",
          "  Every SerpApi search id consulted to reach this verdict is recorded in",
          "  the dossier's evidence trail and can be re-fetched from SerpApi's archive",
          "  by a third party, who can re-canonicalise and re-hash the payload and",
          "  compare it to the hash recorded here.",
          "",
          "LIMITS OF THIS DOCUMENT",
          "  This summary records what generative answers stated, which sources were",
          "  cited with those statements, and whether those sources supported them. It",
          "  characterises nothing beyond that.",
        ].join("\n"),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // CONFLATED · adverse · observed 1 of 8 markets · priority round(1.0 * 0.125 * 100)
  // -------------------------------------------------------------------------
  {
    clusterId: "cls_conflated_datcp_sanction",
    pivot: {
      url: "https://stateregulatoryguide.example.org/enforcement/2023-summary",
      domain: "stateregulatoryguide.example.org",
      title: "State Regulatory Enforcement Actions Bulletin - Q4 2023",
      citationCount: 1,
      organicRank: 2,
      score: 3.9,
      why: "Cited across 1 adjudication in this cluster with organic search position #2.",
    },
    remedies: [
      {
        kind: "counter_content",
        title: "Authoritative reference counter-content",
        rationale:
          "Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.",
        effort: "medium",
        priority: 13,
        draft: [
          "PUBLISHING BRIEF — /about/who-we-are-not",
          "",
          "1. DIRECT ANSWER (lead paragraph, verbatim)",
          "",
          "   Wolf River Electric is a Minnesota corporation headquartered in Isanti,",
          "   Minnesota. It is not affiliated with Wolf River Solar LLC of Appleton,",
          "   Wisconsin, or with Wolf River Energy Solutions. The 2023 Wisconsin",
          "   regulatory matter concerning deposit refunds involved a different",
          "   company under different ownership.",
          "",
          "2. DATED SPECIFICS TO INCLUDE",
          "",
          "   - State of incorporation, file number, and headquarters address.",
          "   - Licence numbers held, and the states they are held in.",
          "   - A plainly worded distinction table: our legal name, their legal name;",
          "     our state, their state; our registration, theirs.",
          "",
          "3. TONE",
          "",
          "   Describe the other company only in terms of the public record, without",
          "   characterising it. The goal is separation, not commentary.",
          "",
          "4. SUGGESTED JSON-LD",
          "",
          "   Organization with legalName, identifier, address, areaServed and sameAs",
          "   links to the state registry and licence records.",
        ].join("\n"),
      },
      {
        kind: "profile_fix",
        title: "Entity disambiguation and knowledge graph alignment",
        rationale:
          "The generative search engine conflates Wolf River Electric with a similar external entity. Disambiguating profile registries clarifies entity boundaries for search indexers.",
        effort: "medium",
        priority: 13,
        draft: [
          "DISAMBIGUATION WORK ORDER",
          "",
          "COLLISION SET",
          "  - Wolf River Solar LLC — Appleton, Wisconsin. Separate ownership.",
          "  - Wolf River Energy Solutions — northern Wisconsin biomass heating vendor.",
          "",
          "STEP 1 — GOOGLE BUSINESS PROFILE",
          "  Confirm the legal name field matches the state filing exactly, including",
          "  the suffix. Confirm the primary category and the service-area polygon.",
          "  Ensure every location carries the same phone number as the state record.",
          "",
          "STEP 2 — SITE MARKUP",
          "  Publish Organization JSON-LD on the homepage carrying legalName, the",
          "  state file number as identifier, address, and sameAs links to the",
          "  Secretary of State filing, the licence lookup and the Business Profile.",
          "  sameAs is the strongest disambiguation signal available and is routinely",
          "  the one missing.",
          "",
          "STEP 3 — WIKIDATA",
          "  If an item exists, ensure it carries a distinct headquarters location",
          "  (P159), inception (P571) and a state registry identifier. If items exist",
          "  for the similarly named companies, ensure each carries its own, and add a",
          "  \"different from\" (P1889) statement between them.",
          "",
          "STEP 4 — DIRECTORIES",
          "  Submit corrections to the directory pages the audit found cited. Include",
          "  the state file number in every submission; a name alone is what caused",
          "  the collision in the first place.",
          "",
          "DIFFERENTIATION CRITERIA TO USE EVERYWHERE",
          "  Headquarters state, incorporation date, licence numbers, principal",
          "  officers. Use the same four in every submission so the records agree.",
        ].join("\n"),
      },
    ],
  },

  // -------------------------------------------------------------------------
  // STALE · neutral · observed 2 of 8 markets · priority round(0.5 * 0.25 * 100)
  // -------------------------------------------------------------------------
  {
    clusterId: "cls_stale_warranty",
    pivot: {
      url: "https://consumerenergywatch.example.org/archive/warranty-standards-2022",
      domain: "consumerenergywatch.example.org",
      title: "Solar Installation Terms & Maintenance Archive: 2021-2023",
      citationCount: 2,
      organicRank: 14,
      score: 4.7,
      why: "Cited across 2 adjudications in this cluster with organic search position #14.",
    },
    remedies: [
      {
        kind: "counter_content",
        title: "Authoritative reference counter-content",
        rationale:
          "Publishing an authoritative page directly answering the probe provides search crawlers with a primary source of truth, addressing the assertion that has no support found in the cited sources.",
        effort: "medium",
        priority: 13,
        draft: [
          "PUBLISHING BRIEF — /warranty",
          "",
          "1. DIRECT ANSWER (lead paragraph, verbatim)",
          "",
          "   Wolf River Electric's current residential workmanship warranty is <term>,",
          "   effective <date>. Installations completed before <date> are covered by",
          "   the terms in force at the time of installation; those terms are listed",
          "   below and remain in effect for those customers.",
          "",
          "2. WHY THE ARCHIVE PAGE IS THE PROBLEM",
          "",
          "   The source cited by the answer is an archive covering 2021-2023. It was",
          "   accurate when written. The generative answer presents it in the present",
          "   tense, which is how a correct source produces an out-of-date statement.",
          "   The remedy is not a correction to that archive — it is to publish a",
          "   current, clearly dated page that outranks it for the same question.",
          "",
          "3. DATED SPECIFICS TO INCLUDE",
          "",
          "   - A version table: term, effective from, effective to, superseded by.",
          "   - The current term stated in a single unambiguous sentence.",
          "   - A visible \"last reviewed\" date, refreshed on a schedule.",
          "",
          "4. SUGGESTED JSON-LD",
          "",
          "   WarrantyPromise on the relevant Offer, with durationOfWarranty and",
          "   validFrom, so the term is machine-readable and carries its own date.",
        ].join("\n"),
      },
    ],
  },
];

/** Look up the recorded plan for a cluster. Returns null when none was drafted. */
export function remediationFor(clusterId: string): RemediationExample | null {
  return EXAMPLE_REMEDIATION.find((r) => r.clusterId === clusterId) ?? null;
}
