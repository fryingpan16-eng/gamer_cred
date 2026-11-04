import { useCallback, useState } from 'react';

import { HUMAN_CHECK_ENABLED } from '@/constants/humanCheck';

/**
 * State for one <HumanCheck>: the current Turnstile token, and `take()` which
 * hands it to a sign-in call and remounts the widget for the next attempt
 * (tokens are single use). With the check off, everything is always ready.
 */
export function useHumanCheck() {
  const [token, setToken] = useState<string | null>(null);
  const [widgetKey, setWidgetKey] = useState(0);
  const onToken = useCallback((t: string | null) => setToken(t), []);

  const take = useCallback((): string | undefined => {
    if (!HUMAN_CHECK_ENABLED) return undefined;
    const t = token ?? undefined;
    setToken(null);
    setWidgetKey((k) => k + 1);
    return t;
  }, [token]);

  return { ready: !HUMAN_CHECK_ENABLED || token !== null, onToken, take, widgetKey };
}
