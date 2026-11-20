#!/usr/bin/env node
// Mechanical checks for spec-driven development. No dependencies.
//
// Usage:
//   node scripts/spec-check.mjs <feature>                 spec + tasks checks
//   node scripts/spec-check.mjs <feature> --spec-only     spec checks only
//   node scripts/spec-check.mjs <feature> --tests [--story US1]
//                                                         also: each REQ cited by a test
//   node scripts/spec-check.mjs --all                     every feature in specs/
//
// Tests cite requirements as "<feature>/REQ-<n>" in a test title or comment.
// Exit code 1 when there are errors.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SPECS = join(ROOT, "specs");
const LIMITS = { lite: { reqs: 15, lines: 80 }, full: { reqs: 30, lines: 180 } };
const STATUSES = ["draft", "approved", "planned", "partial", "implemented"];
const TEST_DIRS = ["tests", "src", "e2e", "__tests__"];
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".next-e2e", ".git", "generated", "dist", "build"]);
const HOW_HINTS = [
  [/```/, "code block"],
  [/\b(src|app|lib|components)\/[\w./-]+/, "file path"],
  [/\b(algorithm|formula|schema|endpoint|SQL|Prisma|useState|useEffect|component|localStorage|regex|jsonb?)\b/i, "implementation term"],
];

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const features = flag("--all")
  ? readdirSync(SPECS).filter((d) => !d.startsWith("_") && !["bugs", "refactors"].includes(d) && statSync(join(SPECS, d)).isDirectory())
  : args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--story");

if (!features.length) {
  console.error("Usage: node scripts/spec-check.mjs <feature> [--spec-only] [--tests [--story USn]] | --all");
  process.exit(2);
}

let totalErrors = 0;
let testFilesCache;

for (const feature of features) totalErrors += checkFeature(feature);
process.exit(totalErrors ? 1 : 0);

function checkFeature(feature) {
  const dir = join(SPECS, feature);
  const errors = [];
  const warns = [];
  const specPath = join(dir, "spec.md");
  if (!existsSync(specPath)) {
    console.log(`\n${feature}: ERROR no spec.md at ${relative(ROOT, specPath)}`);
    return 1;
  }

  const spec = readFileSync(specPath, "utf8");
  const specLines = spec.split("\n");
  const lane = (spec.match(/\*\*Lane:\*\*\s*(lite|full)/i)?.[1] ?? "").toLowerCase();
  const status = (spec.match(/\*\*Status:\*\*\s*([a-z]+)/i)?.[1] ?? "").toLowerCase();
  const version = spec.match(/\*\*Version:\*\*\s*([\d.]+)/)?.[1];

  if (!lane) errors.push("spec: missing '**Lane:** lite|full' in the header");
  if (!STATUSES.includes(status)) errors.push(`spec: status '${status || "?"}' is not one of ${STATUSES.join(", ")}`);
  if (version && !/^\d+\.\d+$/.test(version)) errors.push(`spec: version ${version} must be MAJOR.MINOR (no patch level)`);

  // Requirements and stories
  const reqs = new Map(); // id -> { story, removed, line }
  const stories = new Set();
  let story = null;
  specLines.forEach((line, i) => {
    const s = line.match(/^#{2,4}\s+(US\d+)\b/);
    if (s) {
      story = s[1];
      stories.add(story);
    }
    const r = line.match(/\*\*(REQ-\d+)\*?\*?:?/);
    if (r && /^\s*[-*]\s+\*\*REQ-\d+/.test(line)) {
      if (reqs.has(r[1])) errors.push(`spec:${i + 1} duplicate ${r[1]}`);
      reqs.set(r[1], { story, removed: /REMOVED/.test(line), line: i + 1 });
    }
  });
  const active = [...reqs].filter(([, r]) => !r.removed);
  const limit = LIMITS[lane];
  if (limit) {
    if (active.length > limit.reqs) {
      const msg = `spec: ${active.length} requirements, ${lane} limit is ${limit.reqs}; split the feature`;
      // Already-shipped specs are not split retroactively; the limit applies to new or changing work.
      (status === "implemented" ? warns : errors).push(msg);
    }
    if (specLines.length > limit.lines) warns.push(`spec: ${specLines.length} lines, ${lane} budget is about ${limit.lines}`);
  }
  if (!active.length) errors.push("spec: no requirements found (expected '- **REQ-n:** ...' lines)");

  // "How" hints in the spec (warnings: the verifier judges)
  let inChangeLog = false;
  specLines.forEach((line, i) => {
    if (/^##\s+Change log/i.test(line)) inChangeLog = true;
    else if (/^##\s/.test(line)) inChangeLog = false;
    if (inChangeLog || line.startsWith(">")) return;
    for (const [re, label] of HOW_HINTS) {
      if (re.test(line)) {
        warns.push(`spec:${i + 1} possible implementation detail (${label}): ${line.trim().slice(0, 80)}`);
        break;
      }
    }
  });

  // Tasks
  const tasksPath = join(dir, "tasks.md");
  if (!flag("--spec-only")) {
    if (!existsSync(tasksPath)) {
      if (["planned", "partial", "implemented"].includes(status)) errors.push("tasks: missing tasks.md");
    } else {
      checkTasks(readFileSync(tasksPath, "utf8"), { reqs, stories, lane, errors, warns, dir });
    }
  }

  // Tests cite requirements
  if (flag("--tests")) {
    const onlyStory = opt("--story");
    const files = testFiles();
    for (const [id, r] of active) {
      if (onlyStory && r.story !== onlyStory) continue;
      const tag = `${feature}/${id}`;
      const re = new RegExp(`${escapeRe(tag)}(?!\\d)`);
      if (!files.some((f) => re.test(f.text))) errors.push(`tests: ${tag} is not cited by any test (${r.story ?? "no story"})`);
    }
  }

  report(feature, { lane, status, reqCount: active.length, errors, warns });
  return errors.length;
}

function checkTasks(text, { reqs, stories, lane, errors, warns, dir }) {
  const lines = text.split("\n");
  const cited = new Set();
  const ids = new Set();
  let phase = "";
  const parallelFiles = new Map(); // phase -> Map(file -> taskId)

  lines.forEach((line, i) => {
    if (/^##\s/.test(line)) phase = line;
    for (const m of line.matchAll(/REQ-\d+/g)) cited.add(m[0]);

    const t = line.match(/^\s*-\s*\[[ xX]\]\s*(T\d+)\b(.*)$/);
    if (!t) return;
    const [, id, rest] = t;
    if (ids.has(id)) errors.push(`tasks:${i + 1} duplicate task ${id}`);
    ids.add(id);

    const tag = rest.match(/\[(US\d+|setup|found)\]/);
    if (!tag) errors.push(`tasks:${i + 1} ${id} has no [USn], [setup] or [found] tag`);
    else if (tag[1].startsWith("US") && !stories.has(tag[1])) errors.push(`tasks:${i + 1} ${id} references ${tag[1]}, which is not in the spec`);
    if (tag && tag[1].startsWith("US") && !/REQ-\d+/.test(rest)) warns.push(`tasks:${i + 1} ${id} cites no REQ`);

    if (/\[P\]/.test(rest)) {
      const file = rest.match(/\(([^()]+)\)\s*$/)?.[1]?.trim();
      if (!file) warns.push(`tasks:${i + 1} ${id} is [P] but names no file in (path)`);
      else {
        const map = parallelFiles.get(phase) ?? new Map();
        for (const f of file.split(/,\s*/)) {
          if (map.has(f)) errors.push(`tasks:${i + 1} ${id} [P] touches ${f}, also touched by ${map.get(f)} in the same phase`);
          map.set(f, id);
        }
        parallelFiles.set(phase, map);
      }
    }
  });

  for (const r of [...cited]) if (!reqs.has(r)) errors.push(`tasks: cites ${r}, which is not in the spec`);
  for (const [id, r] of reqs) if (!r.removed && !cited.has(id)) errors.push(`tasks: ${id} (${r.story ?? "no story"}) is not covered by any task or outline line`);

  if (lane === "lite" && !/^##\s+Approach/m.test(text)) errors.push("tasks: lite lane needs an '## Approach' section");
  if (lane === "full" && !existsSync(join(dir, "plan.md"))) errors.push("plan: full lane needs plan.md");
  if (!/^##\s+Approvals/m.test(text)) errors.push("tasks: missing '## Approvals' section (write 'none' if none)");
}

function testFiles() {
  if (testFilesCache) return testFilesCache;
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (SKIP_DIRS.has(name)) continue;
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (TEST_FILE.test(name)) out.push({ path: p, text: readFileSync(p, "utf8") });
    }
  };
  for (const d of TEST_DIRS) if (existsSync(join(ROOT, d))) walk(join(ROOT, d));
  return (testFilesCache = out);
}

function report(feature, { lane, status, reqCount, errors, warns }) {
  const limit = LIMITS[lane]?.reqs ?? "?";
  console.log(`\n${feature}  [lane: ${lane || "?"}, status: ${status || "?"}, requirements: ${reqCount}/${limit}]`);
  for (const e of errors) console.log(`  ERROR ${e}`);
  for (const w of warns) console.log(`  WARN  ${w}`);
  console.log(`  => ${errors.length} errors, ${warns.length} warnings`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
