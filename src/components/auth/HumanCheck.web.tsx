import { useEffect, useRef, type ComponentRef } from 'react';
import { Text, View } from 'react-native';

import { HUMAN_CHECK_ENABLED, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from '@/constants/humanCheck';

import type { HumanCheckProps } from './HumanCheck';

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let scriptPromise: Promise<Turnstile> | null = null;

/** Loads Cloudflare's script once per page. */
function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `${TURNSTILE_SCRIPT}?render=explicit`;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not load')));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Turnstile did not load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Cloudflare Turnstile on the web. Remount with a new `key` after each sign-in attempt. */
export function HumanCheck({ onToken }: HumanCheckProps) {
  const ref = useRef<ComponentRef<typeof View>>(null);

  useEffect(() => {
    if (!HUMAN_CHECK_ENABLED) return;
    let widgetId: string | null = null;
    let cancelled = false;
    void loadTurnstile()
      .then((t) => {
        // On web, a View's ref is its DOM element.
        const el = ref.current as unknown as HTMLElement | null;
        if (cancelled || !el) return;
        widgetId = t.render(el, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token: string) => onToken(token),
          'expired-callback': () => onToken(null),
          'error-callback': () => onToken(null),
        });
      })
      .catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [onToken]);

  if (!HUMAN_CHECK_ENABLED) return null;
  return (
    <View className="items-center gap-1">
      <View ref={ref} style={{ minHeight: 65 }} accessibilityLabel="Human check" />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Quick check that you&apos;re a person.</Text>
    </View>
  );
}
