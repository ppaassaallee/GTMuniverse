import Link from "next/link";
import { refreshTower } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ago, DEST_LABEL, money, PageHead } from "@/components/ui";
import { readDb } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/tower";
import type { Destination, Tier } from "@/lib/types";

const DEST_COLOR: Record<Destination, string> = { SDR: "var(--accent)", AI: "var(--violet)", Hold: "var(--warn)", Freezer: "var(--muted)" };

export default async function Tower() {
  const db = await readDb();
  const t = db.tower;
  const g = db.gtms[0];
  return (
    <>
      <PageHead eyebrow="Stage 6 · Control Tower" title="Is the system producing revenue?" sub={`${g.northStar} is the number that runs the operation. The Analytics squad refreshes this page on request.`}>
        <ActionForm action={refreshTower} submitLabel="Ask Lens to refresh" pendingLabel="Lens is refreshing…" />
      </PageHead>
      {!t ? <p className="notice">No snapshot yet. Ask Lens to refresh.</p> : (
        <>
          <p className="muted small" style={{ margin: 0 }}>Last refreshed by <b>{t.updatedBy}</b> (Analytics squad) {ago(t.updatedAt)}{t.model ? ` · commentary by ${t.model}` : ""}. Numbers are computed exactly from the universe; Grok only writes the commentary.</p>
          <Body t={t} />
        </>
      )}
    </>
  );
}

function Body({ t }: { t: NonNullable<Awaited<ReturnType<typeof readDb>>["tower"]> }) {
  const m = t.metrics;
  const maxFunnel = Math.max(1, ...m.funnel.map((f) => f.count));
  const tiers: Tier[] = ["A", "B", "C", "Park"];
  const dests: Destination[] = ["SDR", "AI", "Hold", "Freezer"];
  const maxSrc = Math.max(1, ...m.sources.map((s) => s.accounts));
  return (
    <>
      <div className="kpis">
        <div className="kpi primary"><span className="label">Revenue per 100 MQLs</span><span className="n">{m.revenuePer100Mqls == null ? "–" : money(m.revenuePer100Mqls)}</span><span className="d">{money(m.revenue)} won from {m.mqls} MQLs</span></div>
        <div className="kpi"><span className="label">MQLs per closed-won</span><span className="n">{m.mqlsPerWin ?? "–"}</span><span className="d">Lower is better</span></div>
        <div className="kpi"><span className="label">Universe</span><span className="n">{m.universe}</span><span className="d">{m.tiers.A} Tier A ({Math.round((m.tiers.A / Math.max(1, m.universe)) * 100)}%)</span></div>
        <div className="kpi"><span className="label">Closed won</span><span className="n">{m.won}</span><span className="d">deals</span></div>
      </div>

      {t.commentary.length ? (
        <section className="synth">
          <span className="label">What Lens sees</span>
          <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>{t.commentary.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </section>
      ) : null}

      <div className="grid2">
        <section className="panel">
          <h2>Funnel</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {m.funnel.map((f, i) => (
              <div key={f.stage} className="hbar">
                <span>{f.stage}</span>
                <span className="track"><i style={{ width: `${(f.count / maxFunnel) * 100}%` }} /></span>
                <span className="num">{f.count}{i > 0 && m.funnel[i - 1].count ? <span className="muted small"> {Math.round((f.count / m.funnel[i - 1].count) * 100)}%</span> : null}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>Where the universe sits</h2>
          <div className="matrix">
            <span /><span className="axis">Low fit</span><span className="axis">High fit</span>
            <span className="axis">Signal</span>
            <Link href="/universe?tier=C" className="cell C"><b>{m.tiers.C}</b>Tier C · review</Link>
            <Link href="/universe?tier=A" className="cell A"><b>{m.tiers.A}</b>Tier A · work now</Link>
            <span className="axis">No signal</span>
            <Link href="/universe?tier=Park" className="cell P"><b>{m.tiers.Park}</b>Park</Link>
            <Link href="/universe?tier=B" className="cell B"><b>{m.tiers.B}</b>Tier B · nurture</Link>
          </div>
          <div className="stack">{dests.map((d) => <i key={d} style={{ width: `${(m.destinations[d] / Math.max(1, m.universe)) * 100}%`, background: DEST_COLOR[d] }} />)}</div>
          <div className="legend">{dests.map((d) => <span key={d}><i style={{ background: DEST_COLOR[d] }} />{DEST_LABEL[d]} {m.destinations[d]}</span>)}</div>
          <span className="muted small">Tiers: {tiers.map((x) => `${x} ${m.tiers[x]}`).join(" · ")}</span>
        </section>
        <section className="panel">
          <h2>Pod load</h2>
          <div style={{ display: "grid", gap: 8 }}>
            {m.pods.map((p) => {
              const pct = (p.load / p.capacity) * 100;
              return <div key={p.id} className="hbar"><span>{p.name}</span><span className="track"><i style={{ width: `${Math.min(100, pct)}%`, background: pct > 100 ? "var(--bad)" : pct > 85 ? "var(--warn)" : "var(--good)" }} /></span><span className="num">{p.load}/{p.capacity}</span></div>;
            })}
          </div>
        </section>
        <section className="panel">
          <h2>Source scorecard</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Source</th><th>Accounts</th><th className="num">Tier A</th><th className="num">Won</th></tr></thead>
              <tbody>
                {m.sources.map((s) => (
                  <tr key={s.source}><td>{SOURCE_LABEL[s.source]}</td><td><span className="hbar" style={{ gridTemplateColumns: "1fr 34px" }}><span className="track"><i style={{ width: `${(s.accounts / maxSrc) * 100}%` }} /></span><span className="num">{s.accounts}</span></span></td><td className="num">{s.tierA}</td><td className="num">{s.won}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <span className="muted small">Judge each source on pipeline per 100 MQLs, never on records delivered.</span>
        </section>
      </div>
    </>
  );
}
