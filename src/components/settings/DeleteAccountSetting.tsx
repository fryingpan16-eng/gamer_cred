import { useState } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { useDeleteAccount } from '@/hooks/useSafety';
import { showToast } from '@/hooks/useToastStore';

/**
 * In-app account deletion (Apple 5.1.1(v), Google Play User Data policy):
 * permanent, immediate, and confirmed by typing your username.
 */
export function DeleteAccountSetting({ username }: { username: string }) {
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === username.toLowerCase();

  return (
    <View className="gap-2">
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        Permanently delete your GamerCred account and everything in it. This can’t be undone.
      </Text>
      <View className="flex-row">
        <RetroGamingPCButton variant="danger" label="Delete Account" onPress={() => setOpen(true)} />
      </View>
      <RetroGamingPCModal visible={open} title="Delete your account?" onClose={() => (remove.isPending ? undefined : setOpen(false))} dismissOnBackdrop={!remove.isPending}>
        <View className="gap-3">
          {remove.isError ? <RetroGamingPCAlert message={remove.error.message} /> : null}
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text">This permanently deletes, right away:</Text>
          <Text className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text">
            • your profile, username and profile picture{'\n'}• your ratings, reviews and drafts{'\n'}• your lists, Now Playing, Top 4 and platforms{'\n'}• your friends, friend requests and blocks
          </Text>
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            Reports you sent stay with the moderation team without your name. Questions: {SUPPORT_EMAIL}.
          </Text>
          <RetroGamingPCInput
            label={`Type your username (${username}) to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!remove.isPending}
          />
          <View className="flex-row justify-end gap-2">
            <RetroGamingPCButton variant="cancel" label="Keep My Account" disabled={remove.isPending} onPress={() => setOpen(false)} />
            <RetroGamingPCButton
              variant="danger"
              label="Delete Forever"
              disabled={!matches}
              loading={remove.isPending}
              onPress={() =>
                remove.mutate(undefined, {
                  // Signing out sends you to the login screen.
                  onSuccess: () => showToast('Your account and data have been deleted.', 'success'),
                })
              }
            />
          </View>
        </View>
      </RetroGamingPCModal>
    </View>
  );
}
