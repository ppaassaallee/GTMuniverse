import Link from "next/link";
import { notFound } from "next/navigation";
import { runBotTask } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ago, PageHead, TierPill } from "@/components/ui";
import { grokConfigured } from "@/lib/grok";
import { ACTION_LABEL, chainOfCommand, usedToday } from "@/lib/guardrails";
import { prioritize } from "@/lib/scoring";
import { scoreAll } from "@/lib/routing";
import { skillName } from "@/lib/skills";
import { readDb } from "@/lib/store";

const AUTONOMY = { act: "Acts within guardrails", approve: "Changes need sign-off", suggest: "Suggests only" };

export default async function SquadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bot?: string }> }) {
  const { id } = await params;
  const { bot: botParam } = await searchParams;
  const db = await readDb();
  const squad = db.squads.find((s) => s.id === id);
  if (!squad) notFound();
  const bots = db.bots.filter((b) => b.squadId === id);
  const bot = bots.find((b) => b.id === botParam) || bots.find((b) => !b.isLead) || bots[0];
  const gtm = db.gtms.find((g) => g.id === squad.gtmId)!;
  const conns = new Map(db.connections.map((c) => [c.id, c]));
  const candidates = prioritize(scoreAll(db.accounts, db.gtms).filter((a) => a.gtmId === gtm.id && !a.dnc && !a.customer)).slice(0, 12);
  const names = new Set(bots.map((b) => b.name));

  return (
    <>
      <p className="small" style={{ margin: 0 }}><Link href="/squads">← Squads</Link></p>
      <PageHead eyebrow={`Squad · works on ${gtm.name}`} title={squad.name} sub={squad.mission} />

      <div className="grid3">
        {bots.map((b) => (
          <Link key={b.id} href={`/squads/${id}?bot=${b.id}`} className="card" style={b.id === bot.id ? { borderColor: squad.color, boxShadow: `inset 0 0 0 1px ${squad.color}` } : undefined}>
            <div className="top"><h3>{b.name}{b.isLead ? " · lead" : ""}</h3><span className={`pill ${b.autonomy === "act" ? "ok" : b.autonomy === "approve" ? "warn" : "info"}`}>{b.autonomy}</span></div>
            <span className="small">{b.role}</span>
            <span className="chips">{b.skills.map((s) => <span key={s} className="src">{skillName(s)}</span>)}</span>
            <span className="muted small">{usedToday(db.activity, b.name)} / {b.dailyLimit} actions today</span>
          </Link>
        ))}
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-h"><h2>Give {bot.name} a task</h2><span className="muted small">Runs on Grok · {AUTONOMY[bot.autonomy]}</span></div>
          {!grokConfigured() ? <p className="notice">Grok isn't connected yet. Set XAI_API_KEY on the server and the bot can run.</p> : null}
          <ActionForm action={runBotTask} submitLabel={`Run ${bot.name}`} pendingLabel={`${bot.name} is working…`}>
            <input type="hidden" name="botId" value={bot.id} />
            <div>
              <label htmlFor="task">Task</label>
              <textarea id="task" name="task" required defaultValue={defaultTask(bot.id)} />
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Accounts in scope (top of the work queue)</legend>
              <div className="seats">
                {candidates.map((a, i) => (
                  <label key={a.id} className="seat"><input type="checkbox" name="accountId" value={a.id} defaultChecked={i < 3} /> <TierPill tier={a.tier} /> {a.name}</label>
                ))}
              </div>
            </fieldset>
          </ActionForm>
        </section>

        <section className="panel">
          <h2>{bot.name}'s guardrails</h2>
          <span className="label" style={{ margin: 0 }}>Chain of command</span>
          <span className="small">{chainOfCommand(bot, db.bots).join(" → ")}</span>
          <span className="label" style={{ margin: 0 }}>May do</span>
          <span className="chips">{bot.allowedActions.map((a) => <span key={a} className="pill ok">{ACTION_LABEL[a]}</span>)}</span>
          <span className="label" style={{ margin: 0 }}>Connections granted</span>
          <span className="chips">{bot.connections.length ? bot.connections.map((c) => <span key={c} className={`pill ${conns.get(c)?.status === "connected" ? "ok" : "no"}`}>{conns.get(c)?.name} · {conns.get(c)?.status === "connected" ? "connected" : "not connected"}</span>) : <span className="muted small">None. Works on Boldr data only.</span>}</span>
          <span className="label" style={{ margin: 0 }}>Daily limit</span>
          <span className="small">{bot.dailyLimit} actions</span>
        </section>
      </div>

      <section className="panel">
        <h2>Squad activity</h2>
        <ul className="list feed">
          {db.activity.filter((a) => names.has(a.actor)).slice(0, 15).map((a) => <li key={a.id}><span className={`kind kind-${a.kind}`}>{a.kind}</span><span><b>{a.actor}</b> {a.text} <span className="muted small">· {ago(a.at)}</span></span></li>)}
          {!db.activity.some((a) => names.has(a.actor)) ? <li className="muted">No runs yet.</li> : null}
        </ul>
      </section>
    </>
  );
}

function defaultTask(botId: string): string {
  const t: Record<string, string> = {
    b_scout: "Look at these accounts. For each one, propose any new dated signal the facts support, with the source. Skip accounts with nothing new.",
    b_research: "Write a sourced account brief for each account and map any buying-committee roles we're missing. List open questions and evidence against.",
    b_strategist: "For each account, decide: prepare, dig or skip. Pick the best play and say why.",
    b_writer: "Draft a first-touch email for each account from its play and signals. Plain, under 120 words, one ask.",
    b_pipeline: "Check each account's status and propose the next action and date.",
    b_dex: "Review routing for these accounts and propose pod assignments for any Tier A account with a mapped committee.",
    b_lens: "Summarise what changed in the pipeline this week.",
  };
  return t[botId] || "Work these accounts according to your role and propose the next actions.";
}
