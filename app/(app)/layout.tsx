import Link from "next/link";
import { signOut } from "@/app/actions";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { deploymentInfo, requireMember } from "@/lib/auth";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const db = await readDb();
  const scored = scoreAll(db.accounts, db.gtms);
  const dest = (d: string) => db.accounts.filter((a) => a.routing?.dest === d).length;
  const pending = db.approvals.filter((a) => a.status === "pending").length;
  const botsIn = db.logins.filter((l) => l.lastSignInAt && db.bots.some((b) => b.id === l.memberId)).length;
  const items: NavItem[] = [
    { href: "/gtms", n: "1", label: "GTMs", hint: "ICPs, plays, policies, knowledge", count: db.gtms.length },
    { href: "/squads", n: "2", label: "Squads", hint: "Your GTMBots, guardrails, command", count: db.bots.length },
    { href: "/connections", n: "3", label: "Connections", hint: "What the squads can reach", count: db.connections.length },
    { href: "/universe", n: "4", label: "Universe", hint: "Accounts, signals, lists, rules", count: db.accounts.length, match: ["/accounts"] },
    { href: "/pods", n: "5", label: "Pods", hint: "SDR, BDR and BC assignment", count: db.pods.length },
    { href: "/tower", n: "6", label: "Control Tower", hint: "Analytics posted by the Analytics squad" },
  ];
  const extra: NavItem[] = [{ href: "/approvals", label: "Approvals", hint: "GTMBot work waiting for a person", count: pending }];
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand">Horizon GTM</Link>
        <span className="org">{db.org.name} · GTM management layer</span>
        <div className="stats">
          <span><b>{db.accounts.length}</b> accounts</span>
          <span><b>{scored.filter((a) => a.tier === "A").length}</b> Tier A</span>
          <span><b>{dest("SDR")}</b> with SDRs</span>
          <span><b>{dest("AI")}</b> AI SDR</span>
          <span><b>{dest("Freezer")}</b> frozen</span>
          <span className={`grok ${botsIn ? "on" : ""}`}><i />{botsIn} of {db.bots.length} GTMBots signed in</span>
          <form action={signOut} className="who">
            <span>{me.name}{me.kind === "bot" ? " · GTMBot" : ""}</span>
            <button type="submit">Sign out</button>
          </form>
          <span className="build-tag">Build {deploymentInfo().commit || "local"}</span>
        </div>
      </header>
      <div className="app">
        <aside className="rail">
          <span className="rail-h">Define → staff → reach → sell → measure</span>
          <NavLinks items={items} />
          <span className="rail-h">Work</span>
          <NavLinks items={extra} />
        </aside>
        <main>
          <div className="view">{children}</div>
        </main>
      </div>
    </>
  );
}
