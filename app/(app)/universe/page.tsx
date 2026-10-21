import Link from "next/link";
import { addAccount } from "@/app/actions";
import { AccountTable } from "@/components/AccountTable";
import { ActionForm } from "@/components/ActionForm";
import { UniverseTabs } from "@/components/UniverseTabs";
import { DEST_LABEL, PageHead } from "@/components/ui";
import { listMembers, scoreAll } from "@/lib/routing";
import { prioritize } from "@/lib/scoring";
import { readDb } from "@/lib/store";
import { SOURCE_LABEL } from "@/lib/tower";

type SP = { tier?: string; dest?: string; list?: string; q?: string };

export default async function Universe({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = await readDb();
  const verticals = new Map(db.gtms.flatMap((g) => g.verticals).map((v) => [v.id, v.name]));
  const all = scoreAll(db.accounts, db.gtms);
  let rows = prioritize(all);
  const list = db.lists.find((l) => l.id === sp.list);
  if (list) rows = prioritize(listMembers(list, all));
  if (sp.tier) rows = rows.filter((a) => a.tier === sp.tier);
  if (sp.dest) rows = rows.filter((a) => a.routing?.dest === sp.dest);
  const q = (sp.q || "").trim().toLowerCase();
  if (q) rows = rows.filter((a) => a.name.toLowerCase().includes(q) || a.domain.includes(q) || (verticals.get(a.verticalId || "") || "").toLowerCase().includes(q) || a.state.toLowerCase() === q);
  const link = (patch: Partial<SP>) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/universe?${s}` : "/universe";
  };

  return (
    <>
      <PageHead eyebrow="Stage 4 · Universe" title="Universe" sub={`${db.accounts.length} accounts from ${Object.keys(SOURCE_LABEL).length} sources, scored and routed by rules. Click an account to see why.`}>
        <Link className="btn ghost" href="/universe/rules">Routing rules & dry run</Link>
      </PageHead>
      <UniverseTabs db={db} active="/universe" inbox={all.filter((a) => a.freshestSignalDays != null && a.freshestSignalDays <= 7).length} />

      <div className="actions" style={{ justifyContent: "space-between" }}>
        <div className="actions">
          {["A", "B", "C", "Park"].map((t) => <Link key={t} className={`btn sm ${sp.tier === t ? "" : "ghost"}`} href={link({ tier: sp.tier === t ? undefined : t })}>{t === "Park" ? "Park" : `Tier ${t}`}</Link>)}
          <span className="muted">|</span>
          {(["SDR", "AI", "Hold", "Freezer"] as const).map((d) => <Link key={d} className={`btn sm ${sp.dest === d ? "" : "ghost"}`} href={link({ dest: sp.dest === d ? undefined : d })}>{DEST_LABEL[d]}</Link>)}
          {list ? <Link className="btn sm" href={link({ list: undefined })}>List: {list.name} ✕</Link> : null}
        </div>
        <form action="/universe" style={{ display: "flex", gap: 6 }}>
          {Object.entries(sp).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={sp.q} placeholder="Search name, domain, vertical, state" aria-label="Search the universe" style={{ minWidth: 260 }} />
        </form>
      </div>

      <section className="panel" style={{ padding: 0 }}>
        <div className="panel-h" style={{ padding: "12px 16px 0" }}><span className="small muted"><b>{rows.length}</b> of {db.accounts.length} accounts · sorted by tier, value, signal, fit</span></div>
        <AccountTable rows={rows.slice(0, 150)} pods={db.pods} verticals={verticals} />
      </section>

      <details className="panel">
        <summary><b>Add an account</b> <span className="muted small">It's scored and routed as soon as it lands</span></summary>
        <ActionForm action={addAccount} submitLabel="Add to universe" pendingLabel="Adding…">
          <div className="row">
            <div><label htmlFor="name">Company</label><input id="name" name="name" required /></div>
            <div><label htmlFor="domain">Domain</label><input id="domain" name="domain" required placeholder="example.com" /></div>
            <div><label htmlFor="gtmId">GTM</label><select id="gtmId" name="gtmId">{db.gtms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
            <div><label htmlFor="vertical">Vertical</label><select id="vertical" name="vertical" defaultValue=""><option value="">Unclassified</option>{[...verticals].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
          </div>
          <div className="row">
            <div><label htmlFor="source">Source</label><select id="source" name="source">{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="employees">Employees</label><input id="employees" name="employees" type="number" min="0" /></div>
            <div><label htmlFor="state">State</label><input id="state" name="state" maxLength={2} placeholder="TX" /></div>
            <div><label htmlFor="seats">Est. seats</label><input id="seats" name="seats" type="number" min="0" /></div>
            <div><label htmlFor="fit">Initial fit</label><input id="fit" name="fit" type="number" min="0" max="100" defaultValue="50" /></div>
          </div>
        </ActionForm>
      </details>
    </>
  );
}
