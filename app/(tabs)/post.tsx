import { ScrollView, View } from 'react-native';

import { DraftList } from '@/components/studio/DraftList';
import { NowPlayingGrid } from '@/components/studio/NowPlayingGrid';
import { ReviewStudio } from '@/components/studio/ReviewStudio';

/**
 * Post / Review Studio:
 *   1. Now Playing — 4 slots with running notes & preliminary scores
 *   2. Review Studio — "Review a Game…"; the writer opens as a top-aligned overlay
 *   3. Drafts — saved backlog notes to resume
 * Desktop places the studio and drafts side by side beneath the grid.
 */
export default function PostScreen() {
  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      className="flex-1 bg-retrogamingpc-dark"
      contentContainerClassName="gap-3 p-3"
      keyboardShouldPersistTaps="handled"
    >
      <NowPlayingGrid />
      <View className="gap-3 md:flex-row md:items-start">
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
