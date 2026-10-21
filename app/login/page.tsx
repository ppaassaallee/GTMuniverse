import { redirect } from "next/navigation";
import { signIn } from "@/app/actions";
import { ActionForm } from "@/components/ActionForm";
import { adminCodeProblem, currentMember, deploymentInfo } from "@/lib/auth";
import { readDb } from "@/lib/store";

export default async function Login() {
  if (await currentMember()) redirect("/");
  const db = await readDb();
  const firstRun = !db.logins.length;
  const problem = adminCodeProblem();
  const info = deploymentInfo();
  return (
    <div className="login">
      <span className="build-tag build-corner">Build {info.commit || "local"}</span>
      <section className="panel">
        <span className="label" style={{ margin: 0 }}>{db.org.name} · Boldr</span>
        <h1>Sign in</h1>
        <p className="muted small" style={{ margin: 0 }}>People and Grokbots sign in the same way, with their own access code. Everything a Grokbot changes passes the guardrails and is logged under its name.</p>
        <ActionForm action={signIn} submitLabel="Sign in" pendingLabel="Signing in…">
          <div><label htmlFor="code">Access code</label><input id="code" name="code" type="text" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} required autoFocus /></div>
        </ActionForm>
        {firstRun && problem ? <p className="notice small" style={{ margin: 0 }}><b>Setup:</b> {problem}</p> : null}
        {firstRun && !problem ? <p className="notice small" style={{ margin: 0 }}>First time? {db.org.humans[0]?.name} signs in with the admin code set as <span className="code">BOLDR_ADMIN_CODE</span> on the server (any length, at least 8 characters), then issues codes for people and Grokbots from Squads.</p> : null}
      </section>
    </div>
  );
}
