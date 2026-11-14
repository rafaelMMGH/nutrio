import { linkSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// One e2e run at a time: the suite owns port 3200, test-results/ and the "<name>-e2e" database (cloned in setup,
// dropped in teardown), so a second run would corrupt the first. The lock file holds "<pid> <ISO start time>".
// Resolved from this file, not the cwd. E2E_RUN_LOCK_PATH overrides it so unit tests never touch the real lock.
const defaultLockPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".e2e-run.lock");
export const lockPath = () => process.env.E2E_RUN_LOCK_PATH ?? defaultLockPath;

// Playwright re-loads the config in every worker process. The main process exports its PID here when it takes the
// lock, workers inherit it and so know they must neither abort nor re-acquire.
const OWNER_ENV = "E2E_RUN_LOCK_OWNER";

// Taking over a stale lock is serialized through a second lock file (the "reaper"), so a process can only delete the
// lock after re-reading it under mutual exclusion. Unlinking or renaming without it lets a slow process delete a
// live lock that a faster one just created over the stale one.
const reaperPath = () => `${lockPath()}.reaper`;
const REAPER_STALE_MS = 10_000;
const MAX_ATTEMPTS = 100;

type LockState =
  | { kind: "missing" }
  | { kind: "unreadable"; raw: string }
  | { kind: "held"; raw: string; pid: number; startedAt: string };

function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function readLock(): LockState {
  let raw: string;
  try {
    raw = readFileSync(lockPath(), "utf8");
  } catch (error) {
    if (isMissing(error)) return { kind: "missing" };
    throw error;
  }
  const [pidText, startedAt] = raw.trim().split(" ");
  const pid = Number(pidText);
  return pidText && Number.isInteger(pid) && pid > 0 ? { kind: "held", raw, pid, startedAt } : { kind: "unreadable", raw };
}

function isAlive(pid: number) {
  if (pid === process.pid) return false; // a lock carrying our own PID is a leftover (PID reuse), never a live run
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM means the process exists but belongs to someone else: still alive.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function sleep(ms: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** Creates `target` already filled in (temp file, then link): a half-written file can never be observed. */
function tryCreate(target: string) {
  const temp = `${target}.${process.pid}.tmp`;
  writeFileSync(temp, `${process.pid} ${new Date().toISOString()}`);
  try {
    linkSync(temp, target); // fails with EEXIST if someone else holds it
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    unlinkSync(temp);
  }
}

function unlinkIfPresent(file: string) {
  try {
    unlinkSync(file);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}

/** Deletes the lock if it still holds exactly what `seen` showed and that holder is dead; otherwise leaves it. */
function reapStale(seen: Exclude<LockState, { kind: "missing" }>) {
  if (!tryCreate(reaperPath())) {
    // Another process is reaping. A crashed reaper would block everyone forever, so an old reaper file is discarded.
    try {
      if (Date.now() - statSync(reaperPath()).mtimeMs > REAPER_STALE_MS) unlinkIfPresent(reaperPath());
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    sleep(10);
    return;
  }
  try {
    const current = readLock();
    if (current.kind === "missing" || current.raw !== seen.raw) return; // someone else already took over
    if (current.kind === "held" && isAlive(current.pid)) return;
    const what = current.kind === "held" ? `dead PID ${current.pid} (started ${current.startedAt})` : "an unreadable lock";
    console.warn(`Removing stale e2e lock: ${what}.`);
    unlinkIfPresent(lockPath());
  } finally {
    unlinkIfPresent(reaperPath());
  }
}

/**
 * Called from playwright.config.ts, i.e. before Playwright clears test-results/ and before the web server and
 * global setup run, so a refused second run cannot disturb the first one. Takes the lock once, in the main
 * process; throws if a live run holds it; clears it first when its owner is dead.
 */
export function acquireRunLock() {
  if (process.env[OWNER_ENV]) return;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (tryCreate(lockPath())) {
      process.env[OWNER_ENV] = String(process.pid);
      return;
    }
    const state = readLock();
    if (state.kind === "missing") continue; // released between our create and our read: just try again
    if (state.kind === "held" && isAlive(state.pid)) {
      throw new Error(
        `Another e2e run (PID ${state.pid}, started ${state.startedAt}) is using port 3200, test-results/ and the e2e database; wait for it or stop it. ` +
          `Delete ${lockPath()} if no Playwright run is active.`
      );
    }
    reapStale(state);
  }
  throw new Error(`Could not acquire the e2e run lock at ${lockPath()}; another run may have just started. Delete it if no Playwright run is active.`);
}

/** Whether this process holds the lock. */
export function ownsRunLock() {
  const state = readLock();
  return state.kind === "held" && state.pid === process.pid;
}

/** Removes the lock only if this process owns it. */
export function releaseRunLock() {
  if (ownsRunLock()) unlinkIfPresent(lockPath());
}
