import Link from "next/link";
import { ago, PageHead } from "@/components/ui";
import { ACTION_LABEL } from "@/lib/guardrails";
import { SKILLS } from "@/lib/skills";
import { readDb } from "@/lib/store";

const KIND_LABEL = { approval: "Needs a person", block: "Hard stop", limit: "Budget", escalate: "Escalates" };

export default async function Squads() {
  const db = await readDb();
  const humans = db.org.humans;
  const leads = db.bots.filter((b) => b.isLead);
  const squadOf = (id: string) => db.squads.find((s) => s.id === id)!;
  const skillUse = (id: string) => db.bots.filter((b) => b.skills.includes(id)).length;

  return (
    <>
      <PageHead eyebrow="Stage 2 · Squads" title="Squads of Grokbots" sub="Each squad owns one job. Bots have skills, a permission list and a boss. Every action they propose passes the guardrails; anything that needs a person waits in Approvals." />

      <section className="panel">
        <div className="panel-h"><h2>Chain of command</h2><span className="muted small">Humans at the top; every bot reports to a squad lead, every lead to a person</span></div>
        <div className="org">
          <div className="lvl">
            {humans.map((h) => <div key={h.role} className="node human"><b>{h.name}</b><small>{h.role}</small></div>)}
          </div>
          <div className="lvl">
            {leads.map((l) => (
              <Link key={l.id} href={`/squads/${l.squadId}`} className="node lead" style={{ borderColor: squadOf(l.squadId).color }}>
                <b>{l.name}</b><small>{squadOf(l.squadId).name} lead</small><small>reports to {l.reportsTo.replace("human:", "")}</small>
              </Link>
            ))}
          </div>
          <div className="lvl">
            {db.squads.map((s) => (
              <Link key={s.id} href={`/squads/${s.id}`} className="node" style={{ minWidth: 200 }}>
                <b><span className="bot-dot" style={{ background: s.color }} /> {s.name}</b>
                <small>{db.bots.filter((b) => b.squadId === s.id && !b.isLead).map((b) => b.name).join(" · ")}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="grid2">
        {db.squads.map((s) => {
          const bots = db.bots.filter((b) => b.squadId === s.id);
          const pending = db.approvals.filter((a) => a.status === "pending" && bots.some((b) => b.id === a.botId)).length;
          return (
            <Link key={s.id} href={`/squads/${s.id}`} className="card" style={{ borderTop: `3px solid ${s.color}` }}>
              <div className="top"><h2>{s.name}</h2><span className="muted small">{bots.length} bots{pending ? ` · ${pending} waiting` : ""}</span></div>
              <span className="small">{s.mission}</span>
              <span className="chips" style={{ marginTop: 4 }}>{bots.map((b) => <span key={b.id} className={`pill ${b.autonomy === "act" ? "ok" : b.autonomy === "approve" ? "warn" : "info"}`}>{b.name}</span>)}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>Guardrails</h2>
          <p className="muted small" style={{ margin: 0 }}>Enforced in code on every proposed action, in this order. A bot can't talk its way past them.</p>
          <ul className="list">
            {db.guardrails.map((g, i) => (
              <li key={g.id} className="policy"><span className={`shield ${g.kind === "block" ? "must" : "should"}`}>{i + 1}</span><span><b>{g.name}</b> <span className="pill info">{KIND_LABEL[g.kind]}</span><div className="small">{g.description}</div></span></li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Skill library</h2>
          <p className="muted small" style={{ margin: 0 }}>The twelve GTM-engineering skills bots are built from. Bar = how many bots use it.</p>
          <div style={{ display: "grid", gap: 7 }}>
            {SKILLS.map((s) => (
              <div key={s.id} className="hbar" title={s.what}>
                <span>{s.name}</span>
                <span className="track"><i style={{ width: `${(skillUse(s.id) / db.bots.length) * 100 * 2.5}%` }} /></span>
                <span className="num">{skillUse(s.id)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-h"><h2>Recent activity</h2><Link className="small" href="/approvals">Approvals</Link></div>
        <ul className="list feed">
          {db.activity.slice(0, 12).map((a) => <li key={a.id}><span className={`kind kind-${a.kind}`}>{a.kind}</span><span><b>{a.actor}</b> {a.text} <span className="muted small">· {ago(a.at)}</span></span></li>)}
        </ul>
        <p className="muted small" style={{ margin: 0 }}>Actions bots can take: {Object.values(ACTION_LABEL).join(" · ")}.</p>
      </section>
    </>
  );
}
