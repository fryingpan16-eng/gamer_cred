import { useState } from 'react';
import { Image, Linking, Platform, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAdminStatus, useStartAuthenticatorSetup, useVerifyAdminCode } from '@/hooks/useAdminSecurity';
import type { AuthenticatorSetup } from '@/services/adminSecurity';
import { authCodeSchema, formatSetupKey } from '@/utils/adminSecurity';

/** 6-digit code box + Verify. */
function CodeForm({ factorId, submitLabel, onVerified }: { factorId: string; submitLabel: string; onVerified?: () => void }) {
  const verify = useVerifyAdminCode();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const parsed = authCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the 6-digit code.');
      return;
    }
    setError(null);
    verify.mutate({ factorId, code: parsed.data }, { onSuccess: () => onVerified?.(), onError: (e) => setError(e.message) });
  };

  return (
    <View className="gap-2">
      <RetroGamingPCInput
        label="6-digit code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^\d ]/g, '').slice(0, 7))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        placeholder="123 456"
        maxLength={7}
        error={error ?? undefined}
        editable={!verify.isPending}
        onSubmitEditing={submit}
      />
      <View className="flex-row justify-end">
        <RetroGamingPCButton variant="save" label={submitLabel} loading={verify.isPending} onPress={submit} />
      </View>
    </View>
  );
}

/** First-time setup: add GamerCred to an authenticator app, then confirm with a code. */
function SetupSteps({ setup, onCancel }: { setup: AuthenticatorSetup; onCancel: () => void }) {
  return (
    <View className="gap-3">
      <Text className="retrogamingpc-label">1. Add GamerCred to your authenticator app</Text>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        Any authenticator app works (the one on your phone that shows 6-digit codes).
      </Text>
      {Platform.OS === 'web' ? (
        // The QR code is an SVG: browsers show it; phones use the button or the key instead.
        <View className="self-start bg-white p-2">
          <Image
            source={{ uri: setup.qrCode }}
            style={{ width: 168, height: 168 }}
            accessibilityLabel="QR code to scan with your authenticator app"
          />
        </View>
      ) : (
        <View className="flex-row">
          <RetroGamingPCButton
            variant="navigate"
            label="Open in authenticator app"
            onPress={() => void Linking.openURL(setup.uri).catch(() => undefined)}
          />
        </View>
      )}
      <View className="gap-1">
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Or type this setup key into the app:</Text>
        <Text selectable className="font-mono text-retrogamingpc-base font-bold text-retrogamingpc-text-bright">
          {formatSetupKey(setup.secret)}
        </Text>
      </View>
      <Text className="retrogamingpc-label">2. Enter the code it shows</Text>
      <CodeForm factorId={setup.factorId} submitLabel="Verify & Turn On" />
      <View className="flex-row">
        <RetroGamingPCButton variant="cancel" label="Cancel setup" onPress={onCancel} />
      </View>
    </View>
  );
}

/**
 * Admin two-step sign-in. Admin tools (featuring lists, smart lists, moderation)
 * only work after this sign-in is verified with a code. `compact` drops the
 * explanation, for use as the lock screen on admin pages.
 */
export function AdminSecurityBody({ compact = false }: { compact?: boolean }) {
  const status = useAdminStatus();
  const start = useStartAuthenticatorSetup();
  const [setup, setSetup] = useState<AuthenticatorSetup | null>(null);

  if (status.isPending) return <RetroGamingPCSpinner label="Checking admin security…" />;
  if (status.isError) return <RetroGamingPCAlert message={status.error.message} />;
  const s = status.data;
  if (!s.member) return null;

  if (s.verified) {
    return <RetroGamingPCAlert tone="success" message="Two-step sign-in is on, and admin tools are unlocked for this sign-in." />;
  }

  if (!s.factorId) {
    return (
      <View className="gap-3">
        {compact ? null : (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
            Admin tools need two-step sign-in: a 6-digit code from an authenticator app, so a stolen password alone can’t use them.
          </Text>
        )}
        {setup ? (
          <SetupSteps setup={setup} onCancel={() => setSetup(null)} />
        ) : (
          <>
            {start.isError ? <RetroGamingPCAlert message={start.error.message} /> : null}
            <View className="flex-row">
              <RetroGamingPCButton
                variant="create"
                label="Set Up Two-Step Sign-In"
                loading={start.isPending}
                onPress={() => start.mutate(undefined, { onSuccess: setSetup })}
              />
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        Enter the code from your authenticator app to unlock admin tools. You only need to do this once per sign-in.
      </Text>
      <CodeForm factorId={s.factorId} submitLabel="Unlock Admin Tools" />
      {compact ? null : (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          Lost your phone? The project owner can remove the old authenticator in Supabase → Authentication → Users, then you set up a new
          one here.
        </Text>
      )}
    </View>
  );
}

/** Settings panel, shown to admins only. */
export function AdminSecuritySetting() {
  const status = useAdminStatus();
  if (!status.data?.member) return null;
  return (
    <RetroGamingPCPanel title="Admin Security">
      <AdminSecurityBody />
    </RetroGamingPCPanel>
  );
}
