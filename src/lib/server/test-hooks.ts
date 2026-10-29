/** Test-only request hooks (plan D4). */
export type TestHooks = {
  /** `x-e2e-today: YYYY-MM-DD`: the day the server treats as today. */
  today?: string;
  /** `x-e2e-fail: chat`: the answer builder throws. */
  fail?: true;
  /** `x-e2e-trace: 1`: the response carries the resolution trace. */
  trace: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(value: string) {
  return DAY.test(value) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

/**
 * Reads the e2e hook headers. They are honored only when `E2E_HOOKS` is "1" and `NODE_ENV` is not "production";
 * otherwise (and for any malformed value) they are ignored, so production can never pin a date or force a failure.
 * Routes read these headers only through this function.
 */
export function testHooks(headers: Headers, env: Record<string, string | undefined>): TestHooks {
  if (env.E2E_HOOKS !== "1" || env.NODE_ENV === "production") return { trace: false };
  const today = headers.get("x-e2e-today")?.trim();
  return {
    ...(today && isRealDay(today) ? { today } : {}),
    ...(headers.get("x-e2e-fail") === "chat" ? { fail: true as const } : {}),
    trace: headers.get("x-e2e-trace") === "1"
  };
}
