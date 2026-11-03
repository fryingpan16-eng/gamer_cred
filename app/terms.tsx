import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { RetroGamingPCPanel } from '@/components/ui';
import { SUPPORT_EMAIL, TERMS_SECTIONS, TERMS_VERSION } from '@/constants/legal';

/** Terms of Use + Community Guidelines (public: linked from sign-up and Settings). */
export default function TermsScreen() {
  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[760px]">
      <Stack.Screen options={{ title: 'Terms & Community Guidelines' }} />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Version {TERMS_VERSION}</Text>
      {TERMS_SECTIONS.map((section) => (
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
