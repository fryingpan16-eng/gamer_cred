import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { SteamPanel } from './SteamPanel';

type Section = { title: string; description: string };

type ScreenPlaceholderProps = {
  title: string;
  subtitle?: string;
  sections: readonly Section[];
  children?: ReactNode;
};

/** Phase 1 scaffold screen: lists the panels each route will eventually host. */
export function ScreenPlaceholder({ title, subtitle, sections, children }: ScreenPlaceholderProps) {
  return (
    <ScrollView className="flex-1 bg-steam-dark" contentContainerClassName="p-3 gap-3">
      <View>
        <Text className="text-steam-text-bright text-steam-xl font-bold">{title}</Text>
        {subtitle ? <Text className="text-steam-text-muted text-steam-sm">{subtitle}</Text> : null}
      </View>
      <View className="gap-3 md:flex-row md:flex-wrap">
        {sections.map((section) => (
          <SteamPanel key={section.title} title={section.title} className="md:flex-1 md:min-w-[280px]">
            <Text className="text-steam-text text-steam-base">{section.description}</Text>
          </SteamPanel>
        ))}
      </View>
      {children}
    </ScrollView>
  );
}
