import { applyRouting, toggleRule } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { UniverseTabs } from "@/components/UniverseTabs";
import { DEST_LABEL, DestPill, PageHead } from "@/components/ui";
import { describeCondition, dryRun, matchRule, scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";
import type { Destination } from "@/lib/types";

const COLORS: Record<Destination, string> = { SDR: "var(--accent)", AI: "var(--violet)", Hold: "var(--warn)", Freezer: "var(--muted)" };

export default async function Rules() {
  const db = await readDb();
  const all = scoreAll(db.accounts, db.gtms);
  const dry = dryRun(db.accounts, db.gtms, db.rules, db.pods);
  // How many accounts each rule catches first (rules run top to bottom).
  const firstHit = new Map<string, number>();
  for (const a of all) {
    const r = db.rules.find((x) => x.on && matchRule(a, x));
    if (r) firstHit.set(r.id, (firstHit.get(r.id) || 0) + 1);
  }
  const dests: Destination[] = ["SDR", "AI", "Hold", "Freezer"];
  const total = db.accounts.length;
  const bar = (counts: Record<Destination, number>) => (
    <div className="stack">{dests.map((d) => <i key={d} style={{ width: `${(counts[d] / total) * 100}%`, background: COLORS[d] }} title={`${DEST_LABEL[d]}: ${counts[d]}`} />)}</div>
  );

  return (
    <>
      <PageHead eyebrow="Stage 4 · Universe" title="Routing rules" sub="Business rules decide where every account goes. They run top to bottom; the first match wins. Toggle a rule, check the dry run, then apply." />
      <UniverseTabs db={db} active="/universe/rules" inbox={all.filter((a) => a.freshestSignalDays != null && a.freshestSignalDays <= 7).length} />

      <section className="panel">
        <div className="panel-h"><h2>Dry run · impact before you apply</h2><span className="muted small">{dry.changed} accounts would move</span></div>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="hbar"><span>Now</span>{bar(dry.before)}<span /></div>
          <div className="hbar"><span>After apply</span>{bar(dry.after)}<span /></div>
          <div className="legend">{dests.map((d) => <span key={d}><i style={{ background: COLORS[d] }} />{DEST_LABEL[d]}: {dry.before[d]} → <b>{dry.after[d]}</b></span>)}</div>
        </div>
        {dry.moves.length ? <span className="chips">{dry.moves.slice(0, 8).map(([k, n]) => <span key={k} className="src">{k}: {n}</span>)}</span> : <span className="muted small">No changes. The universe already matches these rules.</span>}
        <ActionForm action={applyRouting} submitLabel={`Apply rules to ${total} accounts`} pendingLabel="Routing…" />
      </section>

      <section className="panel">
        <h2>Rules</h2>
        <ol className="list" style={{ paddingLeft: 0 }}>
          {db.rules.map((r, i) => (
            <li key={r.id} style={{ gridTemplateColumns: "28px 1fr auto auto", alignItems: "center", gap: 12, opacity: r.on ? 1 : 0.5 }}>
              <span className="nav-n" style={{ background: "var(--soft)", color: "var(--ink)" }}>{i + 1}</span>
              <span>
                <b>{r.name}</b>
                <div className="chips" style={{ marginTop: 3 }}>
                  {r.when.map((c, j) => <span key={j} className="src">{describeCondition(c)}</span>)}
                  {r.any?.map((c, j) => <span key={`a${j}`} className="src">or {describeCondition(c)}</span>)}
                  <span className="muted small">→ <DestPill dest={r.then.dest} />{r.then.agent ? ` · ${r.then.agent}` : ""}{r.then.thaw ? ` · thaws ${r.then.thaw}` : ""}</span>
                </div>
              </span>
              <span className="num small muted">{firstHit.get(r.id) || 0} accounts</span>
              <ActionForm action={toggleRule} submitLabel={r.on ? "Turn off" : "Turn on"} secondary><input type="hidden" name="ruleId" value={r.id} /></ActionForm>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
