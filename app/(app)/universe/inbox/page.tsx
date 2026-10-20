import { AccountTable } from "@/components/AccountTable";
import { UniverseTabs } from "@/components/UniverseTabs";
import { PageHead } from "@/components/ui";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function Inbox() {
  const db = await readDb();
  const verticals = new Map(db.gtms.flatMap((g) => g.verticals).map((v) => [v.id, v.name]));
  const all = scoreAll(db.accounts, db.gtms);
  const fresh = all.filter((a) => a.freshestSignalDays != null && a.freshestSignalDays <= 7).sort((a, b) => a.freshestSignalDays! - b.freshestSignalDays! || b.signalScore - a.signalScore);
  return (
    <>
      <PageHead eyebrow="Stage 4 · Universe" title="Signal inbox" sub="Accounts with a signal in the last 7 days. Intent is perishable: route these first." />
      <UniverseTabs db={db} active="/universe/inbox" inbox={fresh.length} />
      <section className="panel" style={{ padding: 0 }}><AccountTable rows={fresh} pods={db.pods} verticals={verticals} /></section>
    </>
  );
}
