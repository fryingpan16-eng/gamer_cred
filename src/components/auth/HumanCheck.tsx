import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { HUMAN_CHECK_ENABLED, SITE_URL, TURNSTILE_SCRIPT, TURNSTILE_SITE_KEY } from '@/constants/humanCheck';

export type HumanCheckProps = {
  /** A fresh token, or null when it expired / failed (each token works for ONE sign-in call). */
  onToken: (token: string | null) => void;
};

/**
 * Cloudflare Turnstile on phones: the widget runs in a small web view that loads
 * as SITE_URL (one of the widget's allowed hostnames). Remount it with a new
 * `key` after each sign-in attempt to get a new token. Renders nothing when the
 * check isn't configured. (Web uses HumanCheck.web.tsx.)
 */
export function HumanCheck({ onToken }: HumanCheckProps) {
  const html = useMemo(
    () => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style>
<script src="${TURNSTILE_SCRIPT}?onload=start&render=explicit" async defer></script></head>
<body><div id="t"></div><script>
function send(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function start(){turnstile.render('#t',{sitekey:${JSON.stringify(TURNSTILE_SITE_KEY)},theme:'dark',
callback:function(t){send({token:t});},'expired-callback':function(){send({token:null});},
'error-callback':function(){send({token:null});}});}
</script></body></html>`,
    [],
  );

  if (!HUMAN_CHECK_ENABLED) return null;

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { token?: string | null };
      onToken(typeof msg.token === 'string' ? msg.token : null);
    } catch {
      onToken(null);
    }
  };

  return (
    <View className="items-center gap-1">
      <WebView
        source={{ html, baseUrl: SITE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        scrollEnabled={false}
        style={{ width: 304, height: 68, backgroundColor: 'transparent' }}
        accessibilityLabel="Human check"
      />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Quick check that you&apos;re a person.</Text>
    </View>
  );
}
