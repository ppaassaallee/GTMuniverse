import Link from "next/link";
import { PageHead } from "@/components/ui";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function Gtms() {
  const db = await readDb();
  const scored = scoreAll(db.accounts, db.gtms);
  return (
    <>
      <PageHead eyebrow="Stage 1 · GTMs" title="Go-to-market motions" sub="Each GTM is a project: who you sell to, why now, what you say, the rules you never break, and the practices you follow. Squads and scores run off it." />
      <div className="grid3">
        {db.gtms.map((g) => {
          const mine = scored.filter((a) => a.gtmId === g.id);
          return (
            <Link key={g.id} href={`/gtms/${g.id}`} className="card">
              <div className="top"><h2>{g.name}</h2><span className={`pill ${g.status === "live" ? "ok" : "warn"}`}>{g.status}</span></div>
              <p className="muted small" style={{ margin: 0 }}>{g.objective}</p>
              <div className="row" style={{ marginTop: 6 }}>
                <span><b className="num">{g.verticals.length}</b> <span className="muted small">ICP verticals</span></span>
                <span><b className="num">{g.plays.length}</b> <span className="muted small">plays</span></span>
                <span><b className="num">{g.sequences.length}</b> <span className="muted small">sequences</span></span>
                <span><b className="num">{g.policies.length}</b> <span className="muted small">policies</span></span>
                <span><b className="num">{mine.length}</b> <span className="muted small">accounts</span></span>
                <span><b className="num">{mine.filter((a) => a.tier === "A").length}</b> <span className="muted small">Tier A</span></span>
              </div>
              <span className="small muted">North star: {g.northStar} · Owner: {g.owner}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
