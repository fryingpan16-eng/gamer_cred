import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type ThumbnailProps = {
  uri: string | null;
  /** Shown when there is no image (or it fails to load). */
  fallback: string;
  shape: 'cover' | 'square';
  accessibilityLabel: string;
};

/** Sunken-frame thumbnail: 3:4 for game covers, square for logos/avatars. */
export function Thumbnail({ uri, fallback, shape, accessibilityLabel }: ThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const size = shape === 'cover' ? 'h-16 w-12' : 'h-12 w-12';

  return (
    <View className={cn('retrogamingpc-bevel-inset items-center justify-center overflow-hidden bg-retrogamingpc-dark', size)}>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          className="h-full w-full"
          resizeMode={shape === 'cover' ? 'cover' : 'contain'}
          accessibilityLabel={accessibilityLabel}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text className="font-mono text-retrogamingpc-lg font-bold text-retrogamingpc-text-muted">{fallback.slice(0, 1).toUpperCase()}</Text>
      )}
    </View>
  );
}
