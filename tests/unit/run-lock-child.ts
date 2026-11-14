import { existsSync } from "node:fs";
import { acquireRunLock, releaseRunLock } from "../e2e/run-lock";

// Child process for run-lock.test.ts. Waits for the go-file (so several children start at the same instant), tries
// to take the lock, reports OWNED or REFUSED on stdout and, when it owns the lock, stays alive until killed (or
// until it receives "release" on stdin, which releases the lock and exits).
const goFile = process.argv[2];
const sleeper = new Int32Array(new SharedArrayBuffer(4));
console.log("READY");
while (goFile && !existsSync(goFile)) Atomics.wait(sleeper, 0, 0, 1);

try {
  acquireRunLock();
  console.log("OWNED");
  process.stdin.on("data", (chunk) => {
    if (String(chunk).includes("release")) {
      releaseRunLock();
      console.log("RELEASED");
      process.exit(0);
    }
  });
  setInterval(() => {}, 1000);
} catch (error) {
  console.log(`REFUSED ${(error as Error).message.replace(/\n/g, " ")}`);
  process.exit(0);
}
