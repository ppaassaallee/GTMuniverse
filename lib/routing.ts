import { scoreAccount } from "./scoring";
import type { Account, Condition, Destination, Gtm, List, Pod, RoutingRule, Routing, ScoredAccount } from "./types";

// Routing rules are plain data, evaluated top to bottom; the first match wins.
// Adapted from the Solvo Universe rule set: freeze customers and DNC, hold what is still
// enriching, send Tier A with a mapped committee to a human pod, let AI SDRs work the rest.

function fieldValue(a: ScoredAccount, c: Condition): unknown {
  switch (c.field) {
    case "tier": return a.tier;
    case "fit": return a.fitScore;
    case "signal": return a.signalScore;
    case "committee": return a.committee.length;
    case "freshDays": return a.freshestSignalDays;
    case "stage": return a.stage;
    case "source": return a.sources;
    case "vertical": return a.verticalId;
    case "state": return a.state;
    case "employees": return a.employees;
    case "dnc": return a.dnc;
    case "customer": return a.customer;
    case "rejectDays": return a.rejectDays;
    case "signalType": return a.signals.map((s) => s.typeId);
    case "value": return a.value;
  }
}

export function test(a: ScoredAccount, c: Condition): boolean {
  const v = fieldValue(a, c);
  switch (c.op) {
    case "is true": return v === true;
    case "is": return v === c.value;
    case "is not": return v !== c.value;
    case ">=": return typeof v === "number" && v >= Number(c.value);
    case "<=": return typeof v === "number" && v <= Number(c.value);
    case "in": return Array.isArray(c.value) && c.value.includes(String(v));
    case "includes": {
      const want = Array.isArray(c.value) ? c.value : [String(c.value)];
      return Array.isArray(v) && want.some((w) => (v as unknown[]).includes(w));
    }
  }
}

export function matches(a: ScoredAccount, conds: Condition[]): boolean {
  return conds.every((c) => test(a, c));
}

export function matchRule(a: ScoredAccount, r: RoutingRule): boolean {
  const all = r.when.length > 0 && matches(a, r.when);
  const any = !!r.any?.length && r.any.some((c) => test(a, c));
  return all || any;
}

export function route(a: ScoredAccount, rules: RoutingRule[]): Omit<Routing, "podId" | "owner" | "at"> {
  for (const r of rules) {
    if (!r.on || !matchRule(a, r)) continue;
    return { dest: r.then.dest, ruleId: r.id, reason: r.then.reason || r.name, agent: r.then.agent || null, thaw: r.then.thaw || null };
  }
  return { dest: "Hold", ruleId: null, reason: "No rule matched", agent: null, thaw: null };
}

/** Pick the pod with the best vertical affinity and the most room, as in the Solvo distribution logic. */
export function pickPod(a: Pick<Account, "verticalId">, pods: Pod[], load: Map<string, number>): Pod | null {
  let best: Pod | null = null;
  let bestScore = -Infinity;
  for (const p of pods.filter((x) => x.kind === "SDR")) {
    const l = load.get(p.id) || 0;
    const affinity = a.verticalId && p.focus.includes(a.verticalId) ? 1 : 0;
    const room = (p.capacity - l) / p.capacity;
    const score = affinity * 2 + room * 3 - (l >= p.capacity ? 5 : 0);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best;
}

export function scoreAll(accounts: Account[], gtms: Gtm[], now = new Date()): ScoredAccount[] {
  const byId = new Map(gtms.map((g) => [g.id, g]));
  return accounts.map((a) => scoreAccount(a, byId.get(a.gtmId) || gtms[0], now));
}

/** Route every account. Accounts a human already works (engaged or later) keep their owner. */
export function routeAll(accounts: Account[], gtms: Gtm[], rules: RoutingRule[], pods: Pod[], now = new Date()): Map<string, Routing> {
  const scored = scoreAll(accounts, gtms, now);
  const out = new Map<string, Routing>();
  const load = new Map<string, number>();
  const locked = (a: Account) => ["engaged", "mql", "sql", "opportunity", "won", "lost"].includes(a.stage) && a.routing?.podId;
  for (const a of scored) if (locked(a)) load.set(a.routing!.podId!, (load.get(a.routing!.podId!) || 0) + 1);
  // Highest-priority accounts get first pick of pod capacity.
  const order = [...scored].sort((x, y) => y.signalScore + y.fitScore - (x.signalScore + x.fitScore));
  for (const a of order) {
    if (locked(a)) { out.set(a.id, a.routing!); continue; }
    const r = route(a, rules);
    let podId: string | null = null;
    let owner: string | null = r.agent;
    if (r.dest === "SDR") {
      const pod = pickPod(a, pods, load);
      if (pod) {
        const n = load.get(pod.id) || 0;
        load.set(pod.id, n + 1);
        podId = pod.id;
        owner = pod.members[n % pod.members.length];
      }
    }
    out.set(a.id, { ...r, podId, owner, at: now.toISOString() });
  }
  return out;
}

/** What would change if these rules were applied: counts per destination before and after, and moves. */
export function dryRun(accounts: Account[], gtms: Gtm[], rules: RoutingRule[], pods: Pod[], now = new Date()) {
  const next = routeAll(accounts, gtms, rules, pods, now);
  const dests: Destination[] = ["SDR", "AI", "Hold", "Freezer"];
  const before = Object.fromEntries(dests.map((d) => [d, 0])) as Record<Destination, number>;
  const after = { ...before };
  const moves = new Map<string, number>();
  let unrouted = 0;
  for (const a of accounts) {
    const b = a.routing?.dest;
    const n = next.get(a.id)!.dest;
    if (b) before[b]++; else unrouted++;
    after[n]++;
    if (b !== n) moves.set(`${b || "Unrouted"} → ${n}`, (moves.get(`${b || "Unrouted"} → ${n}`) || 0) + 1);
  }
  return { before, after, unrouted, moves: [...moves.entries()].sort((x, y) => y[1] - x[1]), changed: [...moves.values()].reduce((s, n) => s + n, 0) };
}

export function listMembers(list: List, scored: ScoredAccount[]): ScoredAccount[] {
  if (list.type === "static") return scored.filter((a) => list.accountIds.includes(a.id));
  return scored.filter((a) => matches(a, list.conditions));
}

const FIELD_LABEL: Record<string, string> = {
  tier: "Tier", fit: "Fit", signal: "Signal", committee: "Committee members", freshDays: "Freshest signal (days)", stage: "Stage",
  source: "Source", vertical: "Vertical", state: "State", employees: "Employees", dnc: "Do not contact", customer: "Customer",
  rejectDays: "Days since BC reject", signalType: "Signal type", value: "Value",
};

export function describeCondition(c: Condition): string {
  const v = Array.isArray(c.value) ? c.value.join(", ") : c.value;
  return c.op === "is true" ? FIELD_LABEL[c.field] : `${FIELD_LABEL[c.field]} ${c.op} ${v}`;
}
