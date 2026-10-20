import { describe, expect, it } from "vitest";
import { fitScore, normalizeDomain, prioritize, revenuePer100Mqls, scoreAccount, signalScore, tierFor } from "@/lib/scoring";
import { seedDatabase, solvoWorkspace } from "@/lib/seed/solvo";
import type { Account } from "@/lib/types";

const NOW = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const base: Account = {
  id: "a", domain: "x.com", name: "X", verticalId: "legal", employees: 100, geography: "", notes: "", factory: "core",
  fit: { vertical: 1, sizeAndRoleMix: 1, geography: 1, operationsIntensity: 1, historicalPerformance: 1 },
  signals: [], committee: [], estimatedSeats: null, brief: null, stage: "universe", revenue: null, createdAt: NOW.toISOString(),
};

describe("fitScore", () => {
  it("weights add up to 100", () => expect(fitScore(base.fit)).toBe(100));
  it("clamps out-of-range inputs", () => expect(fitScore({ ...base.fit, vertical: 2, geography: -1 })).toBe(85));
});

describe("signalScore", () => {
  it("sums fresh signals and ignores expired ones", () => {
    const a = { signals: [{ typeId: "hiring_spike", detail: "", date: daysAgo(5) }, { typeId: "new_leader", detail: "", date: daysAgo(45) }] };
    expect(signalScore(a, solvoWorkspace, NOW)).toBe(35);
  });
  it("counts each signal type once", () => {
    const a = { signals: [{ typeId: "role_hiring", detail: "", date: daysAgo(1) }, { typeId: "role_hiring", detail: "", date: daysAgo(2) }] };
    expect(signalScore(a, solvoWorkspace, NOW)).toBe(20);
  });
  it("prior relationship only counts alongside another signal", () => {
    expect(signalScore({ signals: [{ typeId: "prior_relationship", detail: "", date: daysAgo(1) }] }, solvoWorkspace, NOW)).toBe(0);
    expect(signalScore({ signals: [{ typeId: "prior_relationship", detail: "", date: daysAgo(1) }, { typeId: "expansion", detail: "", date: daysAgo(1) }] }, solvoWorkspace, NOW)).toBe(30);
  });
  it("caps at 100", () => {
    const signals = solvoWorkspace.signalTypes.map((t) => ({ typeId: t.id, detail: "", date: daysAgo(1) }));
    expect(signalScore({ signals }, solvoWorkspace, NOW)).toBe(100);
  });
});

describe("tiers and MQL gate", () => {
  const th = { fit: 60, signal: 55 };
  it("maps the fit × signal matrix", () => {
    expect(tierFor(70, 60, th)).toBe("A");
    expect(tierFor(70, 10, th)).toBe("B");
    expect(tierFor(40, 60, th)).toBe("C");
    expect(tierFor(40, 10, th)).toBe("Park");
  });
  it("requires a committee of two and a play", () => {
    const a = { ...base, signals: [{ typeId: "hiring_spike", detail: "", date: daysAgo(1) }, { typeId: "new_leader", detail: "", date: daysAgo(1) }] };
    const s = scoreAccount(a, solvoWorkspace, NOW);
    expect(s.tier).toBe("A");
    expect(s.mqlReady).toBe(false);
    expect(s.mqlBlockers).toEqual(["Fewer than 2 committee members", "No play assigned"]);
    const ready = scoreAccount({ ...a, committee: [{ role: "economic", title: "COO" }, { role: "operational", title: "VP Ops" }], brief: { playId: "01" } as Account["brief"] }, solvoWorkspace, NOW);
    expect(ready.mqlReady).toBe(true);
  });
});

describe("pipeline metrics", () => {
  it("computes revenue per 100 MQLs", () => {
    const accts = [{ ...base, stage: "mql" as const }, { ...base, stage: "won" as const, revenue: 50_000 }, { ...base }];
    expect(revenuePer100Mqls(accts)).toEqual({ mqls: 2, won: 1, revenue: 50_000, per100: 2_500_000 });
  });
  it("prioritizes Tier A first", () => {
    const db = seedDatabase(NOW);
    const list = prioritize(db.accounts.map((a) => scoreAccount(a, db.workspace, NOW)));
    expect(list[0].tier).toBe("A");
    expect(list.at(-1)!.tier).not.toBe("A");
  });
});

describe("seed", () => {
  it("has unique domains", () => {
    const db = seedDatabase(NOW);
    expect(new Set(db.accounts.map((a) => a.domain)).size).toBe(db.accounts.length);
  });
});

it("normalizes domains", () => {
  expect(normalizeDomain("https://www.Example.com/about?x=1")).toBe("example.com");
});
