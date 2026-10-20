import type { Metadata } from "next";
import Link from "next/link";
import { grokConfigured, GROK_MODEL } from "@/lib/grok";
import { readDb } from "@/lib/store";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boldr",
  description: "The GTM engineering system for B2B teams: account universe, scoring, AI briefs and an expert board, powered by Grok.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = await readDb();
  const live = grokConfigured();
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <div className="app">
          <aside className="rail">
            <Link href="/" className="brand">
              Boldr<small>{db.workspace.company} workspace</small>
            </Link>
            <NavLinks />
            <div className="rail-foot">
              <span className={`dot ${live ? "on" : ""}`} aria-hidden />
              {live ? `Grok connected · ${GROK_MODEL}` : "Grok not connected"}
            </div>
          </aside>
          <main>
            <div className="view">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
