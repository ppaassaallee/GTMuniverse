import { PageHead } from "@/components/ui";
import { readDb } from "@/lib/store";

const ACCESS = {
  delegated: { label: "Squads act for you", text: "You sign in once and grant scopes; granted bots work inside them." },
  file: { label: "Shared files only", text: "Bots see only the sheets or folders you share with the squad." },
  "human-only": { label: "Human channel", text: "Bots prepare; a person does the action in the tool." },
};

export default async function Connections() {
  const db = await readDb();
  return (
    <>
      <PageHead eyebrow="Stage 3 · Connections" title="What the squads can reach" sub="Every tool the squads work in, how they're allowed to reach it, and which bots hold access. Nothing is reachable until you grant it here." />
      <p className="notice">Prototype: these connectors aren't wired up yet, so every connection shows as not connected and bots that need one are blocked by the guardrails. Wiring them is the next build step, starting with the one you use most.</p>
      <div className="grid3">
        {db.connections.map((c) => {
          const bots = db.bots.filter((b) => b.connections.includes(c.id));
          return (
            <article key={c.id} className="card">
              <div className="top"><h2>{c.name}</h2><span className={`pill ${c.status === "connected" ? "ok" : "no"}`}>{c.status === "connected" ? "connected" : "not connected"}</span></div>
              <span className={`pill ${c.access === "human-only" ? "warn" : "info"}`} style={{ justifySelf: "start" }}>{ACCESS[c.access].label}</span>
              <span className="small">{c.note}</span>
              <span className="muted small">{ACCESS[c.access].text}</span>
              <span className="label" style={{ margin: "6px 0 0" }}>Scopes</span>
              <span className="chips">{c.scopes.map((s) => <span key={s} className="src">{s}</span>)}</span>
              <span className="label" style={{ margin: "6px 0 0" }}>Granted to</span>
              <span className="chips">{bots.length ? bots.map((b) => <span key={b.id} className="pill info">{b.name}</span>) : <span className="muted small">No bot</span>}</span>
            </article>
          );
        })}
      </div>
    </>
  );
}
