import type { Account, FitInputs, ScoredAccount, Tier, ValueBand, Workspace } from "./types";

// Fit weights follow the Solvo GTM Engineering System: vertical 30, size and role mix 25,
// geography 15, operations intensity 15, historical performance 15.
export const FIT_WEIGHTS: Record<keyof FitInputs, number> = {
  vertical: 30,
  sizeAndRoleMix: 25,
  geography: 15,
  operationsIntensity: 15,
  historicalPerformance: 15,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function fitScore(fit: FitInputs): number {
  let total = 0;
  for (const [k, w] of Object.entries(FIT_WEIGHTS) as [keyof FitInputs, number][]) total += clamp01(fit[k]) * w;
  return Math.round(total);
}

const DAY = 86_400_000;

/** Sum of fresh signal weights, capped at 100. Signals older than the decay window count for nothing. */
export function signalScore(account: Pick<Account, "signals">, ws: Pick<Workspace, "signalTypes" | "signalDecayDays">, now = new Date()): number {
  const types = new Map(ws.signalTypes.map((t) => [t.id, t]));
  const fresh = account.signals.filter((s) => {
    const age = (now.getTime() - new Date(s.date).getTime()) / DAY;
    return age >= 0 && age <= ws.signalDecayDays && types.has(s.typeId);
  });
  // Count each signal type once, so three hiring posts don't triple the score.
  const seen = new Set<string>();
  let base = 0;
  let modifiers = 0;
  for (const s of fresh) {
    if (seen.has(s.typeId)) continue;
    seen.add(s.typeId);
    const t = types.get(s.typeId)!;
    if (t.modifier) modifiers += t.weight;
    else base += t.weight;
  }
  if (base === 0) return 0;
  return Math.min(100, base + modifiers);
}

export function tierFor(fit: number, signal: number, th: Workspace["thresholds"]): Tier {
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

export function scoreAccount(a: Account, ws: Workspace, now = new Date()): ScoredAccount {
  const f = fitScore(a.fit);
  const s = signalScore(a, ws, now);
  const tier = tierFor(f, s, ws.thresholds);
  // MQL gate: Tier A, at least two buying-committee members, and a play assigned.
  const mqlBlockers: string[] = [];
  if (tier !== "A") mqlBlockers.push("Not Tier A");
  if (a.committee.length < 2) mqlBlockers.push("Fewer than 2 committee members");
  if (!a.brief?.playId) mqlBlockers.push("No play assigned");
  return { ...a, fitScore: f, signalScore: s, value: valueBand(a.estimatedSeats), tier, mqlReady: mqlBlockers.length === 0, mqlBlockers };
}

const TIER_ORDER: Record<Tier, number> = { A: 0, B: 1, C: 2, Park: 3 };
const VALUE_ORDER: Record<ValueBand, number> = { high: 0, medium: 1, low: 2 };

/** Priority order for the work queue: tier, then value, then signal, then fit. */
export function prioritize(list: ScoredAccount[]): ScoredAccount[] {
  return [...list].sort(
    (a, b) =>
      TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
      VALUE_ORDER[a.value] - VALUE_ORDER[b.value] ||
      b.signalScore - a.signalScore ||
      b.fitScore - a.fitScore,
  );
}

/** The operating metric: closed-won revenue per 100 MQLs. */
export function revenuePer100Mqls(accounts: Account[]): { mqls: number; won: number; revenue: number; per100: number | null } {
  const reachedMql = accounts.filter((a) => a.stage !== "universe");
  const won = accounts.filter((a) => a.stage === "won");
  const revenue = won.reduce((s, a) => s + (a.revenue || 0), 0);
  return { mqls: reachedMql.length, won: won.length, revenue, per100: reachedMql.length ? Math.round((revenue / reachedMql.length) * 100) : null };
}

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}
