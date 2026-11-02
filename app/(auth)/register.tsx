import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';

import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { SteamAlert, SteamButton, SteamInput, SteamPanel } from '@/components/ui';
import { steamColors } from '@/constants/theme';
import { useAuthAction } from '@/hooks/useAuthAction';
import { signInWithGoogle, signUpWithEmail } from '@/services/auth';
import { registerSchema, validate, type FieldErrors, type RegisterInput } from '@/utils/authSchemas';

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<RegisterInput>>({});
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);

  const google = useAuthAction(signInWithGoogle);
  const signUp = useAuthAction(signUpWithEmail);
  const busy = google.pending || signUp.pending;
  const formError = google.error ?? signUp.error;

  const submit = async () => {
    const parsed = validate(registerSchema, { username, email, password });
    if (!parsed.ok) {
      setFieldErrors(parsed.errors);
      return;
    }
    setFieldErrors({});
    google.setError(null);
    const result = await signUp.run(parsed.data);
    if (result?.ok && 'needsEmailConfirmation' in result) setConfirmationSentTo(parsed.data.email);
  };

  if (confirmationSentTo) {
    return (
      <View className="flex-1 items-center justify-center bg-steam-dark p-4">
        <SteamPanel title="Confirm your email" className="w-full max-w-[360px]">
          <View className="gap-3">
            <SteamAlert
              tone="info"
              message={`We sent a confirmation link to ${confirmationSentTo}. Open it on this device to finish signing in.`}
            />
            <View className="flex-row justify-end">
              <Link href="/login" className="text-steam-sm text-steam-highlight underline">
                Back to login
              </Link>
            </View>
          </View>
        </SteamPanel>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        className="flex-1 bg-steam-dark"
        contentContainerClassName="flex-grow items-center justify-center p-4"
        keyboardShouldPersistTaps="handled"
      >
        <SteamPanel title="Create a GAMER_CRED account" className="w-full max-w-[360px]">
          <View className="gap-3">
            {formError ? <SteamAlert message={formError} /> : null}

            <GoogleSignInButton
              label="Sign up with Google"
              loading={google.pending}
              disabled={busy}
              onPress={() => {
                signUp.setError(null);
                void google.run();
              }}
            />

            <View className="flex-row items-center gap-2">
              <View className="steam-divider flex-1" />
              <Text className="steam-label">or use email</Text>
              <View className="steam-divider flex-1" />
            </View>

            <SteamInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              error={fieldErrors.username}
              editable={!busy}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              hint="3–24 characters: letters, numbers, underscore"
              icon={<Feather name="user" size={12} color={steamColors.textMuted} />}
            />
            <SteamInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              error={fieldErrors.email}
              editable={!busy}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              icon={<Feather name="mail" size={12} color={steamColors.textMuted} />}
            />
            <SteamInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              error={fieldErrors.password}
              editable={!busy}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              hint="At least 8 characters"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              icon={<Feather name="lock" size={12} color={steamColors.textMuted} />}
            />

            <View className="flex-row items-center justify-between pt-1">
              <Link href="/login" className="text-steam-sm text-steam-highlight underline">
                Have an account?
              </Link>
              <SteamButton
                label={signUp.pending ? 'Creating…' : 'Register'}
                variant="primary"
                loading={signUp.pending}
                disabled={busy}
                onPress={() => void submit()}
              />
            </View>
          </View>
        </SteamPanel>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
