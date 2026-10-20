import Link from "next/link";
import { decideApproval } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { ago, PageHead } from "@/components/ui";
import { ACTION_LABEL } from "@/lib/guardrails";
import { readDb } from "@/lib/store";

export default async function Approvals() {
  const db = await readDb();
  const pending = db.approvals.filter((a) => a.status === "pending");
  const decided = db.approvals.filter((a) => a.status !== "pending").slice(0, 20);
  const bot = (id: string) => db.bots.find((b) => b.id === id);
  const acct = (id?: string | null) => db.accounts.find((a) => a.id === id);

  return (
    <>
      <PageHead eyebrow="Approvals" title="Grokbot work waiting for a person" sub="Anything that leaves the building, changes who works an account, or comes from a Grokbot that needs sign-off stops here. Approving applies the change; approving a send marks it ready for a person to send. Boldr never sends on its own." />
      {pending.length ? (
        <div style={{ display: "grid", gap: 12 }}>
          {pending.map((p) => {
            const a = acct(p.action.accountId);
            const body = p.action.payload && typeof p.action.payload.body === "string" ? p.action.payload : null;
            return (
              <section key={p.id} className="panel">
                <div className="panel-h">
                  <h3>{p.action.summary}</h3>
                  <span className="muted small">{bot(p.botId)?.name} · {ACTION_LABEL[p.action.type]} · {ago(p.createdAt)}</span>
                </div>
                {a ? <span className="small">Account: <Link href={`/accounts/${a.id}`}>{a.name}</Link></span> : null}
                {body ? <div className="email"><b>{String(body.subject || "")}</b>{"\n\n"}{String(body.body)}</div> : null}
                <span className="chips">{p.reasons.map((r, i) => <span key={i} className="pill warn">{r}</span>)}</span>
                <div className="actions">
                  <span className="small muted">Approver: <b>{p.approver}</b></span>
                  <ActionForm action={decideApproval} submitLabel="Approve" pendingLabel="Saving…"><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="approve" /></ActionForm>
                  <ActionForm action={decideApproval} submitLabel="Reject" secondary><input type="hidden" name="approvalId" value={p.id} /><input type="hidden" name="decision" value="reject" /></ActionForm>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel"><p className="muted" style={{ margin: 0 }}>Nothing waiting. When a signed-in Grokbot makes a change that needs sign-off, it lands here.</p></section>
      )}
      {decided.length ? (
        <section className="panel">
          <h2>Decided</h2>
          <ul className="list">
            {decided.map((p) => <li key={p.id}><span><span className={`pill ${p.status === "approved" ? "ok" : "no"}`}>{p.status}</span> {p.action.summary}</span><span className="muted small">{bot(p.botId)?.name} · {p.decidedBy || p.approver} · {p.decidedAt ? ago(p.decidedAt) : ""}</span></li>)}
          </ul>
        </section>
      ) : null}
    </>
  );
}
