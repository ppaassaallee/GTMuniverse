import { routeAll } from "../routing";
import { computeTower } from "../tower";
import type { Account, Bot, Connection, Database, Gtm, Guardrail, List, Pod, RoutingRule, Source, Squad } from "../types";

// Demo organisation: Solvo, a nearshore staffing company, configured from its GTM Engineering System.

const VERTICALS: Gtm["verticals"] = [
  { id: "legal", name: "Legal", fitProfile: "Law firms and legal services, 50–500 staff; PI, immigration, family, mass tort, insurance defense; multi-office", hiringSignals: "Paralegals, legal assistants, intake specialists, records and billing clerks", personas: "Managing Partner, Firm Administrator, COO", timing: "Intake growth after a marketing push; new office; case-load surge", sellMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "healthcare", name: "Healthcare", fitProfile: "Multi-site practices, MSOs, DSOs, RCM and billing companies", hiringSignals: "Medical billers and coders, prior authorization, schedulers, credentialing, AR follow-up", personas: "Practice Administrator, VP Revenue Cycle, COO", timing: "Practice acquisitions; payer changes; Q4 enrollment; year-end", sellMonths: [8, 9, 10] },
  { id: "logistics", name: "Logistics", fitProfile: "Freight brokers, 3PLs, carriers, 100–2,000 staff; asset-light growth", hiringSignals: "Track & trace, dispatch, carrier sales support, load planning, documentation, AP/AR", personas: "VP Operations, COO, CFO", timing: "Q4 peak; produce season; new lanes or terminals; TMS migration", sellMonths: [3, 4, 7, 8, 9] },
  { id: "accounting", name: "Accounting", fitProfile: "Regional CPA firms and outsourced accounting providers, 20–300 staff", hiringSignals: "Bookkeepers, staff accountants, tax preparers, AP/AR specialists", personas: "Managing Partner, Firm Administrator, Director of Client Accounting", timing: "Oct–Jan hiring before tax season; post-merger integration", sellMonths: [8, 9, 10, 11] },
  { id: "cx", name: "CX-heavy operators", fitProfile: "Home services, insurance agencies, e-commerce, fintech, SaaS support, 200–5,000 staff", hiringSignals: "CSRs, chat and email support, order management, collections agents, retention", personas: "VP Customer Experience, Director of Support, COO", timing: "Q4 volume; product launch; CSAT or backlog pressure", sellMonths: [7, 8, 9] },
  { id: "staffing", name: "Staffing", fitProfile: "Staffing and recruiting agencies, 50–1,000 staff", hiringSignals: "Recruiters, sourcers, recruiting coordinators, payroll and admin", personas: "CEO, COO, VP Recruiting", timing: "Req volume growth; new client wins; margin pressure", sellMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { id: "pe", name: "PE-backed platforms", fitProfile: "Roll-ups in any vertical above; shared-services build-out", hiringSignals: "Any of the above at scale; shared services and centralization roles", personas: "Operating Partner, portfolio COO / CFO", timing: "Add-on acquisition; 100-day plan; cost pressure", sellMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

const SIGNALS: Gtm["signalTypes"] = [
  { id: "hiring_spike", name: "Hiring spike", definition: "30+ relevant open roles, or 3× the 90-day baseline", weight: 35, source: "TheirStack webhooks, career pages" },
  { id: "role_hiring", name: "Role-specific hiring", definition: "Postings for roles Solvo places: paralegal, biller, dispatcher, bookkeeper", weight: 20, source: "TheirStack title filters" },
  { id: "new_leader", name: "New operations leader", definition: "COO, VP Operations or VP CX appointed within 120 days", weight: 25, source: "LinkedIn (human), Apollo job-change alerts" },
  { id: "pe_event", name: "PE / VC event", definition: "Acquisition, add-on, new funding round", weight: 20, source: "Investor sites, news RSS, SEC filings" },
  { id: "expansion", name: "Expansion", definition: "New state, country or operating location", weight: 15, source: "Press releases, career-page geography" },
  { id: "prior_relationship", name: "Prior relationship", definition: "Closed-lost or dormant account plus any event above", weight: 15, source: "Salesforce join", modifier: true },
];

const usNearshore: Gtm = {
  id: "gtm_us",
  name: "US nearshore staffing",
  status: "live",
  owner: "Valentina Ríos · Head of GTM Engineering",
  objective: "Produce the smallest number of high-quality MQLs needed to hit the closed-won target, and make every account arrive with a reason.",
  northStar: "Closed-won revenue per 100 MQLs",
  product: "Nearshore professionals in accounting, back office, collections, customer service, healthcare, IT, legal, logistics and sales, placed with US companies.",
  icpSummary: "US companies hiring exactly the roles Solvo places, right now. “Operations-heavy company” is not an ICP; the seven verticals below are.",
  exclusions: "Existing customers, do-not-contact, accounts a Business Consultant rejected in the last 60 days, companies under 20 staff.",
  verticals: VERTICALS,
  signalTypes: SIGNALS,
  signalDecayDays: 30,
  thresholds: { fit: 60, signal: 55 },
  personas: [
    { id: "p_econ", title: "COO / CFO / Managing Partner", committeeRole: "economic", pains: "Cost per hire, margin, speed of scaling", message: "Add capacity without adding US cost structure." },
    { id: "p_ops", title: "VP Operations / VP Revenue Cycle", committeeRole: "operational", pains: "Backlog, SLAs, open roles that stay open", message: "Fill the roles your team can't hire fast enough, in your time zone." },
    { id: "p_func", title: "HR / Talent / CX leader", committeeRole: "functional", pains: "Recruiting load, onboarding, attrition", message: "We recruit, onboard and retain; you manage the work." },
    { id: "p_champ", title: "Director or manager with the pain", committeeRole: "champion", pains: "Overtime, queue length, missed targets", message: "Get your team out of the queue and back to the work only they can do." },
  ],
  plays: [
    { id: "01", name: "Rapid hiring", trigger: "30+ relevant open roles or a spike vs. the 90-day baseline", hypothesis: "Capacity is growing faster than the operating model can scale it efficiently", firstTouch: "Call the operational buyer with the role count and a comparable customer.", sequenceId: "seq_hiring", sqlRate: 0.27 },
    { id: "02", name: "New operations leader", trigger: "New COO, VP Operations or VP CX within ~120 days", hypothesis: "New leaders re-evaluate structure, cost, capacity and vendors in their first two quarters", firstTouch: "Connect with the new leader; offer a 100-day capacity benchmark.", sequenceId: "seq_leader", sqlRate: 0.24 },
    { id: "03", name: "PE / VC portfolio growth", trigger: "PE- or VC-backed plus acquisition, funding, hiring or expansion", hypothesis: "Growth is raising execution complexity and operating cost across the platform", firstTouch: "Thesis email to the operating partner, then call the portfolio COO.", sequenceId: "seq_pe", sqlRate: 0.22 },
    { id: "04", name: "Geographic expansion", trigger: "New state, country, region or operating location", hypothesis: "Expansion opens a capacity and recruiting gap before local hiring catches up", firstTouch: "Reach the head of the new region with a ramp plan.", sequenceId: "seq_hiring", sqlRate: 0.19 },
    { id: "05", name: "Closed-lost reactivation", trigger: "Prior opportunity plus a new event", hypothesis: "The blocker that lost the deal has changed; the need has not", firstTouch: "Reference the earlier conversation and what changed since.", sequenceId: "seq_reactivation", sqlRate: 0.21 },
    { id: "06", name: "Lookalike expansion", trigger: "Operationally similar to a strong customer, plus a timing signal", hypothesis: "Same operating model, same pain, same seat structure", firstTouch: "Lead with the reference customer's result.", sequenceId: "seq_hiring", sqlRate: 0.25 },
  ],
  sequences: [
    { id: "seq_hiring", name: "Rapid hiring · operations buyer", persona: "VP Operations / VP Revenue Cycle", steps: [
      { day: 1, channel: "email", action: "Role count + comparable customer, one ask" },
      { day: 1, channel: "linkedin", action: "Connection request (human sends)" },
      { day: 3, channel: "call", action: "Call with the hiring numbers" },
      { day: 3, channel: "email", action: "Short follow-up with seat math" },
      { day: 5, channel: "voicemail", action: "Voicemail referencing open roles" },
      { day: 7, channel: "call", action: "Call the economic buyer" },
      { day: 10, channel: "email", action: "Breakup email" },
    ] },
    { id: "seq_leader", name: "New leader · first 100 days", persona: "New COO / VP Operations", steps: [
      { day: 1, channel: "linkedin", action: "Congratulate and connect (human sends)" },
      { day: 2, channel: "email", action: "Offer a 100-day capacity benchmark" },
      { day: 5, channel: "call", action: "Call with benchmark takeaway" },
      { day: 9, channel: "email", action: "Peer story from the same vertical" },
      { day: 14, channel: "call", action: "Final call, ask for 20 minutes" },
    ] },
    { id: "seq_pe", name: "PE platform thesis", persona: "Operating Partner, portfolio COO", steps: [
      { day: 1, channel: "email", action: "Thesis email to the operating partner" },
      { day: 3, channel: "call", action: "Call the portfolio COO" },
      { day: 8, channel: "email", action: "Shared-services case study" },
      { day: 12, channel: "email", action: "Breakup with portfolio-wide offer" },
    ] },
    { id: "seq_reactivation", name: "What changed since we spoke", persona: "Previous contact or their successor", steps: [
      { day: 1, channel: "email", action: "Reference the earlier talk and the new event" },
      { day: 4, channel: "call", action: "Call to re-open" },
      { day: 9, channel: "email", action: "Short value recap" },
    ] },
  ],
  scripts: [
    { id: "sc_open", name: "Cold call opener · rapid hiring", kind: "cold call", body: "Hi [Name], it's [Rep] from Solvo. I'll be brief. I saw [Company] has [N] open [roles] right now. Teams in that spot usually tell us the roles stay open 60+ days. We place nearshore [roles] in your time zone in about three weeks. Is filling those seats a priority this quarter?" },
    { id: "sc_vm", name: "Voicemail", kind: "voicemail", body: "Hi [Name], [Rep] at Solvo. Calling about the [N] [roles] you're hiring for. We helped [Comparable] fill [M] of those in under a month. I'll send a two-line email; my number is [phone]." },
    { id: "sc_vendor", name: "“We already have a vendor”", kind: "objection", body: "That makes sense. Most of our clients had one too. Usually we come in for the roles the current vendor can't fill fast enough. Which of the [roles] are taking longest today?" },
    { id: "sc_local", name: "“We only hire locally”", kind: "objection", body: "Understood. Is that about time zone, language, or control? Our people work your hours, are fluent, and you manage them directly. Would it help to talk to a client in [vertical] who felt the same?" },
    { id: "sc_handoff", name: "SDR → Business Consultant handoff", kind: "handoff", body: "Account, committee met (names and roles), pain in their words, seats and roles, timeline, budget signal, competing options, next meeting booked for [date]." },
  ],
  policies: [
    { id: "po1", name: "AI drafts, a human sends", rule: "No bot sends an email or message without a person approving it.", severity: "must" },
    { id: "po2", name: "LinkedIn is a human channel", rule: "Bots may prepare LinkedIn touches; only people send them, within LinkedIn's terms. No scraping.", severity: "must" },
    { id: "po3", name: "Customers and DNC stay out", rule: "Existing customers and do-not-contact accounts are never prospected.", severity: "must" },
    { id: "po4", name: "No signal, no MQL", rule: "High-fit accounts without a fresh signal go to nurture, not to an SDR.", severity: "must" },
    { id: "po5", name: "MQL gate", rule: "Tier A, at least two buying-committee members, and a play assigned.", severity: "must" },
    { id: "po6", name: "BC reject cooling period", rule: "An account a Business Consultant rejected waits 60 days and needs a new signal.", severity: "must" },
    { id: "po7", name: "Contact data from Apollo", rule: "Contacts come from Apollo, which handles compliance filtering. Pay for another provider only to close a measured gap.", severity: "should" },
    { id: "po9", name: "An unsent draft is never “contacted”", rule: "Status only moves to contacted when a person actually sends. Researched → ready for review → contacted → replied → meeting booked → closed.", severity: "must" },
    { id: "po8", name: "Touch limit", rule: "At most 3 touches per person per week across all channels.", severity: "should" },
  ],
  bestPractices: [
    { id: "bp1", source: "6sense", area: "Buying stages", practice: "Classify every target account by predicted buying stage and change the motion by stage: ads and content early, sales in Decision and Purchase." },
    { id: "bp2", source: "6sense", area: "Segments", practice: "Build segments from ICP fit plus intent, and push the same segment to sales and advertising at once." },
    { id: "bp3", source: "ZoomInfo", area: "Foundations", practice: "Start with the ICP and the buying-committee personas, then build the multichannel signal plays on top." },
    { id: "bp4", source: "ZoomInfo", area: "Signals", practice: "Treat first-party intent as accurate but late and third-party intent as early but noisy. Use both, and weight them differently." },
    { id: "bp5", source: "ZoomInfo", area: "Speed", practice: "Intent is perishable. Measure the time from signal to first touch and keep it in days, not weeks." },
    { id: "bp6", source: "ZoomInfo", area: "Play hygiene", practice: "Document each play's channel, inputs, owner and core signal, and audit the playbook on a schedule." },
    { id: "bp7", source: "Apollo", area: "Deliverability", practice: "Warm up new mailboxes for weeks before sequencing, and don't send cold email from the primary domain." },
    { id: "bp8", source: "Apollo", area: "Cadence", practice: "Start with a short multichannel cadence (email, then email and call, calls with voicemail, final email around day 10) and add steps only when results justify them." },
    { id: "bp9", source: "Apollo", area: "Testing", practice: "A/B test each step of a sequence and personalise by prospect tier rather than writing one email for everyone." },
    { id: "bp10", source: "Boldr", area: "Reasons", practice: "Every account arrives with a reason: good company, why now, commercial hypothesis and recommended motion." },
    { id: "bp11", source: "Boldr", area: "Sources", practice: "Judge every lead source on cost per SQL and pipeline per 100 MQLs, never on records delivered." },
  ],
  buyingStages: [
    { id: "target", name: "Target", meaning: "Fits the ICP, no buying activity yet", motion: "Nurture, build the committee map" },
    { id: "awareness", name: "Awareness", meaning: "Early research or a first signal", motion: "AI warm-up, content, ads" },
    { id: "consideration", name: "Consideration", meaning: "Multiple signals or a new leader", motion: "SDR play with a hypothesis" },
    { id: "decision", name: "Decision", meaning: "Engaged committee, comparing options", motion: "Business Consultant, proof, pricing" },
    { id: "purchase", name: "Purchase", meaning: "Commercial terms and onboarding", motion: "Close, then expansion plan" },
  ],
};

const peDraft: Gtm = {
  ...structuredClone(usNearshore),
  id: "gtm_pe",
  name: "PE platform shared services",
  status: "draft",
  owner: "Valentina Ríos · Head of GTM Engineering",
  objective: "Win portfolio-wide shared-services agreements through operating partners.",
  northStar: "Portfolio companies opened per PE firm",
  icpSummary: "PE firms with 5+ portfolio companies in Solvo's verticals and a shared-services or 100-day cost plan.",
  verticals: VERTICALS.filter((v) => v.id === "pe"),
  plays: usNearshore.plays.filter((p) => p.id === "03"),
  sequences: usNearshore.sequences.filter((s) => s.id === "seq_pe"),
};

const HUMANS = [
  { role: "Head of GTM Engineering", name: "Valentina Ríos" },
  { role: "GTM Operator", name: "Camilo Restrepo" },
  { role: "Revenue Analyst", name: "Laura Gómez" },
];

const SQUADS: Squad[] = [
  { id: "sq_prospect", name: "Prospecting squad", mission: "Scout, research, choose the offer, write the first touch and keep the next step moving. Humans approve and send.", gtmId: "gtm_us", color: "#7a3fd6" },
  { id: "sq_data", name: "Data squad", mission: "Keep one clean, deduplicated, enriched, scored and routed universe.", gtmId: "gtm_us", color: "#3a8fd9" },
  { id: "sq_engage", name: "AI SDR squad", mission: "Work the accounts routed to AI: warm-up, nurture and reactivation, all drafts approved by a person.", gtmId: "gtm_us", color: "#158f63" },
  { id: "sq_analytics", name: "Analytics squad", mission: "Refresh the Control Tower on request and report what the numbers say.", gtmId: "gtm_us", color: "#b87a00" },
];

const BOTS: Bot[] = [
  { id: "b_atlas", name: "Atlas", squadId: "sq_prospect", role: "Squad lead · runs the five jobs, one record per account", isLead: true, skills: ["workflow", "agentops"], reportsTo: "human:Head of GTM Engineering", autonomy: "approve", allowedActions: ["read_records", "update_record", "route_account", "assign_pod"], connections: ["c_salesforce"], dailyLimit: 300 },
  { id: "b_scout", name: "Scout", squadId: "sq_prospect", role: "Who deserves a look? Dated evidence: event, date, source, why they fit", skills: ["signals", "tam"], reportsTo: "b_atlas", autonomy: "act", allowedActions: ["read_records", "add_signal"], connections: ["c_theirstack", "c_gsheets"], dailyLimit: 1000 },
  { id: "b_research", name: "Researcher", squadId: "sq_prospect", role: "What should we know? Sourced brief, open questions, evidence against", skills: ["enrichment", "signals"], reportsTo: "b_atlas", autonomy: "act", allowedActions: ["read_records", "write_brief", "map_committee"], connections: ["c_apollo"], dailyLimit: 400 },
  { id: "b_strategist", name: "Strategist", squadId: "sq_prospect", role: "What could we offer? Offer and fit: prepare, dig or skip", skills: ["awareness", "outbound"], reportsTo: "b_atlas", autonomy: "approve", allowedActions: ["read_records", "update_record"], connections: [], dailyLimit: 300 },
  { id: "b_writer", name: "Writer", squadId: "sq_prospect", role: "What starts the talk? First-touch draft from approved examples", skills: ["content", "outbound"], reportsTo: "b_atlas", autonomy: "act", allowedActions: ["read_records", "draft_email", "send_email", "linkedin_prepare"], connections: ["c_email", "c_linkedin"], dailyLimit: 400 },
  { id: "b_pipeline", name: "Pipeline", squadId: "sq_prospect", role: "What happens next? Status, last touch, next action and date", skills: ["crm", "inbound"], reportsTo: "b_atlas", autonomy: "approve", allowedActions: ["read_records", "update_record"], connections: ["c_salesforce"], dailyLimit: 500 },

  { id: "b_dex", name: "Dex", squadId: "sq_data", role: "Data squad lead · routing, pods, freezer", isLead: true, skills: ["workflow", "crm"], reportsTo: "human:GTM Operator", autonomy: "approve", allowedActions: ["read_records", "update_record", "route_account", "assign_pod", "freeze_account"], connections: ["c_salesforce"], dailyLimit: 500 },
  { id: "b_dedupe", name: "Dedupe", squadId: "sq_data", role: "One account per domain", skills: ["crm", "tam"], reportsTo: "b_dex", autonomy: "act", allowedActions: ["read_records", "update_record"], connections: ["c_salesforce"], dailyLimit: 2000 },
  { id: "b_enrich", name: "Enricher", squadId: "sq_data", role: "Apollo waterfall: firmographics, role mix, contacts", skills: ["enrichment", "stack"], reportsTo: "b_dex", autonomy: "act", allowedActions: ["read_records", "enrich", "update_record"], connections: ["c_apollo"], dailyLimit: 1500 },
  { id: "b_scorer", name: "Scorer", squadId: "sq_data", role: "Fit, signal and value scores; tiers", skills: ["awareness", "tam"], reportsTo: "b_dex", autonomy: "act", allowedActions: ["read_records", "update_record", "route_account"], connections: [], dailyLimit: 5000 },

  { id: "b_echo", name: "Echo", squadId: "sq_engage", role: "AI SDR squad lead · message QA", isLead: true, skills: ["outbound", "content"], reportsTo: "human:Head of GTM Engineering", autonomy: "approve", allowedActions: ["read_records", "update_record", "draft_email"], connections: [], dailyLimit: 300 },
  { id: "b_warmup", name: "AI Warm-up", squadId: "sq_engage", role: "3-touch warm-up when a fresh signal lands on a Tier B account", skills: ["outbound", "signals"], reportsTo: "b_echo", autonomy: "approve", allowedActions: ["read_records", "draft_email", "send_email"], connections: ["c_email"], dailyLimit: 250 },
  { id: "b_nurture", name: "AI Nurture", squadId: "sq_engage", role: "Quarterly value touch for high-fit accounts without a signal", skills: ["content"], reportsTo: "b_echo", autonomy: "approve", allowedActions: ["read_records", "draft_email", "send_email"], connections: ["c_email"], dailyLimit: 400 },
  { id: "b_reactivate", name: "AI Reactivation", squadId: "sq_engage", role: "“What changed since we spoke” for dormant and closed-lost accounts", skills: ["outbound", "crm"], reportsTo: "b_echo", autonomy: "approve", allowedActions: ["read_records", "draft_email", "send_email"], connections: ["c_email", "c_salesforce"], dailyLimit: 150 },

  { id: "b_lens", name: "Lens", squadId: "sq_analytics", role: "Analytics lead · refreshes the Control Tower", isLead: true, skills: ["crm", "awareness", "workflow"], reportsTo: "human:Revenue Analyst", autonomy: "act", allowedActions: ["read_records", "refresh_tower", "export_sheet"], connections: ["c_gsheets", "c_onedrive"], dailyLimit: 50 },
];

const GUARDRAILS: Guardrail[] = [
  { id: "g1", name: "Permission list", description: "A bot can only take the actions on its allowed list. Anything else is blocked.", kind: "block" },
  { id: "g2", name: "Granted connections only", description: "A bot can only use connections it has been granted, and only once they're connected.", kind: "block" },
  { id: "g3", name: "Human channels", description: "LinkedIn is human-only. Bots prepare; people send.", kind: "block" },
  { id: "g4", name: "Do-not-contact and customers", description: "No outreach action on DNC accounts or existing customers.", kind: "block" },
  { id: "g5", name: "Daily limit", description: "Each bot has a daily action budget. When it's spent, the bot stops.", kind: "limit" },
  { id: "g6", name: "AI drafts, human sends", description: "Every external send waits for a person's approval.", kind: "approval" },
  { id: "g7", name: "Chain of command", description: "Routing, pod assignment and freezing by a non-lead bot escalate to the first human above it.", kind: "escalate" },
  { id: "g8", name: "Autonomy level", description: "Suggest-mode bots need approval for everything; approve-mode bots for any change.", kind: "approval" },
];

const CONNECTIONS: Connection[] = [
  { id: "c_salesforce", name: "Salesforce", kind: "crm", access: "delegated", status: "not_connected", scopes: ["Accounts", "Opportunities", "Tasks"], note: "System of record. Squads write the queue and briefs; outcomes flow back." },
  { id: "c_apollo", name: "Apollo", kind: "data", access: "delegated", status: "not_connected", scopes: ["Search", "Enrichment", "Contacts"], note: "Market database and contact source." },
  { id: "c_theirstack", name: "TheirStack", kind: "data", access: "delegated", status: "not_connected", scopes: ["Job postings", "Hiring alerts"], note: "Hiring signals for the signal factory." },
  { id: "c_linkedin", name: "LinkedIn Sales Navigator", kind: "social", access: "human-only", status: "not_connected", scopes: ["Saved searches (read by people)"], note: "Human channel under LinkedIn's terms. Bots prepare notes; people send." },
  { id: "c_gsheets", name: "Google Sheets", kind: "files", access: "file", status: "not_connected", scopes: ["Granted sheets only"], note: "Lists in and reports out, limited to sheets you share with the squad." },
  { id: "c_onedrive", name: "Microsoft OneDrive", kind: "files", access: "file", status: "not_connected", scopes: ["Granted folders only"], note: "Board packs and exports, limited to folders you share." },
  { id: "c_email", name: "Email (Gmail / Outlook)", kind: "email", access: "delegated", status: "not_connected", scopes: ["Drafts", "Send after approval"], note: "Bots write drafts; sends wait for a person." },
];

const RULES: RoutingRule[] = [
  { id: "r1", name: "Customers and do-not-contact stay out of the machine", on: true, when: [{ field: "customer", op: "is true" }], any: [{ field: "dnc", op: "is true" }], then: { dest: "Freezer", reason: "Customer or DNC", thaw: "never" } },
  { id: "r2", name: "BC reject cooling period", on: true, when: [{ field: "rejectDays", op: "<=", value: 60 }], then: { dest: "Freezer", reason: "BC reject < 60 days", thaw: "after 60 days with a new signal" } },
  { id: "r3", name: "Still enriching", on: true, when: [{ field: "stage", op: "is", value: "enriching" }], then: { dest: "Hold", reason: "Enrichment in progress" } },
  { id: "r4", name: "Tier A with a mapped committee goes to a human SDR", on: true, when: [{ field: "tier", op: "is", value: "A" }, { field: "committee", op: ">=", value: 2 }], then: { dest: "SDR" } },
  { id: "r5", name: "Tier A without a committee waits for validation", on: true, when: [{ field: "tier", op: "is", value: "A" }], then: { dest: "Hold", reason: "Committee validation (< 2 buyers)" } },
  { id: "r6", name: "Prior relationship with a fresh signal → AI reactivation", on: true, when: [{ field: "source", op: "includes", value: "RX" }, { field: "freshDays", op: "<=", value: 30 }], then: { dest: "AI", agent: "AI Reactivation" } },
  { id: "r7", name: "Tier B with a warm signal → AI warm-up", on: true, when: [{ field: "tier", op: "is", value: "B" }, { field: "signal", op: ">=", value: 30 }], then: { dest: "AI", agent: "AI Warm-up" } },
  { id: "r8", name: "High fit, no signal → AI nurture", on: true, when: [{ field: "tier", op: "is", value: "B" }], then: { dest: "AI", agent: "AI Nurture" } },
  { id: "r9", name: "Signal without fit → freeze, review as ICP candidate", on: true, when: [{ field: "tier", op: "is", value: "C" }], then: { dest: "Freezer", reason: "Tier C: signal, no fit", thaw: "if fit ≥ 60 after re-score" } },
  { id: "r10", name: "Park: no fit, no signal", on: true, when: [{ field: "tier", op: "is", value: "Park" }], then: { dest: "Freezer", reason: "Park: no fit, no signal", thaw: "on any signal ≥ 55" } },
];

const LISTS: List[] = [
  { id: "l1", name: "Legal intake surge · FL / TX", color: "#2457e6", type: "smart", description: "Law firms in Florida and Texas with role or hiring-spike signals in the last 30 days", cadence: "Daily", owner: "Research squad", conditions: [{ field: "vertical", op: "is", value: "legal" }, { field: "state", op: "in", value: ["FL", "TX"] }, { field: "signalType", op: "includes", value: ["role_hiring", "hiring_spike"] }, { field: "freshDays", op: "<=", value: 30 }], accountIds: [] },
  { id: "l2", name: "Healthcare RCM after acquisition", color: "#158f63", type: "smart", description: "Healthcare groups with a PE / VC event or hiring spike and a mapped committee", cadence: "Daily", owner: "Research squad", conditions: [{ field: "vertical", op: "is", value: "healthcare" }, { field: "signalType", op: "includes", value: ["pe_event", "hiring_spike"] }, { field: "committee", op: ">=", value: 2 }], accountIds: [] },
  { id: "l3", name: "Tax-season accounting (Oct–Jan)", color: "#b87a00", type: "smart", description: "CPA firms up to 300 staff with bookkeeping or tax hiring; sell before the season", cadence: "Weekly", owner: "Research squad", conditions: [{ field: "vertical", op: "is", value: "accounting" }, { field: "employees", op: "<=", value: 300 }, { field: "signalType", op: "includes", value: ["role_hiring", "hiring_spike"] }], accountIds: [] },
  { id: "l4", name: "New operations leader < 120 days", color: "#7a3fd6", type: "smart", description: "Any vertical, new COO / VP Operations / VP CX, fit ≥ 60", cadence: "Daily", owner: "Research squad", conditions: [{ field: "fit", op: ">=", value: 60 }, { field: "signalType", op: "includes", value: ["new_leader"] }], accountIds: [] },
  { id: "l5", name: "PE portfolios with an operating signal", color: "#3a8fd9", type: "smart", description: "Portfolio companies from the PE / VC factory with any active signal", cadence: "Weekly", owner: "Data squad", conditions: [{ field: "source", op: "includes", value: "PE" }, { field: "signal", op: ">=", value: 1 }], accountIds: [] },
  { id: "l6", name: "Closed-lost + new signal", color: "#cc3f35", type: "smart", description: "Reactivation accounts with a fresh signal", cadence: "Daily", owner: "Revenue Analyst", conditions: [{ field: "source", op: "includes", value: "RX" }, { field: "freshDays", op: "<=", value: 30 }], accountIds: [] },
  { id: "l7", name: "Logistics peak season", color: "#0b5b62", type: "smart", description: "Brokers, 3PLs and carriers with hiring spikes or expansion", cadence: "Daily", owner: "Research squad", conditions: [{ field: "vertical", op: "is", value: "logistics" }, { field: "signalType", op: "includes", value: ["hiring_spike", "expansion"] }], accountIds: [] },
  { id: "l8", name: "Pilot pod 1 · hand-picked", color: "#0b2545", type: "static", description: "Accounts chosen by Valentina Ríos for the 30-day pilot", cadence: "Manual", owner: "Pod 1", conditions: [], accountIds: [] },
];

const PODS: Pod[] = [
  { id: "pod1", name: "Pod 1", kind: "SDR", lead: "Valeria Cárdenas", members: ["Alejandro Torres", "Mariana López", "Sebastián Ruiz"], capacity: 12, focus: ["healthcare"] },
  { id: "pod2", name: "Pod 2", kind: "SDR", lead: "Daniel Mejía", members: ["Juliana Osorio", "Santiago Díaz", "Paula Henao"], capacity: 12, focus: ["legal"] },
  { id: "pod3", name: "Pod 3", kind: "SDR", lead: "Natalia Ríos", members: ["Martín Cano", "Isabela Gil", "Felipe Arias"], capacity: 12, focus: ["logistics", "pe"] },
  { id: "pod4", name: "Pod 4", kind: "SDR", lead: "Andrés Zapata", members: ["Andrea Villa", "Tomás Arango", "Lucía Vélez"], capacity: 12, focus: ["accounting", "staffing"] },
  { id: "pod5", name: "Pod 5", kind: "SDR", lead: "Carolina Pérez", members: ["Salomé Puerta", "Nicolás Ochoa", "Diego Marín"], capacity: 12, focus: ["cx"] },
  { id: "bdr1", name: "Inbound BDR", kind: "BDR", lead: "Sara Montoya", members: ["Juan Pablo Ríos", "Manuela Castro"], capacity: 20, focus: [] },
  { id: "bc1", name: "Business Consultants", kind: "BC", lead: "Ricardo Salazar", members: ["Elena Duque", "Mauricio Vargas", "Catalina Ortiz"], capacity: 15, focus: [] },
];

/* ---------- Deterministic account generator ---------- */

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX = ["Valley", "Summit", "Harbor Point", "Lakeshore", "Redwood", "Cascade", "Prairie", "Granite", "Evergreen", "Ironwood", "Pinecrest", "Blue Ridge", "Copperline", "Northwind", "Meridian", "Castellan", "Keystone", "Aurora", "Westfield", "Southpoint", "Delta", "Franklin", "Silverline", "Bayview", "Oakmont", "Riverside", "Highland", "Sterling", "Crescent", "Beacon", "Cobalt", "Juniper", "Magnolia", "Lone Star", "Bluewater"];
const SUFFIX: Record<string, string[]> = {
  legal: ["Law Group", "Injury Law", "Legal Services", "Immigration Law", "Trial Lawyers"],
  healthcare: ["Physicians Group", "Dental Partners", "Health Partners", "Medical Billing", "Care Network"],
  logistics: ["Freight Brokers", "3PL", "Logistics", "Carriers", "Transport"],
  accounting: ["CPA Advisors", "Accounting", "Tax & Advisory", "Bookkeeping Co"],
  cx: ["Home Services", "Insurance Agency", "Customer Care", "Collections", "Direct"],
  staffing: ["Staffing", "Talent Partners", "Recruiting"],
  pe: ["Holdings", "Platform Partners", "Services Group"],
};
const EMP: Record<string, [number, number]> = { legal: [50, 500], healthcare: [200, 3000], logistics: [100, 2500], accounting: [20, 300], cx: [200, 5000], staffing: [50, 1000], pe: [500, 5000] };
const STATES = ["TX", "FL", "CA", "IL", "GA", "NC", "OH", "PA", "AZ", "CO", "MA", "TN", "NY", "WA"];
const SIGNAL_DETAIL: Record<string, string[]> = {
  hiring_spike: ["{n} relevant openings in 30 days", "Openings at 3× the 90-day baseline"],
  role_hiring: ["{n} {role} postings", "Hiring {role} in two offices"],
  new_leader: ["New COO appointed", "New VP Operations from a larger competitor", "New VP Customer Experience"],
  pe_event: ["Add-on acquisition closed", "Series B funding announced", "Acquired by a PE platform"],
  expansion: ["New office in {st}", "Entered a new state", "New terminal opening"],
  prior_relationship: ["Closed-lost 14 months ago (budget)", "Dormant since 2024"],
};
const ROLE: Record<string, string> = { legal: "paralegal", healthcare: "medical billing", logistics: "dispatch", accounting: "bookkeeper", cx: "customer service", staffing: "recruiter", pe: "shared-services" };
const SOURCE_POOL: Source[] = ["AP", "AP", "AP", "LI", "TS", "TS", "PE", "LK", "RX", "IN", "FC"];

function generateAccounts(now: Date, count: number): Account[] {
  const r = rng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const day = 86_400_000;
  const used = new Set<string>();
  const out: Account[] = [];
  const verticalIds = VERTICALS.map((v) => v.id);
  for (let i = 0; i < count; i++) {
    const v = i % 9 === 8 ? null : pick(verticalIds);
    const vid = v || pick(verticalIds);
    let name = `${pick(PREFIX)} ${pick(SUFFIX[vid])}`;
    while (used.has(name)) name += " II";
    used.add(name);
    const domain = name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "") + ".com";
    const [lo, hi] = EMP[vid];
    const employees = Math.round(lo + r() * (hi - lo));
    const state = pick(STATES);
    const baseFit = v ? 0.45 + r() * 0.5 : 0.15 + r() * 0.35;
    const jitter = () => Math.max(0, Math.min(1, baseFit + (r() - 0.5) * 0.2));
    const sources = Array.from(new Set([pick(SOURCE_POOL), ...(r() < 0.35 ? [pick(SOURCE_POOL)] : [])]));
    const nSignals = r() < 0.25 ? 0 : 1 + Math.floor(r() * 3);
    const signals = Array.from({ length: nSignals }, () => {
      const typeId = sources.includes("RX") && r() < 0.3 ? "prior_relationship" : pick(["hiring_spike", "role_hiring", "role_hiring", "new_leader", "pe_event", "expansion"]);
      const detail = pick(SIGNAL_DETAIL[typeId]).replace("{n}", String(6 + Math.floor(r() * 60))).replace("{role}", ROLE[vid]).replace("{st}", pick(STATES));
      return { typeId, detail, date: new Date(now.getTime() - Math.floor(r() * 55) * day).toISOString().slice(0, 10) };
    }).sort((a, b) => b.date.localeCompare(a.date));
    const roles = ["economic", "operational", "functional", "champion"] as const;
    const titles = { economic: "COO", operational: "VP Operations", functional: "VP People", champion: "Director of Operations" };
    const nCommittee = Math.floor(r() * 4.4);
    const committee = roles.slice(0, nCommittee).map((role) => ({ role, title: titles[role] }));
    const x = r();
    const stage: Account["stage"] = x < 0.05 ? "enriching" : x < 0.62 ? "new" : x < 0.72 ? "engaged" : x < 0.8 ? "mql" : x < 0.86 ? "sql" : x < 0.9 ? "opportunity" : x < 0.94 ? "won" : x < 0.97 ? "lost" : "new";
    out.push({
      id: `acc_${String(i + 1).padStart(3, "0")}`,
      gtmId: v === "pe" && r() < 0.5 ? "gtm_pe" : "gtm_us",
      domain,
      name,
      verticalId: v,
      employees,
      state,
      sources,
      fit: { vertical: jitter(), sizeAndRoleMix: jitter(), geography: jitter(), operationsIntensity: jitter(), historicalPerformance: jitter() },
      signals,
      committee,
      estimatedSeats: Math.max(2, Math.round((employees / 60) * (0.5 + r()))),
      brief: null,
      stage,
      revenue: stage === "won" ? Math.round((40 + r() * 300) * 1000) : null,
      customer: stage === "won" || r() < 0.02,
      dnc: r() < 0.02,
      rejectDays: r() < 0.05 ? Math.floor(r() * 120) : null,
      routing: null,
      createdAt: new Date(now.getTime() - Math.floor(r() * 120) * day).toISOString(),
    });
  }
  return out;
}

export function seedDatabase(now = new Date()): Database {
  const gtms = [structuredClone(usNearshore), structuredClone(peDraft)];
  const pods = structuredClone(PODS);
  const rules = structuredClone(RULES);
  const accounts = generateAccounts(now, 160);
  // Engaged and later accounts already sit with a pod; route them first so they're "locked".
  const r = rng(7);
  const sdrPods = pods.filter((p) => p.kind === "SDR");
  for (const a of accounts) {
    if (["engaged", "mql", "sql", "opportunity", "won", "lost"].includes(a.stage)) {
      const pod = a.stage === "sql" || a.stage === "opportunity" || a.stage === "won" || a.stage === "lost" ? pods.find((p) => p.kind === "BC")! : sdrPods.find((p) => a.verticalId && p.focus.includes(a.verticalId)) || sdrPods[Math.floor(r() * sdrPods.length)];
      a.routing = { dest: "SDR", ruleId: "r4", reason: "Worked by a human pod", podId: pod.id, owner: pod.members[Math.floor(r() * pod.members.length)], agent: null, thaw: null, at: now.toISOString() };
    }
  }
  const routed = routeAll(accounts, gtms, rules, pods, now);
  for (const a of accounts) a.routing = routed.get(a.id) || a.routing;
  const lists = structuredClone(LISTS);
  lists[7].accountIds = accounts.filter((a) => a.routing?.podId === "pod1").slice(0, 6).map((a) => a.id);
  const db: Database = {
    version: 2,
    org: { name: "Solvo", humans: HUMANS },
    gtms,
    squads: structuredClone(SQUADS),
    bots: structuredClone(BOTS),
    guardrails: structuredClone(GUARDRAILS),
    connections: structuredClone(CONNECTIONS),
    accounts,
    lists,
    rules,
    pods,
    approvals: [],
    activity: [{ id: "act_seed", at: now.toISOString(), actor: "Boldr", text: `Seeded the Solvo demo: ${accounts.length} accounts routed by ${rules.length} rules.`, kind: "info" }],
    tower: null,
    sessions: [],
  };
  db.tower = computeTower(db, "Lens", null, [], now);
  return db;
}
