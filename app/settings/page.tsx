import { resetDemo, saveWorkspace } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHead } from "@/components/ui";
import { readDb } from "@/lib/store";

export default async function Settings() {
  const { workspace: ws } = await readDb();
  return (
    <>
      <PageHead eyebrow="Workspace" title={`${ws.company} on Boldr`} sub="The context every brief and board session is built on, and the rules every score follows. Every rule here is plain data you can version." />

      <section className="panel">
        <ActionForm action={saveWorkspace} submitLabel="Save workspace" pendingLabel="Saving…">
          <div className="row">
            <div><label htmlFor="company">Company</label><input id="company" name="company" defaultValue={ws.company} /></div>
            <div><label htmlFor="stage">Stage</label><input id="stage" name="stage" defaultValue={ws.stage} /></div>
            <div><label htmlFor="motion">Motion</label><input id="motion" name="motion" defaultValue={ws.motion} /></div>
          </div>
          <div><label htmlFor="product">What you sell</label><textarea id="product" name="product" defaultValue={ws.product} /></div>
          <div><label htmlFor="icpSummary">Ideal customer</label><textarea id="icpSummary" name="icpSummary" defaultValue={ws.icpSummary} /></div>
          <div><label htmlFor="goal">Goal</label><input id="goal" name="goal" defaultValue={ws.goal} /></div>

          <h2>Scoring rules</h2>
          <div className="row">
            <div><label htmlFor="thFit">Tier A fit threshold</label><input id="thFit" name="thFit" type="number" min="0" max="100" defaultValue={ws.thresholds.fit} /></div>
            <div><label htmlFor="thSignal">Tier A signal threshold</label><input id="thSignal" name="thSignal" type="number" min="0" max="100" defaultValue={ws.thresholds.signal} /></div>
            <div><label htmlFor="signalDecayDays">Signal decay (days)</label><input id="signalDecayDays" name="signalDecayDays" type="number" min="1" defaultValue={ws.signalDecayDays} /></div>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Signal</th><th>Definition</th><th>Source</th><th>Weight</th></tr></thead>
              <tbody>
                {ws.signalTypes.map((t) => (
                  <tr key={t.id}>
                    <td><b>{t.name}</b>{t.modifier ? <div className="muted small">Only counts with another signal</div> : null}</td>
                    <td>{t.definition}</td>
                    <td className="muted small">{t.source}</td>
                    <td style={{ width: 90 }}><input aria-label={`${t.name} weight`} name={`w_${t.id}`} type="number" min="0" max="100" defaultValue={t.weight} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ActionForm>
      </section>

      <div className="grid2">
        <section className="panel">
          <h2>ICP verticals</h2>
          <ul className="list">
            {ws.verticals.map((v) => (
              <li key={v.id}>
                <b>{v.name}</b>
                <span className="small">{v.fitProfile}</span>
                <span className="muted small">Hiring: {v.hiringSignals}. Personas: {v.personas}. Timing: {v.timing}.</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Play library</h2>
          <ul className="list">
            {ws.plays.map((p) => (
              <li key={p.id}>
                <b>{p.id} · {p.name}</b>
                <span className="small">Trigger: {p.trigger}</span>
                <span className="muted small">Hypothesis: {p.hypothesis}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel">
        <h2>Demo data</h2>
        <p className="muted">Restores the Solvo sample workspace and accounts. This replaces everything in this workspace, including briefs and board sessions.</p>
        <ActionForm action={resetDemo} submitLabel="Restore demo data" pendingLabel="Restoring…" secondary />
      </section>
    </>
  );
}
