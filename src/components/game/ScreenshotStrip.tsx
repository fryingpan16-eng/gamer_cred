import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCModal, RetroGamingPCPanel } from '@/components/ui';
import { igdbImageUrl } from '@/types/igdb';

/** Horizontal screenshot reel; tap to view a larger frame. */
export function ScreenshotStrip({ imageIds, gameName }: { imageIds: string[]; gameName: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (imageIds.length === 0) return null;
  const openId = openIndex !== null ? imageIds[openIndex] : undefined;

  return (
    <RetroGamingPCPanel title="Screenshots">
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerClassName="gap-2">
        {imageIds.map((id, index) => (
          <Pressable
            key={id}
            accessibilityRole="imagebutton"
            accessibilityLabel={`${gameName} screenshot ${index + 1}`}
            onPress={() => setOpenIndex(index)}
            className="retrogamingpc-bevel-inset bg-retrogamingpc-dark p-px"
          >
            <Image source={{ uri: igdbImageUrl(id, 'screenshot_med') }} className="h-[108px] w-[192px]" resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <RetroGamingPCModal
        visible={openId !== undefined}
        title={`${gameName} — ${openIndex !== null ? openIndex + 1 : ''}/${imageIds.length}`}
        onClose={() => setOpenIndex(null)}
        className="max-w-[900px]"
        footer={
          <>
            <RetroGamingPCButton label="◀ Prev" disabled={!openIndex} onPress={() => setOpenIndex((i) => (i ? i - 1 : i))} />
            <RetroGamingPCButton
              label="Next ▶"
              disabled={openIndex === null || openIndex >= imageIds.length - 1}
              onPress={() => setOpenIndex((i) => (i !== null && i < imageIds.length - 1 ? i + 1 : i))}
            />
          </>
        }
      >
        {openId ? (
          <View className="retrogamingpc-bevel-inset aspect-video bg-retrogamingpc-dark">
            <Image source={{ uri: igdbImageUrl(openId, '720p') }} className="h-full w-full" resizeMode="contain" />
          </View>
        ) : null}
      </RetroGamingPCModal>
    </RetroGamingPCPanel>
  );
}
