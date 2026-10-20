import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { seedDatabase } from "./seed/solvo";
import type { Database } from "./types";

// A single JSON file per deployment. Good for the prototype and a single server; swap for Postgres
// (one table per collection, keyed the same way) before running several instances or tenants.

const DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DIR, "db.json");

let loading: Promise<Database> | null = null;
let queue: Promise<unknown> = Promise.resolve();

/** Loads once per process; concurrent first requests share the same load (and seed). */
export function readDb(): Promise<Database> {
  loading ??= (async () => {
    try {
      const db = JSON.parse(await fs.readFile(FILE, "utf8")) as Database;
      if (db.version === 2) return db;
    } catch {}
    const db = seedDatabase();
    await persist(db);
    return db;
  })();
  return loading;
}

async function persist(db: Database) {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db));
  await fs.rename(tmp, FILE);
}

/** Serialised read-modify-write so concurrent requests don't overwrite each other. */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const db = await readDb();
    const out = await fn(db);
    await persist(db);
    return out;
  });
  queue = run.catch(() => undefined);
  return run;
}

export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
