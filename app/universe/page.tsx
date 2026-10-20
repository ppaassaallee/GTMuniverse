import Link from "next/link";
import { addAccount } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { FACTORY_LABEL, PageHead, ScoreBar, STAGE_LABEL, TierPill, ValuePill } from "@/components/ui";
import { prioritize, scoreAccount } from "@/lib/scoring";
import { readDb } from "@/lib/store";

const TIERS = ["all", "A", "B", "C", "Park"] as const;

export default async function Universe({ searchParams }: { searchParams: Promise<{ tier?: string; q?: string }> }) {
  const { tier = "all", q = "" } = await searchParams;
  const db = await readDb();
  const ws = db.workspace;
  const verticals = new Map(ws.verticals.map((v) => [v.id, v.name]));
  let list = prioritize(db.accounts.map((a) => scoreAccount(a, ws)));
  if (tier !== "all") list = list.filter((a) => a.tier === tier);
  const query = q.trim().toLowerCase();
  if (query) list = list.filter((a) => a.name.toLowerCase().includes(query) || a.domain.includes(query));

  return (
    <>
      <PageHead eyebrow="Account universe" title="One market, deduplicated by domain" sub="Every account from every lead factory, scored on fit, signal and value and sorted into tiers. Change a weight in Workspace and every score updates." />

      <div className="split">
        <section className="panel">
          <div className="actions" style={{ justifyContent: "space-between" }}>
            <nav className="filters" aria-label="Filter by tier" style={{ flexDirection: "row" }}>
              {TIERS.map((t) => (
                <Link key={t} className="chip" aria-current={tier === t ? "true" : undefined} href={t === "all" ? "/universe" : `/universe?tier=${t}`}>
                  {t === "all" ? "All" : t === "Park" ? "Park" : `Tier ${t}`}
                </Link>
              ))}
            </nav>
            <form action="/universe" style={{ display: "flex", gap: 6 }}>
              {tier !== "all" ? <input type="hidden" name="tier" value={tier} /> : null}
              <input name="q" defaultValue={q} placeholder="Search name or domain" aria-label="Search accounts" />
            </form>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Account</th><th>Tier</th><th>Fit</th><th>Signal</th><th>Value</th><th>Stage</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="link-row">
                    <td>
                      <Link className="name" href={`/accounts/${a.id}`}>{a.name}</Link>
                      <div className="muted small">{a.domain} · {verticals.get(a.verticalId || "") || "Unclassified"} · {FACTORY_LABEL[a.factory]}</div>
                    </td>
                    <td><TierPill tier={a.tier} /></td>
                    <td><ScoreBar value={a.fitScore} label="Fit" /></td>
                    <td><ScoreBar value={a.signalScore} label="Signal" /></td>
                    <td><ValuePill value={a.value} /></td>
                    <td className="small">{STAGE_LABEL[a.stage]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.length ? <p className="muted">No accounts match.</p> : null}
        </section>

        <section className="panel">
          <h2>Add an account</h2>
          <ActionForm action={addAccount} submitLabel="Add to universe" pendingLabel="Adding…">
            <div><label htmlFor="name">Company</label><input id="name" name="name" required placeholder="Lakeshore Injury Law" /></div>
            <div><label htmlFor="domain">Domain</label><input id="domain" name="domain" required placeholder="lakeshoreinjury.com" /></div>
            <div className="row">
              <div>
                <label htmlFor="vertical">Vertical</label>
                <select id="vertical" name="vertical" defaultValue="">
                  <option value="">Unclassified</option>
                  {ws.verticals.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="factory">Source</label>
                <select id="factory" name="factory" defaultValue="core">
                  {Object.entries(FACTORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="row">
              <div><label htmlFor="employees">Employees</label><input id="employees" name="employees" type="number" min="0" /></div>
              <div><label htmlFor="seats">Est. seats</label><input id="seats" name="seats" type="number" min="0" /></div>
            </div>
            <div className="row">
              <div><label htmlFor="geography">Geography</label><input id="geography" name="geography" placeholder="IL · WI" /></div>
              <div><label htmlFor="fit">Initial fit (0–100)</label><input id="fit" name="fit" type="number" min="0" max="100" defaultValue="50" /></div>
            </div>
            <div><label htmlFor="notes">Notes</label><textarea id="notes" name="notes" placeholder="Anything the brief should know." /></div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
