import Link from "next/link";
import { notFound } from "next/navigation";
import { addCommitteeMember, addSignal, briefAccount, setStage, updateFit } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { FACTORY_LABEL, PageHead, STAGE_LABEL, TierPill, ValuePill } from "@/components/ui";
import { grokConfigured } from "@/lib/grok";
import { FIT_WEIGHTS, scoreAccount } from "@/lib/scoring";
import { readDb } from "@/lib/store";
import type { FitInputs } from "@/lib/types";

const FIT_LABEL: Record<keyof FitInputs, string> = {
  vertical: "Vertical match",
  sizeAndRoleMix: "Size and role mix",
  geography: "Geography and time zone",
  operationsIntensity: "Operations intensity",
  historicalPerformance: "Historical performance",
};
const ROLE_LABEL = { economic: "Economic buyer", operational: "Operational buyer", functional: "Functional buyer", champion: "Champion" } as const;

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const ws = db.workspace;
  const raw = db.accounts.find((a) => a.id === id);
  if (!raw) notFound();
  const a = scoreAccount(raw, ws);
  const vertical = ws.verticals.find((v) => v.id === a.verticalId);
  const types = new Map(ws.signalTypes.map((t) => [t.id, t]));
  const play = ws.plays.find((p) => p.id === a.brief?.playId);
  const today = Date.now();
  const live = grokConfigured();

  return (
    <>
      <p className="small"><Link href="/universe">← Universe</Link></p>
      <PageHead eyebrow={`${vertical?.name || "Unclassified"} · ${FACTORY_LABEL[a.factory]}`} title={a.name} sub={`${a.domain} · ${a.employees?.toLocaleString("en-US") ?? "?"} employees · ${a.geography || "geography unknown"}`} />

      <div className="kpis">
        <div className="kpi"><span className="label">Tier</span><span className="n"><TierPill tier={a.tier} /></span><span className="d">Fit ≥ {ws.thresholds.fit} and signal ≥ {ws.thresholds.signal} is Tier A</span></div>
        <div className="kpi"><span className="label">Fit</span><span className="n">{a.fitScore}</span><span className="d">Does it look like a customer?</span></div>
        <div className="kpi"><span className="label">Signal</span><span className="n">{a.signalScore}</span><span className="d">Why talk to them now?</span></div>
        <div className="kpi"><span className="label">Value</span><span className="n"><ValuePill value={a.value} /></span><span className="d">{a.estimatedSeats ? `~${a.estimatedSeats} seats` : "Seats unknown"}</span></div>
      </div>

      <div className={`notice`} style={a.mqlReady ? { borderColor: "var(--good)", background: "var(--good-soft)" } : undefined}>
        {a.mqlReady ? "Passes the MQL gate. Hand it to an SDR." : `Not an MQL yet: ${a.mqlBlockers.join(", ")}.`}
      </div>

      <div className="split">
        <section className="panel">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <h2>Account brief</h2>
            {a.brief ? <span className="muted small">By {a.brief.model} · {new Date(a.brief.generatedAt).toLocaleString("en-US")}</span> : null}
          </div>
          {!live ? <p className="notice">Grok isn't connected yet. Set XAI_API_KEY on the server to generate briefs.</p> : null}
          {a.brief ? (
            <div className="brief">
              <section><span className="label">Why it fits</span><p>{a.brief.whyFit}</p></section>
              <section><span className="label">Why now</span><p>{a.brief.whyNow}</p></section>
              <section><span className="label">Buying committee</span><p>{a.brief.committee}</p></section>
              <section><span className="label">Commercial hypothesis</span><p>{a.brief.hypothesis}</p></section>
              <section><span className="label">Play</span><p>{play ? `${play.id} · ${play.name}. ${play.firstTouch}` : "No play fits yet."}</p></section>
              <section><span className="label">Next action</span><p><b>{a.brief.nextAction}</b></p></section>
              <section><span className="label">Draft email (a human edits and sends)</span><div className="email"><b>{a.brief.email.subject}</b>{"\n\n"}{a.brief.email.body}</div></section>
            </div>
          ) : (
            <p className="muted">No brief yet. Grok will research why it fits, why now, who to contact, the play and the next action, using only what's on this page.</p>
          )}
          <ActionForm action={briefAccount} submitLabel={a.brief ? "Regenerate brief with Grok" : "Generate brief with Grok"} pendingLabel="Grok is researching…">
            <input type="hidden" name="accountId" value={a.id} />
          </ActionForm>
        </section>

        <div style={{ display: "grid", gap: 16 }}>
          <section className="panel">
            <h2>Signals</h2>
            <ul className="list">
              {a.signals.map((s, i) => {
                const age = Math.round((today - new Date(s.date).getTime()) / 86_400_000);
                const stale = age > ws.signalDecayDays;
                return (
                  <li key={i} className={stale ? "stale" : ""}>
                    <span><b>{types.get(s.typeId)?.name || s.typeId}</b> <span className="muted small">+{types.get(s.typeId)?.weight ?? 0}</span></span>
                    <span>{s.detail}</span>
                    <span className="muted small">{s.date} · {stale ? `expired (${age} days old)` : `${age} days ago`}</span>
                  </li>
                );
              })}
              {!a.signals.length ? <li className="muted">No signals. No signal, no MQL.</li> : null}
            </ul>
            <ActionForm action={addSignal} submitLabel="Add signal" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="typeId">Type</label><select id="typeId" name="typeId">{ws.signalTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <div><label htmlFor="detail">What happened</label><input id="detail" name="detail" placeholder="14 intake specialist roles posted" /></div>
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Buying committee</h2>
            <ul className="list">
              {a.committee.map((c, i) => <li key={i}><span className="muted small">{ROLE_LABEL[c.role]}</span><span>{c.title}{c.name ? ` · ${c.name}` : ""}</span></li>)}
              {!a.committee.length ? <li className="muted">Nobody mapped. One contact is a lead; a mapped committee is an opportunity.</li> : null}
            </ul>
            <ActionForm action={addCommitteeMember} submitLabel="Add member" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="role">Role</label><select id="role" name="role">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label htmlFor="title">Title</label><input id="title" name="title" placeholder="COO" /></div>
              </div>
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Fit breakdown</h2>
            <ActionForm action={updateFit} submitLabel="Update fit" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              {(Object.keys(FIT_WEIGHTS) as (keyof FitInputs)[]).map((k) => (
                <div key={k}>
                  <label htmlFor={k}>{FIT_LABEL[k]} · weight {FIT_WEIGHTS[k]}</label>
                  <input id={k} name={k} type="number" min="0" max="100" defaultValue={Math.round(a.fit[k] * 100)} />
                </div>
              ))}
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Stage</h2>
            <ActionForm action={setStage} submitLabel="Save stage" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={a.stage}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label htmlFor="revenue">Won revenue ($)</label><input id="revenue" name="revenue" type="number" min="0" defaultValue={a.revenue ?? ""} /></div>
              </div>
            </ActionForm>
          </section>
        </div>
      </div>
    </>
  );
}
