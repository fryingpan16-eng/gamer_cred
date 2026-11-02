import { Text, View } from 'react-native';

import type { TierCode } from '@/constants/ratingRubric';
import { cn } from '@/utils/cn';
import { tierDefinition } from '@/utils/rating';

export type SteamTierBadgeProps = {
  tier: TierCode;
  /** Show the descriptor ("Classic") beside the tier code. */
  showDescriptor?: boolean;
  size?: 'compact' | 'regular';
  className?: string;
};

/** Tier badge in the rubric colour. S** has its own colour so perfect scores stand out. */
export function SteamTierBadge({ tier, showDescriptor = true, size = 'regular', className }: SteamTierBadgeProps) {
  const def = tierDefinition(tier);
  return (
    <View
      className={cn('flex-row items-center self-start border', size === 'compact' ? 'px-1' : 'px-1.5 py-px', className)}
      style={{ backgroundColor: def.color, borderColor: def.tier === 'S**' ? '#E6D8FF' : 'rgba(0,0,0,0.35)' }}
      accessibilityLabel={`Tier ${tier}, ${def.descriptor}`}
    >
      <Text className="font-mono text-steam-xs font-bold" style={{ color: def.textColor }}>
        {tier}
      </Text>
      {showDescriptor ? (
        <Text className="text-steam-xs" style={{ color: def.textColor }}>
          {' '}
          · {def.descriptor}
        </Text>
      ) : null}
    </View>
  );
}
