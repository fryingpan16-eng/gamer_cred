import { useCallback, useRef, useState } from 'react';

import type { AuthResult } from '@/services/auth';

/**
 * Runs one auth action at a time and tracks its pending/error state.
 * Cancelled OAuth flows clear the error instead of showing one.
 */
export function useAuthAction<A extends unknown[], R extends AuthResult>(action: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  const run = useCallback(
    async (...args: A): Promise<R | null> => {
      if (running.current) return null;
      running.current = true;
      setPending(true);
      setError(null);
      try {
        const result = await action(...args);
        if (!result.ok && !result.cancelled) setError(result.error);
        return result;
      } finally {
        running.current = false;
        setPending(false);
      }
    },
    [action],
  );

  return { run, pending, error, setError };
}
