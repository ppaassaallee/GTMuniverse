import "server-only";
import { ADVISORS } from "./advisors";
import { GROK_MODEL, grokJSON } from "./grok";
import { ACTION_LABEL, chainOfCommand } from "./guardrails";
import { skillName } from "./skills";
import type { AccountBrief, ActionType, AdvisorTake, Bot, Gtm, Guardrail, ProposedAction, ScoredAccount, Squad, TowerSnapshot } from "./types";

const str = (v: unknown, max = 600) => String(v ?? "").slice(0, max);

function gtmContext(g: Gtm): string {
  return [
    `GTM: ${g.name}. Objective: ${g.objective}. North star: ${g.northStar}.`,
    `What we sell: ${g.product}`,
    `Ideal customer: ${g.icpSummary} Exclusions: ${g.exclusions}`,
    `Policies: ${g.policies.map((p) => `${p.name} (${p.severity})`).join("; ")}`,
  ].join("\n");
}

function accountFacts(a: ScoredAccount, g: Gtm): string {
  const v = g.verticals.find((x) => x.id === a.verticalId);
  const types = new Map(g.signalTypes.map((t) => [t.id, t.name]));
  return `id ${a.id}: ${a.name} (${a.domain}). Vertical: ${v ? `${v.name} (personas: ${v.personas}; timing: ${v.timing})` : "unclassified"}. ${a.employees ?? "?"} employees, ${a.state}. Est. seats ${a.estimatedSeats ?? "?"}.
Scores: fit ${a.fitScore}, signal ${a.signalScore}, tier ${a.tier}, value ${a.value}. Stage ${a.stage}. Routed to ${a.routing?.dest ?? "nowhere"} (${a.routing?.reason ?? ""}).
Signals: ${a.signals.map((s) => `${types.get(s.typeId) || s.typeId} on ${s.date}: ${s.detail}`).join("; ") || "none"}
Committee: ${a.committee.map((c) => `${c.role}: ${c.title}`).join("; ") || "none mapped"}${a.dnc ? "\nDO NOT CONTACT." : ""}${a.customer ? "\nExisting customer." : ""}`;
}

export async function generateBrief(a: ScoredAccount, g: Gtm): Promise<AccountBrief> {
  const system =
    "You are the research layer of a B2B GTM engineering system. You prepare account briefs an SDR can act on in two minutes. " +
    "Use only the facts provided; when something is unknown, say what to verify instead of inventing it. Reply with one JSON object.";
  const user = `${gtmContext(g)}

Account:
${accountFacts(a, g)}

Plays (pick the best by id, or null):
${g.plays.map((p) => `- ${p.id} ${p.name}. Trigger: ${p.trigger}. Hypothesis: ${p.hypothesis}`).join("\n")}

Return JSON: {"whyFit":"2 sentences","whyNow":"2 sentences tied to the dated signals","committee":"who to reach per committee role and which roles are missing","hypothesis":"1-2 sentences","playId":"01"|null,"nextAction":"single next step for the SDR","email":{"subject":"under 8 words","body":"under 120 words, plain, one ask, [First name] placeholder"}}`;
  const out = await grokJSON<Record<string, unknown>>(system, user);
  const email = (out.email || {}) as Record<string, unknown>;
  return {
    generatedAt: new Date().toISOString(),
    model: GROK_MODEL,
    whyFit: str(out.whyFit),
    whyNow: str(out.whyNow),
    committee: str(out.committee),
    hypothesis: str(out.hypothesis),
    playId: g.plays.some((p) => p.id === out.playId) ? String(out.playId) : null,
    nextAction: str(out.nextAction, 300),
    email: { subject: str(email.subject, 120), body: str(email.body, 1500) },
  };
}

export interface BotRunResult {
  summary: string;
  actions: ProposedAction[];
}

/** A Grokbot works one task. It proposes actions; the guardrail engine decides what happens to each. */
export async function runBot(bot: Bot, squad: Squad, bots: Bot[], guardrails: Guardrail[], g: Gtm, task: string, accounts: ScoredAccount[]): Promise<BotRunResult> {
  const chain = chainOfCommand(bot, bots).join(" → ");
  const system = `You are ${bot.name}, a Grokbot in the ${squad.name} of a B2B GTM platform. Role: ${bot.role}.
Skills: ${bot.skills.map(skillName).join(", ")}.
Chain of command: ${chain}. Escalate anything outside your role to the next in line.
You may ONLY propose these action types: ${bot.allowedActions.map((a) => `${a} (${ACTION_LABEL[a]})`).join(", ")}.
Guardrails that will be enforced on every action: ${guardrails.map((x) => x.name + ": " + x.description).join(" | ")}
Never invent facts. Keep evidence separate from assumptions. Prepare work; never claim something was sent or done.
Reply with one JSON object.`;
  const user = `${gtmContext(g)}

Task from your manager: ${task}

Accounts in scope:
${accounts.map((a) => accountFacts(a, g)).join("\n\n") || "none"}

Return JSON:
{"summary":"2-3 sentences on what you found and propose",
 "actions":[{"type":"<one of your allowed action types>","accountId":"<id or null>","summary":"one line a manager can approve","payload":{ /* for add_signal: {typeId, detail, date}; for map_committee: {role, title}; for draft_email: {subject, body}; for update_record: {field, value}; otherwise {} */ }}]}
Propose at most 6 actions.`;
  const out = await grokJSON<Record<string, unknown>>(system, user);
  const actions = (Array.isArray(out.actions) ? out.actions : []).slice(0, 6).map((x: Record<string, unknown>) => ({
    type: String(x.type) as ActionType,
    accountId: x.accountId ? String(x.accountId) : null,
    summary: str(x.summary, 300),
    payload: (x.payload && typeof x.payload === "object" ? x.payload : {}) as Record<string, unknown>,
  }));
  return { summary: str(out.summary, 800), actions };
}

export async function towerCommentary(snap: TowerSnapshot, g: Gtm): Promise<string[]> {
  const system = "You are Lens, the analytics lead of a B2B GTM team. You read the Control Tower numbers and write what a Head of GTM must know. Only use the numbers given. Reply with one JSON object.";
  const user = `${gtmContext(g)}\n\nControl Tower metrics (JSON):\n${JSON.stringify(snap.metrics)}\n\nReturn {"insights":["4 short findings, each with the number that supports it and one recommended action"]}`;
  const out = await grokJSON<{ insights?: unknown[] }>(system, user);
  return (out.insights || []).slice(0, 5).map((x) => str(x, 400));
}

export interface BoardResult {
  synthesis: string;
  week: string[];
  takes: Record<string, AdvisorTake>;
}

export async function runBoard(question: string, advisorIds: string[], g: Gtm, pipelineSummary: string): Promise<BoardResult> {
  const seats = ADVISORS.filter((a) => advisorIds.includes(a.id));
  const system =
    "You moderate a go-to-market advisory board. Each advisor answers in the spirit of their publicly known frameworks. " +
    "Never invent quotes or claim the real person said anything; give the advice their frameworks imply, specific to this company and its data. Reply with one JSON object.";
  const user = `${gtmContext(g)}

Pipeline right now: ${pipelineSummary}

Challenge: ${question}

Advisors:
${seats.map((a) => `- id "${a.id}": ${a.name} (${a.lens}). Known for ${a.frameworks}.`).join("\n")}

Return JSON: {"synthesis":"3-4 sentences resolving disagreements into one recommendation","week":["5 concrete actions, one per day"],"takes":{"<advisor id>":{"headline":"one-sentence stance","moves":["3 specific moves"],"watch":"one pitfall"}}}
Include every advisor id listed. Each string under 220 characters.`;
  const out = await grokJSON<Record<string, unknown>>(system, user);
  const takesIn = (out.takes || {}) as Record<string, Record<string, unknown>>;
  const takes: Record<string, AdvisorTake> = {};
  for (const a of seats) {
    const t = takesIn[a.id];
    if (t) takes[a.id] = { headline: str(t.headline, 300), moves: (Array.isArray(t.moves) ? t.moves : []).slice(0, 4).map((m) => str(m, 300)), watch: str(t.watch, 300) };
  }
  return { synthesis: str(out.synthesis, 1200), week: (Array.isArray(out.week) ? out.week : []).slice(0, 7).map((w) => str(w, 300)), takes };
}
