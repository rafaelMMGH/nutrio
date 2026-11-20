// Exports the real database into the deterministic e2e seed: one JSON file per table under
// tests/e2e/fixtures/seed/, plus manifest.json (table order, capture date). Run it once, review the
// anonymization report, then commit the folder. Re-run it only when you want fresher data.
//
// Usage: npm run e2e:snapshot [-- --names "Extra Name,Another"]
//
// - Reads DATABASE_URL (from .env.local via the npm script). Read-only: it never writes to the database.
// - Rows keep their seq values, so the app's insertion order is reproduced exactly.
// - Rows are exported as Postgres JSON text (json_agg) and never re-serialized by JavaScript, so the key
//   order of json columns (macros, equivalents) is preserved.
// - Sessions are not exported (auth.setup signs in on every run).
// - Anonymization: the user's name and email, and person names found in uploaded PDF file names, are
//   replaced everywhere (all tables, json columns included). The run fails if any of them survives.
//   Add names it cannot infer with --names.

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const OUT_DIR = path.join("tests", "e2e", "fixtures", "seed");
const SKIP_TABLES = new Set(["_prisma_migrations", "sessions"]);
const DEMO_NAME = "Usuario Demo";
const DEMO_EMAIL = "demo@example.com";
// Words in plan PDF file names that are not person names.
const FILE_NAME_STOPWORDS = new Set(
  ["plan", "planes", "alimentacion", "alimentación", "nutricional", "nutricion", "nutrición", "dieta", "menu", "menú", "pdf", "de", "del", "la", "el", "los", "las", "y", "semana", "copia", "final", "nuevo", "nueva"].map(fold)
);

type Table = { name: string; file: string; rows: number };

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (run through `npm run e2e:snapshot`, which loads .env.local)");
const extraNames = argValue("--names")?.split(",").map((n) => n.trim()).filter(Boolean) ?? [];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("SET TIME ZONE 'UTC'");
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");

  const order = await tablesInDependencyOrder();
  const texts = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const table of order) {
    const hasSeq = await hasColumn(table, "seq");
    const orderBy = hasSeq ? "t.seq" : "1";
    const { rows } = await client.query(
      `SELECT coalesce(json_agg(t ORDER BY ${orderBy}), '[]')::text AS rows, count(*)::int AS n FROM ${ident(table)} t`
    );
    texts.set(table, rows[0].rows);
    counts.set(table, rows[0].n);
  }

  // Personal data to replace.
  const users = await client.query<{ name: string; email: string }>("SELECT name, email FROM users ORDER BY seq");
  const pdfs = (await hasTable("uploaded_pdfs"))
    ? (await client.query<{ file_name: string }>("SELECT file_name FROM uploaded_pdfs")).rows.map((r) => r.file_name)
    : [];
  // Each user gets its own demo identity (the first, the account the app signs into, gets the plain one).
  const demoName = (i: number) => (i === 0 ? DEMO_NAME : `${DEMO_NAME} ${i + 1}`);
  const demoEmail = (i: number) => (i === 0 ? DEMO_EMAIL : DEMO_EMAIL.replace("@", `${i + 1}@`));
  const emails = users.rows.map((u) => u.email).filter(Boolean);
  const fullNames = users.rows.map((u) => u.name).filter(Boolean);
  const nameWords = new Set<string>();
  for (const n of [...fullNames, ...extraNames]) for (const w of words(n)) nameWords.add(w);
  for (const file of pdfs) {
    const stem = file.replace(/\.[a-z0-9]+$/i, "");
    for (const w of words(stem)) if (!FILE_NAME_STOPWORDS.has(fold(w))) nameWords.add(w);
  }

  const report = new Map<string, number>();
  const anonymize = (text: string) => {
    let out = text;
    users.rows.forEach((u, i) => {
      if (u.email) out = replaceCounting(out, new RegExp(escapeRe(jsonEscape(u.email)), "gi"), demoEmail(i), `email ${u.email}`, report);
    });
    users.rows.forEach((u, i) => {
      if (u.name) out = replaceCounting(out, wholeWord(u.name), (m) => caseLike(m, demoName(i)), `name "${u.name}"`, report);
    });
    for (const word of nameWords) out = replaceCounting(out, wholeWord(word), (m) => caseLike(m, "Demo"), `word "${word}"`, report);
    // "Demo Demo Demo" left by a multi-word name becomes one "Demo".
    out = out.replace(/\b(DEMO|Demo|demo)(?:[ _-]+(?:DEMO|Demo|demo)\b)+/g, "$1");
    return out;
  };

  for (const [table, text] of texts) texts.set(table, anonymize(text));

  // Fail if anything personal survived.
  const leftovers: string[] = [];
  for (const [table, text] of texts) {
    for (const email of emails) if (new RegExp(escapeRe(email), "i").test(text)) leftovers.push(`${table}: email ${email}`);
    for (const word of nameWords) if (wholeWord(word).test(text)) leftovers.push(`${table}: "${word}"`);
    const otherEmails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g)?.filter((e) => !/@(local|example\.(com|org))$/i.test(e)) ?? [];
    for (const e of new Set(otherEmails)) leftovers.push(`${table}: other email-like text "${e}" (review it)`);
  }

  const capturedOn = localDate(new Date());
  const tables: Table[] = order.map((name, i) => ({ name, file: `${String(i + 1).padStart(2, "0")}-${name}.json`, rows: counts.get(name) ?? 0 }));

  if (leftovers.some((l) => !l.includes("(review it)"))) {
    console.error("Anonymization failed, nothing was written:\n  " + leftovers.join("\n  "));
    process.exitCode = 1;
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const f of readdirSync(OUT_DIR)) if (f.endsWith(".json")) rmSync(path.join(OUT_DIR, f));
    for (const t of tables) writeFileSync(path.join(OUT_DIR, t.file), texts.get(t.name)! + "\n");
    const manifest = {
      format: 1,
      captured_on: capturedOn,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      note: "Generated by scripts/e2e-snapshot.ts. Loaded by scripts/seed-e2e.ts. Dates are shifted at load time so they keep their distance to today.",
      tables
    };
    writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

    console.log(`Snapshot written to ${OUT_DIR} (captured_on ${capturedOn}):`);
    for (const t of tables) console.log(`  ${t.file.padEnd(32)} ${String(t.rows).padStart(6)} rows`);
    console.log("Anonymization (replacements):");
    for (const [what, n] of report) console.log(`  ${what}: ${n}`);
    if (!report.size) console.log("  none needed");
    for (const l of leftovers) console.log(`  REVIEW ${l}`);
    console.log("Review a few files, then commit tests/e2e/fixtures/seed/.");
  }
  await client.query("COMMIT");
} finally {
  await client.end();
}

// ---------------------------------------------------------------------------------------------

async function tablesInDependencyOrder(): Promise<string[]> {
  const { rows: tables } = await client.query<{ name: string }>(
    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  const names = tables.map((t) => t.name).filter((n) => !SKIP_TABLES.has(n));
  const { rows: fks } = await client.query<{ child: string; parent: string }>(
    `SELECT DISTINCT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
       FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE c.contype = 'f' AND n.nspname = 'public'`
  );
  const clean = (n: string) => n.replace(/^"|"$/g, "");
  const parents = new Map(names.map((n) => [n, new Set<string>()]));
  for (const fk of fks) {
    const child = clean(fk.child);
    const parent = clean(fk.parent);
    if (child !== parent && parents.has(child) && parents.has(parent)) parents.get(child)!.add(parent);
  }
  const ordered: string[] = [];
  const done = new Set<string>();
  while (ordered.length < names.length) {
    const ready = names.filter((n) => !done.has(n) && [...parents.get(n)!].every((p) => done.has(p)));
    if (!ready.length) throw new Error("Foreign keys form a cycle; cannot order the tables");
    for (const n of ready) {
      ordered.push(n);
      done.add(n);
    }
  }
  return ordered;
}

async function hasColumn(table: string, column: string) {
  const { rowCount } = await client.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
    [table, column]
  );
  return (rowCount ?? 0) > 0;
}

async function hasTable(table: string) {
  const { rowCount } = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1", [table]);
  return (rowCount ?? 0) > 0;
}

function words(text: string) {
  return (text.match(/\p{L}{3,}/gu) ?? []).filter((w) => !/^\p{Ll}+$/u.test(w) || w.length > 3);
}

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Whole-word, case-insensitive, accent-insensitive regex for a word or phrase. */
function wholeWord(phrase: string) {
  const accents: Record<string, string> = { a: "aáàä", e: "eéèë", i: "iíìï", o: "oóòö", u: "uúùü", n: "nñ" };
  const body = [...fold(phrase)]
    .map((ch) => (accents[ch] ? `[${accents[ch]}${accents[ch].toUpperCase()}]` : /\s/.test(ch) ? "\\s+" : escapeRe(ch)))
    .join("");
  return new RegExp(`(?<!\\p{L})${body}(?!\\p{L})`, "giu");
}

function replaceCounting(
  text: string,
  re: RegExp,
  replacement: string | ((match: string) => string),
  label: string,
  report: Map<string, number>
) {
  let n = 0;
  const out = text.replace(re, (m) => {
    n++;
    return typeof replacement === "string" ? replacement : replacement(m);
  });
  if (n) report.set(label, (report.get(label) ?? 0) + n);
  return out;
}

function caseLike(sample: string, word: string) {
  const letters = sample.replace(/[^\p{L}]/gu, "");
  if (letters && letters === letters.toUpperCase()) return word.toUpperCase();
  if (letters && letters === letters.toLowerCase()) return word.toLowerCase();
  return word;
}

function jsonEscape(s: string) {
  return JSON.stringify(s).slice(1, -1);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ident(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function localDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function argValue(flag: string) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
