import Link from "next/link";
import type { Destination, ScoredAccount, Source, Tier, ValueBand } from "@/lib/types";

export function TierPill({ tier }: { tier: Tier }) {
  return <span className={`tier tier-${tier}`} title={tier === "Park" ? "Park" : `Tier ${tier}`}>{tier === "Park" ? "P" : tier}</span>;
}

export function ValuePill({ value }: { value: ValueBand }) {
  return <span className={`pill value-${value}`}>{value}</span>;
}

export const DEST_LABEL: Record<Destination, string> = { SDR: "SDR pod", AI: "AI SDR", Hold: "Hold", Freezer: "Freezer" };

export function DestPill({ dest }: { dest: Destination | undefined }) {
  return <span className={`dest dest-${dest || "none"}`}>{dest ? DEST_LABEL[dest] : "Unrouted"}</span>;
}

export function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <span className="score" title={`${label} ${value} / 100`}>
      <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
      <span className="score-n">{value}</span>
    </span>
  );
}

export function SourceChips({ sources }: { sources: Source[] }) {
  return <span className="chips">{sources.map((s) => <span key={s} className={`src src-${s}`}>{s}</span>)}</span>;
}

const SHORT: Record<string, string> = { hiring_spike: "Hiring", role_hiring: "Role hiring", new_leader: "New leader", pe_event: "PE / VC", expansion: "Expansion", prior_relationship: "Prior" };

export function SignalChips({ a, now = new Date() }: { a: Pick<ScoredAccount, "signals">; now?: Date }) {
  const fresh = a.signals.slice(0, 2);
  if (!fresh.length) return <span className="muted small">No signal</span>;
  return (
    <span className="chips">
      {fresh.map((s, i) => {
        const d = Math.floor((now.getTime() - new Date(s.date).getTime()) / 86_400_000);
        return <span key={i} className={`sig ${d > 30 ? "old" : ""}`}><i />{SHORT[s.typeId] || s.typeId} · {d <= 0 ? "today" : `${d}d`}</span>;
      })}
    </span>
  );
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="vhead">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </div>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { href: string; label: string; count?: number }[]; active: string }) {
  return (
    <nav className="tabs" aria-label="Sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} aria-current={active === t.href ? "page" : undefined}>
          {t.label}{t.count != null ? <span className="count">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export const STAGE_LABEL: Record<string, string> = {
  new: "New", enriching: "Enriching", queued: "Queued", engaged: "Engaged", mql: "MQL", sql: "SQL", opportunity: "Opportunity", won: "Closed won", lost: "Closed lost",
};

export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const ago = (iso: string, now = new Date()) => {
  const m = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
