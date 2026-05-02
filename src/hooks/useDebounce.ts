/**
 * Musanad — useDebounce hook.
 *
 * Standard 300ms debounce per CLAUDE.md §5 frontend rules. Every search
 * input MUST use this hook (no inline setTimeout). Feature modules that
 * need a different cadence may pass `delay`.
 */

import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
