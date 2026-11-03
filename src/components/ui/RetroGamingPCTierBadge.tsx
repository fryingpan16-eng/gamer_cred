import { Text, View } from 'react-native';

import type { TierCode } from '@/constants/ratingRubric';
import { cn } from '@/utils/cn';
import { tierBorderColor, tierDefinition, tierSpokenName } from '@/utils/rating';

export type RetroGamingPCTierBadgeProps = {
  tier: TierCode;
  /** Show the descriptor ("Classic") beside the tier code. */
  showDescriptor?: boolean;
  size?: 'compact' | 'regular';
  className?: string;
};

/** Tier badge in the rubric colour. A perfect 100 is a gold S with a gold edge. */
export function RetroGamingPCTierBadge({ tier, showDescriptor = true, size = 'regular', className }: RetroGamingPCTierBadgeProps) {
  const def = tierDefinition(tier);
  return (
    <View
      className={cn('flex-row items-center self-start border', size === 'compact' ? 'px-1' : 'px-1.5 py-px', className)}
      style={{ backgroundColor: def.color, borderColor: tierBorderColor(tier) }}
      accessibilityLabel={`Tier ${tierSpokenName(tier)}, ${def.descriptor}`}
    >
      <Text className="font-mono text-retrogamingpc-xs font-bold" style={{ color: def.textColor }}>
        {def.label}
      </Text>
      {showDescriptor ? (
        <Text className="text-retrogamingpc-xs" style={{ color: def.textColor }}>
          {' '}
          · {def.descriptor}
        </Text>
      ) : null}
    </View>
  );
}
