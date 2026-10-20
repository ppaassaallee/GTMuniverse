import type { Account, FitInputs, Gtm, ScoredAccount, Tier, ValueBand } from "./types";

// Fit weights follow the Solvo GTM Engineering System: vertical 30, size and role mix 25,
// geography 15, operations intensity 15, historical performance 15.
export const FIT_WEIGHTS: Record<keyof FitInputs, number> = {
  vertical: 30,
  sizeAndRoleMix: 25,
  geography: 15,
  operationsIntensity: 15,
  historicalPerformance: 15,
};

const DAY = 86_400_000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

export function fitScore(fit: FitInputs): number {
  let total = 0;
  for (const [k, w] of Object.entries(FIT_WEIGHTS) as [keyof FitInputs, number][]) total += clamp01(fit[k]) * w;
  return Math.round(total);
}

/** Sum of fresh signal weights, each type once, capped at 100. Modifiers need a base signal. */
export function signalScore(account: Pick<Account, "signals">, gtm: Pick<Gtm, "signalTypes" | "signalDecayDays">, now = new Date()): number {
  const types = new Map(gtm.signalTypes.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let base = 0;
  let modifiers = 0;
  for (const s of account.signals) {
    const age = daysSince(s.date, now);
    const t = types.get(s.typeId);
    if (!t || age < 0 || age > gtm.signalDecayDays || seen.has(s.typeId)) continue;
    seen.add(s.typeId);
    if (t.modifier) modifiers += t.weight;
    else base += t.weight;
  }
  return base === 0 ? 0 : Math.min(100, base + modifiers);
}

export function tierFor(fit: number, signal: number, th: Gtm["thresholds"]): Tier {
  const hiFit = fit >= th.fit;
  const hiSignal = signal >= th.signal;
  if (hiFit && hiSignal) return "A";
  if (hiFit) return "B";
  if (hiSignal) return "C";
  return "Park";
}

export function valueBand(seats: number | null): ValueBand {
  if (seats == null) return "low";
  if (seats >= 20) return "high";
  if (seats >= 8) return "medium";
  return "low";
}

export function scoreAccount(a: Account, gtm: Gtm, now = new Date()): ScoredAccount {
  const f = fitScore(a.fit);
  const s = signalScore(a, gtm, now);
  const tier = tierFor(f, s, gtm.thresholds);
  const ages = a.signals.map((x) => daysSince(x.date, now)).filter((d) => d >= 0);
  // MQL gate: Tier A, at least two buying-committee members, and a play assigned.
  const mqlBlockers: string[] = [];
  if (tier !== "A") mqlBlockers.push("Not Tier A");
  if (a.committee.length < 2) mqlBlockers.push("Fewer than 2 committee members");
  if (!a.brief?.playId) mqlBlockers.push("No play assigned");
  return {
    ...a,
    fitScore: f,
    signalScore: s,
    value: valueBand(a.estimatedSeats),
    tier,
    freshestSignalDays: ages.length ? Math.min(...ages) : null,
    mqlReady: mqlBlockers.length === 0,
    mqlBlockers,
  };
}

const TIER_ORDER: Record<Tier, number> = { A: 0, B: 1, C: 2, Park: 3 };
const VALUE_ORDER: Record<ValueBand, number> = { high: 0, medium: 1, low: 2 };

/** Work-queue order: tier, then value, then signal, then fit. */
export function prioritize<T extends ScoredAccount>(list: T[]): T[] {
  return [...list].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || VALUE_ORDER[a.value] - VALUE_ORDER[b.value] || b.signalScore - a.signalScore || b.fitScore - a.fitScore,
  );
}

export const MQL_STAGES: Account["stage"][] = ["mql", "sql", "opportunity", "won", "lost"];

/** The operating metric: closed-won revenue per 100 MQLs. */
export function revenuePer100Mqls(accounts: Pick<Account, "stage" | "revenue">[]) {
  const mqls = accounts.filter((a) => MQL_STAGES.includes(a.stage)).length;
  const wonList = accounts.filter((a) => a.stage === "won");
  const revenue = wonList.reduce((s, a) => s + (a.revenue || 0), 0);
  return { mqls, won: wonList.length, revenue, per100: mqls ? Math.round((revenue / mqls) * 100) : null };
}

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}
