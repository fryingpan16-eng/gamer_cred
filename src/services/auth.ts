import { isAuthError } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { TERMS_VERSION } from '@/constants/legal';
import type { LoginInput, RegisterInput } from '@/utils/authSchemas';

import { isSupabaseConfigured, supabase } from './supabase';
import { nameProblemMessage } from '@/utils/nameRules';

export type AuthResult = { ok: true } | { ok: false; cancelled: true; error?: undefined } | { ok: false; cancelled?: false; error: string };

export type SignUpResult = AuthResult | { ok: true; needsEmailConfirmation: true };

/** Route that finishes every OAuth / email-link redirect: app/auth/callback.tsx */
const CALLBACK_PATH = 'auth/callback';

/**
 * Redirect URL registered with Supabase (Auth → URL Configuration → Redirect URLs):
 *   - Web:               https://<origin>/auth/callback
 *   - Dev/standalone:    gamercred://auth/callback        (expo.scheme in app.json)
 *   - Expo Go (dev only): exp://<lan-ip>:8081/--/auth/callback   → allow `exp://**`
 */
export function getAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/${CALLBACK_PATH}`;
  }
  return Linking.createURL(CALLBACK_PATH);
}

// -----------------------------------------------------------------------------
// Error mapping
// -----------------------------------------------------------------------------

const FRIENDLY_ERRORS: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Confirm your email address before signing in.',
  user_already_exists: 'An account with this email already exists.',
  email_exists: 'An account with this email already exists.',
  weak_password: 'That password is too weak.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  over_email_send_rate_limit: 'Too many emails sent. Wait a moment and try again.',
  flow_state_expired: 'Sign-in took too long. Please try again.',
  flow_state_not_found: 'Sign-in session expired. Please try again.',
  bad_code_verifier: 'Sign-in could not be verified. Please try again.',
  captcha_failed: 'The human check didn’t go through. Wait for it to finish, then try again.',
  anonymous_provider_disabled: 'Guest browsing isn’t switched on yet.',
};

export function toAuthErrorMessage(error: unknown): string {
  if (!isSupabaseConfigured) return 'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.';
  if (isAuthError(error)) {
    if (error.code && FRIENDLY_ERRORS[error.code]) return FRIENDLY_ERRORS[error.code]!;
    if (error.name === 'AuthPKCECodeVerifierMissingError') return 'Sign-in must be finished on the device that started it.';
    return error.message;
  }
  if (error instanceof Error) {
    if (/network request failed|failed to fetch/i.test(error.message)) return 'Cannot reach the GAMER_CRED servers. Check your connection.';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

// -----------------------------------------------------------------------------
// OAuth callback handling
// -----------------------------------------------------------------------------

export type OAuthCallbackParams = {
  code?: string;
  sb_flow_id?: string;
  error?: string;
  error_code?: string;
  error_description?: string;
};

/** Extracts callback params from both the query string and the fragment. */
export function parseOAuthCallbackUrl(url: string): OAuthCallbackParams {
  const params: Record<string, string> = {};
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const query = queryIndex === -1 ? '' : url.slice(queryIndex + 1, hashIndex === -1 ? undefined : hashIndex);
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  for (const part of [query, fragment]) {
    new URLSearchParams(part).forEach((value, key) => {
      params[key] = value;
    });
  }
  return params;
}

/**
 * The same authorization code can arrive twice on Android (openAuthSessionAsync
 * result AND an Expo Router deep link to /auth/callback). PKCE codes and
 * verifiers are single-use, so concurrent/duplicate exchanges share one promise.
 */
const inflightExchanges = new Map<string, Promise<AuthResult>>();

export function completeOAuthSignIn(params: OAuthCallbackParams): Promise<AuthResult> {
  if (params.error || params.error_description) {
    return Promise.resolve({
      ok: false,
      error: params.error_description?.replace(/\+/g, ' ') ?? params.error ?? 'Sign-in was rejected.',
    });
  }
  const { code } = params;
  if (!code) return Promise.resolve({ ok: false, error: 'Missing authorization code in sign-in redirect.' });

  const existing = inflightExchanges.get(code);
  if (existing) return existing;

  const exchange = (async (): Promise<AuthResult> => {
    try {
      const { error } = await supabase.auth.exchangeCodeForSession(code, params.sb_flow_id ? { flowId: params.sb_flow_id } : undefined);
      if (error) {
        // A parallel handler may have already won the exchange.
        const { data } = await supabase.auth.getSession();
        return data.session ? { ok: true } : { ok: false, error: toAuthErrorMessage(error) };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toAuthErrorMessage(error) };
    }
  })();

  inflightExchanges.set(code, exchange);
  return exchange;
}

// -----------------------------------------------------------------------------
// Sign-in methods
// -----------------------------------------------------------------------------

/**
 * Google OAuth via Supabase (PKCE).
 *   - Web:    full-page redirect to Google → /auth/callback (exchanged there).
 *   - Native: system auth session (ASWebAuthenticationSession / Custom Tabs),
 *             then exchange the returned code in-process.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: toAuthErrorMessage(null) };

  const redirectTo = getAuthRedirectUrl();
  const isWeb = Platform.OS === 'web';

  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: !isWeb,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) return { ok: false, error: toAuthErrorMessage(error) };
    // Web: the browser is navigating away; the callback route finishes the flow.
    if (isWeb) return { ok: true };
    if (!data.url) return { ok: false, error: 'Could not start Google sign-in.' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') return completeOAuthSignIn(parseOAuthCallbackUrl(result.url));
    // cancel / dismiss / opened (Android may instead deliver the redirect to /auth/callback).
    return { ok: false, cancelled: true };
  } catch (error) {
    return { ok: false, error: toAuthErrorMessage(error) };
  }
}

/** `captchaToken`: the Turnstile token (single use) when the human check is on. */
export async function signInWithEmail({ email, password }: LoginInput, captchaToken?: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: toAuthErrorMessage(null) };
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password, options: { captchaToken } });
    return error ? { ok: false, error: toAuthErrorMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: toAuthErrorMessage(error) };
  }
}

/**
 * Email sign-up. The permanent name travels in user metadata and is claimed by the
 * `handle_new_user` trigger (migrations 000002, 000038), which creates the profile row.
 */
export async function signUpWithEmail({ username, email, password }: RegisterInput, captchaToken?: string): Promise<SignUpResult> {
  if (!isSupabaseConfigured) return { ok: false, error: toAuthErrorMessage(null) };
  try {
    // Every permanent-name rule (migration 000038). If the check can't run, the server
    // still enforces it: a rejected name becomes player_xxxxxx, chosen on first sign-in.
    const { data: problem } = await supabase.rpc('check_name', { p_kind: 'permanent', p_name: username });
    if (problem) return { ok: false, error: nameProblemMessage(problem, 'permanent') };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // accepted_terms_version: the Terms are recorded on first sign-in (TermsGate).
      options: { data: { username, accepted_terms_version: TERMS_VERSION }, emailRedirectTo: getAuthRedirectUrl(), captchaToken },
    });
    if (error) return { ok: false, error: toAuthErrorMessage(error) };
    // With "Confirm email" enabled Supabase returns a user but no session.
    return data.session ? { ok: true } : { ok: true, needsEmailConfirmation: true };
  } catch (error) {
    return { ok: false, error: toAuthErrorMessage(error) };
  }
}

/**
 * Guest browsing (migration 000027): an anonymous, read-only session. No email,
 * no profile; the database refuses every write. Behind the human check.
 */
export async function signInAsGuest(captchaToken?: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) return { ok: false, error: toAuthErrorMessage(null) };
  try {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    return error ? { ok: false, error: toAuthErrorMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: toAuthErrorMessage(error) };
  }
}

export async function signOut(): Promise<AuthResult> {
  try {
    const { error } = await supabase.auth.signOut();
    return error ? { ok: false, error: toAuthErrorMessage(error) } : { ok: true };
  } catch (error) {
    return { ok: false, error: toAuthErrorMessage(error) };
  }
}
