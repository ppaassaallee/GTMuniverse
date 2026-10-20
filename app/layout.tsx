import type { Metadata } from "next";
import Link from "next/link";
import { NavLinks, type NavItem } from "@/components/NavLinks";
import { grokConfigured, GROK_MODEL } from "@/lib/grok";
import { scoreAll } from "@/lib/routing";
import { readDb } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boldr",
  description: "Define your GTMs, run squads of Grokbots under guardrails, manage the universe, assign pods and watch the Control Tower.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = await readDb();
  const live = grokConfigured();
  const scored = scoreAll(db.accounts, db.gtms);
  const dest = (d: string) => db.accounts.filter((a) => a.routing?.dest === d).length;
  const pending = db.approvals.filter((a) => a.status === "pending").length;
  const items: NavItem[] = [
    { href: "/gtms", n: "1", label: "GTMs", hint: "ICPs, plays, policies, sequences", count: db.gtms.length },
    { href: "/squads", n: "2", label: "Squads", hint: "Grokbots, guardrails, command", count: db.bots.length },
    { href: "/connections", n: "3", label: "Connections", hint: "What the squads can reach", count: db.connections.length },
    { href: "/universe", n: "4", label: "Universe", hint: "Accounts, signals, lists, rules", count: db.accounts.length, match: ["/accounts"] },
    { href: "/pods", n: "5", label: "Pods", hint: "SDR, BDR and BC assignment", count: db.pods.length },
    { href: "/tower", n: "6", label: "Control Tower", hint: "Analytics by the Analytics squad" },
  ];
  const extra: NavItem[] = [
    { href: "/approvals", label: "Approvals", hint: "Bot work waiting for a person", count: pending },
    { href: "/board", label: "Expert Board", hint: "Ask eight GTM advisors" },
  ];
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Boldr</Link>
          <span className="org">{db.org.name} · GTM operating system</span>
          <div className="stats">
            <span><b>{db.accounts.length}</b> accounts</span>
            <span><b>{scored.filter((a) => a.tier === "A").length}</b> Tier A</span>
            <span><b>{dest("SDR")}</b> with SDRs</span>
            <span><b>{dest("AI")}</b> AI SDR</span>
            <span><b>{dest("Hold")}</b> hold</span>
            <span><b>{dest("Freezer")}</b> frozen</span>
            <span className={`grok ${live ? "on" : ""}`}><i />{live ? `Grok · ${GROK_MODEL}` : "Grok not connected"}</span>
          </div>
        </header>
        <div className="app">
          <aside className="rail">
            <span className="rail-h">Build → run → sell → measure</span>
            <NavLinks items={items} />
            <span className="rail-h">Work</span>
            <NavLinks items={extra} />
          </aside>
          <main>
            <div className="view">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
