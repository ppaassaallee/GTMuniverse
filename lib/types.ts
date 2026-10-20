// Core domain model. One workspace = one company running its GTM on Boldr.

export type Tier = "A" | "B" | "C" | "Park";
export type ValueBand = "high" | "medium" | "low";

export interface Vertical {
  id: string;
  name: string;
  fitProfile: string;
  hiringSignals: string;
  personas: string;
  timing: string;
}

export interface SignalType {
  id: string;
  name: string;
  definition: string;
  /** Points added to the signal score while the signal is fresh. */
  weight: number;
  source: string;
  /** A modifier only counts when at least one other signal is active (e.g. prior relationship). */
  modifier?: boolean;
}

export interface Play {
  id: string;
  name: string;
  trigger: string;
  hypothesis: string;
  firstTouch: string;
}

export interface Workspace {
  id: string;
  company: string;
  product: string;
  icpSummary: string;
  stage: string;
  motion: string;
  goal: string;
  verticals: Vertical[];
  signalTypes: SignalType[];
  plays: Play[];
  /** Days after which a signal stops counting. */
  signalDecayDays: number;
  thresholds: { fit: number; signal: number };
}

export interface AccountSignal {
  typeId: string;
  detail: string;
  /** ISO date of the event. */
  date: string;
}

export interface FitInputs {
  /** Each 0..1: how well the account matches that part of the ICP. */
  vertical: number;
  sizeAndRoleMix: number;
  geography: number;
  operationsIntensity: number;
  historicalPerformance: number;
}

export interface CommitteeMember {
  role: "economic" | "operational" | "functional" | "champion";
  title: string;
  name?: string;
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

export type Factory = "core" | "linkedin" | "signal" | "portfolio" | "lookalike" | "reactivation";

export interface Account {
  id: string;
  domain: string;
  name: string;
  verticalId: string | null;
  employees: number | null;
  geography: string;
  notes: string;
  factory: Factory;
  fit: FitInputs;
  signals: AccountSignal[];
  committee: CommitteeMember[];
  estimatedSeats: number | null;
  brief: AccountBrief | null;
  stage: "universe" | "mql" | "sql" | "opportunity" | "won" | "lost";
  revenue: number | null;
  createdAt: string;
}

export interface ScoredAccount extends Account {
  fitScore: number;
  signalScore: number;
  value: ValueBand;
  tier: Tier;
  mqlReady: boolean;
  mqlBlockers: string[];
}

export interface AdvisorTake {
  headline: string;
  moves: string[];
  watch: string;
}

export interface BoardSession {
  id: string;
  createdAt: string;
  model: string;
  question: string;
  advisorIds: string[];
  synthesis: string;
  week: string[];
  takes: Record<string, AdvisorTake>;
}

export interface Database {
  workspace: Workspace;
  accounts: Account[];
  sessions: BoardSession[];
}
