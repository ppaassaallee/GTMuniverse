import Link from "next/link";
import { notFound } from "next/navigation";
import { issueCode, revokeCode, saveBot } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ago, PageHead } from "@/components/ui";
import { ACTION_LABEL, chainOfCommand, usedToday } from "@/lib/guardrails";
import { SKILLS, skillName } from "@/lib/skills";
import { readDb } from "@/lib/store";
import type { ActionType, Bot } from "@/lib/types";

const AUTONOMY = { act: "Acts within guardrails", approve: "Changes need sign-off", suggest: "Suggests only; everything needs sign-off" };

export default async function SquadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ bot?: string }> }) {
  const { id } = await params;
  const { bot: botParam } = await searchParams;
  const db = await readDb();
  const squad = db.squads.find((s) => s.id === id);
  if (!squad) notFound();
  const bots = db.bots.filter((b) => b.squadId === id);
  const isNew = botParam === "new";
  const bot: Bot | undefined = isNew ? undefined : bots.find((b) => b.id === botParam) || bots.find((b) => !b.isLead) || bots[0];
  const gtm = db.gtms.find((g) => g.id === squad.gtmId)!;
  const conns = new Map(db.connections.map((c) => [c.id, c]));
  const names = new Set(bots.map((b) => b.name));
  const login = bot && db.logins.find((l) => l.memberId === bot.id);

  return (
    <>
      <p className="small" style={{ margin: 0 }}><Link href="/squads">← Squads</Link></p>
      <PageHead eyebrow={`Squad · works on ${gtm.name}`} title={squad.name} sub={squad.mission}>
        <Link className="btn ghost" href={`/squads/${id}?bot=new`}>Add a GTMBot</Link>
      </PageHead>

      <div className="grid3">
        {bots.map((b) => {
          const l = db.logins.find((x) => x.memberId === b.id);
          return (
            <Link key={b.id} href={`/squads/${id}?bot=${b.id}`} className="card" style={b.id === bot?.id ? { borderColor: squad.color, boxShadow: `inset 0 0 0 1px ${squad.color}` } : undefined}>
              <div className="top"><h3>{b.name}{b.isLead ? " · lead" : ""}</h3><span className={`pill ${b.autonomy === "act" ? "ok" : b.autonomy === "approve" ? "warn" : "info"}`}>{b.autonomy}</span></div>
              <span className="small">{b.role}</span>
              <span className="chips">{b.skills.map((s) => <span key={s} className="src">{skillName(s)}</span>)}</span>
              <span className="muted small">{l?.lastSignInAt ? `Signed in ${ago(l.lastSignInAt)}` : l ? "Code issued, not signed in yet" : "No sign-in yet"} · {usedToday(db.activity, b.name)}/{b.dailyLimit} today</span>
            </Link>
          );
        })}
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-h"><h2>{bot ? `Edit ${bot.name}` : "Add a GTMBot to this squad"}</h2>{bot ? <span className="muted small">{AUTONOMY[bot.autonomy]}</span> : null}</div>
          <p className="muted small" style={{ margin: 0 }}>This is the registry entry for one of your GTMBots. The bot itself runs outside Horizon GTM; here you decide what it may do when it signs in.</p>
          <ActionForm key={bot?.id || "new"} action={saveBot} submitLabel={bot ? "Save changes" : "Add GTMBot"} pendingLabel="Saving…">
            <input type="hidden" name="botId" value={bot?.id || ""} />
            <input type="hidden" name="squadId" value={id} />
            <div className="row">
              <div><label htmlFor="name">Name</label><input id="name" name="name" required defaultValue={bot?.name} /></div>
              <div>
                <label htmlFor="reportsTo">Reports to</label>
                <select id="reportsTo" name="reportsTo" defaultValue={bot?.reportsTo || bots.find((b) => b.isLead)?.id}>
                  {db.org.humans.map((h) => <option key={h.id} value={`human:${h.role}`}>{h.name} · {h.role}</option>)}
                  {db.bots.filter((b) => b.id !== bot?.id).map((b) => <option key={b.id} value={b.id}>{b.name} (GTMBot)</option>)}
                </select>
              </div>
            </div>
            <div><label htmlFor="role">Role</label><input id="role" name="role" defaultValue={bot?.role} placeholder="What this bot is for, in one line" /></div>
            <div className="row">
              <div><label htmlFor="autonomy">Autonomy</label><select id="autonomy" name="autonomy" defaultValue={bot?.autonomy || "suggest"}>{Object.entries(AUTONOMY).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select></div>
              <div><label htmlFor="dailyLimit">Daily action limit</label><input id="dailyLimit" name="dailyLimit" type="number" min="1" defaultValue={bot?.dailyLimit ?? 50} /></div>
            </div>
            <label className="checks"><input type="checkbox" name="isLead" defaultChecked={bot?.isLead} /> Squad lead (may route accounts without escalating)</label>
            <fieldset><legend className="label">May do</legend><div className="checks">{(Object.keys(ACTION_LABEL) as ActionType[]).map((a) => <label key={a}><input type="checkbox" name="allowedActions" value={a} defaultChecked={bot?.allowedActions.includes(a)} />{ACTION_LABEL[a]}</label>)}</div></fieldset>
            <fieldset><legend className="label">Connections granted</legend><div className="checks">{db.connections.map((c) => <label key={c.id}><input type="checkbox" name="connections" value={c.id} defaultChecked={bot?.connections.includes(c.id)} />{c.name}{c.access === "human-only" ? " (prepare only)" : ""}</label>)}</div></fieldset>
            <fieldset><legend className="label">Skills</legend><div className="checks">{SKILLS.map((s) => <label key={s.id} title={s.what}><input type="checkbox" name="skills" value={s.id} defaultChecked={bot?.skills.includes(s.id)} />{s.name}</label>)}</div></fieldset>
          </ActionForm>
        </section>

        {bot ? (
          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <section className="panel">
              <h2>{bot.name}'s sign-in</h2>
              <span className="small">{login ? <>Code ending <span className="code">…{login.hint}</span>, issued by {login.issuedBy} {ago(login.issuedAt)}. {login.lastSignInAt ? `Last signed in ${ago(login.lastSignInAt)}.` : "Hasn't signed in yet."}</> : "No code yet. Issue one and give it to the GTMBot so it can sign in."}</span>
              <ActionForm action={issueCode} submitLabel={login ? "Issue a new code" : "Issue a code"} secondary><input type="hidden" name="memberId" value={bot.id} /></ActionForm>
              {login ? <ActionForm action={revokeCode} submitLabel="Revoke sign-in" secondary><input type="hidden" name="memberId" value={bot.id} /></ActionForm> : null}
            </section>
            <section className="panel">
              <h2>{bot.name}'s guardrails</h2>
              <span className="label" style={{ margin: 0 }}>Chain of command</span>
              <span className="small">{chainOfCommand(bot, db.bots).join(" → ")}</span>
              <span className="label" style={{ margin: 0 }}>May do</span>
              <span className="chips">{bot.allowedActions.map((a) => <span key={a} className="pill ok">{ACTION_LABEL[a]}</span>)}</span>
              <span className="label" style={{ margin: 0 }}>Connections granted</span>
              <span className="chips">{bot.connections.length ? bot.connections.map((c) => <span key={c} className={`pill ${conns.get(c)?.status === "connected" ? "ok" : "no"}`}>{conns.get(c)?.name} · {conns.get(c)?.status === "connected" ? "connected" : "not connected"}</span>) : <span className="muted small">None. Works on Horizon GTM data only.</span>}</span>
              <span className="label" style={{ margin: 0 }}>Daily limit</span>
              <span className="small">{bot.dailyLimit} actions</span>
            </section>
          </div>
        ) : null}
      </div>

      <section className="panel">
        <h2>Squad activity</h2>
        <ul className="list feed">
          {db.activity.filter((a) => names.has(a.actor)).slice(0, 15).map((a) => <li key={a.id}><span className={`kind kind-${a.kind}`}>{a.kind}</span><span><b>{a.actor}</b> {a.text} <span className="muted small">· {ago(a.at)}</span></span></li>)}
          {!db.activity.some((a) => names.has(a.actor)) ? <li className="muted">Nothing yet. Activity appears when this squad's GTMBots sign in and work.</li> : null}
        </ul>
      </section>
    </>
  );
}
