import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCBootScreen } from '@/components/RetroGamingPCBootScreen';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel } from '@/components/ui';
import { completeOAuthSignIn, type OAuthCallbackParams } from '@/services/auth';

/**
 * Landing route for OAuth / email-confirmation redirects:
 *   web:    https://<origin>/auth/callback?code=…&sb_flow_id=…
 *   native: gamercred://auth/callback?code=… (Android may deliver this as a deep link)
 * Exchanges the PKCE code, then hands off to the root guards via "/".
 */
export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<OAuthCallbackParams>();
  const [state, setState] = useState<{ phase: 'working' } | { phase: 'done' } | { phase: 'error'; message: string }>({
    phase: 'working',
  });

  const { code, sb_flow_id, error, error_code, error_description } = params;

  useEffect(() => {
    let active = true;
    void completeOAuthSignIn({ code, sb_flow_id, error, error_code, error_description }).then((result) => {
      if (!active) return;
      if (result.ok) setState({ phase: 'done' });
      else setState({ phase: 'error', message: result.error ?? 'Sign-in was cancelled.' });
    });
    return () => {
      active = false;
    };
  }, [code, sb_flow_id, error, error_code, error_description]);

  if (state.phase === 'done') return <Redirect href="/" />;
  if (state.phase === 'working') return <RetroGamingPCBootScreen label="Completing sign-in…" />;

  return (
    <View className="flex-1 items-center justify-center bg-retrogamingpc-dark p-4">
      <RetroGamingPCPanel title="Sign-in failed" className="w-full max-w-[360px]">
        <View className="gap-3">
          <RetroGamingPCAlert message={state.message} />
          <View className="flex-row justify-end">
            <RetroGamingPCButton variant="navigate" label="Back to login" onPress={() => router.replace('/login')} />
          </View>
        </View>
      </RetroGamingPCPanel>
    </View>
  );
}
