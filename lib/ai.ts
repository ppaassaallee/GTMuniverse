import "server-only";
import { ADVISORS } from "./advisors";
import { GROK_MODEL, grokJSON } from "./grok";
import type { AccountBrief, AdvisorTake, ScoredAccount, Workspace } from "./types";

function workspaceContext(ws: Workspace): string {
  return [
    `Company: ${ws.company}`,
    `What they sell: ${ws.product}`,
    `Ideal customer: ${ws.icpSummary}`,
    `Stage: ${ws.stage}. Motion: ${ws.motion}.`,
    `Goal: ${ws.goal}`,
  ].join("\n");
}

const str = (v: unknown, max = 600) => String(v ?? "").slice(0, max);

export async function generateBrief(a: ScoredAccount, ws: Workspace): Promise<AccountBrief> {
  const vertical = ws.verticals.find((v) => v.id === a.verticalId);
  const types = new Map(ws.signalTypes.map((t) => [t.id, t.name]));
  const system =
    "You are the AI research layer of a B2B GTM engineering system. You prepare account briefs that an SDR can act on in two minutes. " +
    "Use only the facts provided; when something is unknown, say what to verify instead of inventing it. Reply with a single JSON object.";
  const user = `${workspaceContext(ws)}

Account: ${a.name} (${a.domain})
Vertical: ${vertical ? `${vertical.name}. Fit profile: ${vertical.fitProfile}. Entry personas: ${vertical.personas}. Timing: ${vertical.timing}` : "unclassified"}
Employees: ${a.employees ?? "unknown"}. Geography: ${a.geography || "unknown"}. Estimated seats: ${a.estimatedSeats ?? "unknown"}.
Scores: fit ${a.fitScore}/100, signal ${a.signalScore}/100, tier ${a.tier}, value ${a.value}.
Signals: ${a.signals.map((s) => `${types.get(s.typeId) || s.typeId} on ${s.date}: ${s.detail}`).join("; ") || "none"}
Known buying committee: ${a.committee.map((c) => `${c.role}: ${c.title}`).join("; ") || "none mapped"}
Notes: ${a.notes || "none"}

Available plays (pick the best one by id, or null if none fits):
${ws.plays.map((p) => `- ${p.id} ${p.name}. Trigger: ${p.trigger}. Hypothesis: ${p.hypothesis}`).join("\n")}

Return JSON with exactly these keys:
{"whyFit": "2 sentences", "whyNow": "2 sentences tied to the dated signals", "committee": "who to reach for each committee role and which roles are missing", "hypothesis": "the commercial hypothesis in 1-2 sentences", "playId": "01" | null, "nextAction": "the single next step for the SDR", "email": {"subject": "under 8 words", "body": "under 120 words, plain, one ask, placeholder [First name]"}}`;
  const out = await grokJSON<Record<string, unknown>>(system, user);
  const email = (out.email || {}) as Record<string, unknown>;
  const playId = ws.plays.some((p) => p.id === out.playId) ? String(out.playId) : null;
  return {
    generatedAt: new Date().toISOString(),
    model: GROK_MODEL,
    whyFit: str(out.whyFit),
    whyNow: str(out.whyNow),
    committee: str(out.committee),
    hypothesis: str(out.hypothesis),
    playId,
    nextAction: str(out.nextAction, 300),
    email: { subject: str(email.subject, 120), body: str(email.body, 1500) },
  };
}

export interface BoardResult {
  synthesis: string;
  week: string[];
  takes: Record<string, AdvisorTake>;
}

export async function runBoard(question: string, advisorIds: string[], ws: Workspace, pipelineSummary: string): Promise<BoardResult> {
  const seats = ADVISORS.filter((a) => advisorIds.includes(a.id));
  const system =
    "You moderate a go-to-market advisory board. Each advisor answers in the spirit of their publicly known frameworks. " +
    "Never invent quotes or claim the real person said anything; give the advice their frameworks imply, specific to this company and its data. Reply with a single JSON object.";
  const user = `${workspaceContext(ws)}

Pipeline right now: ${pipelineSummary}

Challenge: ${question}

Advisors:
${seats.map((a) => `- id "${a.id}": ${a.name} (${a.lens}). Known for ${a.frameworks}.`).join("\n")}

Return JSON:
{"synthesis": "3-4 sentences resolving disagreements into one recommendation", "week": ["5 concrete actions, one per day"], "takes": {"<advisor id>": {"headline": "one-sentence stance", "moves": ["3 specific moves"], "watch": "one pitfall"}}}
Include every advisor id listed. Keep each string under 220 characters.`;
  const out = await grokJSON<Record<string, unknown>>(system, user);
  const takesIn = (out.takes || {}) as Record<string, Record<string, unknown>>;
  const takes: Record<string, AdvisorTake> = {};
  for (const a of seats) {
    const t = takesIn[a.id];
    if (!t) continue;
    takes[a.id] = { headline: str(t.headline, 300), moves: (Array.isArray(t.moves) ? t.moves : []).slice(0, 4).map((m) => str(m, 300)), watch: str(t.watch, 300) };
  }
  return {
    synthesis: str(out.synthesis, 1200),
    week: (Array.isArray(out.week) ? out.week : []).slice(0, 7).map((w) => str(w, 300)),
    takes,
  };
}
