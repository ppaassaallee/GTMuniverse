import type { Account, ActionType, Activity, Bot, Connection, ProposedAction, Verdict } from "./types";

// Every change a signed-in GTMBot makes passes through this check before anything happens.
// The order matters: hard blocks first, then the conditions that need a human, then autonomy.

/** Actions that end in a message leaving the building. A person approves, whatever the bot's autonomy. */
export const EXTERNAL_ACTIONS: ActionType[] = ["draft_email", "send_email", "linkedin_send"];
/** Actions that change who works an account. They go up the chain of command. */
export const ROUTING_ACTIONS: ActionType[] = ["assign_pod", "freeze_account", "route_account"];
const OUTREACH_ACTIONS: ActionType[] = ["draft_email", "send_email", "linkedin_prepare", "linkedin_send"];

export const ACTION_LABEL: Record<ActionType, string> = {
  read_records: "Read records",
  update_record: "Update a record",
  add_signal: "Add a signal",
  map_committee: "Map the buying committee",
  write_brief: "Write an account brief",
  draft_email: "Draft an email",
  send_email: "Send an email",
  linkedin_prepare: "Prepare a LinkedIn touch",
  linkedin_send: "Send on LinkedIn",
  enrich: "Enrich from a data source",
  export_sheet: "Export to a sheet",
  route_account: "Route an account",
  assign_pod: "Assign to a pod",
  freeze_account: "Move to the freezer",
  refresh_tower: "Refresh the Control Tower",
  create_account: "Add an account to the universe",
};

export interface GuardrailContext {
  bot: Bot;
  bots: Bot[];
  connections: Connection[];
  account?: Pick<Account, "dnc" | "customer" | "name"> | null;
  /** How many actions this bot already ran today. */
  usedToday: number;
}

/** Walk up reportsTo until a human. Returns the chain of names, bot first. */
export function chainOfCommand(bot: Bot, bots: Bot[]): string[] {
  const chain: string[] = [bot.name];
  let cur: string = bot.reportsTo;
  const seen = new Set([bot.id]);
  while (cur) {
    if (cur.startsWith("human:")) { chain.push(cur.slice(6)); break; }
    const next = bots.find((b) => b.id === cur);
    if (!next || seen.has(next.id)) break;
    seen.add(next.id);
    chain.push(next.name);
    cur = next.reportsTo;
  }
  return chain;
}

/** The first human above the bot: who signs off its approvals. */
export function humanApprover(bot: Bot, bots: Bot[]): string {
  return chainOfCommand(bot, bots).at(-1) || "Head of GTM Engineering";
}

export function evaluate(action: ProposedAction, ctx: GuardrailContext): Verdict {
  const { bot, bots, connections, account } = ctx;
  const block = (r: string): Verdict => ({ decision: "block", reasons: [r], approver: null });

  if (!bot.allowedActions.includes(action.type)) return block(`${bot.name} isn't permitted to ${ACTION_LABEL[action.type].toLowerCase()}.`);
  if (ctx.usedToday >= bot.dailyLimit) return block(`${bot.name} reached its daily limit of ${bot.dailyLimit} actions.`);
  if (account && (account.dnc || account.customer) && OUTREACH_ACTIONS.includes(action.type))
    return block(`${account.name} is ${account.dnc ? "on the do-not-contact list" : "an existing customer"}. No outreach.`);

  if (action.connectionId) {
    const conn = connections.find((c) => c.id === action.connectionId);
    if (!conn) return block("Unknown connection.");
    if (!bot.connections.includes(conn.id)) return block(`${bot.name} hasn't been granted access to ${conn.name}.`);
    if (conn.status !== "connected") return block(`${conn.name} isn't connected yet.`);
    if (conn.access === "human-only" && action.type !== "linkedin_prepare" && action.type !== "read_records")
      return block(`${conn.name} is a human channel. Bots can only prepare work for it.`);
  }

  const reasons: string[] = [];
  if (EXTERNAL_ACTIONS.includes(action.type)) reasons.push("AI drafts, a human approves and sends.");
  if (ROUTING_ACTIONS.includes(action.type) && !bot.isLead) reasons.push("Changing who works an account goes to the squad's chain of command.");
  if (bot.autonomy === "suggest") reasons.push(`${bot.name} runs in suggest mode.`);
  if (bot.autonomy === "approve" && !["read_records", "add_signal", "refresh_tower"].includes(action.type)) reasons.push(`${bot.name} needs sign-off for changes.`);

  if (reasons.length) return { decision: "approval", reasons, approver: humanApprover(bot, bots) };
  return { decision: "allow", reasons: [], approver: null };
}

export function usedToday(activity: Activity[], botName: string, now = new Date()): number {
  const day = now.toISOString().slice(0, 10);
  return activity.filter((a) => a.actor === botName && a.at.startsWith(day) && a.kind !== "info").length;
}
