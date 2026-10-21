import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { readDb } from "./store";
import type { Database, Member } from "./types";

// People and Grokbots sign in the same way: one access code each. The code is shown once,
// only its hash is stored, and a session cookie (HMAC-signed) carries who is acting.
// BOLDR_ADMIN_CODE lets the first person in (the Head of GTM) to issue everyone else's codes.

export const COOKIE = "boldr_session";
const MAX_AGE = 60 * 60 * 24 * 14;
/** Shortest admin code accepted. Any longer length is fine. */
export const MIN_CODE_LENGTH = 8;

export const hashCode = (code: string) => createHash("sha256").update(code.trim()).digest("hex");
export const newCode = () => `bdr-${randomBytes(18).toString("base64url")}`;

export function members(db: Pick<Database, "org" | "bots">): Member[] {
  return [
    ...db.org.humans.map((h) => ({ id: h.id, name: h.name, kind: "human" as const, role: h.role })),
    ...db.bots.map((b) => ({ id: b.id, name: b.name, kind: "bot" as const, role: b.role })),
  ];
}

/** BOLDR_ADMIN_CODE as typed into the host's settings, without stray spaces or wrapping quotes. */
function rawAdminCode(): string {
  return (process.env.BOLDR_ADMIN_CODE || "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
}

/** The admin code from the environment. Null when unset or shorter than MIN_CODE_LENGTH. */
export function adminCode(): string | null {
  const code = rawAdminCode();
  return code.length >= MIN_CODE_LENGTH ? code : null;
}

/** Why the admin code can't be used, for the sign-in page. */
export function adminCodeProblem(): string | null {
  const raw = rawAdminCode();
  if (!raw) return "BOLDR_ADMIN_CODE isn't set on the server. Add it in your host's environment settings and redeploy.";
  if (raw.length < MIN_CODE_LENGTH) return `BOLDR_ADMIN_CODE on the server is only ${raw.length} characters; it needs at least ${MIN_CODE_LENGTH}. Make it longer and redeploy.`;
  return null;
}

// A short BOLDR_SECRET would let anyone guess it and forge a session, so it only counts from 32 characters;
// below that the random secret generated into the data store is used instead.
const secret = (db: Database) => ((process.env.BOLDR_SECRET || "").length >= 32 ? process.env.BOLDR_SECRET! : db.secret);
const sign = (db: Database, payload: string) => createHmac("sha256", secret(db)).update(payload).digest("base64url");

/** Which member an access code belongs to, or null. */
export function memberForCode(db: Database, code: string): Member | null {
  const h = hashCode(code);
  const admin = adminCode();
  if (admin && safeEqual(h, hashCode(admin))) return members(db).find((m) => m.id === db.org.humans[0]?.id) || null;
  const login = db.logins.find((l) => safeEqual(l.codeHash, h));
  return login ? members(db).find((m) => m.id === login.memberId) || null : null;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function sessionValue(db: Database, memberId: string, now = Date.now()) {
  const payload = `${memberId}.${now}`;
  return `${payload}.${sign(db, payload)}`;
}

/** Secure cookies whenever the browser reached us over HTTPS, including behind a host's proxy (Render, Vercel, Fly). */
export async function cookieOptions() {
  const h = await headers();
  const https = (h.get("x-forwarded-proto") || "").split(",")[0].trim() === "https";
  return { httpOnly: true, sameSite: "lax" as const, secure: https && process.env.BOLDR_INSECURE_COOKIE !== "1", path: "/", maxAge: MAX_AGE };
}

/** What the sign-in page shows about this deployment, so a failed first sign-in can be diagnosed. */
export function deploymentInfo() {
  const commit = process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || null;
  return { commit: commit ? commit.slice(0, 7) : null, adminCodeLength: rawAdminCode().length };
}

/** The signed-in member, or null. Re-issuing or revoking a code ends that member's older sessions. */
export async function currentMember(): Promise<Member | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [memberId, iat, sig] = raw.split(".");
  if (!memberId || !iat || !sig) return null;
  const db = await readDb();
  if (!safeEqual(sig, sign(db, `${memberId}.${iat}`))) return null;
  if (Date.now() - Number(iat) > MAX_AGE * 1000) return null;
  const login = db.logins.find((l) => l.memberId === memberId);
  const isAdmin = !!adminCode() && memberId === db.org.humans[0]?.id;
  if (!isAdmin && (!login || new Date(login.issuedAt).getTime() > Number(iat))) return null;
  return members(db).find((m) => m.id === memberId) || null;
}

export async function requireMember(): Promise<Member> {
  const m = await currentMember();
  if (!m) redirect("/login");
  return m;
}
