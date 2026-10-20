import type { Account, Database, Workspace } from "../types";

// Demo tenant: Solvo, a nearshore staffing company, configured from its GTM Engineering System.

export const solvoWorkspace: Workspace = {
  id: "solvo",
  company: "Solvo",
  product: "Nearshore professionals in accounting, back office, collections, customer service, healthcare, IT, legal, logistics and sales, placed with US companies.",
  icpSummary: "US companies hiring the roles Solvo places right now: law firms, multi-site healthcare, 3PLs and freight brokers, CPA firms, CX-heavy operators, staffing agencies and PE-backed platforms.",
  stage: "Scaling: 100+ SDRs in pods",
  motion: "Sales-led, SDR to Business Consultant",
  goal: "Raise closed-won revenue per 100 MQLs while lowering MQLs per closed-won deal.",
  signalDecayDays: 30,
  thresholds: { fit: 60, signal: 55 },
  verticals: [
    { id: "legal", name: "Legal", fitProfile: "Law firms and legal services, 50–500 staff; PI, immigration, family, mass tort, insurance defense; multi-office", hiringSignals: "Paralegals, legal assistants, intake specialists, records and billing clerks", personas: "Managing Partner, Firm Administrator, COO", timing: "Intake growth after a marketing push; new office; case-load surge" },
    { id: "healthcare", name: "Healthcare", fitProfile: "Multi-site practices, MSOs, DSOs, RCM and billing companies", hiringSignals: "Medical billers and coders, prior authorization, schedulers, credentialing, AR follow-up", personas: "Practice Administrator, VP Revenue Cycle, COO", timing: "Practice acquisitions; payer changes; Q4 enrollment; year-end" },
    { id: "logistics", name: "Logistics", fitProfile: "Freight brokers, 3PLs, carriers, 100–2,000 staff; asset-light growth", hiringSignals: "Track & trace, dispatch, carrier sales support, load planning, documentation, AP/AR", personas: "VP Operations, COO, CFO", timing: "Q4 peak; produce season; new lanes or terminals; TMS migration" },
    { id: "accounting", name: "Accounting", fitProfile: "Regional CPA firms and outsourced accounting providers, 20–300 staff", hiringSignals: "Bookkeepers, staff accountants, tax preparers, AP/AR specialists", personas: "Managing Partner, Firm Administrator, Director of Client Accounting", timing: "Oct–Jan hiring before tax season; post-merger integration" },
    { id: "cx", name: "CX-heavy operators", fitProfile: "Home services, insurance agencies, e-commerce, fintech, SaaS support, 200–5,000 staff", hiringSignals: "CSRs, chat and email support, order management, collections agents, retention", personas: "VP Customer Experience, Director of Support, COO", timing: "Q4 volume; product launch; CSAT or backlog pressure" },
    { id: "staffing", name: "Staffing", fitProfile: "Staffing and recruiting agencies, 50–1,000 staff", hiringSignals: "Recruiters, sourcers, recruiting coordinators, payroll and admin", personas: "CEO, COO, VP Recruiting", timing: "Req volume growth; new client wins; margin pressure" },
    { id: "pe", name: "PE-backed platforms", fitProfile: "Roll-ups in any vertical above; shared-services build-out", hiringSignals: "Any of the above at scale; shared services and centralization roles", personas: "Operating Partner, portfolio COO / CFO", timing: "Add-on acquisition; 100-day plan; cost pressure" },
  ],
  signalTypes: [
    { id: "hiring_spike", name: "Hiring spike", definition: "30+ relevant open roles, or 3× the 90-day baseline", weight: 35, source: "TheirStack webhooks, career pages" },
    { id: "role_hiring", name: "Role-specific hiring", definition: "Postings for roles you place: paralegal, biller, dispatcher, bookkeeper", weight: 20, source: "TheirStack title filters" },
    { id: "new_leader", name: "New operations leader", definition: "COO, VP Operations or VP CX appointed within 120 days", weight: 25, source: "LinkedIn, Apollo job-change alerts" },
    { id: "pe_event", name: "PE / VC event", definition: "Acquisition, add-on, new funding round", weight: 20, source: "Investor sites, news RSS, SEC filings" },
    { id: "expansion", name: "Expansion", definition: "New state, country or operating location", weight: 15, source: "Press releases, career-page geography" },
    { id: "prior_relationship", name: "Prior relationship", definition: "Closed-lost or dormant account plus any event above", weight: 15, source: "Salesforce join", modifier: true },
  ],
  plays: [
    { id: "01", name: "Rapid hiring", trigger: "30+ relevant open roles or a spike vs. the 90-day baseline", hypothesis: "Capacity is growing faster than the operating model can scale it efficiently", firstTouch: "Call the operational buyer with the role count and a comparable customer." },
    { id: "02", name: "New operations leader", trigger: "New COO, VP Operations or VP CX within ~120 days", hypothesis: "New leaders re-evaluate structure, cost, capacity and vendors in their first two quarters", firstTouch: "Connect with the new leader; offer a 100-day capacity benchmark." },
    { id: "03", name: "PE / VC portfolio growth", trigger: "PE- or VC-backed plus acquisition, funding, hiring or expansion", hypothesis: "Growth is raising execution complexity and operating cost across the platform", firstTouch: "Thesis email to the operating partner, then call the portfolio COO." },
    { id: "04", name: "Geographic expansion", trigger: "New state, country, region or operating location", hypothesis: "Expansion opens a capacity and recruiting gap before local hiring catches up", firstTouch: "Reach the head of the new region with a ramp plan." },
    { id: "05", name: "Closed-lost reactivation", trigger: "Prior opportunity plus a new event", hypothesis: "The blocker that lost the deal has changed; the need has not", firstTouch: "Reference the earlier conversation and what changed since." },
    { id: "06", name: "Lookalike expansion", trigger: "Operationally similar to a strong customer, plus a timing signal", hypothesis: "Same operating model, same pain, same seat structure", firstTouch: "Lead with the reference customer's result." },
  ],
};

type SeedRow = [name: string, domain: string, vertical: string, emp: number, geo: string, fit: number, seats: number, factory: Account["factory"], signals: [string, string, number][], committee: [Account["committee"][number]["role"], string][], stage?: Account["stage"], revenue?: number];

const ROWS: SeedRow[] = [
  ["Meridian Health Partners", "meridianhealthpartners.com", "healthcare", 1800, "TX · FL", 84, 30, "signal", [["hiring_spike", "42 open patient-support and billing roles", 6], ["new_leader", "New COO appointed", 25]], [["economic", "COO"], ["operational", "VP Revenue Cycle"], ["functional", "VP People"]]],
  ["Northwind Freight Brokers", "northwindfreight.com", "logistics", 640, "IL · GA", 79, 21, "signal", [["role_hiring", "27 track-and-trace and carrier-sales openings", 9], ["expansion", "New Chicago terminal", 14], ["hiring_spike", "Openings 3× the 90-day baseline", 9]], [["operational", "VP Operations"], ["economic", "CFO"]]],
  ["Castellan Law Group", "castellanlaw.com", "legal", 210, "CA", 88, 10, "linkedin", [["new_leader", "New Chief Operating Officer (Aug 2026)", 20], ["role_hiring", "9 paralegal and intake postings", 5], ["expansion", "Second office opening in San Diego", 12]], [["economic", "Managing Partner"]]],
  ["Harbor Point CPA Advisors", "harborpointcpa.com", "accounting", 140, "MA · NH", 81, 8, "core", [["role_hiring", "11 bookkeeper and staff-accountant roles", 18], ["hiring_spike", "Tax-season staffing surge", 18], ["expansion", "Opened NH office", 22]], [["economic", "Managing Partner"], ["operational", "Director of Client Accounting"]]],
  ["Blue Ridge Home Services", "blueridgehome.com", "cx", 2300, "NC · VA · SC", 76, 40, "portfolio", [["pe_event", "Add-on acquisition closed (Halcyon Growth Partners)", 11], ["hiring_spike", "60+ CSR openings", 4], ["expansion", "Entered SC market", 11]], [["economic", "Operating Partner"], ["operational", "VP Customer Experience"], ["champion", "Director of Support"]], "sql"],
  ["Aurora Dental Partners", "auroradental.com", "healthcare", 950, "OH · MI", 83, 20, "portfolio", [["pe_event", "DSO acquired 6 practices in Q3", 16], ["role_hiring", "Credentialing and billing postings", 7], ["hiring_spike", "Billing backlog roles up 3×", 7]], [["economic", "COO"], ["operational", "VP Revenue Cycle"]], "opportunity"],
  ["Keystone Legal Services", "keystonelegal.com", "legal", 160, "PA", 80, 7, "reactivation", [["prior_relationship", "Closed-lost 14 months ago (budget)", 3], ["new_leader", "New managing partner", 15], ["role_hiring", "6 intake roles open", 8]], [["economic", "Managing Partner"], ["operational", "Firm Administrator"]], "won", 96000],
  ["Copperline 3PL", "copperline3pl.com", "logistics", 2900, "CA · TX", 77, 35, "signal", [["hiring_spike", "88 open warehouse-office and customer-ops roles", 3], ["role_hiring", "Order management postings", 3], ["pe_event", "Series C funding", 26]], [["operational", "VP Operations"], ["economic", "CFO"], ["functional", "Head of Talent"]], "won", 312000],
  ["Evergreen Accounting Advisors", "evergreenaccounting.com", "accounting", 90, "CO", 78, 5, "core", [["role_hiring", "8 tax-preparer roles for the 2027 season", 12]], [["economic", "Managing Partner"]]],
  ["Pinecrest Physicians Group", "pinecrestphysicians.com", "healthcare", 1300, "GA · AL", 82, 20, "lookalike", [["new_leader", "New Chief Operating Officer", 30], ["role_hiring", "Prior-authorization team hiring", 10], ["expansion", "Two new clinics in AL", 19]], [["economic", "COO"], ["operational", "Practice Administrator"]], "mql"],
  ["Lakeshore Injury Law", "lakeshoreinjury.com", "legal", 260, "IL · WI", 87, 12, "linkedin", [["hiring_spike", "Intake volume doubled after marketing push", 8], ["role_hiring", "14 intake specialist roles", 8], ["expansion", "Milwaukee office", 21]], [["economic", "Managing Partner"], ["operational", "Firm Administrator"], ["champion", "Intake Director"]], "mql"],
  ["Cobalt Collections", "cobaltcollections.com", "cx", 540, "TX", 73, 15, "reactivation", [["prior_relationship", "Dormant since 2024", 2], ["new_leader", "New CFO", 40], ["role_hiring", "Collections agent hiring restarted", 6]], [["economic", "CFO"]], "lost"],
  ["Granite Peak Staffing", "granitepeakstaffing.com", "staffing", 120, "UT", 64, 6, "core", [], [["economic", "CEO"]]],
  ["Summit Retail Group", "summitretail.com", null as unknown as string, 8000, "Nationwide", 38, 0, "core", [["hiring_spike", "Seasonal store hiring", 5], ["expansion", "40 new stores", 10], ["pe_event", "Refinancing", 8]], []],
];

export function seedDatabase(now = new Date()): Database {
  const day = 86_400_000;
  const accounts: Account[] = ROWS.map(([name, domain, vertical, emp, geo, fit, seats, factory, signals, committee, stage, revenue], i) => {
    const f = fit / 100;
    return {
      id: `acc_${String(i + 1).padStart(3, "0")}`,
      domain,
      name,
      verticalId: vertical,
      employees: emp,
      geography: geo,
      notes: "",
      factory,
      fit: { vertical: f, sizeAndRoleMix: f, geography: f, operationsIntensity: f, historicalPerformance: f },
      signals: signals.map(([typeId, detail, daysAgo]) => ({ typeId, detail, date: new Date(now.getTime() - daysAgo * day).toISOString().slice(0, 10) })),
      committee: committee.map(([role, title]) => ({ role, title })),
      estimatedSeats: seats || null,
      brief: null,
      stage: stage || "universe",
      revenue: revenue ?? null,
      createdAt: new Date(now.getTime() - (30 - i) * day).toISOString(),
    };
  });
  return { workspace: structuredClone(solvoWorkspace), accounts, sessions: [] };
}
