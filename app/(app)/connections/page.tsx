import { setConnectionStatus } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHead } from "@/components/ui";
import { readDb } from "@/lib/store";

const ACCESS = {
  delegated: { label: "Grokbots act for you", text: "Your Grokbots sign in to the tool with the scopes you grant; only granted bots may use it." },
  file: { label: "Shared files only", text: "Bots see only the sheets or folders you share with the squad." },
  "human-only": { label: "Human channel", text: "Bots prepare; a person does the action in the tool." },
};

export default async function Connections() {
  const db = await readDb();
  return (
    <>
      <PageHead eyebrow="Stage 3 · Connections" title="What the squads can reach" sub="Every tool your Grokbots work in, how they may reach it, and which bots hold access. Your Grokbots sign in to these tools themselves; Boldr keeps the record of who is allowed, and the guardrails block any change that relies on a connection a bot wasn't granted or that is switched off here." />
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
              <ActionForm action={setConnectionStatus} submitLabel={c.status === "connected" ? "Switch off" : "Mark as connected"} secondary>
                <input type="hidden" name="connectionId" value={c.id} />
              </ActionForm>
            </article>
          );
        })}
      </div>
    </>
  );
}
