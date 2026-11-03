import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCPanel } from '@/components/ui';
import { useAuthAction } from '@/hooks/useAuthAction';
import { signInWithEmail, signInWithGoogle } from '@/services/auth';
import { loginSchema, validate, type FieldErrors, type LoginInput } from '@/utils/authSchemas';
import { useThemeColors } from '@/hooks/useTheme';

export default function LoginScreen() {
  const themeColors = useThemeColors();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginInput>>({});

  const google = useAuthAction(signInWithGoogle);
  const emailLogin = useAuthAction(signInWithEmail);
  const busy = google.pending || emailLogin.pending;
  const formError = google.error ?? emailLogin.error;

  const submit = () => {
    const parsed = validate(loginSchema, { email, password });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }
    setFieldErrors({});
    google.setError(null);
    // On success the auth listener flips the root guard and redirects to Home.
    void emailLogin.run(parsed.data);
  };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-retrogamingpc-dark"
        contentContainerClassName="flex-grow items-center justify-center p-4"
        keyboardShouldPersistTaps="handled"
      >
        <RetroGamingPCPanel title="Sign in to GAMER_CRED" className="w-full max-w-[360px]">
          <View className="gap-3">
            {formError ? <RetroGamingPCAlert message={formError} /> : null}

            <GoogleSignInButton
              loading={google.pending}
              disabled={busy}
              onPress={() => {
                emailLogin.setError(null);
                void google.run();
              }}
            />

            <View className="flex-row items-center gap-2">
              <View className="retrogamingpc-divider flex-1" />
              <Text className="retrogamingpc-label">or use email</Text>
              <View className="retrogamingpc-divider flex-1" />
            </View>

            <RetroGamingPCInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              editable={!busy}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              icon={<Feather name="mail" size={12} color={themeColors.textMuted} />}
            />
            <RetroGamingPCInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              editable={!busy}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
              icon={<Feather name="lock" size={12} color={themeColors.textMuted} />}
            />

            <View className="flex-row items-center justify-between pt-1">
              <Link href="/register" className="text-retrogamingpc-sm text-retrogamingpc-text-bright underline">
                Create account
              </Link>
              <RetroGamingPCButton variant="save"
                label={emailLogin.pending ? 'Signing in…' : 'Login'}
                loading={emailLogin.pending}
                disabled={busy}
                onPress={submit}
              />
            </View>
          </View>
        </RetroGamingPCPanel>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
