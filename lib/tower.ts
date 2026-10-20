import { revenuePer100Mqls } from "./scoring";
import { scoreAll } from "./routing";
import type { Database, Destination, Source, Tier, TowerSnapshot } from "./types";

// The Control Tower's numbers are computed in code so they're exact and repeatable.
// The Analytics squad triggers a refresh and (when Grok is connected) adds commentary.

export const SOURCE_LABEL: Record<Source, string> = {
  AP: "Apollo core",
  LI: "LinkedIn accounts",
  TS: "Hiring signals",
  PE: "PE / VC portfolios",
  LK: "Closed-won lookalikes",
  RX: "Reactivation",
  IN: "Inbound & referrals",
  FC: "Web crawl",
};

export function computeTower(db: Pick<Database, "accounts" | "gtms" | "pods">, updatedBy: string, model: string | null, commentary: string[], now = new Date()): TowerSnapshot {
  const scored = scoreAll(db.accounts, db.gtms, now);
  const tiers: Record<Tier, number> = { A: 0, B: 0, C: 0, Park: 0 };
  const destinations: Record<Destination, number> = { SDR: 0, AI: 0, Hold: 0, Freezer: 0 };
  for (const a of scored) {
    tiers[a.tier]++;
    if (a.routing) destinations[a.routing.dest]++;
  }
  const order = ["queued", "engaged", "mql", "sql", "opportunity", "won"] as const;
  const atOrBeyond = (s: (typeof order)[number]) => {
    if (s === "mql") return scored.filter((a) => ["mql", "sql", "opportunity", "won", "lost"].includes(a.stage)).length;
    const i = order.indexOf(s);
    return scored.filter((a) => order.indexOf(a.stage as never) >= i).length;
  };
  const m = revenuePer100Mqls(scored);
  const load = (podId: string) => scored.filter((a) => a.routing?.podId === podId && !["won", "lost"].includes(a.stage)).length;
  const sources = (Object.keys(SOURCE_LABEL) as Source[]).map((source) => {
    const list = scored.filter((a) => a.sources.includes(source));
    return { source, accounts: list.length, tierA: list.filter((a) => a.tier === "A").length, won: list.filter((a) => a.stage === "won").length };
  });
  const playsById = new Map<string, { id: string; name: string; accounts: number; sqlRate: number | null }>();
  for (const g of db.gtms) for (const p of g.plays) if (!playsById.has(p.id)) playsById.set(p.id, { id: p.id, name: p.name, accounts: 0, sqlRate: p.sqlRate });
  for (const a of scored) if (a.brief?.playId && playsById.has(a.brief.playId)) playsById.get(a.brief.playId)!.accounts++;
  return {
    updatedAt: now.toISOString(),
    updatedBy,
    model,
    metrics: {
      universe: scored.length,
      tiers,
      destinations,
      funnel: [
        { stage: "Universe", count: scored.length },
        { stage: "Engaged", count: atOrBeyond("engaged") + scored.filter((a) => a.stage === "lost").length },
        { stage: "MQL", count: atOrBeyond("mql") },
        { stage: "SQL", count: atOrBeyond("sql") },
        { stage: "Opportunity", count: atOrBeyond("opportunity") },
        { stage: "Closed won", count: atOrBeyond("won") },
      ],
      mqls: m.mqls,
      won: m.won,
      revenue: m.revenue,
      revenuePer100Mqls: m.per100,
      mqlsPerWin: m.won ? Math.round((m.mqls / m.won) * 10) / 10 : null,
      pods: db.pods.map((p) => ({ id: p.id, name: p.name, load: load(p.id), capacity: p.capacity })),
      sources,
      plays: [...playsById.values()],
    },
    commentary,
  };
}
