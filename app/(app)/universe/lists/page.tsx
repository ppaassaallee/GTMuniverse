import Link from "next/link";
import { UniverseTabs } from "@/components/UniverseTabs";
import { PageHead } from "@/components/ui";
import { describeCondition, listMembers, scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function Lists() {
  const db = await readDb();
  const all = scoreAll(db.accounts, db.gtms);
  return (
    <>
      <PageHead eyebrow="Stage 4 · Universe" title="Lists" sub="Smart lists are saved conditions that refresh themselves. Static lists are hand-picked." />
      <UniverseTabs db={db} active="/universe/lists" inbox={all.filter((a) => a.freshestSignalDays != null && a.freshestSignalDays <= 7).length} />
      <div className="grid3">
        {db.lists.map((l) => {
          const members = listMembers(l, all);
          const tierA = members.filter((a) => a.tier === "A").length;
          return (
            <Link key={l.id} href={`/universe?list=${l.id}`} className="card" style={{ borderLeft: `4px solid ${l.color}` }}>
              <div className="top"><h3>{l.name}</h3><span className="pill info">{l.type}</span></div>
              <span className="small">{l.description}</span>
              <div className="actions" style={{ marginTop: 4 }}>
                <span><b className="num" style={{ fontSize: 20 }}>{members.length}</b> <span className="muted small">accounts</span></span>
                <span><b className="num" style={{ fontSize: 20 }}>{tierA}</b> <span className="muted small">Tier A</span></span>
              </div>
              {l.type === "smart" ? <span className="chips">{l.conditions.map((c, i) => <span key={i} className="src">{describeCondition(c)}</span>)}</span> : null}
              <span className="muted small">{l.cadence} · {l.owner}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
