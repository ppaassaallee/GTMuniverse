import { AccountTable } from "@/components/AccountTable";
import { UniverseTabs } from "@/components/UniverseTabs";
import { PageHead } from "@/components/ui";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function Freezer() {
  const db = await readDb();
  const verticals = new Map(db.gtms.flatMap((g) => g.verticals).map((v) => [v.id, v.name]));
  const all = scoreAll(db.accounts, db.gtms);
  const frozen = all.filter((a) => a.routing?.dest === "Freezer");
  const reasons = new Map<string, number>();
  for (const a of frozen) reasons.set(a.routing!.reason, (reasons.get(a.routing!.reason) || 0) + 1);
  const max = Math.max(1, ...reasons.values());
  return (
    <>
      <PageHead eyebrow="Stage 4 · Universe" title="Freezer" sub="Frozen accounts are kept, not deleted. Each one carries the condition that thaws it." />
      <UniverseTabs db={db} active="/universe/freezer" inbox={all.filter((a) => a.freshestSignalDays != null && a.freshestSignalDays <= 7).length} />
      <section className="panel">
        <h2>Why accounts are frozen</h2>
        <div style={{ display: "grid", gap: 7 }}>
          {[...reasons].sort((a, b) => b[1] - a[1]).map(([r, n]) => (
            <div key={r} className="hbar"><span>{r}</span><span className="track"><i style={{ width: `${(n / max) * 100}%`, background: "var(--muted)" }} /></span><span className="num">{n}</span></div>
          ))}
        </div>
      </section>
      <section className="panel" style={{ padding: 0 }}><AccountTable rows={frozen} pods={db.pods} verticals={verticals} show="freezer" /></section>
    </>
  );
}
