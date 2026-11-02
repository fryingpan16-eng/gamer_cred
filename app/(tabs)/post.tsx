import { useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';

import { DraftList } from '@/components/studio/DraftList';
import { NowPlayingGrid } from '@/components/studio/NowPlayingGrid';
import { ReviewStudio } from '@/components/studio/ReviewStudio';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useStudioStore } from '@/hooks/useStudioStore';

/**
 * Post / Review Studio:
 *   1. Now Playing — 4 slots with running notes & preliminary scores
 *   2. Review Studio — publish from a slot, or a standalone quick review
 *   3. Drafts — saved backlog notes to resume
 * Desktop places the studio and drafts side by side beneath the grid.
 */
export default function PostScreen() {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const studioY = useRef(0);
  const isDesktop = useIsDesktop();

  // Starting a review from a slot/draft scrolls the studio into view on phones.
  useEffect(
    () =>
      useStudioStore.subscribe((state, prev) => {
        if (!isDesktop && state.target && state.target !== prev.target) {
          scrollRef.current?.scrollTo({ y: Math.max(0, studioY.current - 8), animated: true });
        }
      }),
    [isDesktop],
  );

  return (
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-steam-dark"
      contentContainerClassName="gap-3 p-3"
      keyboardShouldPersistTaps="handled"
    >
      <NowPlayingGrid />
      <View
        className="gap-3 md:flex-row md:items-start"
        onLayout={(e) => {
          studioY.current = e.nativeEvent.layout.y;
        }}
      >
        <View className="md:flex-[3]">
          <ReviewStudio />
        </View>
        <View className="md:flex-[2]">
          <DraftList />
        </View>
      </View>
    </ScrollView>
  );
}
