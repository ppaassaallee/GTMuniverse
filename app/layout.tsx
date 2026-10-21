import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Horizon GTM",
  description: "The GTM management layer your GTMBots and your people work in: GTMs, squads, connections, universe, pods and the Control Tower.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
