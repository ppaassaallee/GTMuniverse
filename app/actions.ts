"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateBrief, runBoard } from "@/lib/ai";
import { ADVISORS } from "@/lib/advisors";
import { GrokError } from "@/lib/grok";
import { normalizeDomain, prioritize, revenuePer100Mqls, scoreAccount } from "@/lib/scoring";
import { mutate, newId, readDb, resetDb } from "@/lib/store";
import type { Account, Factory } from "@/lib/types";

export type ActionState = { error?: string; ok?: string } | null;

const errorMessage = (e: unknown) => (e instanceof GrokError ? e.message : "Something went wrong. Try again.");

const num01 = (v: FormDataEntryValue | null, fallback = 0.5) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : fallback;
};

export async function addAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const name = String(form.get("name") || "").trim();
  const domain = normalizeDomain(String(form.get("domain") || ""));
  if (!name || !domain) return { error: "Add a company name and a domain." };
  const fit = num01(form.get("fit"), 0.5);
  const result = await mutate((db) => {
    // The universe is deduplicated by domain.
    if (db.accounts.some((a) => a.domain === domain)) return { error: `${domain} is already in your universe.` };
    const a: Account = {
      id: newId("acc"),
      domain,
      name,
      verticalId: String(form.get("vertical") || "") || null,
      employees: Number(form.get("employees")) || null,
      geography: String(form.get("geography") || ""),
      notes: String(form.get("notes") || ""),
      factory: (String(form.get("factory") || "core") as Factory),
      fit: { vertical: fit, sizeAndRoleMix: fit, geography: fit, operationsIntensity: fit, historicalPerformance: fit },
      signals: [],
      committee: [],
      estimatedSeats: Number(form.get("seats")) || null,
      brief: null,
      stage: "universe",
      revenue: null,
      createdAt: new Date().toISOString(),
    };
    db.accounts.push(a);
    return { id: a.id };
  });
  if ("error" in result) return { error: result.error };
  revalidatePath("/", "layout");
  redirect(`/accounts/${result.id}`);
}

export async function addSignal(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const typeId = String(form.get("typeId"));
  const detail = String(form.get("detail") || "").trim();
  const date = String(form.get("date") || new Date().toISOString().slice(0, 10));
  if (!detail) return { error: "Describe what happened." };
  await mutate((db) => {
    db.accounts.find((a) => a.id === id)?.signals.unshift({ typeId, detail, date });
  });
  revalidatePath("/", "layout");
  return { ok: "Signal added." };
}

export async function addCommitteeMember(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const title = String(form.get("title") || "").trim();
  if (!title) return { error: "Add a job title." };
  await mutate((db) => {
    db.accounts.find((a) => a.id === id)?.committee.push({ role: String(form.get("role")) as Account["committee"][number]["role"], title, name: String(form.get("person") || "") || undefined });
  });
  revalidatePath("/", "layout");
  return { ok: "Added to the committee." };
}

export async function updateFit(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  await mutate((db) => {
    const a = db.accounts.find((x) => x.id === id);
    if (!a) return;
    a.fit = {
      vertical: num01(form.get("vertical")),
      sizeAndRoleMix: num01(form.get("sizeAndRoleMix")),
      geography: num01(form.get("geography")),
      operationsIntensity: num01(form.get("operationsIntensity")),
      historicalPerformance: num01(form.get("historicalPerformance")),
    };
  });
  revalidatePath("/", "layout");
  return { ok: "Fit updated." };
}

export async function setStage(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const stage = String(form.get("stage")) as Account["stage"];
  const revenue = Number(form.get("revenue")) || null;
  await mutate((db) => {
    const a = db.accounts.find((x) => x.id === id);
    if (!a) return;
    a.stage = stage;
    if (stage === "won") a.revenue = revenue ?? a.revenue;
  });
  revalidatePath("/", "layout");
  return { ok: "Stage updated." };
}

export async function briefAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const db = await readDb();
  const a = db.accounts.find((x) => x.id === id);
  if (!a) return { error: "Account not found." };
  try {
    const brief = await generateBrief(scoreAccount(a, db.workspace), db.workspace);
    await mutate((d) => {
      const t = d.accounts.find((x) => x.id === id);
      if (t) t.brief = brief;
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/", "layout");
  return { ok: "Brief ready." };
}

export async function conveneBoard(_: ActionState, form: FormData): Promise<ActionState> {
  const question = String(form.get("question") || "").trim().slice(0, 2000);
  const advisorIds = form.getAll("advisor").map(String).filter((id) => ADVISORS.some((a) => a.id === id));
  if (!question) return { error: "Describe your challenge first." };
  if (!advisorIds.length) return { error: "Pick at least one advisor." };
  const db = await readDb();
  const scored = prioritize(db.accounts.map((a) => scoreAccount(a, db.workspace)));
  const m = revenuePer100Mqls(db.accounts);
  const tiers = ["A", "B", "C", "Park"].map((t) => `${scored.filter((a) => a.tier === t).length} Tier ${t}`).join(", ");
  const summary = `${scored.length} accounts in the universe (${tiers}); ${scored.filter((a) => a.mqlReady).length} pass the MQL gate; ${m.mqls} reached MQL, ${m.won} won, closed-won revenue per 100 MQLs ${m.per100 ?? "n/a"}.`;
  let id: string;
  try {
    const r = await runBoard(question, advisorIds, db.workspace, summary);
    id = await mutate((d) => {
      const sid = newId("sess");
      d.sessions.unshift({ id: sid, createdAt: new Date().toISOString(), model: process.env.XAI_MODEL || "grok-4", question, advisorIds, ...r });
      return sid;
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/board");
  redirect(`/board?s=${id}`);
}

export async function saveWorkspace(_: ActionState, form: FormData): Promise<ActionState> {
  await mutate((db) => {
    const ws = db.workspace;
    for (const k of ["company", "product", "icpSummary", "stage", "motion", "goal"] as const) ws[k] = String(form.get(k) ?? ws[k]);
    ws.signalDecayDays = Math.max(1, Number(form.get("signalDecayDays")) || ws.signalDecayDays);
    ws.thresholds = { fit: Number(form.get("thFit")) || ws.thresholds.fit, signal: Number(form.get("thSignal")) || ws.thresholds.signal };
    for (const t of ws.signalTypes) {
      const w = Number(form.get(`w_${t.id}`));
      if (Number.isFinite(w)) t.weight = Math.max(0, Math.min(100, w));
    }
  });
  revalidatePath("/", "layout");
  return { ok: "Workspace saved. Scores are recalculated everywhere." };
}

export async function resetDemo(): Promise<ActionState> {
  await resetDb();
  revalidatePath("/", "layout");
  return { ok: "Demo data restored." };
}
