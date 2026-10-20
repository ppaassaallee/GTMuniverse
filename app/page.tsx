import Link from "next/link";
import { ago, money, PageHead } from "@/components/ui";
import { grokConfigured } from "@/lib/grok";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function Home() {
  const db = await readDb();
  const scored = scoreAll(db.accounts, db.gtms);
  const pending = db.approvals.filter((a) => a.status === "pending");
  const connected = db.connections.filter((c) => c.status === "connected").length;
  const withPods = db.accounts.filter((a) => a.routing?.podId).length;
  const t = db.tower?.metrics;
  const stages = [
    { href: "/gtms", n: "1", name: "GTMs", big: db.gtms.length, small: `${db.gtms.filter((g) => g.status === "live").length} live · ${db.gtms.reduce((s, g) => s + g.plays.length, 0)} plays · ${db.gtms.reduce((s, g) => s + g.policies.length, 0)} policies` },
    { href: "/squads", n: "2", name: "Squads", big: db.bots.length, small: `${db.squads.length} squads · ${db.guardrails.length} guardrails` },
    { href: "/connections", n: "3", name: "Connections", big: `${connected}/${db.connections.length}`, small: "connected" },
    { href: "/universe", n: "4", name: "Universe", big: db.accounts.length, small: `${scored.filter((a) => a.tier === "A").length} Tier A · ${db.lists.length} lists · ${db.rules.filter((r) => r.on).length} rules` },
    { href: "/pods", n: "5", name: "Pods", big: withPods, small: `accounts with ${db.pods.length} human pods` },
    { href: "/tower", n: "6", name: "Control Tower", big: t?.revenuePer100Mqls != null ? money(t.revenuePer100Mqls) : "–", small: "revenue per 100 MQLs" },
  ];
  return (
    <>
      <PageHead eyebrow={`${db.org.name} on Boldr`} title="Your GTM operating system" sub="Define how you go to market, let squads of Grokbots do the work under guardrails, keep one universe of accounts, hand the right ones to your people, and measure what it produces." />
      {!grokConfigured() ? <p className="notice">Grok isn't connected, so the squads can't run yet. Add XAI_API_KEY on the server. Everything else works.</p> : null}

      <div className="flow" aria-label="The six stages">
        {stages.map((s, i) => (
          <span key={s.href} style={{ display: "contents" }}>
            {i ? <span className="arrow" aria-hidden>→</span> : null}
            <Link className="step" href={s.href}>
              <span className="label" style={{ margin: 0 }}>{s.n} · {s.name}</span>
              <span className="n">{s.big}</span>
              <small>{s.small}</small>
            </Link>
          </span>
        ))}
      </div>

      <div className="grid2">
        <section className="panel">
          <div className="panel-h"><h2>Waiting for you</h2><Link href="/approvals" className="small">All approvals</Link></div>
          {pending.length ? (
            <ul className="list">
              {pending.slice(0, 6).map((p) => (
                <li key={p.id}><b>{p.action.summary}</b><span className="muted small">{db.bots.find((b) => b.id === p.botId)?.name} → {p.approver} · {ago(p.createdAt)}</span></li>
              ))}
            </ul>
          ) : <p className="muted">Nothing pending. When a bot needs sign-off, it lands here.</p>}
        </section>
        <section className="panel">
          <div className="panel-h"><h2>Squad activity</h2><Link href="/squads" className="small">Squads</Link></div>
          <ul className="list feed">
            {db.activity.slice(0, 8).map((a) => (
              <li key={a.id}><span className={`kind kind-${a.kind}`}>{a.kind}</span><span><b>{a.actor}</b> {a.text} <span className="muted small">· {ago(a.at)}</span></span></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
