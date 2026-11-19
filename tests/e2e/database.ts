import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

// The e2e suite never touches the real database. Global setup clones it once into the template "<name>-e2e", then
// creates one database per Playwright worker from that template ("<name>-e2e-<i>", i = parallelIndex). Each worker has
// its own `next dev` on BASE_PORT + i connected to its own database, so spec files run in parallel without sharing
// data. The template is never served: no server connects to it, which CREATE DATABASE ... TEMPLATE requires.
// Teardown drops the worker databases and the template.

export const BASE_PORT = 3200;

/** Number of workers (and so of servers and databases). E2E_WORKERS=1 reproduces the old serial run. */
export function workerCount() {
  const raw = process.env.E2E_WORKERS ?? "3";
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1) throw new Error(`E2E_WORKERS must be a positive integer, got "${raw}"`);
  return count;
}

export const workerPort = (index: number) => BASE_PORT + index;
export const workerBaseUrl = (index: number) => `http://localhost:${workerPort(index)}`;
export const authStatePath = (index: number) => `tests/e2e/.auth/user-${index}.json`;
export const serverLogName = (index: number) => `.server-${index}.log`;

/**
 * The calling worker's parallelIndex (stable 0..workers-1, also after a worker restart; never workerIndex, which grows
 * with every restart). Playwright exports it to every worker process.
 */
export function currentWorkerIndex() {
  const raw = process.env.TEST_PARALLEL_INDEX;
  const index = Number(raw);
  if (raw === undefined || !Number.isInteger(index) || index < 0) throw new Error("TEST_PARALLEL_INDEX is not set: this code must run inside a Playwright worker");
  return index;
}

function sourceUrl() {
  if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.E2E_SOURCE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (.env.local)");
  return new URL(url);
}

function withDatabase(url: URL, name: string) {
  const copy = new URL(url);
  copy.pathname = `/${name}`;
  return copy;
}

const sourceName = () => decodeURIComponent(sourceUrl().pathname.slice(1));
export const templateDatabaseName = () => `${sourceName()}-e2e`;
export const workerDatabaseName = (index: number) => `${templateDatabaseName()}-${index}`;
const databaseUrl = (name: string) => withDatabase(sourceUrl(), name).toString();
export const workerDatabaseUrl = (index: number) => databaseUrl(workerDatabaseName(index));

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

function psql(url: string, args: string[], input?: Buffer) {
  return execFileSync("psql", ["--quiet", "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--dbname", url, ...args], { input, stdio: ["pipe", "pipe", "pipe"] }).toString();
}

const adminUrl = () => databaseUrl("postgres");

/** Fresh copy of the real database (schema and data) as the template, then one copy of the template per worker. */
export function cloneDatabase() {
  const template = templateDatabaseName();
  psql(adminUrl(), ["-c", `DROP DATABASE IF EXISTS ${quote(template)} WITH (FORCE)`, "-c", `CREATE DATABASE ${quote(template)}`]);
  const dump = execFileSync("pg_dump", ["--no-owner", "--dbname", sourceUrl().toString()], { maxBuffer: 512 * 1024 * 1024 });
  psql(databaseUrl(template), [], dump);
  for (let index = 0; index < workerCount(); index++) {
    const name = quote(workerDatabaseName(index));
    psql(adminUrl(), ["-c", `DROP DATABASE IF EXISTS ${name} WITH (FORCE)`, "-c", `CREATE DATABASE ${name} TEMPLATE ${quote(template)}`]);
  }
}

/** Drops every worker database and the template, closing the e2e servers' open connections. */
export function dropDatabase() {
  const names = [...Array.from({ length: workerCount() }, (_, index) => workerDatabaseName(index)), templateDatabaseName()];
  psql(adminUrl(), names.map((name) => ["-c", `DROP DATABASE IF EXISTS ${quote(name)} WITH (FORCE)`]).flat());
}

/** One value (or rows joined by newlines) from the calling worker's database. */
export function sql(query: string) {
  return psql(workerDatabaseUrl(currentWorkerIndex()), ["--tuples-only", "--no-align", "-c", query]).trim();
}
