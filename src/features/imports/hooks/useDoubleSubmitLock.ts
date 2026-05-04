/**
 * Musanad — synchronous one-shot lock for mutations (F-FE-002).
 *
 * React Query's `mutation.isPending` is asynchronous — a double-submit
 * (Enter pressed twice, double-click) can fire two mutations before the
 * first sets isPending=true. This hook returns a synchronous lock that
 * flips on the first call and stays locked until explicitly released.
 *
 * Usage:
 *   const lock = useDoubleSubmitLock();
 *   const onSubmit = () => {
 *     if (!lock.acquire()) return;       // second press: no-op
 *     mutation.mutate(payload, {
 *       onSettled: () => lock.release(),  // unlock on success or failure
 *     });
 *   };
 *
 * Codex caught this in M1b round 1 — never trust mutation.isPending alone
 * as the gate; always pair it with this synchronous check.
 */

import { useCallback, useRef } from "react";

export interface DoubleSubmitLock {
  acquire: () => boolean;
  release: () => void;
  /** Read-only — true between acquire() and release(). */
  isLocked: () => boolean;
}

export function useDoubleSubmitLock(): DoubleSubmitLock {
  const lockedRef = useRef(false);
  const acquire = useCallback(() => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    return true;
  }, []);
  const release = useCallback(() => {
    lockedRef.current = false;
  }, []);
  const isLocked = useCallback(() => lockedRef.current, []);
  return { acquire, release, isLocked };
}
