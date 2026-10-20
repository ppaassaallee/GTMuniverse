import Link from "next/link";
import { DestPill, ScoreBar, SignalChips, SourceChips, STAGE_LABEL, TierPill, ValuePill } from "./ui";
import type { Pod, ScoredAccount } from "@/lib/types";

export function AccountTable({ rows, pods, verticals, show = "routing" }: { rows: ScoredAccount[]; pods: Pod[]; verticals: Map<string, string>; show?: "routing" | "freezer" }) {
  const podName = new Map(pods.map((p) => [p.id, p.name]));
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Account</th><th>Tier</th><th>Fit</th><th>Signals · why now</th><th>Value</th><th>Sources</th><th>Stage</th>
            <th>{show === "freezer" ? "Why frozen · thaws" : "Destination · owner"}</th><th>Buyers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td><Link className="name" href={`/accounts/${a.id}`}>{a.name}</Link><div className="sub-line">{verticals.get(a.verticalId || "") || "Unclassified"} · {a.employees?.toLocaleString("en-US")} employees · {a.state}</div></td>
              <td><TierPill tier={a.tier} /></td>
              <td><ScoreBar value={a.fitScore} label="Fit" /></td>
              <td><SignalChips a={a} /></td>
              <td><ValuePill value={a.value} /></td>
              <td><SourceChips sources={a.sources} /></td>
              <td className="small">{STAGE_LABEL[a.stage]}</td>
              <td>
                <DestPill dest={a.routing?.dest} />
                <div className="sub-line">
                  {show === "freezer"
                    ? `${a.routing?.reason || ""}${a.routing?.thaw ? ` · thaws ${a.routing.thaw}` : ""}`
                    : a.routing?.podId ? `${a.routing.owner} · ${podName.get(a.routing.podId)}` : a.routing?.agent || a.routing?.reason || ""}
                </div>
              </td>
              <td><span className="buyers" title={`${a.committee.length} of 4 committee roles`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < a.committee.length ? "on" : ""} />)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="muted">No accounts match.</p> : null}
    </div>
  );
}
