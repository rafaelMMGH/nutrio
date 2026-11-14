import { dropDatabase } from "./database";
import { ownsRunLock, releaseRunLock } from "./run-lock";

export default function globalTeardown() {
  // Only the lock owner drops the database, as a safeguard for the live run's data.
  if (!ownsRunLock()) return;
  try {
    dropDatabase();
  } finally {
    releaseRunLock();
  }
}
