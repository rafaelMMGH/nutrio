import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

// specs/bugs/e2e-run-guard.md: the e2e run lock must admit exactly one run, also when several runs start at the same
// instant and when the lock left by a crashed run is stale. Real child processes take the lock against a temporary
// path (E2E_RUN_LOCK_PATH), so nothing here touches the lock of a real e2e run.
const childScript = path.resolve("tests/unit/run-lock-child.ts");
const DEAD_PID = 2_000_000_000; // above any real pid limit, so process.kill(pid, 0) fails with ESRCH

type Child = { process: ChildProcessWithoutNullStreams; result: Promise<string>; output: () => string };

function withLockDir(run: (lockPath: string, goFile: string) => Promise<void>) {
  const dir = mkdtempSync(path.join(tmpdir(), "run-lock-"));
  return run(path.join(dir, "e2e.lock"), path.join(dir, "go")).finally(() => rmSync(dir, { recursive: true, force: true }));
}

function startChild(lockPath: string, goFile: string): Child {
  const env: NodeJS.ProcessEnv = { ...process.env, E2E_RUN_LOCK_PATH: lockPath };
  delete env.E2E_RUN_LOCK_OWNER;
  const child = spawn(process.execPath, ["--import", "tsx", childScript, goFile], { env });
  let output = "";
  const result = new Promise<string>((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const verdict = output.split("\n").find((line) => line.startsWith("OWNED") || line.startsWith("REFUSED"));
      if (verdict) resolve(verdict);
    });
    child.on("error", reject);
    child.on("exit", () => reject(new Error(`child exited without a verdict: ${output}`)));
  });
  result.catch(() => {});
  return { process: child, result, output: () => output };
}

/** Starts `count` children, releases them all at the same instant and returns their verdicts. */
async function startTogether(lockPath: string, goFile: string, count: number) {
  const children = Array.from({ length: count }, () => startChild(lockPath, goFile));
  await Promise.all(children.map((child) => waitFor(() => child.output().includes("READY"))));
  writeFileSync(goFile, "go");
  const verdicts = await Promise.all(children.map((child) => child.result));
  return { children, verdicts };
}

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 2000 && !condition(); i++) await new Promise((resolve) => setTimeout(resolve, 10));
  assert.ok(condition(), "timed out waiting for a child process");
}

const killAll = (children: Child[]) =>
  children.forEach((child) => {
    child.process.removeAllListeners("exit");
    child.process.kill("SIGKILL");
  });

const owners = (verdicts: string[]) => verdicts.filter((verdict) => verdict.startsWith("OWNED"));

test("a live holder is refused, naming the lock path and the delete hint", () =>
  withLockDir(async (lockPath, goFile) => {
    const { children, verdicts } = await startTogether(lockPath, goFile, 1);
    const second = startChild(lockPath, goFile);
    try {
      assert.deepEqual(verdicts, ["OWNED"]);
      const verdict = await second.result;
      assert.match(verdict, /^REFUSED Another e2e run \(PID \d+/);
      assert.ok(verdict.includes(lockPath), "the message names the lock path");
      assert.match(verdict, /[Dd]elete .* if no Playwright run is active/);
      assert.equal(readFileSync(lockPath, "utf8").split(" ")[0], String(children[0].process.pid), "the live holder keeps the lock");
    } finally {
      killAll([...children, second]);
    }
  }));

for (const [name, content] of [
  ["a dead PID", `${DEAD_PID} 2020-01-01T00:00:00.000Z`],
  ["an empty file", ""],
  ["garbage content", "abc"],
  ["a non-integer PID", "12.5 2020-01-01T00:00:00.000Z"]
] as const) {
  test(`a lock holding ${name} is taken over`, () =>
    withLockDir(async (lockPath, goFile) => {
      writeFileSync(lockPath, content);
      const { children, verdicts } = await startTogether(lockPath, goFile, 1);
      try {
        assert.deepEqual(verdicts, ["OWNED"]);
        assert.equal(readFileSync(lockPath, "utf8").split(" ")[0], String(children[0].process.pid));
      } finally {
        killAll(children);
      }
    }));
}

test("a lock holding the process's own PID is treated as stale", () =>
  withLockDir(async (lockPath, goFile) => {
    const child = startChild(lockPath, goFile);
    await waitFor(() => child.output().includes("READY"));
    writeFileSync(lockPath, `${child.process.pid} 2020-01-01T00:00:00.000Z`);
    writeFileSync(goFile, "go");
    try {
      assert.equal(await child.result, "OWNED");
    } finally {
      killAll([child]);
    }
  }));

test("6 simultaneous starts on a fresh lock give exactly one owner", () =>
  withLockDir(async (lockPath, goFile) => {
    const { children, verdicts } = await startTogether(lockPath, goFile, 6);
    try {
      assert.equal(owners(verdicts).length, 1, verdicts.join("\n"));
    } finally {
      killAll(children);
    }
  }));

test("6 simultaneous starts on a stale lock give exactly one owner", () =>
  withLockDir(async (lockPath, goFile) => {
    // Repeated because the old takeover raced only some of the time.
    for (let round = 0; round < 3; round++) {
      rmSync(goFile, { force: true });
      writeFileSync(lockPath, `${DEAD_PID} 2020-01-01T00:00:00.000Z`);
      const { children, verdicts } = await startTogether(lockPath, goFile, 6);
      try {
        assert.equal(owners(verdicts).length, 1, `round ${round}:\n${verdicts.join("\n")}`);
      } finally {
        killAll(children);
      }
      rmSync(lockPath, { force: true });
    }
  }));

test("a stale lock is not taken over while a fresh reaper file exists, and is once the reaper is gone", () =>
  withLockDir(async (lockPath, goFile) => {
    // Deterministic proof that takeover is serialized through the reaper: a naive unlink-and-retry would ignore it.
    writeFileSync(lockPath, `${DEAD_PID} 2020-01-01T00:00:00.000Z`);
    writeFileSync(`${lockPath}.reaper`, `${DEAD_PID} ${new Date().toISOString()}`);
    const blocked = await startTogether(lockPath, goFile, 1);
    try {
      assert.match(blocked.verdicts[0], /^REFUSED Could not acquire the e2e run lock/);
      assert.equal(readFileSync(lockPath, "utf8").split(" ")[0], String(DEAD_PID), "the stale lock is left untouched");
    } finally {
      killAll(blocked.children);
    }
    rmSync(`${lockPath}.reaper`);
    const retry = startChild(lockPath, goFile);
    try {
      assert.equal(await retry.result, "OWNED");
    } finally {
      killAll([retry]);
    }
  }));

test("the lock is released only by its owner", () =>
  withLockDir(async (lockPath, goFile) => {
    const { children } = await startTogether(lockPath, goFile, 1);
    const previous = process.env.E2E_RUN_LOCK_PATH;
    process.env.E2E_RUN_LOCK_PATH = lockPath;
    try {
      const { releaseRunLock } = await import("../e2e/run-lock");
      releaseRunLock();
      assert.ok(existsSync(lockPath), "a process that does not own the lock cannot release it");
      children[0].process.stdin.write("release\n");
      await waitFor(() => children[0].output().includes("RELEASED"));
      assert.ok(!existsSync(lockPath), "the owner releases its lock");
    } finally {
      if (previous === undefined) delete process.env.E2E_RUN_LOCK_PATH;
      else process.env.E2E_RUN_LOCK_PATH = previous;
      killAll(children);
    }
  }));
