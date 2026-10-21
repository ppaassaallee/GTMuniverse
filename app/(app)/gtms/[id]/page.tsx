import Link from "next/link";
import { notFound } from "next/navigation";
import { addKnowledge, saveGtmRules } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHead, Tabs } from "@/components/ui";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";
import type { Channel, ScoredAccount } from "@/lib/types";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const CH: Record<Channel, string> = { email: "@", call: "☎", linkedin: "in", voicemail: "VM", task: "✓" };
const ROLE_LABEL = { economic: "Economic buyer", operational: "Operational buyer", functional: "Functional buyer", champion: "Champion" };

/** Map an account to a 6sense-style buying stage from what we know about it. */
function buyingStage(a: ScoredAccount): string {
  if (["opportunity", "won"].includes(a.stage)) return "purchase";
  if (["engaged", "mql", "sql"].includes(a.stage)) return "decision";
  if (a.signalScore >= 40 || a.signals.some((s) => s.typeId === "new_leader")) return "consideration";
  if (a.signalScore > 0) return "awareness";
  return "target";
}

export default async function GtmPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const db = await readDb();
  const g = db.gtms.find((x) => x.id === id);
  if (!g) notFound();
  const accounts = scoreAll(db.accounts, db.gtms).filter((a) => a.gtmId === g.id);
  const base = `/gtms/${g.id}`;
  const tabs = [
    { href: `${base}?tab=overview`, label: "Overview" },
    { href: `${base}?tab=icp`, label: "ICP & personas", count: g.verticals.length },
    { href: `${base}?tab=signals`, label: "Signals & scoring", count: g.signalTypes.length },
    { href: `${base}?tab=plays`, label: "Playbooks", count: g.plays.length },
    { href: `${base}?tab=sequences`, label: "Sequences & scripts", count: g.sequences.length + g.scripts.length },
    { href: `${base}?tab=policies`, label: "Policies", count: g.policies.length },
    { href: `${base}?tab=practices`, label: "Best practices", count: g.bestPractices.length },
    { href: `${base}?tab=knowledge`, label: "Knowledge base", count: g.knowledge.length },
  ];
  const stageCounts = g.buyingStages.map((s) => ({ ...s, n: accounts.filter((a) => buyingStage(a) === s.id).length }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));
  const maxW = Math.max(...g.signalTypes.map((t) => t.weight), 1);
  const squads = db.squads.filter((s) => s.gtmId === g.id);

  return (
    <>
      <p className="small" style={{ margin: 0 }}><Link href="/gtms">← GTMs</Link></p>
      <PageHead eyebrow={`GTM · ${g.status} · ${g.owner}`} title={g.name} sub={g.objective}>
        <span className="pill info">North star: {g.northStar}</span>
      </PageHead>
      <Tabs tabs={tabs} active={`${base}?tab=${tab}`} />

      {tab === "overview" ? (
        <>
          <div className="kpis">
            <div className="kpi"><span className="label">Accounts</span><span className="n">{accounts.length}</span><span className="d">{accounts.filter((a) => a.tier === "A").length} Tier A</span></div>
            <div className="kpi"><span className="label">ICP verticals</span><span className="n">{g.verticals.length}</span><span className="d">{g.personas.length} buyer personas</span></div>
            <div className="kpi"><span className="label">Plays</span><span className="n">{g.plays.length}</span><span className="d">{g.sequences.length} sequences · {g.scripts.length} scripts</span></div>
            <div className="kpi"><span className="label">Policies</span><span className="n">{g.policies.length}</span><span className="d">{g.policies.filter((p) => p.severity === "must").length} must-follow</span></div>
            <div className="kpi"><span className="label">Squads on it</span><span className="n">{squads.length}</span><span className="d">{db.bots.filter((b) => squads.some((s) => s.id === b.squadId)).length} GTMBots</span></div>
          </div>
          <div className="grid2">
            <section className="panel">
              <div className="panel-h"><h2>Buying stages</h2><span className="muted small">6sense-style stages, inferred from signals and stage</span></div>
              <div style={{ display: "grid", gap: 8 }}>
                {stageCounts.map((s) => (
                  <div key={s.id} className="hbar">
                    <span><b>{s.name}</b><div className="muted small">{s.motion}</div></span>
                    <span className="track"><i style={{ width: `${(s.n / maxStage) * 100}%` }} /></span>
                    <span className="num">{s.n}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>Play map</h2><Link className="small" href={`${base}?tab=plays`}>Playbooks</Link></div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.plays.map((p) => (
                  <div key={p.id} className="hbar">
                    <span><b>{p.id} · {p.name}</b></span>
                    <span className="track"><i style={{ width: `${(p.sqlRate || 0) * 100 / 0.35}%`, background: "var(--good)" }} /></span>
                    <span className="num">{p.sqlRate != null ? `${Math.round(p.sqlRate * 100)}%` : "–"}</span>
                  </div>
                ))}
                <span className="muted small">Bar = MQL → SQL rate for the play.</span>
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>When to sell</h2><span className="muted small">Plays fire 60–90 days before each peak</span></div>
              <div className="months">
                <span />{MONTHS.map((m, i) => <span key={i} className="mh">{m}</span>)}
                {g.verticals.map((v) => (
                  <span key={v.id} style={{ display: "contents" }}>
                    <span className="small">{v.name}</span>
                    {MONTHS.map((_, i) => <span key={i} className={`m ${v.sellMonths.includes(i + 1) ? "on" : ""}`} title={`${v.name}: ${v.timing}`} />)}
                  </span>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel-h"><h2>Signal weights</h2><Link className="small" href={`${base}?tab=signals`}>Edit</Link></div>
              <div style={{ display: "grid", gap: 8 }}>
                {g.signalTypes.map((t) => (
                  <div key={t.id} className="hbar">
                    <span>{t.name}</span>
                    <span className="track"><i style={{ width: `${(t.weight / maxW) * 100}%`, background: t.modifier ? "var(--warn)" : "var(--accent)" }} /></span>
                    <span className="num">+{t.weight}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      {tab === "icp" ? (
        <>
          <section className="panel"><h2>Ideal customer</h2><p style={{ margin: 0 }}>{g.icpSummary}</p><p className="muted small" style={{ margin: 0 }}>Exclusions: {g.exclusions}</p></section>
          <div className="grid3">
            {g.verticals.map((v) => (
              <article key={v.id} className="card">
                <div className="top"><h3>{v.name}</h3><span className="muted small">{accounts.filter((a) => a.verticalId === v.id).length} accounts</span></div>
                <span className="small">{v.fitProfile}</span>
                <span className="label" style={{ marginTop: 6 }}>Hiring that signals need</span><span className="small">{v.hiringSignals}</span>
                <span className="label">Entry personas</span><span className="small">{v.personas}</span>
                <span className="label">Timing</span><span className="small">{v.timing}</span>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>Buying committee</h2>
            <div className="grid3">
              {g.personas.map((p) => (
                <div key={p.id} className="card" style={{ background: "var(--bg)" }}>
                  <span className="pill info" style={{ justifySelf: "start" }}>{ROLE_LABEL[p.committeeRole]}</span>
                  <b>{p.title}</b>
                  <span className="small muted">Pains: {p.pains}</span>
                  <span className="small">“{p.message}”</span>
                </div>
              ))}
            </div>
            <p className="muted small" style={{ margin: 0 }}>One contact is a lead; a mapped committee is an opportunity.</p>
          </section>
        </>
      ) : null}

      {tab === "signals" ? (
        <section className="panel">
          <h2>Signal library and scoring rules</h2>
          <ActionForm action={saveGtmRules} submitLabel="Save scoring rules" pendingLabel="Saving…">
            <input type="hidden" name="gtmId" value={g.id} />
            <div className="row">
              <div><label htmlFor="thFit">Tier A fit threshold</label><input id="thFit" name="thFit" type="number" min="0" max="100" defaultValue={g.thresholds.fit} /></div>
              <div><label htmlFor="thSignal">Tier A signal threshold</label><input id="thSignal" name="thSignal" type="number" min="0" max="100" defaultValue={g.thresholds.signal} /></div>
              <div><label htmlFor="signalDecayDays">Signal decay (days)</label><input id="signalDecayDays" name="signalDecayDays" type="number" min="1" defaultValue={g.signalDecayDays} /></div>
            </div>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Signal</th><th>Definition</th><th>Source</th><th>Weight</th></tr></thead>
                <tbody>
                  {g.signalTypes.map((t) => (
                    <tr key={t.id}>
                      <td><b>{t.name}</b>{t.modifier ? <div className="muted small">Counts only with another signal</div> : null}</td>
                      <td>{t.definition}</td>
                      <td className="muted small">{t.source}</td>
                      <td style={{ width: 90 }}><input aria-label={`${t.name} weight`} name={`w_${t.id}`} type="number" min="0" max="100" defaultValue={t.weight} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small" style={{ margin: 0 }}>Fit = vertical 30 + size and role mix 25 + geography 15 + operations intensity 15 + historical performance 15. Signal = fresh weights, each type once, capped at 100. Tier A needs both thresholds.</p>
          </ActionForm>
        </section>
      ) : null}

      {tab === "plays" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {g.plays.map((p) => {
            const seq = g.sequences.find((s) => s.id === p.sequenceId);
            return (
              <section key={p.id} className="panel">
                <div className="panel-h"><h2>{p.id} · {p.name}</h2><span className="pill ok">{p.sqlRate != null ? `${Math.round(p.sqlRate * 100)}% MQL → SQL` : "No data yet"}</span></div>
                <div className="flow">
                  <div className="step"><span className="label" style={{ margin: 0 }}>Trigger</span><span className="small">{p.trigger}</span></div>
                  <span className="arrow" aria-hidden>→</span>
                  <div className="step"><span className="label" style={{ margin: 0 }}>Hypothesis</span><span className="small">{p.hypothesis}</span></div>
                  <span className="arrow" aria-hidden>→</span>
                  <div className="step"><span className="label" style={{ margin: 0 }}>First touch</span><span className="small">{p.firstTouch}</span></div>
                  <span className="arrow" aria-hidden>→</span>
                  <Link className="step" href={`${base}?tab=sequences`}><span className="label" style={{ margin: 0 }}>Sequence</span><span className="small">{seq ? `${seq.name} · ${seq.steps.length} steps` : "None"}</span></Link>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {tab === "sequences" ? (
        <>
          <div className="grid2">
            {g.sequences.map((s) => (
              <section key={s.id} className="panel">
                <div className="panel-h"><h2>{s.name}</h2><span className="muted small">{s.persona}</span></div>
                <div className="timeline">
                  {s.steps.map((st, i) => (
                    <div key={i} className="rowt"><span className="day">Day {st.day}</span><span className={`ch ch-${st.channel}`}><i>{CH[st.channel]}</i>{st.action}</span></div>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <div className="grid2">
            {g.scripts.map((s) => (
              <section key={s.id} className="panel">
                <div className="panel-h"><h3>{s.name}</h3><span className="pill info">{s.kind}</span></div>
                <p className="email" style={{ margin: 0 }}>{s.body}</p>
              </section>
            ))}
          </div>
        </>
      ) : null}

      {tab === "policies" ? (
        <section className="panel">
          <h2>Policies</h2>
          <p className="muted small" style={{ margin: 0 }}>Must-follow policies are enforced by the squads' guardrails. Should-follow policies guide the bots' prompts.</p>
          <ul className="list">
            {g.policies.map((p) => (
              <li key={p.id} className="policy"><span className={`shield ${p.severity}`}>{p.severity === "must" ? "!" : "~"}</span><span><b>{p.name}</b><div className="small">{p.rule}</div></span></li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "practices" ? (
        <div className="grid2">
          {(["6sense", "ZoomInfo", "Apollo", "Horizon GTM"] as const).map((src) => (
            <section key={src} className="panel">
              <h2>{src === "Horizon GTM" ? "From your GTM engineering system" : `From ${src}`}</h2>
              <ul className="list">
                {g.bestPractices.filter((b) => b.source === src).map((b) => (
                  <li key={b.id}><span className="label" style={{ margin: 0 }}>{b.area}</span><span className="small">{b.practice}</span></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {tab === "knowledge" ? (
        <>
          <p className="muted small" style={{ margin: 0 }}>What your GTMBots read before they act: value propositions, objection handling, case studies, competitors. People write it; GTMBots read it.</p>
          <div className="kb">
            {g.knowledge.map((k) => (
              <article key={k.id}>
                <span className="pill info" style={{ justifySelf: "start" }}>{k.kind}</span>
                <b>{k.title}</b>
                <p>{k.body}</p>
                <span className="muted small">{k.updatedBy} · {new Date(k.updatedAt).toLocaleDateString("en-US")}</span>
              </article>
            ))}
          </div>
          <section className="panel">
            <h2>Add to the knowledge base</h2>
            <ActionForm action={addKnowledge} submitLabel="Add" secondary>
              <input type="hidden" name="gtmId" value={g.id} />
              <div className="row">
                <div><label htmlFor="kind">Type</label><select id="kind" name="kind">{["Value proposition", "Objection", "Case study", "Competitor", "FAQ"].map((k) => <option key={k}>{k}</option>)}</select></div>
                <div><label htmlFor="title">Title</label><input id="title" name="title" required /></div>
              </div>
              <div><label htmlFor="body">Content</label><textarea id="body" name="body" required /></div>
            </ActionForm>
          </section>
        </>
      ) : null}
    </>
  );
}
