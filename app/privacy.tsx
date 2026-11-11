import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { RetroGamingPCPanel } from '@/components/ui';
import { PRIVACY_SECTIONS, PRIVACY_VERSION, SUPPORT_EMAIL } from '@/constants/legal';

/** Privacy Policy (public: linked from sign-up, Settings → About and the store listing). */
export default function PrivacyScreen() {
  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[760px]">
      <Stack.Screen options={{ title: 'Privacy Policy' }} />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Effective {PRIVACY_VERSION}</Text>
      {PRIVACY_SECTIONS.map((section) => (
        <RetroGamingPCPanel key={section.title} title={section.title}>
          <View className="gap-2">
            {section.paragraphs.map((p) => (
              <Text key={p} className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">
                {p}
              </Text>
            ))}
          </View>
        </RetroGamingPCPanel>
      ))}
      <Text className="text-center text-retrogamingpc-xs text-retrogamingpc-text-muted">Contact: {SUPPORT_EMAIL}</Text>
    </ScrollView>
  );
}
