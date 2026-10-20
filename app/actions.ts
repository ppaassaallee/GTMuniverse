"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateBrief, runBoard, runBot, towerCommentary } from "@/lib/ai";
import { ADVISORS } from "@/lib/advisors";
import { GROK_MODEL, grokConfigured, GrokError } from "@/lib/grok";
import { ACTION_LABEL, evaluate, usedToday } from "@/lib/guardrails";
import { routeAll, scoreAll } from "@/lib/routing";
import { normalizeDomain, revenuePer100Mqls } from "@/lib/scoring";
import { mutate, newId, readDb } from "@/lib/store";
import { computeTower } from "@/lib/tower";
import type { Account, Activity, CommitteeRole, Database, ProposedAction } from "@/lib/types";

export type ActionState = { error?: string; ok?: string } | null;

const errorMessage = (e: unknown) => (e instanceof GrokError ? e.message : `Something went wrong: ${(e as Error)?.message || "unknown error"}.`);
const refresh = () => revalidatePath("/", "layout");

function log(db: Database, actor: string, text: string, kind: Activity["kind"]) {
  db.activity.unshift({ id: newId("act"), at: new Date().toISOString(), actor, text, kind });
  db.activity = db.activity.slice(0, 300);
}

const STAGES: Account["stage"][] = ["new", "enriching", "queued", "engaged", "mql", "sql", "opportunity", "won", "lost"];
const ROLES: CommitteeRole[] = ["economic", "operational", "functional", "champion"];

/** Apply an action that has cleared the guardrails (or a human approved). Returns what happened. */
function applyAction(db: Database, action: ProposedAction, actor: string): string {
  const a = db.accounts.find((x) => x.id === action.accountId);
  const p = action.payload || {};
  const gtm = db.gtms.find((g) => g.id === a?.gtmId) || db.gtms[0];
  switch (action.type) {
    case "add_signal": {
      if (!a) return "No account given.";
      const typeId = String(p.typeId || "");
      if (!gtm.signalTypes.some((t) => t.id === typeId)) return `Unknown signal type “${typeId}”.`;
      a.signals.unshift({ typeId, detail: String(p.detail || action.summary).slice(0, 300), date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) ? String(p.date) : new Date().toISOString().slice(0, 10) });
      return `Added a signal to ${a.name}.`;
    }
    case "map_committee": {
      if (!a) return "No account given.";
      const role = ROLES.includes(p.role as CommitteeRole) ? (p.role as CommitteeRole) : "champion";
      a.committee.push({ role, title: String(p.title || "Unknown title").slice(0, 80) });
      return `Mapped a ${role} buyer at ${a.name}.`;
    }
    case "write_brief": {
      if (!a) return "No account given.";
      a.brief = {
        generatedAt: new Date().toISOString(), model: GROK_MODEL,
        whyFit: String(p.whyFit || ""), whyNow: String(p.whyNow || ""), committee: String(p.committee || ""), hypothesis: String(p.hypothesis || ""),
        playId: gtm.plays.some((x) => x.id === p.playId) ? String(p.playId) : null, nextAction: String(p.nextAction || ""), email: { subject: "", body: "" },
      };
      return `Wrote a brief for ${a.name}.`;
    }
    case "update_record": {
      if (!a) return "No account given.";
      if (p.field === "stage" && STAGES.includes(p.value as Account["stage"])) a.stage = p.value as Account["stage"];
      else if (p.field === "estimatedSeats" && Number(p.value) > 0) a.estimatedSeats = Number(p.value);
      else return `Field “${String(p.field)}” can't be changed by a bot.`;
      return `Updated ${String(p.field)} on ${a.name}.`;
    }
    case "assign_pod":
    case "route_account": {
      if (!a) return "No account given.";
      const pod = db.pods.find((x) => x.id === p.podId);
      if (!pod) return "Unknown pod.";
      a.routing = { dest: "SDR", ruleId: null, reason: `Assigned by ${actor}`, podId: pod.id, owner: pod.members[0], agent: null, thaw: null, at: new Date().toISOString() };
      return `Assigned ${a.name} to ${pod.name}.`;
    }
    case "freeze_account": {
      if (!a) return "No account given.";
      a.routing = { dest: "Freezer", ruleId: null, reason: `Frozen by ${actor}`, podId: null, owner: null, agent: null, thaw: String(p.thaw || "manual review"), at: new Date().toISOString() };
      return `Moved ${a.name} to the freezer.`;
    }
    case "draft_email":
    case "send_email":
    case "linkedin_send":
      return `Approved for a person to send${a ? ` to ${a.name}` : ""}. Nothing is sent automatically.`;
    default:
      return `${ACTION_LABEL[action.type] || action.type}: noted.`;
  }
}

/** Run every proposed action through the guardrails. Allowed ones apply; others queue or block. */
function processActions(db: Database, botId: string, actions: ProposedAction[]) {
  const bot = db.bots.find((b) => b.id === botId)!;
  const counts = { done: 0, queued: 0, blocked: 0 };
  for (const action of actions) {
    const account = db.accounts.find((x) => x.id === action.accountId) || null;
    const verdict = evaluate(action, { bot, bots: db.bots, connections: db.connections, account, usedToday: usedToday(db.activity, bot.name) });
    if (verdict.decision === "block") {
      counts.blocked++;
      log(db, bot.name, `Blocked: ${action.summary} (${verdict.reasons.join(" ")})`, "blocked");
    } else if (verdict.decision === "approval") {
      counts.queued++;
      db.approvals.unshift({ id: newId("apr"), createdAt: new Date().toISOString(), botId, action, reasons: verdict.reasons, approver: verdict.approver!, status: "pending" });
      log(db, bot.name, `Waiting for ${verdict.approver}: ${action.summary}`, "queued");
    } else {
      counts.done++;
      log(db, bot.name, applyAction(db, action, bot.name), "done");
    }
  }
  return counts;
}

/* ---------- Squads ---------- */

export async function runBotTask(_: ActionState, form: FormData): Promise<ActionState> {
  const botId = String(form.get("botId"));
  const task = String(form.get("task") || "").trim().slice(0, 1500);
  const ids = form.getAll("accountId").map(String).slice(0, 8);
  if (!task) return { error: "Tell the bot what to do." };
  const db = await readDb();
  const bot = db.bots.find((b) => b.id === botId);
  if (!bot) return { error: "Bot not found." };
  const squad = db.squads.find((s) => s.id === bot.squadId)!;
  const gtm = db.gtms.find((g) => g.id === squad.gtmId) || db.gtms[0];
  const scored = scoreAll(db.accounts, db.gtms).filter((a) => ids.includes(a.id));
  try {
    const result = await runBot(bot, squad, db.bots, db.guardrails, gtm, task, scored);
    const counts = await mutate((d) => {
      log(d, bot.name, result.summary || "Finished the task.", "info");
      return processActions(d, bot.id, result.actions);
    });
    refresh();
    return { ok: `${bot.name}: ${counts.done} done, ${counts.queued} waiting for approval, ${counts.blocked} blocked by guardrails.` };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function decideApproval(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("approvalId"));
  const approve = form.get("decision") === "approve";
  const msg = await mutate((db) => {
    const ap = db.approvals.find((x) => x.id === id);
    if (!ap || ap.status !== "pending") return "Already decided.";
    ap.status = approve ? "approved" : "rejected";
    ap.decidedAt = new Date().toISOString();
    if (!approve) { log(db, ap.approver, `Rejected: ${ap.action.summary}`, "human"); return "Rejected."; }
    const bot = db.bots.find((b) => b.id === ap.botId);
    const out = applyAction(db, ap.action, bot?.name || "bot");
    log(db, ap.approver, `Approved: ${out}`, "human");
    return out;
  });
  refresh();
  return { ok: msg };
}

/* ---------- Universe ---------- */

export async function addAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const name = String(form.get("name") || "").trim();
  const domain = normalizeDomain(String(form.get("domain") || ""));
  if (!name || !domain) return { error: "Add a company name and a domain." };
  const fit = Math.max(0, Math.min(1, (Number(form.get("fit")) || 50) / 100));
  const res = await mutate((db) => {
    if (db.accounts.some((a) => a.domain === domain)) return { error: `${domain} is already in the universe.` };
    const a: Account = {
      id: newId("acc"), gtmId: String(form.get("gtmId") || db.gtms[0].id), domain, name,
      verticalId: String(form.get("vertical") || "") || null, employees: Number(form.get("employees")) || null, state: String(form.get("state") || "").toUpperCase().slice(0, 2),
      sources: [String(form.get("source") || "AP") as Account["sources"][number]],
      fit: { vertical: fit, sizeAndRoleMix: fit, geography: fit, operationsIntensity: fit, historicalPerformance: fit },
      signals: [], committee: [], estimatedSeats: Number(form.get("seats")) || null, brief: null, stage: "new", revenue: null,
      customer: false, dnc: false, rejectDays: null, routing: null, createdAt: new Date().toISOString(),
    };
    db.accounts.push(a);
    const r = routeAll([a], db.gtms, db.rules, db.pods).get(a.id);
    a.routing = r ? { ...r, podId: null, owner: r.agent } : null;
    log(db, "You", `Added ${name} (${domain}).`, "human");
    return { id: a.id };
  });
  if ("error" in res) return { error: res.error };
  refresh();
  redirect(`/accounts/${res.id}`);
}

export async function addSignal(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const detail = String(form.get("detail") || "").trim();
  if (!detail) return { error: "Describe what happened." };
  await mutate((db) => {
    const a = db.accounts.find((x) => x.id === id);
    a?.signals.unshift({ typeId: String(form.get("typeId")), detail, date: String(form.get("date") || new Date().toISOString().slice(0, 10)) });
  });
  refresh();
  return { ok: "Signal added. Re-run routing to move the account if its tier changed." };
}

export async function addCommitteeMember(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const title = String(form.get("title") || "").trim();
  if (!title) return { error: "Add a job title." };
  await mutate((db) => {
    db.accounts.find((a) => a.id === id)?.committee.push({ role: String(form.get("role")) as CommitteeRole, title });
  });
  refresh();
  return { ok: "Added to the committee." };
}

export async function setStage(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const stage = String(form.get("stage")) as Account["stage"];
  if (!STAGES.includes(stage)) return { error: "Unknown stage." };
  await mutate((db) => {
    const a = db.accounts.find((x) => x.id === id);
    if (!a) return;
    a.stage = stage;
    if (stage === "won") a.revenue = Number(form.get("revenue")) || a.revenue;
    log(db, "You", `Moved ${a.name} to ${stage}.`, "human");
  });
  refresh();
  return { ok: "Stage updated." };
}

export async function briefAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const db = await readDb();
  const a = scoreAll(db.accounts, db.gtms).find((x) => x.id === id);
  if (!a) return { error: "Account not found." };
  const gtm = db.gtms.find((g) => g.id === a.gtmId) || db.gtms[0];
  try {
    const brief = await generateBrief(a, gtm);
    await mutate((d) => {
      const t = d.accounts.find((x) => x.id === id);
      if (t) t.brief = brief;
      log(d, "Researcher", `Wrote a brief for ${a.name}.`, "done");
      if (brief.email.body) {
        const bot = d.bots.find((b) => b.id === "b_writer");
        if (bot) processActions(d, bot.id, [{ type: "draft_email", accountId: id, summary: `First touch to ${a.name}: “${brief.email.subject}”`, payload: brief.email }]);
      }
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  refresh();
  return { ok: "Brief ready. The draft email is waiting in Approvals." };
}

export async function assignToPod(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("accountId"));
  const podId = String(form.get("podId"));
  await mutate((db) => {
    const a = db.accounts.find((x) => x.id === id);
    const pod = db.pods.find((p) => p.id === podId);
    if (!a) return;
    if (!pod) { a.routing = null; return; }
    const owner = String(form.get("owner") || "") || pod.members[0];
    a.routing = { dest: "SDR", ruleId: null, reason: "Assigned by a person", podId: pod.id, owner, agent: null, thaw: null, at: new Date().toISOString() };
    log(db, "You", `Assigned ${a.name} to ${pod.name} (${owner}).`, "human");
  });
  refresh();
  return { ok: "Assigned." };
}

export async function applyRouting(): Promise<ActionState> {
  const n = await mutate((db) => {
    const next = routeAll(db.accounts, db.gtms, db.rules, db.pods);
    let changed = 0;
    for (const a of db.accounts) {
      const r = next.get(a.id)!;
      if (a.routing?.dest !== r.dest || a.routing?.podId !== r.podId) changed++;
      a.routing = r;
    }
    log(db, "Dex", `Re-ran ${db.rules.filter((r) => r.on).length} routing rules on ${db.accounts.length} accounts; ${changed} moved.`, "done");
    return changed;
  });
  refresh();
  return { ok: `Rules applied. ${n} accounts moved.` };
}

export async function toggleRule(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("ruleId"));
  await mutate((db) => {
    const r = db.rules.find((x) => x.id === id);
    if (r) r.on = !r.on;
  });
  revalidatePath("/universe/rules");
  return { ok: "Rule toggled. The dry run shows the effect; apply to make it real." };
}

/* ---------- GTMs ---------- */

export async function saveGtmRules(_: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("gtmId"));
  await mutate((db) => {
    const g = db.gtms.find((x) => x.id === id);
    if (!g) return;
    g.signalDecayDays = Math.max(1, Number(form.get("signalDecayDays")) || g.signalDecayDays);
    g.thresholds = { fit: Number(form.get("thFit")) || g.thresholds.fit, signal: Number(form.get("thSignal")) || g.thresholds.signal };
    for (const t of g.signalTypes) {
      const w = Number(form.get(`w_${t.id}`));
      if (Number.isFinite(w)) t.weight = Math.max(0, Math.min(100, w));
    }
    log(db, "You", `Updated scoring rules for ${g.name}.`, "human");
  });
  refresh();
  return { ok: "Saved. Scores update everywhere; re-run routing to move accounts." };
}

/* ---------- Control Tower ---------- */

export async function refreshTower(): Promise<ActionState> {
  const db = await readDb();
  const lens = db.bots.find((b) => b.allowedActions.includes("refresh_tower"));
  if (!lens) return { error: "No bot is allowed to refresh the Control Tower." };
  const verdict = evaluate({ type: "refresh_tower", summary: "Refresh the Control Tower" }, { bot: lens, bots: db.bots, connections: db.connections, usedToday: usedToday(db.activity, lens.name) });
  if (verdict.decision === "block") return { error: verdict.reasons.join(" ") };
  const snap = computeTower(db, lens.name, null, []);
  let note = "";
  if (grokConfigured()) {
    try {
      snap.commentary = await towerCommentary(snap, db.gtms[0]);
      snap.model = GROK_MODEL;
    } catch (e) {
      note = ` Numbers refreshed; commentary failed: ${errorMessage(e)}`;
    }
  } else note = " Numbers refreshed. Connect Grok for commentary.";
  await mutate((d) => {
    d.tower = snap;
    log(d, lens.name, "Refreshed the Control Tower.", "done");
  });
  refresh();
  return { ok: `Refreshed by ${lens.name}.${note}` };
}

/* ---------- Expert board ---------- */

export async function conveneBoard(_: ActionState, form: FormData): Promise<ActionState> {
  const question = String(form.get("question") || "").trim().slice(0, 2000);
  const advisorIds = form.getAll("advisor").map(String).filter((id) => ADVISORS.some((a) => a.id === id));
  if (!question) return { error: "Describe your challenge first." };
  if (!advisorIds.length) return { error: "Pick at least one advisor." };
  const db = await readDb();
  const scored = scoreAll(db.accounts, db.gtms);
  const m = revenuePer100Mqls(scored);
  const tiers = (["A", "B", "C", "Park"] as const).map((t) => `${scored.filter((a) => a.tier === t).length} Tier ${t}`).join(", ");
  const summary = `${scored.length} accounts (${tiers}); ${m.mqls} reached MQL, ${m.won} won, revenue per 100 MQLs ${m.per100 ?? "n/a"}.`;
  let id: string;
  try {
    const r = await runBoard(question, advisorIds, db.gtms[0], summary);
    id = await mutate((d) => {
      const sid = newId("sess");
      d.sessions.unshift({ id: sid, createdAt: new Date().toISOString(), model: GROK_MODEL, question, advisorIds, ...r });
      return sid;
    });
  } catch (e) {
    return { error: errorMessage(e) };
  }
  revalidatePath("/board");
  redirect(`/board?s=${id}`);
}
