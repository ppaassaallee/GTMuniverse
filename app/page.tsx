import Link from "next/link";
import { FACTORY_LABEL, PageHead, ScoreBar, STAGE_LABEL, TierPill, ValuePill } from "@/components/ui";
import { prioritize, revenuePer100Mqls, scoreAccount } from "@/lib/scoring";
import { readDb } from "@/lib/store";
import type { Tier } from "@/lib/types";

const money = (n: number) => "$" + n.toLocaleString("en-US");

export default async function ControlTower() {
  const db = await readDb();
  const ws = db.workspace;
  const scored = prioritize(db.accounts.map((a) => scoreAccount(a, ws)));
  const m = revenuePer100Mqls(db.accounts);
  const count = (t: Tier) => scored.filter((a) => a.tier === t).length;
  const mqlReady = scored.filter((a) => a.mqlReady).length;
  const queue = scored.filter((a) => a.tier === "A" && a.stage === "universe").slice(0, 6);
  const stages = ["mql", "sql", "opportunity", "won"] as const;
  // Closed-lost accounts reached MQL but no further stage we track.
  const reached = (s: (typeof stages)[number]) =>
    s === "mql" ? db.accounts.filter((a) => a.stage !== "universe").length : db.accounts.filter((a) => stages.indexOf(a.stage as never) >= stages.indexOf(s)).length;
  const factories = Object.keys(FACTORY_LABEL).map((f) => {
    const list = scored.filter((a) => a.factory === f);
    return { f, total: list.length, tierA: list.filter((a) => a.tier === "A").length, won: list.filter((a) => a.stage === "won").length };
  });

  return (
    <>
      <PageHead eyebrow={`${ws.company} · Control Tower`} title="Is the system producing revenue?" sub={ws.goal} />

      <div className="kpis">
        <div className="kpi primary">
          <span className="label">Revenue per 100 MQLs</span>
          <span className="n">{m.per100 == null ? "–" : money(m.per100)}</span>
          <span className="d">{money(m.revenue)} closed won from {m.mqls} MQLs</span>
        </div>
        <div className="kpi">
          <span className="label">MQLs per closed-won deal</span>
          <span className="n">{m.won ? (m.mqls / m.won).toFixed(1) : "–"}</span>
          <span className="d">Lower is better</span>
        </div>
        <div className="kpi">
          <span className="label">Tier A accounts</span>
          <span className="n">{count("A")}</span>
          <span className="d">{scored.length ? Math.round((count("A") / scored.length) * 100) : 0}% of a {scored.length}-account universe</span>
        </div>
        <div className="kpi">
          <span className="label">Pass the MQL gate</span>
          <span className="n">{mqlReady}</span>
          <span className="d">Tier A, 2+ committee members, play assigned</span>
        </div>
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>Fit × signal</h2>
          <div className="matrix">
            <span />
            <span className="axis">Fit below {ws.thresholds.fit}</span>
            <span className="axis">Fit {ws.thresholds.fit}+</span>
            <span className="axis">Signal {ws.thresholds.signal}+</span>
            <Link href="/universe?tier=C" className="cell tier-C"><b>{count("C")}</b>Tier C · manual review</Link>
            <Link href="/universe?tier=A" className="cell tier-A"><b>{count("A")}</b>Tier A · work now</Link>
            <span className="axis">Signal below {ws.thresholds.signal}</span>
            <Link href="/universe?tier=Park" className="cell tier-Park"><b>{count("Park")}</b>Park · wait for a signal</Link>
            <Link href="/universe?tier=B" className="cell tier-B"><b>{count("B")}</b>Tier B · nurture</Link>
          </div>
        </section>

        <section className="panel">
          <h2>Funnel</h2>
          <div className="funnel">
            {stages.map((s) => {
              const n = reached(s);
              const max = Math.max(1, reached("mql"));
              return (
                <div className="step" key={s}>
                  <span>{STAGE_LABEL[s]}</span>
                  <span className="track"><i style={{ width: `${(n / max) * 100}%` }} /></span>
                  <span className="num">{n}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small">Counts accounts that reached each stage or beyond. Closed-lost accounts count as MQLs.</p>
        </section>
      </div>

      <section className="panel">
        <div className="actions" style={{ justifyContent: "space-between" }}>
          <h2>Work queue: Tier A, not yet engaged</h2>
          <Link className="btn ghost" href="/universe?tier=A">Open universe</Link>
        </div>
        {queue.length ? (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Account</th><th>Fit</th><th>Signal</th><th>Value</th><th>MQL gate</th></tr></thead>
              <tbody>
                {queue.map((a) => (
                  <tr key={a.id} className="link-row">
                    <td><Link className="name" href={`/accounts/${a.id}`}>{a.name}</Link><div className="muted small">{a.signals[0]?.detail || a.domain}</div></td>
                    <td><ScoreBar value={a.fitScore} label="Fit" /></td>
                    <td><ScoreBar value={a.signalScore} label="Signal" /></td>
                    <td><ValuePill value={a.value} /></td>
                    <td>{a.mqlReady ? <span className="pill ok">Ready</span> : <span className="muted small">{a.mqlBlockers.join(" · ")}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No Tier A accounts waiting. Add accounts or signals in the universe.</p>
        )}
      </section>

      <section className="panel">
        <h2>Lead factories</h2>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Factory</th><th className="num">Accounts</th><th className="num">Tier A</th><th className="num">Closed won</th></tr></thead>
            <tbody>
              {factories.map((r) => (
                <tr key={r.f}><td>{FACTORY_LABEL[r.f]}</td><td className="num">{r.total}</td><td className="num">{r.tierA}</td><td className="num">{r.won}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Judge each source on pipeline per 100 MQLs, never on records delivered.</p>
      </section>

      <p className="muted small">Tiers: <TierPill tier="A" /> <TierPill tier="B" /> <TierPill tier="C" /> <TierPill tier="Park" /></p>
    </>
  );
}
