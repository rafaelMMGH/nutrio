/**
 * After a navigation focus may sit on the main region while the destination's heading is still streaming in. It may
 * move on to the heading only if the user has not moved it elsewhere in the meantime: focus still on the body (the
 * clicked link unmounted) or on the main region itself (our own fallback).
 */
export function mayUpgradeFocus(active: unknown, body: unknown, main: unknown): boolean {
  return active === null || active === body || active === main;
}
