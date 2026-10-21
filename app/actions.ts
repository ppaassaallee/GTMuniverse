"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, adminCodeProblem, cookieOptions, deploymentInfo, hashCode, memberForCode, members, newCode, requireMember, sessionValue } from "@/lib/auth";
import { ACTION_LABEL, evaluate, usedToday } from "@/lib/guardrails";
import { routeAll } from "@/lib/routing";
import { normalizeDomain } from "@/lib/scoring";
import { SKILLS } from "@/lib/skills";
import { mutate, newId, readDb } from "@/lib/store";
import { computeTower } from "@/lib/tower";
import type { Account, ActionType, Activity, Autonomy, Bot, CommitteeRole, Database, KnowledgeDoc, Member, ProposedAction } from "@/lib/types";

// Horizon GTM is a management layer. People and GTMBots sign in and use the same screens.
// Every change goes through perform(): a person's change applies directly; a GTMBot's change
// passes the guardrails first and is blocked, queued for a person, or applied.

export type ActionState = { error?: string; ok?: string } | null;

class Invalid extends Error {}
const refresh = () => revalidatePath("/", "layout");

function log(db: Database, actor: string, text: string, kind: Activity["kind"]) {
  db.activity.unshift({ id: newId("act"), at: new Date().toISOString(), actor, text, kind });
  db.activity = db.activity.slice(0, 500);
}

const STAGES: Account["stage"][] = ["new", "enriching", "queued", "engaged", "mql", "sql", "opportunity", "won", "lost"];
const ROLES: CommitteeRole[] = ["economic", "operational", "functional", "champion"];
const SOURCES: Account["sources"][number][] = ["AP", "LI", "TS", "PE", "LK", "RX", "IN", "FC"];
const text = (v: unknown, max = 600) => String(v ?? "").trim().slice(0, max);

/** Make a change that has cleared the guardrails (or that a person made or approved). */
function applyAction(db: Database, action: ProposedAction, actor: string): string {
  const p = action.payload || {};
  if (action.type === "create_account") {
    const domain = normalizeDomain(text(p.domain, 200));
    const name = text(p.name, 120);
    if (!name || !domain) throw new Invalid("Add a company name and a domain.");
    if (db.accounts.some((a) => a.domain === domain)) throw new Invalid(`${domain} is already in the universe.`);
    const gtm = db.gtms.find((g) => g.id === p.gtmId) || db.gtms[0];
    const fit = Math.max(0, Math.min(1, (Number(p.fit) || 50) / 100));
    const a: Account = {
      id: newId("acc"), gtmId: gtm.id, domain, name,
      verticalId: gtm.verticals.some((v) => v.id === p.verticalId) ? String(p.verticalId) : null,
      employees: Number(p.employees) || null, state: text(p.state, 2).toUpperCase(),
      sources: [SOURCES.includes(p.source as never) ? (p.source as Account["sources"][number]) : "AP"],
      fit: { vertical: fit, sizeAndRoleMix: fit, geography: fit, operationsIntensity: fit, historicalPerformance: fit },
      signals: [], committee: [], estimatedSeats: Number(p.seats) || null, brief: null, stage: "new", revenue: null,
      customer: false, dnc: false, rejectDays: null, routing: null, createdAt: new Date().toISOString(),
    };
    db.accounts.push(a);
    const r = routeAll([a], db.gtms, db.rules, db.pods).get(a.id);
    a.routing = r ? { ...r, podId: null, owner: r.agent } : null;
    return `Added ${name} (${domain}) to the universe.`;
  }
  if (action.type === "route_account" && !action.accountId) {
    const next = routeAll(db.accounts, db.gtms, db.rules, db.pods);
    let changed = 0;
    for (const a of db.accounts) {
      const r = next.get(a.id)!;
      if (a.routing?.dest !== r.dest || a.routing?.podId !== r.podId) changed++;
      a.routing = r;
    }
    return `Re-ran ${db.rules.filter((r) => r.on).length} routing rules on ${db.accounts.length} accounts; ${changed} moved.`;
  }
  if (action.type === "refresh_tower") {
    const lines = (Array.isArray(p.commentary) ? p.commentary : []).map((x) => text(x, 400)).filter(Boolean).slice(0, 8);
    const prev = db.tower;
    db.tower = lines.length ? computeTower(db, actor, lines, actor) : { ...computeTower(db, actor, prev?.commentary || [], null), commentaryBy: prev?.commentaryBy || null, commentaryAt: prev?.commentaryAt || null };
    return lines.length ? `Refreshed the Control Tower and posted ${lines.length} findings.` : "Refreshed the Control Tower numbers.";
  }

  const a = db.accounts.find((x) => x.id === action.accountId);
  if (!a) throw new Invalid("Account not found.");
  const gtm = db.gtms.find((g) => g.id === a.gtmId) || db.gtms[0];
  switch (action.type) {
    case "add_signal": {
      const typeId = text(p.typeId, 60);
      if (!gtm.signalTypes.some((t) => t.id === typeId)) throw new Invalid(`Unknown signal type “${typeId}”.`);
      const detail = text(p.detail, 300);
      if (!detail) throw new Invalid("Describe what happened.");
      a.signals.unshift({ typeId, detail, date: /^\d{4}-\d{2}-\d{2}$/.test(String(p.date)) ? String(p.date) : new Date().toISOString().slice(0, 10) });
      return `Added a signal to ${a.name}: ${detail}`;
    }
    case "map_committee": {
      const title = text(p.title, 80);
      if (!title) throw new Invalid("Add a job title.");
      const role = ROLES.includes(p.role as CommitteeRole) ? (p.role as CommitteeRole) : "champion";
      a.committee.push({ role, title, name: text(p.name, 80) || undefined });
      return `Mapped a ${role} buyer (${title}) at ${a.name}.`;
    }
    case "write_brief": {
      a.brief = {
        generatedAt: new Date().toISOString(), model: actor,
        whyFit: text(p.whyFit), whyNow: text(p.whyNow), committee: text(p.committee), hypothesis: text(p.hypothesis),
        playId: gtm.plays.some((x) => x.id === p.playId) ? String(p.playId) : null, nextAction: text(p.nextAction, 300), email: a.brief?.email || { subject: "", body: "" },
      };
      return `Wrote the brief for ${a.name}.`;
    }
    case "update_record": {
      if (p.field === "stage") {
        if (!STAGES.includes(p.value as Account["stage"])) throw new Invalid("Unknown stage.");
        a.stage = p.value as Account["stage"];
        if (a.stage === "won" && Number(p.revenue) > 0) a.revenue = Number(p.revenue);
        return `Moved ${a.name} to ${a.stage}.`;
      }
      if (p.field === "estimatedSeats" && Number(p.value) > 0) { a.estimatedSeats = Number(p.value); return `Set ${a.name} to ~${a.estimatedSeats} seats.`; }
      throw new Invalid(`Field “${String(p.field)}” can't be changed here.`);
    }
    case "assign_pod":
    case "route_account": {
      const pod = db.pods.find((x) => x.id === p.podId);
      if (!pod) { a.routing = null; return `Took ${a.name} out of its pod.`; }
      const owner = text(p.owner, 80) || pod.members[0];
      a.routing = { dest: "SDR", ruleId: null, reason: `Assigned by ${actor}`, podId: pod.id, owner, agent: null, thaw: null, at: new Date().toISOString() };
      return `Assigned ${a.name} to ${pod.name} (${owner}).`;
    }
    case "freeze_account": {
      a.routing = { dest: "Freezer", ruleId: null, reason: `Frozen by ${actor}`, podId: null, owner: null, agent: null, thaw: text(p.thaw, 120) || "manual review", at: new Date().toISOString() };
      return `Moved ${a.name} to the freezer.`;
    }
    case "draft_email":
    case "send_email":
    case "linkedin_prepare":
    case "linkedin_send":
      return `Cleared for a person to send to ${a.name}: “${text(p.subject, 120) || action.summary}”. Horizon GTM never sends anything itself.`;
    default:
      return `${ACTION_LABEL[action.type] || action.type}: noted.`;
  }
}

/** The single door for every change. */
async function perform(action: ProposedAction): Promise<ActionState> {
  const me = await requireMember();
  try {
    const out = await mutate((db): ActionState => {
      if (me.kind === "human") {
        const msg = applyAction(db, action, me.name);
        log(db, me.name, msg, "human");
        return { ok: msg };
      }
      const bot = db.bots.find((b) => b.id === me.id);
      if (!bot) throw new Invalid("This GTMBot no longer exists.");
      const account = db.accounts.find((x) => x.id === action.accountId) || null;
      const verdict = evaluate(action, { bot, bots: db.bots, connections: db.connections, account, usedToday: usedToday(db.activity, bot.name) });
      if (verdict.decision === "block") {
        log(db, bot.name, `Blocked: ${action.summary}. ${verdict.reasons.join(" ")}`, "blocked");
        return { error: `Blocked by guardrails: ${verdict.reasons.join(" ")}` };
      }
      if (verdict.decision === "approval") {
        db.approvals.unshift({ id: newId("apr"), createdAt: new Date().toISOString(), botId: bot.id, action, reasons: verdict.reasons, approver: verdict.approver!, status: "pending" });
        log(db, bot.name, `Waiting for ${verdict.approver}: ${action.summary}`, "queued");
        return { ok: `Sent to ${verdict.approver} for approval. ${verdict.reasons.join(" ")}` };
      }
      const msg = applyAction(db, action, bot.name);
      log(db, bot.name, msg, "done");
      return { ok: msg };
    });
    refresh();
    return out;
  } catch (e) {
    if (e instanceof Invalid) return { error: e.message };
    throw e;
  }
}

/** Rules, squads, sign-ins and approvals belong to people (guardrail “People own the rules”). */
async function requireHuman(what: string): Promise<Member | ActionState> {
  const me = await requireMember();
  if (me.kind === "human") return me;
  await mutate((db) => log(db, me.name, `Blocked: tried to ${what}. Only people change this.`, "blocked"));
  refresh();
  return { error: `Blocked by guardrails: only people can ${what}.` };
}
const isMember = (x: Member | ActionState): x is Member => !!x && "kind" in x;

/* ---------- Sign-in ---------- */

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const code = text(form.get("code"), 200);
  if (!code) return { error: "Enter your access code." };
  const db = await readDb();
  const m = memberForCode(db, code);
  if (!m) {
    // Before anyone has a code, the admin code is the only way in: say exactly why it didn't match.
    if (!db.logins.length) {
      const problem = adminCodeProblem();
      if (problem) return { error: problem };
      const { adminCodeLength } = deploymentInfo();
      return { error: `That doesn't match BOLDR_ADMIN_CODE on this server. You typed ${code.length} characters, but the code set on the server is ${adminCodeLength} characters long. Check for a typo, or change the variable in your host and redeploy (any length from 8 characters works).` };
    }
    return { error: "That code isn't valid. Ask the Head of GTM for a new one." };
  }
  await mutate((d) => {
    const l = d.logins.find((x) => x.memberId === m.id);
    if (l) l.lastSignInAt = new Date().toISOString();
    log(d, m.name, m.kind === "bot" ? "Signed in (GTMBot)." : "Signed in.", "info");
  });
  (await cookies()).set(COOKIE, sessionValue(db, m.id), await cookieOptions());
  redirect("/");
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

export async function issueCode(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("issue sign-in codes");
  if (!isMember(me)) return me;
  const memberId = text(form.get("memberId"), 60);
  const code = newCode();
  const name = await mutate((db) => {
    const m = members(db).find((x) => x.id === memberId);
    if (!m) return null;
    db.logins = db.logins.filter((l) => l.memberId !== memberId);
    db.logins.push({ memberId, codeHash: hashCode(code), hint: code.slice(-4), issuedAt: new Date().toISOString(), issuedBy: me.name, lastSignInAt: null });
    log(db, me.name, `Issued a sign-in code for ${m.name}.`, "human");
    return m.name;
  });
  if (!name) return { error: "Member not found." };
  refresh();
  return { ok: `Code for ${name}: ${code}. Copy it now; it won't be shown again. Any older code for ${name} stopped working.` };
}

export async function revokeCode(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("revoke sign-in codes");
  if (!isMember(me)) return me;
  const memberId = text(form.get("memberId"), 60);
  await mutate((db) => {
    db.logins = db.logins.filter((l) => l.memberId !== memberId);
    log(db, me.name, `Revoked the sign-in for ${members(db).find((m) => m.id === memberId)?.name || memberId}.`, "human");
  });
  refresh();
  return { ok: "Revoked. Their sessions end on the next click." };
}

/* ---------- Squads (registry of your GTMBots) ---------- */

const ALL_ACTIONS = Object.keys(ACTION_LABEL) as ActionType[];

export async function saveBot(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("change squads");
  if (!isMember(me)) return me;
  const id = text(form.get("botId"), 60);
  const name = text(form.get("name"), 40);
  const squadId = text(form.get("squadId"), 60);
  if (!name) return { error: "Give the GTMBot a name." };
  const res = await mutate((db) => {
    if (!db.squads.some((s) => s.id === squadId)) return { error: "Unknown squad." };
    const reportsTo = text(form.get("reportsTo"), 80);
    const validBoss = reportsTo.startsWith("human:") ? db.org.humans.some((h) => `human:${h.role}` === reportsTo) : db.bots.some((b) => b.id === reportsTo && b.id !== id);
    if (!validBoss) return { error: "Pick who this GTMBot reports to." };
    if (db.bots.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.id !== id)) return { error: `There's already a GTMBot called ${name}.` };
    const autonomy = (["suggest", "approve", "act"].includes(String(form.get("autonomy"))) ? form.get("autonomy") : "suggest") as Autonomy;
    const bot: Bot = {
      id: id || newId("b"),
      name, squadId, reportsTo, autonomy,
      role: text(form.get("role"), 200),
      skills: form.getAll("skills").map(String).filter((s) => SKILLS.some((k) => k.id === s)),
      allowedActions: form.getAll("allowedActions").map(String).filter((a): a is ActionType => ALL_ACTIONS.includes(a as ActionType)),
      connections: form.getAll("connections").map(String).filter((c) => db.connections.some((x) => x.id === c)),
      dailyLimit: Math.max(1, Math.min(10_000, Number(form.get("dailyLimit")) || 50)),
      isLead: form.get("isLead") === "on",
    };
    const i = db.bots.findIndex((b) => b.id === id);
    if (i >= 0) {
      const old = db.bots[i];
      if (old.name !== bot.name) for (const a of db.activity) if (a.actor === old.name) a.actor = bot.name;
      db.bots[i] = bot;
    } else db.bots.push(bot);
    log(db, me.name, `${i >= 0 ? "Updated" : "Added"} GTMBot ${bot.name}.`, "human");
    return { ok: `${bot.name} saved.`, squadId, id: bot.id };
  });
  if ("error" in res) return { error: res.error };
  refresh();
  redirect(`/squads/${res.squadId}?bot=${res.id}`);
}

/* ---------- Approvals ---------- */

export async function decideApproval(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("decide approvals");
  if (!isMember(me)) return me;
  const id = text(form.get("approvalId"), 60);
  const approve = form.get("decision") === "approve";
  try {
    const msg = await mutate((db) => {
      const ap = db.approvals.find((x) => x.id === id);
      if (!ap || ap.status !== "pending") return "Already decided.";
      ap.decidedAt = new Date().toISOString();
      ap.decidedBy = me.name;
      if (!approve) { ap.status = "rejected"; log(db, me.name, `Rejected: ${ap.action.summary}`, "human"); return "Rejected."; }
      const bot = db.bots.find((b) => b.id === ap.botId);
      const out = applyAction(db, ap.action, bot?.name || "GTMBot");
      ap.status = "approved";
      log(db, me.name, `Approved ${bot?.name || "GTMBot"}: ${out}`, "human");
      return out;
    });
    refresh();
    return { ok: msg };
  } catch (e) {
    if (e instanceof Invalid) return { error: `Can't apply it: ${e.message}` };
    throw e;
  }
}

/* ---------- Universe ---------- */

export async function addAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const domain = normalizeDomain(text(form.get("domain"), 200));
  const res = await perform({
    type: "create_account", accountId: null, summary: `Add ${text(form.get("name"), 120)} (${domain}) to the universe`,
    payload: { name: form.get("name"), domain, gtmId: form.get("gtmId"), verticalId: form.get("vertical"), employees: form.get("employees"), state: form.get("state"), source: form.get("source"), seats: form.get("seats"), fit: form.get("fit") },
  });
  if (res?.error || !res?.ok?.startsWith("Added")) return res;
  const created = (await readDb()).accounts.find((a) => a.domain === domain);
  redirect(created ? `/accounts/${created.id}` : "/universe");
}

const accountName = async (id: string) => (await readDb()).accounts.find((a) => a.id === id)?.name || "an account";

export async function addSignal(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  return perform({ type: "add_signal", accountId, summary: `Add a signal to ${await accountName(accountId)}: ${text(form.get("detail"), 120)}`, payload: { typeId: form.get("typeId"), detail: form.get("detail"), date: form.get("date") } });
}

export async function addCommitteeMember(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  return perform({ type: "map_committee", accountId, summary: `Map ${text(form.get("title"), 80)} at ${await accountName(accountId)}`, payload: { role: form.get("role"), title: form.get("title"), name: form.get("name") } });
}

export async function setStage(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  return perform({ type: "update_record", accountId, summary: `Move ${await accountName(accountId)} to ${text(form.get("stage"), 20)}`, payload: { field: "stage", value: form.get("stage"), revenue: form.get("revenue") } });
}

export async function writeBrief(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  const payload = Object.fromEntries(["whyFit", "whyNow", "committee", "hypothesis", "playId", "nextAction"].map((k) => [k, form.get(k)]));
  return perform({ type: "write_brief", accountId, summary: `Brief for ${await accountName(accountId)}`, payload });
}

export async function draftEmail(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  const subject = text(form.get("subject"), 160), body = text(form.get("body"), 3000);
  if (!subject || !body) return { error: "Add a subject and a body." };
  return perform({ type: "draft_email", accountId, summary: `First touch to ${await accountName(accountId)}: “${subject}”`, payload: { subject, body } });
}

export async function assignToPod(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  const db = await readDb();
  const pod = db.pods.find((p) => p.id === form.get("podId"));
  return perform({ type: "assign_pod", accountId, summary: pod ? `Assign ${await accountName(accountId)} to ${pod.name}` : `Take ${await accountName(accountId)} out of its pod`, payload: { podId: form.get("podId"), owner: form.get("owner") } });
}

export async function freezeAccount(_: ActionState, form: FormData): Promise<ActionState> {
  const accountId = text(form.get("accountId"), 60);
  return perform({ type: "freeze_account", accountId, summary: `Freeze ${await accountName(accountId)}`, payload: { thaw: form.get("thaw") } });
}

export async function applyRouting(): Promise<ActionState> {
  return perform({ type: "route_account", accountId: null, summary: "Re-run the routing rules on the whole universe", payload: {} });
}

export async function toggleRule(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("change routing rules");
  if (!isMember(me)) return me;
  const id = text(form.get("ruleId"), 60);
  await mutate((db) => {
    const r = db.rules.find((x) => x.id === id);
    if (!r) return;
    r.on = !r.on;
    log(db, me.name, `Turned ${r.on ? "on" : "off"} rule “${r.name}”.`, "human");
  });
  refresh();
  return { ok: "Rule toggled. The dry run shows the effect; apply to make it real." };
}

/* ---------- GTMs ---------- */

export async function saveGtmRules(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("change GTM definitions");
  if (!isMember(me)) return me;
  const id = text(form.get("gtmId"), 60);
  await mutate((db) => {
    const g = db.gtms.find((x) => x.id === id);
    if (!g) return;
    g.signalDecayDays = Math.max(1, Number(form.get("signalDecayDays")) || g.signalDecayDays);
    g.thresholds = { fit: Number(form.get("thFit")) || g.thresholds.fit, signal: Number(form.get("thSignal")) || g.thresholds.signal };
    for (const t of g.signalTypes) {
      const w = Number(form.get(`w_${t.id}`));
      if (Number.isFinite(w)) t.weight = Math.max(0, Math.min(100, w));
    }
    log(db, me.name, `Updated scoring rules for ${g.name}.`, "human");
  });
  refresh();
  return { ok: "Saved. Scores update everywhere; re-run routing to move accounts." };
}

const KB_KINDS: KnowledgeDoc["kind"][] = ["Value proposition", "Objection", "Case study", "Competitor", "FAQ"];

export async function addKnowledge(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("change the knowledge base");
  if (!isMember(me)) return me;
  const title = text(form.get("title"), 160), body = text(form.get("body"), 4000);
  if (!title || !body) return { error: "Add a title and the content." };
  const kind = KB_KINDS.includes(form.get("kind") as never) ? (form.get("kind") as KnowledgeDoc["kind"]) : "FAQ";
  await mutate((db) => {
    const g = db.gtms.find((x) => x.id === form.get("gtmId"));
    if (!g) return;
    g.knowledge.unshift({ id: newId("kb"), kind, title, body, updatedBy: me.name, updatedAt: new Date().toISOString() });
    log(db, me.name, `Added “${title}” to the ${g.name} knowledge base.`, "human");
  });
  refresh();
  return { ok: "Added. Your GTMBots read it on their next sign-in." };
}

/* ---------- Control Tower ---------- */

export async function refreshTower(_: ActionState, form: FormData): Promise<ActionState> {
  const commentary = text(form.get("commentary"), 4000).split("\n").map((l) => l.replace(/^[-•*\d.)\s]+/, "").trim()).filter(Boolean);
  return perform({ type: "refresh_tower", accountId: null, summary: commentary.length ? `Refresh the Control Tower with ${commentary.length} findings` : "Refresh the Control Tower numbers", payload: { commentary } });
}

/* ---------- Connections ---------- */

export async function setConnectionStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireHuman("change connections");
  if (!isMember(me)) return me;
  const id = text(form.get("connectionId"), 60);
  const msg = await mutate((db) => {
    const c = db.connections.find((x) => x.id === id);
    if (!c) return "Connection not found.";
    c.status = c.status === "connected" ? "not_connected" : "connected";
    log(db, me.name, `${c.status === "connected" ? "Connected" : "Switched off"} ${c.name}.`, "human");
    return `${c.name} is ${c.status === "connected" ? "connected" : "switched off"}.`;
  });
  refresh();
  return { ok: msg };
}
