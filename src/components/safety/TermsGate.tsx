import { router } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCModal } from '@/components/ui';
import { TERMS_VERSION } from '@/constants/legal';
import { useAuthStore } from '@/hooks/useAuth';
import { useAcceptTerms, useTermsAccepted } from '@/hooks/useSafety';
import { signOut } from '@/services/auth';

/**
 * Everyone signed in must have accepted the current Terms of Use / Community
 * Guidelines (store requirement for user-generated content). Email sign-ups
 * accept on the Register screen (recorded on first sign-in); Google sign-ups,
 * existing accounts and new terms versions get this one-time prompt.
 */
export function TermsGate() {
  const terms = useTermsAccepted();
  const accept = useAcceptTerms();
  const acceptedAtSignUp = useAuthStore((s) => s.user?.user_metadata?.accepted_terms_version === TERMS_VERSION);

  // Accepted on the Register screen: record it without asking again.
  const autoAccept = terms.data === false && acceptedAtSignUp;
  useEffect(() => {
    if (autoAccept && !accept.isPending && !accept.isSuccess) accept.mutate();
  }, [autoAccept, accept]);

  // Guests are read-only; they agree to the Terms by browsing (noted on the login screen).
  const isGuest = useAuthStore((s) => s.isGuest);
  const show = !isGuest && terms.data === false && !acceptedAtSignUp;
  return (
    <RetroGamingPCModal visible={show} title="Community Guidelines" onClose={() => undefined} dismissOnBackdrop={false}>
      <View className="gap-3">
        {accept.isError ? <RetroGamingPCAlert message={accept.error.message} /> : null}
        <Text className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">
          GamerCred has zero tolerance for objectionable content and abusive users. Hate, harassment, sexual content, threats and spam are
          removed, and accounts that post them can be removed. You can report and block anyone.
        </Text>
        <Text onPress={() => router.push('/terms')} className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright underline">
          Read the Terms of Use & Community Guidelines
        </Text>
        <View className="flex-row flex-wrap justify-end gap-2">
          <RetroGamingPCButton variant="cancel" label="Sign out" onPress={() => void signOut()} disabled={accept.isPending} />
          <RetroGamingPCButton variant="save" label="I Agree" loading={accept.isPending} onPress={() => accept.mutate()} />
        </View>
      </View>
    </RetroGamingPCModal>
  );
}
