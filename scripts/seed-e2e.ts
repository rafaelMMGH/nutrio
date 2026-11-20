// Builds a deterministic e2e database: applies prisma/migrations to an empty database, loads the snapshot in
// tests/e2e/fixtures/seed/ (written by scripts/e2e-snapshot.ts) and shifts every date so it keeps its distance
// to today. Global setup runs it on the e2e template database; you can also run it by hand.
//
// Usage: npm run db:seed:e2e -- <database-url>
//   E2E_SEED_TODAY=YYYY-MM-DD  shift dates as if today were this day (default: today, local time)
//   E2E_SEED_SHIFT=0           keep the snapshot's dates as they are
//
// Safety: the target database name must contain "e2e" (pass --force to override). It must be empty, or already
// migrated with no rows in the seeded tables.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const SEED_DIR = path.join("tests", "e2e", "fixtures", "seed");
const MIGRATIONS_DIR = path.join("prisma", "migrations");

type Manifest = { format: number; captured_on: string; tables: { name: string; file: string; rows: number }[] };

const target = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!target) throw new Error("Usage: npm run db:seed:e2e -- <database-url>");
const dbName = decodeURIComponent(new URL(target).pathname.slice(1));
if (!dbName.includes("e2e") && !process.argv.includes("--force")) {
  throw new Error(`Refusing to seed "${dbName}": the database name must contain "e2e" (or pass --force).`);
}

const manifestPath = path.join(SEED_DIR, "manifest.json");
if (!existsSync(manifestPath)) {
  throw new Error(
    `No e2e seed at ${SEED_DIR}. Create it once with \`npm run e2e:snapshot\` and commit it, ` +
      "or run the suite against a clone of your database with E2E_DATA=clone."
  );
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
if (manifest.format !== 1) throw new Error(`Unsupported seed format ${manifest.format}`);

const client = new pg.Client({ connectionString: target });
await client.connect();
try {
  await client.query("SET TIME ZONE 'UTC'");

  if (!(await tableExists(manifest.tables[0]?.name ?? "users"))) await applyMigrations();

  await client.query("BEGIN");
  const columns = await columnsByTable();
  const days = shiftDays();
  const loaded: string[] = [];
  for (const table of manifest.tables) {
    const tableColumns = columns.get(table.name);
    if (!tableColumns) {
      console.warn(`seed-e2e: table ${table.name} is in the snapshot but not in the schema; skipped`);
      continue;
    }
    // Raw text straight to Postgres: never parsed by JavaScript, so json key order survives.
    const rows = readFileSync(path.join(SEED_DIR, table.file), "utf8");
    const { rows: keyRows } = await client.query<{ key: string }>(
      "SELECT DISTINCT json_object_keys(r) AS key FROM json_array_elements($1::json) r",
      [rows]
    );
    const keys = keyRows.map((k) => k.key);
    const cols = keys.filter((k) => tableColumns.has(k));
    const dropped = keys.filter((k) => !tableColumns.has(k));
    if (dropped.length) console.warn(`seed-e2e: ${table.name}: columns no longer in the schema, skipped: ${dropped.join(", ")}`);
    if (!cols.length) continue;
    const list = cols.map(ident).join(", ");
    // Dates are shifted in the same statement: a later UPDATE could collide with unique (user_id, date) mid-way.
    const values = cols.map((c) => shifted(c, tableColumns.get(c)!, days)).join(", ");
    await client.query(`INSERT INTO ${ident(table.name)} (${list}) SELECT ${values} FROM json_populate_recordset(null::${ident(table.name)}, $1::json)`, [rows]);
    loaded.push(`${table.name} ${table.rows}`);
  }

  await resetSequences();
  await client.query("COMMIT");

  console.log(`seed-e2e: ${dbName} seeded from snapshot ${manifest.captured_on}; dates shifted ${days} day(s); ${loaded.length} tables`);
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}

// ---------------------------------------------------------------------------------------------

async function applyMigrations() {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(MIGRATIONS_DIR, d.name, "migration.sql")))
    .map((d) => d.name)
    .sort();
  for (const dir of dirs) await client.query(readFileSync(path.join(MIGRATIONS_DIR, dir, "migration.sql"), "utf8"));
}

async function tableExists(table: string) {
  const { rowCount } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1", [table]);
  return (rowCount ?? 0) > 0;
}

/** table -> column -> data type */
async function columnsByTable() {
  const { rows } = await client.query<{ table_name: string; column_name: string; data_type: string }>(
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'"
  );
  const map = new Map<string, Map<string, string>>();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Map());
    map.get(r.table_name)!.set(r.column_name, r.data_type);
  }
  return map;
}

/** The column, moved `days` days if it holds a date or a timestamp. */
function shifted(column: string, dataType: string, days: number) {
  if (!days) return ident(column);
  if (dataType === "date") return `${ident(column)} + ${days}`;
  if (dataType.startsWith("timestamp")) return `${ident(column)} + make_interval(days => ${days})`;
  return ident(column);
}

/** Sequences continue after the loaded rows, so rows the tests create sort after the seed (seq order). */
async function resetSequences() {
  const { rows } = await client.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'"
  );
  for (const r of rows) {
    await client.query(
      `SELECT setval(pg_get_serial_sequence($1, $2), coalesce((SELECT max(${ident(r.column_name)}) FROM ${ident(r.table_name)}), 0) + 1, false)`,
      [ident(r.table_name), r.column_name]
    );
  }
}

/** Days between the snapshot's capture date and today (local), so "yesterday" in the snapshot is yesterday now. */
function shiftDays() {
  if (process.env.E2E_SEED_SHIFT === "0") return 0;
  const today = process.env.E2E_SEED_TODAY ?? localDate(new Date());
  return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${manifest.captured_on}T00:00:00Z`)) / 86_400_000);
}

function ident(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
