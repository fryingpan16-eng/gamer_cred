import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { SteamPanel } from './ui/SteamPanel';

type Section = { title: string; description: string };

type ScreenPlaceholderProps = {
  /** Shown beneath the header bar (the screen title itself lives in the header). */
  subtitle?: string;
  sections?: readonly Section[];
  children?: ReactNode;
};

/** Scaffold screen body: lists the panels each route will eventually host. */
export function ScreenPlaceholder({ subtitle, sections = [], children }: ScreenPlaceholderProps) {
  return (
    <ScrollView className="flex-1 bg-steam-dark" contentContainerClassName="gap-3 p-3">
      {subtitle ? <Text className="text-steam-sm text-steam-text-muted">{subtitle}</Text> : null}
      {children}
      {sections.length > 0 ? (
        <View className="gap-3 md:flex-row md:flex-wrap">
          {sections.map((section) => (
            <SteamPanel key={section.title} title={section.title} className="md:min-w-[280px] md:flex-1">
              <Text className="text-steam-base text-steam-text">{section.description}</Text>
            </SteamPanel>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
