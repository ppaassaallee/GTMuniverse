import Link from "next/link";
import { applyRouting } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHead, SignalChips, TierPill } from "@/components/ui";
import { scoreAll } from "@/lib/routing";
import { prioritize } from "@/lib/scoring";
import { readDb } from "@/lib/store";

const ACTIVE = ["new", "enriching", "queued", "engaged", "mql", "sql", "opportunity"];

export default async function Pods() {
  const db = await readDb();
  const all = scoreAll(db.accounts, db.gtms);
  const verticals = new Map(db.gtms.flatMap((g) => g.verticals).map((v) => [v.id, v.name]));
  const aiBots = db.bots.filter((b) => b.squadId === "sq_engage" && !b.isLead);
  const waiting = prioritize(all.filter((a) => a.tier === "A" && a.routing?.dest === "Hold"));

  return (
    <>
      <PageHead eyebrow="Stage 5 · Pods" title="Pod assignment" sub="Accounts that clear the rules go to human pods: SDRs open, BDRs handle inbound, Business Consultants close. Assignment follows vertical focus and free capacity.">
        <ActionForm action={applyRouting} submitLabel="Re-run assignment" pendingLabel="Assigning…" />
      </PageHead>

      <div className="grid3">
        {db.pods.map((p) => {
          const mine = prioritize(all.filter((a) => a.routing?.podId === p.id && ACTIVE.includes(a.stage)));
          const pct = Math.min(100, (mine.length / p.capacity) * 100);
          const over = mine.length > p.capacity;
          return (
            <section key={p.id} className="panel">
              <div className="panel-h"><h2>{p.name}</h2><span className={`pill ${p.kind === "BC" ? "violet" : p.kind === "BDR" ? "warn" : "info"}`}>{p.kind}</span></div>
              <span className="small muted">Lead {p.lead} · {p.members.join(", ")}</span>
              <div className="hbar" style={{ gridTemplateColumns: "1fr 60px" }}>
                <span className="track"><i style={{ width: `${pct}%`, background: over ? "var(--bad)" : pct > 85 ? "var(--warn)" : "var(--good)" }} /></span>
                <span className="num small">{mine.length} / {p.capacity}</span>
              </div>
              {p.focus.length ? <span className="chips">{p.focus.map((f) => <span key={f} className="src">{verticals.get(f)}</span>)}</span> : null}
              <ul className="list">
                {mine.slice(0, 5).map((a) => (
                  <li key={a.id} style={{ gridTemplateColumns: "26px 1fr", alignItems: "center", gap: 8 }}>
                    <TierPill tier={a.tier} />
                    <span><Link href={`/accounts/${a.id}`} style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "none" }}>{a.name}</Link><div className="sub-line">{a.routing?.owner} · <SignalChips a={a} /></div></span>
                  </li>
                ))}
                {mine.length > 5 ? <li className="muted small">+{mine.length - 5} more</li> : null}
                {!mine.length ? <li className="muted small">No accounts assigned.</li> : null}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="grid2">
        <section className="panel">
          <h2>AI SDRs</h2>
          <p className="muted small" style={{ margin: 0 }}>Accounts routed to AI are worked by the AI SDR squad. Every draft waits for a person.</p>
          {aiBots.map((b) => {
            const n = all.filter((a) => a.routing?.dest === "AI" && a.routing.agent === b.name).length;
            return <div key={b.id} className="hbar"><span>{b.name}</span><span className="track"><i style={{ width: `${Math.min(100, (n / Math.max(1, b.dailyLimit / 5)) * 100)}%`, background: "var(--violet)" }} /></span><span className="num">{n}</span></div>;
          })}
        </section>
        <section className="panel">
          <h2>Tier A waiting for a committee</h2>
          <p className="muted small" style={{ margin: 0 }}>These need at least two mapped buyers before a pod gets them. Ask the Researcher to map them.</p>
          <ul className="list">
            {waiting.slice(0, 8).map((a) => <li key={a.id}><Link href={`/accounts/${a.id}`}>{a.name}</Link><span className="muted small">{a.committee.length} of 2 buyers · fit {a.fitScore} · signal {a.signalScore}</span></li>)}
            {!waiting.length ? <li className="muted">None.</li> : null}
          </ul>
          <Link className="btn ghost" href="/squads/sq_prospect?bot=b_research">Open the Researcher</Link>
        </section>
      </div>
    </>
  );
}
