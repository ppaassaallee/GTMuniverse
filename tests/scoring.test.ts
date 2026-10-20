import { describe, expect, it } from "vitest";
import { chainOfCommand, evaluate, humanApprover } from "@/lib/guardrails";
import { dryRun, routeAll, scoreAll } from "@/lib/routing";
import { fitScore, normalizeDomain, prioritize, revenuePer100Mqls, scoreAccount, signalScore, tierFor } from "@/lib/scoring";
import { seedDatabase } from "@/lib/seed/solvo";
import type { Account, Connection } from "@/lib/types";

const NOW = new Date("2026-10-20T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString().slice(0, 10);
const db = seedDatabase(NOW);
const gtm = db.gtms[0];
const bot = (id: string) => db.bots.find((b) => b.id === id)!;

const base: Account = {
  id: "a", gtmId: gtm.id, domain: "x.com", name: "X", verticalId: "legal", employees: 100, state: "TX", sources: ["AP"],
  fit: { vertical: 1, sizeAndRoleMix: 1, geography: 1, operationsIntensity: 1, historicalPerformance: 1 },
  signals: [], committee: [], estimatedSeats: null, brief: null, stage: "new", revenue: null,
  customer: false, dnc: false, rejectDays: null, routing: null, createdAt: NOW.toISOString(),
};

describe("fitScore", () => {
  it("weights add up to 100", () => expect(fitScore(base.fit)).toBe(100));
  it("clamps out-of-range inputs", () => expect(fitScore({ ...base.fit, vertical: 2, geography: -1 })).toBe(85));
});

describe("signalScore", () => {
  it("sums fresh signals and ignores expired ones", () => {
    const a = { signals: [{ typeId: "hiring_spike", detail: "", date: daysAgo(5) }, { typeId: "new_leader", detail: "", date: daysAgo(45) }] };
    expect(signalScore(a, gtm, NOW)).toBe(35);
  });
  it("counts each signal type once", () => {
    const a = { signals: [{ typeId: "role_hiring", detail: "", date: daysAgo(1) }, { typeId: "role_hiring", detail: "", date: daysAgo(2) }] };
    expect(signalScore(a, gtm, NOW)).toBe(20);
  });
  it("prior relationship only counts alongside another signal", () => {
    expect(signalScore({ signals: [{ typeId: "prior_relationship", detail: "", date: daysAgo(1) }] }, gtm, NOW)).toBe(0);
    expect(signalScore({ signals: [{ typeId: "prior_relationship", detail: "", date: daysAgo(1) }, { typeId: "expansion", detail: "", date: daysAgo(1) }] }, gtm, NOW)).toBe(30);
  });
  it("caps at 100", () => {
    const signals = gtm.signalTypes.map((t) => ({ typeId: t.id, detail: "", date: daysAgo(1) }));
    expect(signalScore({ signals }, gtm, NOW)).toBe(100);
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
    const s = scoreAccount(a, gtm, NOW);
    expect(s.tier).toBe("A");
    expect(s.mqlReady).toBe(false);
    expect(s.mqlBlockers).toEqual(["Fewer than 2 committee members", "No play assigned"]);
    const ready = scoreAccount({ ...a, committee: [{ role: "economic", title: "COO" }, { role: "operational", title: "VP Ops" }], brief: { playId: "01" } as Account["brief"] }, gtm, NOW);
    expect(ready.mqlReady).toBe(true);
  });
});

describe("pipeline metrics", () => {
  it("computes revenue per 100 MQLs", () => {
    const accts = [{ ...base, stage: "mql" as const }, { ...base, stage: "won" as const, revenue: 50_000 }, { ...base }];
    expect(revenuePer100Mqls(accts)).toEqual({ mqls: 2, won: 1, revenue: 50_000, per100: 2_500_000 });
  });
  it("prioritizes Tier A first", () => {
    const list = prioritize(scoreAll(db.accounts, db.gtms, NOW));
    expect(list[0].tier).toBe("A");
    expect(list.at(-1)!.tier).not.toBe("A");
  });
});

describe("routing", () => {
  it("freezes do-not-contact and customers", () => {
    const r = routeAll([{ ...base, dnc: true }, { ...base, id: "b", customer: true }], db.gtms, db.rules, db.pods, NOW);
    expect(r.get("a")!.dest).toBe("Freezer");
    expect(r.get("b")!.dest).toBe("Freezer");
  });
  it("keeps the owner of accounts a human already works", () => {
    const routing = { dest: "SDR" as const, ruleId: null, reason: "manual", podId: "pod1", owner: "Ana", agent: null, thaw: null, at: NOW.toISOString() };
    const r = routeAll([{ ...base, stage: "engaged", routing }], db.gtms, db.rules, db.pods, NOW);
    expect(r.get("a")!.owner).toBe("Ana");
  });
  it("seeded universe matches its own rules, and turning a rule off shows moves", () => {
    expect(dryRun(db.accounts, db.gtms, db.rules, db.pods, NOW).changed).toBe(0);
    const rules = db.rules.map((r, i) => (i === 0 ? { ...r, on: false } : r));
    const d = dryRun(db.accounts, db.gtms, rules, db.pods, NOW);
    expect(Object.values(d.after).reduce((s, n) => s + n, 0)).toBe(db.accounts.length);
  });
});

describe("guardrails", () => {
  const connected: Connection[] = db.connections.map((c) => ({ ...c, status: "connected" }));
  const ctx = { bots: db.bots, connections: connected, usedToday: 0 };
  it("walks the chain of command up to a human", () => {
    expect(chainOfCommand(bot("b_scout"), db.bots)).toEqual(["Scout", "Atlas", "Head of GTM Engineering"]);
    expect(humanApprover(bot("b_scout"), db.bots)).toBe("Head of GTM Engineering");
  });
  it("blocks actions outside the bot's permissions", () => {
    expect(evaluate({ type: "send_email", summary: "" }, { ...ctx, bot: bot("b_scout") }).decision).toBe("block");
  });
  it("sends every email draft to a human", () => {
    const v = evaluate({ type: "draft_email", summary: "" }, { ...ctx, bot: bot("b_writer") });
    expect(v.decision).toBe("approval");
    expect(v.approver).toBe("Head of GTM Engineering");
  });
  it("blocks outreach to do-not-contact accounts", () => {
    const v = evaluate({ type: "draft_email", summary: "" }, { ...ctx, bot: bot("b_writer"), account: { name: "X", dnc: true, customer: false } });
    expect(v.decision).toBe("block");
  });
  it("enforces the daily limit", () => {
    const b = bot("b_scout");
    expect(evaluate({ type: "add_signal", summary: "" }, { ...ctx, bot: b, usedToday: b.dailyLimit }).decision).toBe("block");
  });
  it("blocks connections the bot wasn't granted or that aren't connected", () => {
    expect(evaluate({ type: "read_records", connectionId: "c_onedrive", summary: "" }, { ...ctx, bot: bot("b_scout") }).decision).toBe("block");
    expect(evaluate({ type: "export_sheet", connectionId: "c_gsheets", summary: "" }, { ...ctx, connections: db.connections, bot: bot("b_lens") }).decision).toBe("block");
  });
  it("never lets a bot send on LinkedIn", () => {
    const b = { ...bot("b_writer"), allowedActions: [...bot("b_writer").allowedActions, "linkedin_send" as const], connections: ["c_linkedin"] };
    expect(evaluate({ type: "linkedin_send", connectionId: "c_linkedin", summary: "" }, { ...ctx, bot: b }).decision).toBe("block");
  });
  it("escalates routing by non-lead bots", () => {
    const v = evaluate({ type: "route_account", summary: "" }, { ...ctx, bot: bot("b_scorer") });
    expect(v.decision).toBe("approval");
    expect(v.approver).toBe("GTM Operator");
  });
  it("lets an act-mode bot add a signal on its own", () => {
    expect(evaluate({ type: "add_signal", summary: "" }, { ...ctx, bot: bot("b_scout") }).decision).toBe("allow");
  });
});

describe("seed", () => {
  it("has unique domains", () => expect(new Set(db.accounts.map((a) => a.domain)).size).toBe(db.accounts.length));
  it("routes every account", () => expect(db.accounts.every((a) => a.routing)).toBe(true));
});

it("normalizes domains", () => {
  expect(normalizeDomain("https://www.Example.com/about?x=1")).toBe("example.com");
});
