import Link from "next/link";
import { notFound } from "next/navigation";
import { addCommitteeMember, addSignal, assignToPod, briefAccount, setStage } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { DestPill, PageHead, SourceChips, STAGE_LABEL, TierPill, ValuePill } from "@/components/ui";
import { grokConfigured } from "@/lib/grok";
import { scoreAll } from "@/lib/routing";
import { FIT_WEIGHTS } from "@/lib/scoring";
import { readDb } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/tower";
import type { FitInputs } from "@/lib/types";

const FIT_LABEL: Record<keyof FitInputs, string> = { vertical: "Vertical match", sizeAndRoleMix: "Size and role mix", geography: "Geography and time zone", operationsIntensity: "Operations intensity", historicalPerformance: "Historical performance" };
const ROLE_LABEL = { economic: "Economic buyer", operational: "Operational buyer", functional: "Functional buyer", champion: "Champion" } as const;

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await readDb();
  const a = scoreAll(db.accounts, db.gtms).find((x) => x.id === id);
  if (!a) notFound();
  const g = db.gtms.find((x) => x.id === a.gtmId) || db.gtms[0];
  const vertical = g.verticals.find((v) => v.id === a.verticalId);
  const types = new Map(g.signalTypes.map((t) => [t.id, t]));
  const play = g.plays.find((p) => p.id === a.brief?.playId);
  const rule = db.rules.find((r) => r.id === a.routing?.ruleId);
  const pod = db.pods.find((p) => p.id === a.routing?.podId);
  const now = Date.now();

  return (
    <>
      <p className="small" style={{ margin: 0 }}><Link href="/universe">← Universe</Link></p>
      <PageHead eyebrow={`${vertical?.name || "Unclassified"} · ${g.name}`} title={a.name} sub={`${a.domain} · ${a.employees?.toLocaleString("en-US") ?? "?"} employees · ${a.state || "state unknown"}`}>
        <SourceChips sources={a.sources} />
      </PageHead>

      <div className="kpis">
        <div className="kpi"><span className="label">Tier</span><span className="n"><TierPill tier={a.tier} /></span><span className="d">Fit ≥ {g.thresholds.fit} and signal ≥ {g.thresholds.signal} is Tier A</span></div>
        <div className="kpi"><span className="label">Fit</span><span className="n">{a.fitScore}</span><span className="d">Looks like a customer?</span></div>
        <div className="kpi"><span className="label">Signal</span><span className="n">{a.signalScore}</span><span className="d">Why talk now?</span></div>
        <div className="kpi"><span className="label">Value</span><span className="n"><ValuePill value={a.value} /></span><span className="d">{a.estimatedSeats ? `~${a.estimatedSeats} seats` : "Seats unknown"}</span></div>
        <div className="kpi"><span className="label">Destination</span><span className="n" style={{ fontSize: 18 }}><DestPill dest={a.routing?.dest} /></span><span className="d">{pod ? `${a.routing?.owner} · ${pod.name}` : a.routing?.agent || a.routing?.reason || "Not routed"}</span></div>
      </div>

      <p className={`notice ${a.mqlReady ? "good" : ""}`} style={{ margin: 0 }}>
        {a.mqlReady ? "Passes the MQL gate: Tier A, a mapped committee and a play." : `Not an MQL yet: ${a.mqlBlockers.join(", ")}.`}
        {rule ? <> Routed by rule <b>“{rule.name}”</b>{a.routing?.thaw ? `, thaws ${a.routing.thaw}` : ""}.</> : null}
        {a.dnc ? " Do not contact." : ""}{a.customer ? " Existing customer." : ""}
      </p>

      <div className="split">
        <section className="panel">
          <div className="panel-h"><h2>Account brief</h2>{a.brief ? <span className="muted small">By {a.brief.model} · {new Date(a.brief.generatedAt).toLocaleString("en-US")}</span> : null}</div>
          {!grokConfigured() ? <p className="notice">Grok isn't connected yet. Set XAI_API_KEY on the server to generate briefs.</p> : null}
          {a.brief ? (
            <div className="brief">
              <div><span className="label">Why it fits</span><p>{a.brief.whyFit}</p></div>
              <div><span className="label">Why now</span><p>{a.brief.whyNow}</p></div>
              <div><span className="label">Buying committee</span><p>{a.brief.committee}</p></div>
              <div><span className="label">Commercial hypothesis</span><p>{a.brief.hypothesis}</p></div>
              <div><span className="label">Play</span><p>{play ? `${play.id} · ${play.name}. ${play.firstTouch}` : "No play fits yet."}</p></div>
              <div><span className="label">Next action</span><p><b>{a.brief.nextAction}</b></p></div>
            </div>
          ) : <p className="muted" style={{ margin: 0 }}>No brief yet. The Researcher bot writes why it fits, why now, who to contact, the play and the next action, using only what's on this page. The Writer drafts the first email, which waits in Approvals.</p>}
          <ActionForm action={briefAccount} submitLabel={a.brief ? "Regenerate with Grok" : "Research with Grok"} pendingLabel="Researcher is working…"><input type="hidden" name="accountId" value={a.id} /></ActionForm>
        </section>

        <div style={{ display: "grid", gap: 14 }}>
          <section className="panel">
            <h2>Pod assignment</h2>
            <ActionForm action={assignToPod} submitLabel="Assign" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="podId">Pod</label><select id="podId" name="podId" defaultValue={a.routing?.podId || ""}><option value="">Unassigned</option>{db.pods.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.kind}</option>)}</select></div>
                <div><label htmlFor="owner">Owner (optional)</label><input id="owner" name="owner" defaultValue={a.routing?.owner || ""} /></div>
              </div>
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Signals</h2>
            <ul className="list">
              {a.signals.map((s, i) => {
                const age = Math.floor((now - new Date(s.date).getTime()) / 86_400_000);
                return (
                  <li key={i} style={{ opacity: age > g.signalDecayDays ? 0.5 : 1 }}>
                    <span><b>{types.get(s.typeId)?.name || s.typeId}</b> <span className="muted small">+{types.get(s.typeId)?.weight ?? 0}</span></span>
                    <span className="small">{s.detail}</span>
                    <span className="muted small">{s.date} · {age > g.signalDecayDays ? `expired (${age} days)` : `${age} days ago`}</span>
                  </li>
                );
              })}
              {!a.signals.length ? <li className="muted">No signals. No signal, no MQL.</li> : null}
            </ul>
            <ActionForm action={addSignal} submitLabel="Add signal" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="typeId">Type</label><select id="typeId" name="typeId">{g.signalTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label htmlFor="date">Date</label><input id="date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              </div>
              <div><label htmlFor="detail">What happened</label><input id="detail" name="detail" placeholder="14 intake specialist roles posted" /></div>
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Buying committee</h2>
            <ul className="list">
              {a.committee.map((c, i) => <li key={i}><span className="muted small">{ROLE_LABEL[c.role]}</span><span>{c.title}</span></li>)}
              {!a.committee.length ? <li className="muted">Nobody mapped.</li> : null}
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
            <h2>Stage</h2>
            <ActionForm action={setStage} submitLabel="Save stage" secondary>
              <input type="hidden" name="accountId" value={a.id} />
              <div className="row">
                <div><label htmlFor="stage">Stage</label><select id="stage" name="stage" defaultValue={a.stage}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label htmlFor="revenue">Won revenue ($)</label><input id="revenue" name="revenue" type="number" min="0" defaultValue={a.revenue ?? ""} /></div>
              </div>
            </ActionForm>
          </section>

          <section className="panel">
            <h2>Fit breakdown</h2>
            {(Object.keys(FIT_WEIGHTS) as (keyof FitInputs)[]).map((k) => (
              <div key={k} className="hbar"><span className="small">{FIT_LABEL[k]}</span><span className="track"><i style={{ width: `${a.fit[k] * 100}%` }} /></span><span className="num small">{Math.round(a.fit[k] * FIT_WEIGHTS[k])}/{FIT_WEIGHTS[k]}</span></div>
            ))}
            <span className="muted small">Sources: {a.sources.map((s) => SOURCE_LABEL[s]).join(", ")}</span>
          </section>
        </div>
      </div>
    </>
  );
}
