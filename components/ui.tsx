import type { Tier, ValueBand } from "@/lib/types";

export function TierPill({ tier }: { tier: Tier }) {
  return <span className={`pill tier-${tier}`}>{tier === "Park" ? "Park" : `Tier ${tier}`}</span>;
}

export function ValuePill({ value }: { value: ValueBand }) {
  return <span className={`pill value-${value}`}>{value}</span>;
}

export function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <span className="score" title={`${label} ${value} / 100`}>
      <span className="score-n">{value}</span>
      <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>
    </span>
  );
}

export function PageHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="vhead">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {sub ? <p className="sub">{sub}</p> : null}
    </div>
  );
}

export const FACTORY_LABEL: Record<string, string> = {
  core: "Core database",
  linkedin: "LinkedIn accounts",
  signal: "Signal",
  portfolio: "PE / VC portfolio",
  lookalike: "Closed-won lookalike",
  reactivation: "First-party reactivation",
};

export const STAGE_LABEL: Record<string, string> = {
  universe: "Universe",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Opportunity",
  won: "Closed won",
  lost: "Closed lost",
};
