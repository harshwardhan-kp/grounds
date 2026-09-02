import type {
  Audit,
  Probe,
  Observation,
  Claim,
  Adjudication,
  ClaimCluster,
  Locale,
} from "@/lib/types";

export interface AuditFixture {
  audit: Audit;
  probes: Probe[];
  observations: Observation[];
  claims: Claim[];
  adjudications: Adjudication[];
  clusters: ClaimCluster[];
}

const AUDIT_ID = "aud_wolf_river_20260901";

const LOCALES: Locale[] = [
  {
    id: "us-mn-minneapolis",
    location: "Minneapolis, Minnesota, United States",
    gl: "us",
    hl: "en",
    label: "Minneapolis, MN",
  },
  {
    id: "us-mn-stpaul",
    location: "Saint Paul, Minnesota, United States",
    gl: "us",
    hl: "en",
    label: "St. Paul, MN",
  },
  {
    id: "us-il-chicago",
    location: "Chicago, Illinois, United States",
    gl: "us",
    hl: "en",
    label: "Chicago, IL",
  },
  {
    id: "us-wi-milwaukee",
    location: "Milwaukee, Wisconsin, United States",
    gl: "us",
    hl: "en",
    label: "Milwaukee, WI",
  },
  {
    id: "us-tx-austin",
    location: "Austin, Texas, United States",
    gl: "us",
    hl: "en",
    label: "Austin, TX",
  },
  {
    id: "us-co-denver",
    location: "Denver, Colorado, United States",
    gl: "us",
    hl: "en",
    label: "Denver, CO",
  },
  {
    id: "us-az-phoenix",
    location: "Phoenix, Arizona, United States",
    gl: "us",
    hl: "en",
    label: "Phoenix, AZ",
  },
  {
    id: "us-wa-seattle",
    location: "Seattle, Washington, United States",
    gl: "us",
    hl: "en",
    label: "Seattle, WA",
  },
];

const PROBES: Probe[] = [
  {
    id: "prb_adv_lawsuit",
    auditId: AUDIT_ID,
    query: "is Wolf River Electric being sued by minnesota attorney general",
    family: "adverse",
    harmWeight: 1.0,
    enabled: true,
  },
  {
    id: "prb_adv_complaints",
    auditId: AUDIT_ID,
    query: "Wolf River Electric customer lawsuits and fraud complaints",
    family: "adverse",
    harmWeight: 1.0,
    enabled: true,
  },
  {
    id: "prb_ident_overview",
    auditId: AUDIT_ID,
    query: "who owns Wolf River Electric and where is it located",
    family: "identity",
    harmWeight: 0.2,
    enabled: true,
  },
  {
    id: "prb_comm_pricing",
    auditId: AUDIT_ID,
    query: "Wolf River Electric solar panel cost and battery storage pricing",
    family: "commercial",
    harmWeight: 0.4,
    enabled: true,
  },
  {
    id: "prb_qual_licenses",
    auditId: AUDIT_ID,
    query: "Wolf River Electric NABCEP certifications and state electrical licenses",
    family: "qualification",
    harmWeight: 0.6,
    enabled: true,
  },
  {
    id: "prb_oper_warranty",
    auditId: AUDIT_ID,
    query: "Wolf River Electric warranty coverage terms and service area",
    family: "operational",
    harmWeight: 0.4,
    enabled: true,
  },
];

const OBSERVATIONS: Observation[] = [
  {
    id: "obs_01",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-mn-minneapolis",
    engine: "google_ai_mode",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Minneapolis, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891001",
        status: "Success",
        created_at: "2026-09-01 14:05:12 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices. Wolf River Electric installs residential photovoltaic solar systems and battery backup solutions.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Upper Midwest Clean Energy Directory: Contractor Profiles",
          link: "https://cleanenergydirectory.example.org/contractors/midwest-solar",
          snippet:
            "Directory profile of licensed electrical and solar panel installation contractors serving the Twin Cities and central Minnesota.",
          source: "Clean Energy Directory",
        },
        {
          index: 1,
          title: "Residential Solar Consumer Guide - State Overview",
          link: "https://consumerenergywatch.example.org/guides/residential-solar-evaluations",
          snippet:
            "Independent guidance for homeowners selecting certified photovoltaic equipment, reviewing net metering rates, and comparing contractor estimates.",
          source: "Consumer Energy Watch",
        },
        {
          index: 2,
          title: "State Solar Interconnection Standards & Permitting Reference",
          link: "https://stateregulatoryguide.example.org/filings/solar-permits",
          snippet:
            "Reference guide covering local building code requirements, utility net-metering interconnection rules, and certified electrical contractor guidelines.",
          source: "State Regulatory Guide",
        },
        {
          index: 3,
          title: "Midwest Energy Infrastructure Review - Annual Summary",
          link: "https://midwestenergyreview.example.org/industry/distributed-solar-trends",
          snippet:
            "Annual review summarizing distributed generation volume, microgrid installations, and battery storage adoption across regional cooperatives.",
          source: "Midwest Energy Review",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891001",
    payloadHash:
      "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    capturedAt: "2026-09-01T14:05:12.000Z",
    latencyMs: 1420,
    suppressed: false,
  },
  {
    id: "obs_02",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-mn-stpaul",
    engine: "google_ai_mode",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Saint Paul, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891002",
        status: "Success",
        created_at: "2026-09-01 14:06:01 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices across residential installations.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Upper Midwest Clean Energy Directory: Contractor Profiles",
          link: "https://cleanenergydirectory.example.org/contractors/midwest-solar",
          snippet:
            "Directory profile of licensed electrical and solar panel installation contractors serving the Twin Cities and central Minnesota.",
          source: "Clean Energy Directory",
        },
        {
          index: 1,
          title: "Consumer Affairs Bulletin: Regional Energy Marketplace",
          link: "https://consumeraffairsbulletin.example.org/regional-market-overview",
          snippet:
            "Quarterly bulletin on consumer protection alerts, standard contract stipulations, and energy contractor licensing verifications.",
          source: "Consumer Affairs Bulletin",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891002",
    payloadHash:
      "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    capturedAt: "2026-09-01T14:06:01.000Z",
    latencyMs: 1610,
    suppressed: false,
  },
  {
    id: "obs_03",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-wi-milwaukee",
    engine: "google_ai_overview",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Milwaukee, Wisconsin, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891003",
        status: "Success",
        created_at: "2026-09-01 14:07:22 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "According to search results, Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Midwest Energy Infrastructure Review - Annual Summary",
          link: "https://midwestenergyreview.example.org/industry/distributed-solar-trends",
          snippet:
            "Annual review summarizing distributed generation volume, microgrid installations, and battery storage adoption across regional cooperatives.",
          source: "Midwest Energy Review",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891003",
    payloadHash:
      "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
    capturedAt: "2026-09-01T14:07:22.000Z",
    latencyMs: 1850,
    suppressed: false,
  },
  {
    id: "obs_04",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-il-chicago",
    engine: "google_ai_overview",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Chicago, Illinois, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891004",
        status: "Success",
        created_at: "2026-09-01 14:08:15 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices in regional sales presentations.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Regional Solar Directory: Contractor Listings",
          link: "https://regionalsolardirectory.example.org/contractors/midwest",
          snippet:
            "Contractor database of licensed photovoltaic installers and electrical specialists serving Midwestern states.",
          source: "Regional Solar Directory",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891004",
    payloadHash:
      "e7f6c011776e8db7cd330b54174fd76f7d0216b612387a5ffcfb81e6f0919683",
    capturedAt: "2026-09-01T14:08:15.000Z",
    latencyMs: 1390,
    suppressed: false,
  },
  {
    id: "obs_05",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-tx-austin",
    engine: "google_ai_mode",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Austin, Texas, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891005",
        status: "Success",
        created_at: "2026-09-01 14:08:50 UTC",
      },
      text_blocks: [],
      references: [],
    },
    searchId: "68b7c1f2a4e3d5b6c7891005",
    payloadHash:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    capturedAt: "2026-09-01T14:08:50.000Z",
    latencyMs: 780,
    suppressed: true,
  },
  {
    id: "obs_06",
    auditId: AUDIT_ID,
    probeId: "prb_adv_lawsuit",
    localeId: "us-co-denver",
    engine: "google_ai_overview",
    params: {
      q: "is Wolf River Electric being sued by minnesota attorney general",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Denver, Colorado, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891006",
        status: "Success",
        created_at: "2026-09-01 14:09:42 UTC",
      },
      text_blocks: [],
      references: [],
    },
    searchId: "68b7c1f2a4e3d5b6c7891006",
    payloadHash:
      "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    capturedAt: "2026-09-01T14:09:42.000Z",
    latencyMs: 820,
    suppressed: true,
  },
  {
    id: "obs_07",
    auditId: AUDIT_ID,
    probeId: "prb_adv_complaints",
    localeId: "us-mn-minneapolis",
    engine: "google_ai_mode",
    params: {
      q: "Wolf River Electric customer lawsuits and fraud complaints",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Minneapolis, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891007",
        status: "Success",
        created_at: "2026-09-01 14:10:35 UTC",
      },
      text_blocks: [],
      references: [],
    },
    searchId: "68b7c1f2a4e3d5b6c7891007",
    payloadHash:
      "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
    capturedAt: "2026-09-01T14:10:35.000Z",
    latencyMs: 910,
    suppressed: true,
  },
  {
    id: "obs_08",
    auditId: AUDIT_ID,
    probeId: "prb_adv_complaints",
    localeId: "us-wi-milwaukee",
    engine: "google_ai_overview",
    params: {
      q: "Wolf River Electric customer lawsuits and fraud complaints",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Milwaukee, Wisconsin, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891008",
        status: "Success",
        created_at: "2026-09-01 14:11:45 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "The company was sanctioned by the Department of Agriculture, Trade and Consumer Protection in 2023 for unfulfilled deposit refunds.",
        },
      ],
      references: [
        {
          index: 0,
          title: "State Regulatory Enforcement Actions Bulletin - Q4 2023",
          link: "https://stateregulatoryguide.example.org/enforcement/2023-summary",
          snippet:
            "Wisconsin consumer protection agency issued an enforcement order against Wolf River Solar LLC regarding consumer restitution.",
          source: "State Regulatory Guide",
        },
        {
          index: 1,
          title: "Consumer Advocacy Review: Solar Contractor Disputes",
          link: "https://consumerenergywatch.example.org/contractor-disputes/wisconsin",
          snippet:
            "Summary of residential dispute mediations and administrative consent decrees involving renewable installation vendors in Wisconsin.",
          source: "Consumer Energy Watch",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891008",
    payloadHash:
      "2e7d2c03a9507ae265ecf5b5356885a53393a2029d24139499ddf66f01f47a08",
    capturedAt: "2026-09-01T14:11:45.000Z",
    latencyMs: 2120,
    suppressed: false,
  },
  {
    id: "obs_09",
    auditId: AUDIT_ID,
    probeId: "prb_ident_overview",
    localeId: "us-mn-minneapolis",
    engine: "google_ai_mode",
    params: {
      q: "who owns Wolf River Electric and where is it located",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Minneapolis, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891009",
        status: "Success",
        created_at: "2026-09-01 14:12:30 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric was established in 2008 as a rural electrical contractor. The company maintains its primary operational headquarters in Isanti, Minnesota.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Local Business Registry: Regional Contractor Profile",
          link: "https://localbusinessjournal.example.org/profiles/wolf-river-electric",
          snippet:
            "Corporate profile of Wolf River Electric, headquartered in Isanti, MN, servicing residential and agricultural accounts across the metro fringe.",
          source: "Local Business Journal",
        },
        {
          index: 1,
          title: "Upper Midwest Clean Energy Directory: Corporate Details",
          link: "https://cleanenergydirectory.example.org/contractors/wolf-river-profile",
          snippet:
            "Verified operational data including headquarters facilities in Isanti, MN and fleet distribution hubs in the Twin Cities metro.",
          source: "Clean Energy Directory",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891009",
    payloadHash:
      "18ac3e7343f016890c510e93f935261169d9e3f565436429830faf0934f4f8e4",
    capturedAt: "2026-09-01T14:12:30.000Z",
    latencyMs: 1240,
    suppressed: false,
  },
  {
    id: "obs_10",
    auditId: AUDIT_ID,
    probeId: "prb_comm_pricing",
    localeId: "us-mn-minneapolis",
    engine: "google_ai_overview",
    params: {
      q: "Wolf River Electric solar panel cost and battery storage pricing",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Minneapolis, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891010",
        status: "Success",
        created_at: "2026-09-01 14:13:10 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "A standard residential 8kW rooftop solar installation through the company costs approximately $21,500 before federal tax credits. Wolf River Electric is widely regarded as offering the premier customer installation experience in the Upper Midwest.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Homeowner Clean Energy Handbook: Inverters & Hardware",
          link: "https://consumerenergywatch.example.org/hardware/inverter-comparisons",
          snippet:
            "Detailed technical comparisons of microinverters, string inverters, and battery storage units commonly specified in residential solar projects.",
          source: "Consumer Energy Watch",
        },
        {
          index: 1,
          title: "Regional Renewable Contractors: Homeowner Experience Ratings",
          link: "https://cleanenergydirectory.example.org/ratings/upper-midwest",
          snippet:
            "Customer satisfaction rankings and review roundups for residential solar installation contractors in Minnesota and Wisconsin.",
          source: "Clean Energy Directory",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891010",
    payloadHash:
      "3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea",
    capturedAt: "2026-09-01T14:13:10.000Z",
    latencyMs: 1530,
    suppressed: false,
  },
  {
    id: "obs_11",
    auditId: AUDIT_ID,
    probeId: "prb_qual_licenses",
    localeId: "us-mn-stpaul",
    engine: "google_ai_mode",
    params: {
      q: "Wolf River Electric NABCEP certifications and state electrical licenses",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Saint Paul, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891011",
        status: "Success",
        created_at: "2026-09-01 14:14:05 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Installations are overseen by technicians holding NABCEP solar credentialing.",
        },
        {
          type: "paragraph",
          snippet:
            "The firm's commercial contracting staff holds specialized Class A Master Electrician certifications from the regional licensing board.",
        },
      ],
      references: [
        {
          index: 0,
          title: "National Clean Energy Certification Registry - Practitioner Directory",
          link: "https://credentialregistry.example.org/certifications/pv-installers",
          snippet:
            "Official registry records showing active NABCEP PV Installation Professional credentials for lead contractor personnel.",
          source: "Credential Registry",
        },
        {
          index: 1,
          title: "State Department of Labor & Industry: Contractor Verification",
          link: "https://stateregulatoryguide.example.org/licensing/electrical-contractors",
          snippet:
            "State licensing database verifying current electrical contractor status, bond coverage, and qualifying master electrician endorsements.",
          source: "State Regulatory Guide",
        },
        {
          index: 2,
          title: "Electrical Contractor Quarterly Journal - Paywalled Dossier",
          link: "https://electricalquarterlyjournal.example.org/dossier/commercial-licensing-reviews",
          snippet: null,
          source: "Electrical Contractor Quarterly",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891011",
    payloadHash:
      "53c234e5e8472b6ac51c1ae1cab3fe06fad053beb8ebfd8977b010655bfdd3c3",
    capturedAt: "2026-09-01T14:14:05.000Z",
    latencyMs: 1720,
    suppressed: false,
  },
  {
    id: "obs_12",
    auditId: AUDIT_ID,
    probeId: "prb_oper_warranty",
    localeId: "us-mn-minneapolis",
    engine: "google_ai_mode",
    params: {
      q: "Wolf River Electric warranty coverage terms and service area",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Minneapolis, Minnesota, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891012",
        status: "Success",
        created_at: "2026-09-01 14:15:20 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric provides a standard 10-year workmanship warranty on all residential panel installations. Wolf River Electric offers service coverage across eastern Minnesota and western Wisconsin.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Solar Installation Terms & Maintenance Archive: 2021-2023",
          link: "https://consumerenergywatch.example.org/archive/warranty-standards-2022",
          snippet:
            "Archived historical program summary noting standard 10-year workmanship coverage policy on regional residential contracts.",
          source: "Consumer Energy Watch",
        },
        {
          index: 1,
          title: "Upper Midwest Clean Energy Directory: Service Territory Maps",
          link: "https://cleanenergydirectory.example.org/contractors/territory-coverage",
          snippet:
            "Territory maps documenting active contractor dispatch coverage across eastern Minnesota counties and western Wisconsin border regions.",
          source: "Clean Energy Directory",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891012",
    payloadHash:
      "f0a9b8c7d6e5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9",
    capturedAt: "2026-09-01T14:15:20.000Z",
    latencyMs: 1460,
    suppressed: false,
  },
  {
    id: "obs_13",
    auditId: AUDIT_ID,
    probeId: "prb_ident_overview",
    localeId: "us-wa-seattle",
    engine: "google_ai_overview",
    params: {
      q: "who owns Wolf River Electric and where is it located",
      engine: "google_ai_overview",
      gl: "us",
      hl: "en",
      location: "Seattle, Washington, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891013",
        status: "Success",
        created_at: "2026-09-01 14:16:02 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric operates from headquarters located in Isanti, Minnesota, serving Upper Midwest residential solar accounts.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Regional Solar Directory: Contractor Listings",
          link: "https://regionalsolardirectory.example.org/contractors/midwest",
          snippet:
            "Contractor database of licensed photovoltaic installers and electrical specialists serving Midwestern states.",
          source: "Regional Solar Directory",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891013",
    payloadHash:
      "91b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    capturedAt: "2026-09-01T14:16:02.000Z",
    latencyMs: 1310,
    suppressed: false,
  },
  {
    id: "obs_14",
    auditId: AUDIT_ID,
    probeId: "prb_comm_pricing",
    localeId: "us-az-phoenix",
    engine: "google_ai_mode",
    params: {
      q: "Wolf River Electric solar panel cost and battery storage pricing",
      engine: "google_ai_mode",
      gl: "us",
      hl: "en",
      location: "Phoenix, Arizona, United States",
    },
    raw: {
      search_metadata: {
        id: "68b7c1f2a4e3d5b6c7891014",
        status: "Success",
        created_at: "2026-09-01 14:17:15 UTC",
      },
      text_blocks: [
        {
          type: "paragraph",
          snippet:
            "Wolf River Electric installs residential photovoltaic solar systems and battery backup solutions across Minnesota.",
        },
      ],
      references: [
        {
          index: 0,
          title: "Clean Energy Review: Midwest Solar Markets",
          link: "https://cleanenergyreview.example.org/midwest-market-roundup",
          snippet:
            "Analysis of residential distributed generation and storage battery adoption among regional contractors.",
          source: "Clean Energy Review",
        },
      ],
    },
    searchId: "68b7c1f2a4e3d5b6c7891014",
    payloadHash:
      "82c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1",
    capturedAt: "2026-09-01T14:17:15.000Z",
    latencyMs: 1190,
    suppressed: false,
  },
];

const CLAIMS: Claim[] = [
  {
    id: "clm_01",
    observationId: "obs_01",
    text: "Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices.",
    span: { start: 0, end: 125 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1, 2, 3],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "adverse",
    type: "factual",
  },
  {
    id: "clm_02",
    observationId: "obs_10",
    text: "A standard residential 8kW rooftop solar installation through the company costs approximately $21,500 before federal tax credits.",
    span: { start: 0, end: 130 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
  {
    id: "clm_03",
    observationId: "obs_09",
    text: "Wolf River Electric was established in 2008 as a rural electrical contractor.",
    span: { start: 0, end: 78 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
  {
    id: "clm_04",
    observationId: "obs_08",
    text: "The company was sanctioned by the Department of Agriculture, Trade and Consumer Protection in 2023 for unfulfilled deposit refunds.",
    span: { start: 0, end: 132 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Solar LLC",
    isAboutTarget: false,
    polarity: "adverse",
    type: "factual",
  },
  {
    id: "clm_05",
    observationId: "obs_12",
    text: "Wolf River Electric provides a standard 10-year workmanship warranty on all residential panel installations.",
    span: { start: 0, end: 109 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
  {
    id: "clm_06",
    observationId: "obs_11",
    text: "The firm's commercial contracting staff holds specialized Class A Master Electrician certifications from the regional licensing board.",
    span: { start: 0, end: 135 },
    blockIndex: 1,
    blockReferenceIndices: [2],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "positive",
    type: "factual",
  },
  {
    id: "clm_07",
    observationId: "obs_10",
    text: "Wolf River Electric is widely regarded as offering the premier customer installation experience in the Upper Midwest.",
    span: { start: 131, end: 250 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "positive",
    type: "opinion",
  },
  {
    id: "clm_08",
    observationId: "obs_01",
    text: "Wolf River Electric installs residential photovoltaic solar systems and battery backup solutions.",
    span: { start: 126, end: 224 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1, 2, 3],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
  {
    id: "clm_09",
    observationId: "obs_09",
    text: "The company maintains its primary operational headquarters in Isanti, Minnesota.",
    span: { start: 79, end: 160 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
  {
    id: "clm_10",
    observationId: "obs_11",
    text: "Installations are overseen by technicians holding NABCEP solar credentialing.",
    span: { start: 0, end: 77 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "positive",
    type: "factual",
  },
  {
    id: "clm_11",
    observationId: "obs_12",
    text: "Wolf River Electric offers service coverage across eastern Minnesota and western Wisconsin.",
    span: { start: 110, end: 202 },
    blockIndex: 0,
    blockReferenceIndices: [0, 1],
    aboutEntity: "Wolf River Electric",
    isAboutTarget: true,
    polarity: "neutral",
    type: "factual",
  },
];

const ADJUDICATIONS: Adjudication[] = [
  {
    id: "adj_01",
    claimId: "clm_01",
    verdict: "UNSOURCED",
    confidence: 0.98,
    reasoning:
      "No support found in the cited sources for any litigation or enforcement action initiated by the state Attorney General. Public court docket indices and regulatory agency releases confirm that no lawsuit has been filed against Wolf River Electric.",
    sourceJudgements: [
      {
        claimId: "clm_01",
        referenceIndex: 0,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891001", "68b7c1f2a4e3d5b6c7892001"],
        confidence: 0.96,
        reasoning:
          "Indexed snippet describes regional contractor directory listings and makes no mention of litigation or legal proceedings.",
      },
      {
        claimId: "clm_01",
        referenceIndex: 1,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891001", "68b7c1f2a4e3d5b6c7892001"],
        confidence: 0.95,
        reasoning:
          "Indexed snippet provides generic guidance for selecting contractors without referencing Attorney General actions or disputes involving this firm.",
      },
      {
        claimId: "clm_01",
        referenceIndex: 2,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891001", "68b7c1f2a4e3d5b6c7892001"],
        confidence: 0.95,
        reasoning:
          "Indexed snippet covers building codes and utility interconnection rules; no reference to enforcement actions or litigation.",
      },
      {
        claimId: "clm_01",
        referenceIndex: 3,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891001", "68b7c1f2a4e3d5b6c7892001"],
        confidence: 0.94,
        reasoning:
          "Indexed snippet outlines regional clean energy adoption metrics with zero mention of enforcement proceedings or lawsuits.",
      },
    ],
    corroboration: {
      claimId: "clm_01",
      outcome: "absent",
      enginesUsed: ["google_news", "google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893001", "68b7c1f2a4e3d5b6c7893002"],
      evidenceQuote: null,
      reasoning:
        "Comprehensive queries across state judicial branch case dockets, official state Attorney General public actions registers, and news indices returned no matching action or filing against the target entity.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891001",
      "68b7c1f2a4e3d5b6c7892001",
      "68b7c1f2a4e3d5b6c7893001",
      "68b7c1f2a4e3d5b6c7893002",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_02",
    claimId: "clm_02",
    verdict: "MISCITED",
    confidence: 0.92,
    reasoning:
      "No support found in the cited sources for the specific installation price figure. Independent market surveys corroborate the amount as typical for an 8kW rooftop system in the region, but the cited references discuss only inverter hardware and review metrics.",
    sourceJudgements: [
      {
        claimId: "clm_02",
        referenceIndex: 0,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891010"],
        confidence: 0.92,
        reasoning:
          "Snippet covers inverter hardware classifications and makes no statement regarding total turnkey system installation costs.",
      },
      {
        claimId: "clm_02",
        referenceIndex: 1,
        stance: "silent",
        channel: "fetched_page",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891010", "68b7c1f2a4e3d5b6c7892002"],
        confidence: 0.94,
        reasoning:
          "Parsed page content evaluates customer review aggregates without quoting pricing schedules or dollar figures for 8kW arrays.",
      },
    ],
    corroboration: {
      claimId: "clm_02",
      outcome: "confirmed",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893003"],
      evidenceQuote:
        "Regional solar contractor index reports an average turn-key cost of $21,500 before incentives for residential 8kW installations.",
      reasoning:
        "Independent contractor benchmarking reports confirm the financial figure as accurate for this market tier, despite its absence from cited sources.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891010",
      "68b7c1f2a4e3d5b6c7892002",
      "68b7c1f2a4e3d5b6c7893003",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_03",
    claimId: "clm_03",
    verdict: "CONTRADICTED",
    confidence: 0.96,
    reasoning:
      "State corporate registry records confirm that the business entity was filed and incorporated in April 2013, which refutes the asserted 2008 founding date.",
    sourceJudgements: [
      {
        claimId: "clm_03",
        referenceIndex: 0,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891009"],
        confidence: 0.88,
        reasoning:
          "Business directory profile does not record an original incorporation year.",
      },
      {
        claimId: "clm_03",
        referenceIndex: 1,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891009"],
        confidence: 0.89,
        reasoning:
          "Directory listing details operational facilities and service regions but omits establishment dates.",
      },
    ],
    corroboration: {
      claimId: "clm_03",
      outcome: "refuted",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893004"],
      evidenceQuote:
        "Minnesota Secretary of State Business Filing: Wolf River Electric Inc. - Original Date of Filing: 04/18/2013.",
      reasoning:
        "Official state business registration record documents the initial incorporation date as April 18, 2013, contradicting 2008.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891009",
      "68b7c1f2a4e3d5b6c7893004",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_04",
    claimId: "clm_04",
    verdict: "CONFLATED",
    confidence: 0.95,
    reasoning:
      "The cited regulatory enforcement order pertained to Wolf River Solar LLC, a distinct Wisconsin entity in the collision set. No support found for regulatory sanctions against Wolf River Electric.",
    sourceJudgements: [
      {
        claimId: "clm_04",
        referenceIndex: 0,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Wisconsin consumer protection agency issued an enforcement order against Wolf River Solar LLC regarding consumer restitution.",
        searchIds: ["68b7c1f2a4e3d5b6c7891008"],
        confidence: 0.95,
        reasoning:
          "Source text substantiates the enforcement action against Wolf River Solar LLC, which the generative answer attributed to the target company.",
      },
      {
        claimId: "clm_04",
        referenceIndex: 1,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891008"],
        confidence: 0.91,
        reasoning:
          "General dispute summary addresses regional vendor mediation without identifying the target firm.",
      },
    ],
    corroboration: {
      claimId: "clm_04",
      outcome: "confirmed",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893005"],
      evidenceQuote:
        "Administrative order DATCP-2023-018 applies solely to Wolf River Solar LLC of Outagamie County, Wisconsin, with no ownership connection to Minnesota entities.",
      reasoning:
        "Corporate filings demonstrate that the sanctioned entity is a distinct company belonging to the collision set.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891008",
      "68b7c1f2a4e3d5b6c7893005",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_05",
    claimId: "clm_05",
    verdict: "STALE",
    confidence: 0.91,
    reasoning:
      "A 10-year workmanship warranty was historically accurate under pre-2024 program schedules, but was superseded in January 2024 by an updated 25-year standard warranty policy.",
    sourceJudgements: [
      {
        claimId: "clm_05",
        referenceIndex: 0,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Archived historical program summary noting standard 10-year workmanship coverage policy on regional residential contracts.",
        searchIds: ["68b7c1f2a4e3d5b6c7891012"],
        confidence: 0.88,
        reasoning:
          "The cited source reflects an archived policy document from 2022 that does not capture current contract standards.",
      },
      {
        claimId: "clm_05",
        referenceIndex: 1,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891012"],
        confidence: 0.92,
        reasoning:
          "Territory coverage map does not detail warranty durations.",
      },
    ],
    corroboration: {
      claimId: "clm_05",
      outcome: "refuted",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893006"],
      evidenceQuote:
        "Updated residential customer contracts effective January 2024 provide a 25-year comprehensive workmanship and installation guarantee.",
      reasoning:
        "Verified current commercial terms confirm that the 10-year warranty policy has been superseded by a 25-year schedule.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891012",
      "68b7c1f2a4e3d5b6c7893006",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_06",
    claimId: "clm_06",
    verdict: "UNVERIFIABLE",
    confidence: 0.5,
    reasoning:
      "The sole cited source is behind an authentication barrier and could not be retrieved or parsed. Because the source cannot be inspected, no determination of support or lack of support can be made.",
    sourceJudgements: [
      {
        claimId: "clm_06",
        referenceIndex: 2,
        stance: "opaque",
        channel: "unreachable",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891011"],
        confidence: 0.2,
        reasoning:
          "Target URL responded with HTTP 403 Forbidden under an authentication barrier; document content is unparseable.",
      },
    ],
    corroboration: {
      claimId: "clm_06",
      outcome: "inconclusive",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893007"],
      evidenceQuote: null,
      reasoning:
        "Independent licensing searches confirm corporate contractor status but public indexes do not detail individual employee credential sub-tiers.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891011",
      "68b7c1f2a4e3d5b6c7893007",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_07",
    claimId: "clm_07",
    verdict: "OPINION",
    confidence: 0.99,
    reasoning:
      "Subjective evaluation regarding premier installation experience represents non-falsifiable marketing assessment and is excluded from defect scoring.",
    sourceJudgements: [
      {
        claimId: "clm_07",
        referenceIndex: 1,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Customer satisfaction rankings and review roundups for residential solar installation contractors in Minnesota and Wisconsin.",
        searchIds: ["68b7c1f2a4e3d5b6c7891010"],
        confidence: 0.95,
        reasoning:
          "Cited review compilation includes favorable subjective consumer opinions.",
      },
      {
        claimId: "clm_07",
        referenceIndex: 0,
        stance: "silent",
        channel: "serpapi_snippet",
        evidenceQuote: null,
        searchIds: ["68b7c1f2a4e3d5b6c7891010"],
        confidence: 0.9,
        reasoning:
          "Hardware guide focuses on technical metrics rather than customer service comparisons.",
      },
    ],
    corroboration: null,
    citationTrail: ["68b7c1f2a4e3d5b6c7891010"],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_08",
    claimId: "clm_08",
    verdict: "GROUNDED",
    confidence: 0.97,
    reasoning:
      "Cited source references and independent trade registrations confirm that Wolf River Electric provides photovoltaic installations and energy storage systems.",
    sourceJudgements: [
      {
        claimId: "clm_08",
        referenceIndex: 0,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Directory profile of licensed electrical and solar panel installation contractors serving the Twin Cities and central Minnesota.",
        searchIds: ["68b7c1f2a4e3d5b6c7891001"],
        confidence: 0.98,
        reasoning:
          "Snippet explicitly confirms that the firm offers solar panel installation and electrical contractor services.",
      },
      {
        claimId: "clm_08",
        referenceIndex: 3,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Annual review summarizing distributed generation volume, microgrid installations, and battery storage adoption across regional cooperatives.",
        searchIds: ["68b7c1f2a4e3d5b6c7891001"],
        confidence: 0.93,
        reasoning:
          "Regional survey notes installation activity in distributed residential solar and storage battery setups.",
      },
    ],
    corroboration: {
      claimId: "clm_08",
      outcome: "confirmed",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893008"],
      evidenceQuote:
        "Contractor provides grid-tied solar electric systems and modular home battery energy storage systems.",
      reasoning:
        "Independent contractor directory confirms active solar photovoltaic and battery storage installation services.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891001",
      "68b7c1f2a4e3d5b6c7893008",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_09",
    claimId: "clm_09",
    verdict: "GROUNDED",
    confidence: 0.99,
    reasoning:
      "Cited reference sources and municipal directory records confirm that the operational headquarters is situated in Isanti, Minnesota.",
    sourceJudgements: [
      {
        claimId: "clm_09",
        referenceIndex: 0,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Corporate profile of Wolf River Electric, headquartered in Isanti, MN, servicing residential and agricultural accounts across the metro fringe.",
        searchIds: ["68b7c1f2a4e3d5b6c7891009"],
        confidence: 0.99,
        reasoning:
          "Snippet explicitly substantiates the headquarters location in Isanti, MN.",
      },
      {
        claimId: "clm_09",
        referenceIndex: 1,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Verified operational data including headquarters facilities in Isanti, MN and fleet distribution hubs in the Twin Cities metro.",
        searchIds: ["68b7c1f2a4e3d5b6c7891009"],
        confidence: 0.98,
        reasoning:
          "Directory entry confirms primary operational facilities in Isanti.",
      },
    ],
    corroboration: {
      claimId: "clm_09",
      outcome: "confirmed",
      enginesUsed: ["google_maps", "google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893009"],
      evidenceQuote:
        "Wolf River Electric, 123 Industrial Blvd, Isanti, MN 55040.",
      reasoning:
        "Municipal address verification and mapping data corroborate the headquarters address.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891009",
      "68b7c1f2a4e3d5b6c7893009",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_10",
    claimId: "clm_10",
    verdict: "GROUNDED",
    confidence: 0.95,
    reasoning:
      "Cited professional registry records and state contractor filings corroborate that lead installers hold active NABCEP credentialing.",
    sourceJudgements: [
      {
        claimId: "clm_10",
        referenceIndex: 0,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Official registry records showing active NABCEP PV Installation Professional credentials for lead contractor personnel.",
        searchIds: ["68b7c1f2a4e3d5b6c7891011"],
        confidence: 0.97,
        reasoning:
          "Snippet confirms verified NABCEP credential listings for technical personnel.",
      },
      {
        claimId: "clm_10",
        referenceIndex: 1,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "State licensing database verifying current electrical contractor status, bond coverage, and qualifying master electrician endorsements.",
        searchIds: ["68b7c1f2a4e3d5b6c7891011"],
        confidence: 0.94,
        reasoning:
          "State licensing reference confirms compliance and qualifying technical designations.",
      },
    ],
    corroboration: {
      claimId: "clm_10",
      outcome: "confirmed",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893010"],
      evidenceQuote:
        "Board-certified installation professionals on record under contractor license #EA712903.",
      reasoning:
        "Independent credential registry search confirms current NABCEP accreditation.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891011",
      "68b7c1f2a4e3d5b6c7893010",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
  {
    id: "adj_11",
    claimId: "clm_11",
    verdict: "GROUNDED",
    confidence: 0.96,
    reasoning:
      "Cited directory sources and regional utility interconnection registrations substantiate multi-state service coverage across eastern Minnesota and western Wisconsin.",
    sourceJudgements: [
      {
        claimId: "clm_11",
        referenceIndex: 1,
        stance: "supports",
        channel: "serpapi_snippet",
        evidenceQuote:
          "Territory maps documenting active contractor dispatch coverage across eastern Minnesota counties and western Wisconsin border regions.",
        searchIds: ["68b7c1f2a4e3d5b6c7891012"],
        confidence: 0.96,
        reasoning:
          "Source snippet provides explicit territory boundary confirmations matching the claim.",
      },
    ],
    corroboration: {
      claimId: "clm_11",
      outcome: "confirmed",
      enginesUsed: ["google"],
      searchIds: ["68b7c1f2a4e3d5b6c7893011"],
      evidenceQuote:
        "Approved residential solar installer for utility interconnection programs across Minnesota and Wisconsin operating territories.",
      reasoning:
        "Utility interconnection participating contractor listings confirm operational territory in both states.",
    },
    citationTrail: [
      "68b7c1f2a4e3d5b6c7891012",
      "68b7c1f2a4e3d5b6c7893011",
    ],
    survivedReview: true,
    needsHumanReview: false,
  },
];

const CLUSTERS: ClaimCluster[] = [
  {
    id: "cls_unsourced_lawsuit",
    auditId: AUDIT_ID,
    canonicalText:
      "Wolf River Electric is currently facing a lawsuit filed by the Minnesota Attorney General alleging deceptive sales practices.",
    verdict: "UNSOURCED",
    polarity: "adverse",
    observedInLocales: [
      "us-mn-minneapolis",
      "us-mn-stpaul",
      "us-il-chicago",
      "us-wi-milwaukee",
    ],
    absentInLocales: [
      "us-tx-austin",
      "us-co-denver",
      "us-az-phoenix",
      "us-wa-seattle",
    ],
    enginesObserved: ["google_ai_mode", "google_ai_overview"],
    frequency: 0.7,
    sampleCount: 10,
    inconsistent: true,
    memberClaimIds: ["clm_01"],
  },
  {
    id: "cls_grounded_solar_battery",
    auditId: AUDIT_ID,
    canonicalText:
      "Wolf River Electric installs residential photovoltaic solar systems and battery backup solutions.",
    verdict: "GROUNDED",
    polarity: "neutral",
    observedInLocales: [
      "us-mn-minneapolis",
      "us-mn-stpaul",
      "us-il-chicago",
      "us-wi-milwaukee",
      "us-az-phoenix",
      "us-wa-seattle",
    ],
    absentInLocales: ["us-tx-austin", "us-co-denver"],
    enginesObserved: ["google_ai_mode", "google_ai_overview"],
    frequency: 0.85,
    sampleCount: 12,
    inconsistent: false,
    memberClaimIds: ["clm_08"],
  },
  {
    id: "cls_conflated_datcp_sanction",
    auditId: AUDIT_ID,
    canonicalText:
      "The company was sanctioned by the Department of Agriculture, Trade and Consumer Protection in 2023 for unfulfilled deposit refunds.",
    verdict: "CONFLATED",
    polarity: "adverse",
    observedInLocales: ["us-wi-milwaukee"],
    absentInLocales: [
      "us-mn-minneapolis",
      "us-mn-stpaul",
      "us-il-chicago",
      "us-tx-austin",
      "us-co-denver",
      "us-az-phoenix",
      "us-wa-seattle",
    ],
    enginesObserved: ["google_ai_overview"],
    frequency: 0.25,
    sampleCount: 4,
    inconsistent: true,
    memberClaimIds: ["clm_04"],
  },
  {
    id: "cls_grounded_hq_location",
    auditId: AUDIT_ID,
    canonicalText:
      "The company maintains its primary operational headquarters in Isanti, Minnesota.",
    verdict: "GROUNDED",
    polarity: "neutral",
    observedInLocales: [
      "us-mn-minneapolis",
      "us-mn-stpaul",
      "us-wa-seattle",
    ],
    absentInLocales: [
      "us-il-chicago",
      "us-wi-milwaukee",
      "us-tx-austin",
      "us-co-denver",
      "us-az-phoenix",
    ],
    enginesObserved: ["google_ai_mode", "google_ai_overview"],
    frequency: 0.9,
    sampleCount: 6,
    inconsistent: false,
    memberClaimIds: ["clm_09"],
  },
];

const AUDIT: Audit = {
  id: AUDIT_ID,
  entityQuery: "Wolf River Electric",
  entityCard: {
    canonicalName: "Wolf River Electric",
    domain: "wolfriverelectric.example.com",
    aliases: ["Wolf River Electric Inc.", "Wolf River Solar & Electric"],
    categories: [
      "Solar Energy Contractor",
      "Electrical Installation Service",
    ],
    locations: [
      {
        label: "Primary Operating HQ",
        address: "123 Industrial Blvd, Isanti, MN 55040",
        phone: "(763) 555-0192",
      },
      {
        label: "Twin Cities Regional Depot",
        address: "456 Energy Way, Minneapolis, MN 55413",
        phone: "(612) 555-0144",
      },
    ],
    collisionSet: [
      {
        name: "Wolf River Solar LLC",
        why: "Defunct Appleton, Wisconsin solar retailer subject to 2023 state regulatory restitution proceedings under distinct ownership.",
      },
      {
        name: "Wolf River Energy Solutions",
        why: "Unrelated northern Wisconsin commercial wood-pellet and biomass heating installation vendor.",
      },
    ],
  },
  state: "complete",
  locales: LOCALES,
  createdAt: "2026-09-01T14:00:00.000Z",
  searchBudget: 250,
  searchesSpent: 148,
  score: {
    overall: 58,
    accuracy: 64,
    attributionIntegrity: 52,
    consistency: 48,
  },
  fromFixture: true,
};

export const WOLF_RIVER_FIXTURE: AuditFixture = {
  audit: AUDIT,
  probes: PROBES,
  observations: OBSERVATIONS,
  claims: CLAIMS,
  adjudications: ADJUDICATIONS,
  clusters: CLUSTERS,
};
