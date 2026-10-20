// Boldr domain model. An organisation runs one or more GTMs; squads of Grokbots do the work
// under guardrails and a chain of command; humans in pods sell; the Control Tower measures.

export type Tier = "A" | "B" | "C" | "Park";
export type ValueBand = "high" | "medium" | "low";

/* ---------- 1. GTMs ---------- */

export interface Vertical {
  id: string;
  name: string;
  fitProfile: string;
  hiringSignals: string;
  personas: string;
  timing: string;
  /** Months (1-12) when plays should fire, 60-90 days before the buying peak. */
  sellMonths: number[];
}

export interface Persona {
  id: string;
  title: string;
  committeeRole: CommitteeRole;
  pains: string;
  message: string;
}

export interface SignalType {
  id: string;
  name: string;
  definition: string;
  weight: number;
  source: string;
  /** Only counts when another signal is active (e.g. prior relationship). */
  modifier?: boolean;
}

export interface Play {
  id: string;
  name: string;
  trigger: string;
  hypothesis: string;
  firstTouch: string;
  sequenceId: string | null;
  /** Observed MQL to SQL rate, 0..1, when known. */
  sqlRate: number | null;
}

export type Channel = "email" | "call" | "linkedin" | "voicemail" | "task";

export interface Sequence {
  id: string;
  name: string;
  persona: string;
  steps: { day: number; channel: Channel; action: string }[];
}

export interface Script {
  id: string;
  name: string;
  kind: "cold call" | "voicemail" | "objection" | "handoff";
  body: string;
}

export interface Policy {
  id: string;
  name: string;
  rule: string;
  severity: "must" | "should";
}

export interface BestPractice {
  id: string;
  source: "6sense" | "ZoomInfo" | "Apollo" | "Boldr";
  area: string;
  practice: string;
}

/** Knowledge the Grokbots read before they act: value props, objections, case studies, competitors. */
export interface KnowledgeDoc {
  id: string;
  kind: "Value proposition" | "Objection" | "Case study" | "Competitor" | "FAQ";
  title: string;
  body: string;
  updatedBy: string;
  updatedAt: string;
}

export interface BuyingStage {
  id: string;
  name: string;
  meaning: string;
  motion: string;
}

export interface Gtm {
  id: string;
  name: string;
  status: "live" | "draft";
  owner: string;
  objective: string;
  northStar: string;
  product: string;
  icpSummary: string;
  exclusions: string;
  verticals: Vertical[];
  personas: Persona[];
  signalTypes: SignalType[];
  plays: Play[];
  sequences: Sequence[];
  scripts: Script[];
  policies: Policy[];
  bestPractices: BestPractice[];
  knowledge: KnowledgeDoc[];
  buyingStages: BuyingStage[];
  signalDecayDays: number;
  thresholds: { fit: number; signal: number };
}

/* ---------- 2. Squads ---------- */

export type ActionType =
  | "read_records"
  | "update_record"
  | "add_signal"
  | "map_committee"
  | "write_brief"
  | "draft_email"
  | "send_email"
  | "linkedin_prepare"
  | "linkedin_send"
  | "enrich"
  | "export_sheet"
  | "route_account"
  | "assign_pod"
  | "freeze_account"
  | "refresh_tower"
  | "create_account";

export type Autonomy = "suggest" | "approve" | "act";

export interface Bot {
  id: string;
  name: string;
  squadId: string;
  role: string;
  skills: string[];
  /** Bot id or "human:<role>". The chain of command runs through this field. */
  reportsTo: string;
  autonomy: Autonomy;
  allowedActions: ActionType[];
  connections: string[];
  dailyLimit: number;
  isLead?: boolean;
}

export interface Squad {
  id: string;
  name: string;
  mission: string;
  gtmId: string;
  color: string;
}

export interface Guardrail {
  id: string;
  name: string;
  description: string;
  kind: "approval" | "block" | "limit" | "escalate";
}

export interface ProposedAction {
  type: ActionType;
  accountId?: string | null;
  connectionId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
}

export type Verdict = { decision: "allow" | "approval" | "block"; reasons: string[]; approver: string | null };

export interface Approval {
  id: string;
  createdAt: string;
  botId: string;
  action: ProposedAction;
  reasons: string[];
  approver: string;
  status: "pending" | "approved" | "rejected";
  decidedAt?: string;
  decidedBy?: string;
}

export interface Activity {
  id: string;
  at: string;
  actor: string;
  text: string;
  kind: "done" | "queued" | "blocked" | "human" | "info";
}

/* ---------- 3. Connections ---------- */

export interface Connection {
  id: string;
  name: string;
  kind: "crm" | "data" | "social" | "files" | "email";
  /** How the squads reach it: delegated sign-in, a granted file/folder, or human-only. */
  access: "delegated" | "file" | "human-only";
  status: "connected" | "not_connected";
  scopes: string[];
  note: string;
}

/* ---------- 4. Universe ---------- */

export type CommitteeRole = "economic" | "operational" | "functional" | "champion";
export type Source = "AP" | "LI" | "TS" | "PE" | "LK" | "RX" | "IN" | "FC";
export type Destination = "SDR" | "AI" | "Hold" | "Freezer";

export interface AccountSignal {
  typeId: string;
  detail: string;
  date: string;
}

export interface FitInputs {
  vertical: number;
  sizeAndRoleMix: number;
  geography: number;
  operationsIntensity: number;
  historicalPerformance: number;
}

export interface AccountBrief {
  generatedAt: string;
  model: string;
  whyFit: string;
  whyNow: string;
  committee: string;
  hypothesis: string;
  playId: string | null;
  nextAction: string;
  email: { subject: string; body: string };
}

export interface Routing {
  dest: Destination;
  ruleId: string | null;
  reason: string;
  podId: string | null;
  owner: string | null;
  agent: string | null;
  thaw: string | null;
  at: string;
}

export interface Account {
  id: string;
  gtmId: string;
  domain: string;
  name: string;
  verticalId: string | null;
  employees: number | null;
  state: string;
  sources: Source[];
  fit: FitInputs;
  signals: AccountSignal[];
  committee: { role: CommitteeRole; title: string; name?: string }[];
  estimatedSeats: number | null;
  brief: AccountBrief | null;
  stage: "new" | "enriching" | "queued" | "engaged" | "mql" | "sql" | "opportunity" | "won" | "lost";
  revenue: number | null;
  customer: boolean;
  dnc: boolean;
  /** Days since a Business Consultant rejected it, if ever. */
  rejectDays: number | null;
  routing: Routing | null;
  createdAt: string;
}

export interface ScoredAccount extends Account {
  fitScore: number;
  signalScore: number;
  value: ValueBand;
  tier: Tier;
  freshestSignalDays: number | null;
  mqlReady: boolean;
  mqlBlockers: string[];
}

export type Field = "tier" | "fit" | "signal" | "committee" | "freshDays" | "stage" | "source" | "vertical" | "state" | "employees" | "dnc" | "customer" | "rejectDays" | "signalType" | "value";
export type Op = "is" | "is not" | ">=" | "<=" | "in" | "includes" | "is true";
export interface Condition {
  field: Field;
  op: Op;
  value?: string | number | string[];
}

export interface RoutingRule {
  id: string;
  name: string;
  on: boolean;
  /** All of these must match... */
  when: Condition[];
  /** ...or any of these. */
  any?: Condition[];
  then: { dest: Destination; reason?: string; agent?: string; thaw?: string };
}

export interface List {
  id: string;
  name: string;
  color: string;
  type: "smart" | "static";
  description: string;
  cadence: string;
  owner: string;
  conditions: Condition[];
  accountIds: string[];
}

/* ---------- 5. Pods ---------- */

export interface Pod {
  id: string;
  name: string;
  kind: "SDR" | "BDR" | "BC";
  lead: string;
  members: string[];
  capacity: number;
  focus: string[];
}

/* ---------- 6. Control Tower ---------- */

export interface TowerSnapshot {
  updatedAt: string;
  updatedBy: string;
  /** Which Grokbot wrote the commentary, and when. Numbers are always computed by Boldr. */
  commentaryBy: string | null;
  commentaryAt: string | null;
  metrics: {
    universe: number;
    tiers: Record<Tier, number>;
    destinations: Record<Destination, number>;
    funnel: { stage: string; count: number }[];
    mqls: number;
    won: number;
    revenue: number;
    revenuePer100Mqls: number | null;
    mqlsPerWin: number | null;
    pods: { id: string; name: string; load: number; capacity: number }[];
    sources: { source: Source; accounts: number; tierA: number; won: number }[];
    plays: { id: string; name: string; accounts: number; sqlRate: number | null }[];
  };
  commentary: string[];
}

/* ---------- Sign-in ---------- */

/** Anyone who signs in: a person, or one of your Grokbots. */
export interface Member {
  id: string;
  name: string;
  kind: "human" | "bot";
  role: string;
}

/** One access code per member. Only its SHA-256 is stored; the code is shown once. */
export interface Login {
  memberId: string;
  codeHash: string;
  hint: string;
  issuedAt: string;
  issuedBy: string;
  lastSignInAt: string | null;
}

export interface Database {
  version: 3;
  org: { name: string; humans: { id: string; role: string; name: string }[] };
  /** Signs session cookies when BOLDR_SECRET isn't set. */
  secret: string;
  logins: Login[];
  gtms: Gtm[];
  squads: Squad[];
  bots: Bot[];
  guardrails: Guardrail[];
  connections: Connection[];
  accounts: Account[];
  lists: List[];
  rules: RoutingRule[];
  pods: Pod[];
  approvals: Approval[];
  activity: Activity[];
  tower: TowerSnapshot | null;
}
