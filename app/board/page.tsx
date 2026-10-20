import Link from "next/link";
import { conveneBoard } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { PageHead } from "@/components/ui";
import { ADVISORS, advisorById } from "@/lib/advisors";
import { grokConfigured } from "@/lib/grok";
import { readDb } from "@/lib/store";

export default async function Board({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const db = await readDb();
  const cur = db.sessions.find((x) => x.id === s) || db.sessions[0];
  const live = grokConfigured();

  return (
    <>
      <PageHead eyebrow="Expert Board" title="Bring a problem to the board" sub="Eight GTM advisors modelled on the frameworks of leading voices on X. Grok answers with your workspace and live pipeline numbers loaded, so the advice is about your business." />

      <div className="split left">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="panel">
            {!live ? <p className="notice">Grok isn't connected yet. Set XAI_API_KEY on the server to convene the board.</p> : null}
            <ActionForm action={conveneBoard} submitLabel="Convene the board" pendingLabel="The board is thinking…">
              <div>
                <label htmlFor="question">Your challenge</label>
                <textarea id="question" name="question" required placeholder="Our MQL to SQL rate in Legal dropped from 31% to 19% this quarter. What do we change?" />
              </div>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="label">Who sits in</legend>
                <div className="seats">
                  {ADVISORS.map((a) => (
                    <label key={a.id} className="seat" title={a.lens} style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--body)", color: "var(--ink)", margin: 0 }}>
                      <input type="checkbox" name="advisor" value={a.id} defaultChecked /> {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            </ActionForm>
          </section>
          {db.sessions.length ? (
            <section className="panel">
              <h2>Past sessions</h2>
              <ul className="list">
                {db.sessions.map((x) => (
                  <li key={x.id}>
                    <Link href={`/board?s=${x.id}`} style={{ fontWeight: x === cur ? 600 : 400 }}>{x.question.length > 90 ? x.question.slice(0, 89) + "…" : x.question}</Link>
                    <span className="muted small">{new Date(x.createdAt).toLocaleDateString("en-US")} · {x.advisorIds.length} advisors · {x.model}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {cur ? (
          <section style={{ display: "grid", gap: 14, minWidth: 0 }}>
            <h2>{cur.question}</h2>
            <div className="synth">
              <span className="label">Combined call</span>
              <p>{cur.synthesis}</p>
              <span className="label">First week</span>
              <ol className="week">{cur.week.map((w, i) => <li key={i}>{w}</li>)}</ol>
            </div>
            <div className="takes">
              {Object.entries(cur.takes).map(([id, t]) => {
                const a = advisorById(id);
                if (!a) return null;
                return (
                  <article key={id} className="take">
                    <div className="actions" style={{ justifyContent: "space-between" }}>
                      <h3>{a.name}</h3>
                      <a className="muted small" href={`https://x.com/${a.handle}`} target="_blank" rel="noopener noreferrer">@{a.handle}</a>
                    </div>
                    <span className="lens">{a.lens}</span>
                    <p className="headline">{t.headline}</p>
                    <ol>{t.moves.map((m, i) => <li key={i}>{m}</li>)}</ol>
                    {t.watch ? <p className="watch">Watch out: {t.watch}</p> : null}
                  </article>
                );
              })}
            </div>
            <p className="muted small">Advice reflects each advisor's published frameworks as interpreted by Grok, not the person's own words.</p>
          </section>
        ) : (
          <section className="panel">
            <h2>No sessions yet</h2>
            <p className="muted">Ask about a real problem: a conversion rate that dropped, a new vertical, pricing, or how to staff a pod. Each advisor gives a stance, three moves and a pitfall, then the board agrees on a first week.</p>
          </section>
        )}
      </div>
    </>
  );
}
