import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native';

import { PERFECT_TIER_GOLD } from '@/constants/ratingRubric';
import { useProfileName } from '@/hooks/useNames';
import { showToast } from '@/hooks/useToastStore';
import { cn } from '@/utils/cn';
import { shownName } from '@/utils/nameRules';

export const OFFICIAL_LABEL = 'Official GamerCred account';

/**
 * The gold check-mark square next to staff names (admins with an approved
 * authenticator, migration 000038). Text-based so it can sit inside a sentence.
 * Players can't fake it: display names can't contain symbols like ✓ or emoji.
 */
export function OfficialBadge({ size = 12 }: { size?: number }) {
  return (
    <Text
      accessibilityRole="button"
      accessibilityLabel={OFFICIAL_LABEL}
      accessibilityHint="Explains the badge"
      onPress={() => showToast(`${OFFICIAL_LABEL}: a member of the GamerCred team.`, 'info')}
      suppressHighlighting
    >
      <MaterialCommunityIcons name="checkbox-marked" size={size} color={PERFECT_TIER_GOLD} />
    </Text>
  );
}

/** Display name, badge and @permanent name for a player you only know by id. */
export function useShownName(userId: string | null | undefined, username: string) {
  const { data } = useProfileName(userId);
  const displayName = data?.displayName ?? null;
  return {
    name: shownName(data?.username ?? username, displayName),
    handle: data?.username ?? username,
    hasDisplayName: Boolean(displayName),
    isOfficial: data?.isOfficial ?? false,
  };
}

export type UserNameProps = {
  userId: string | null | undefined;
  /** The permanent name the caller already has (shown until the display name loads). */
  username: string;
  /** Classes for the name itself (keep the caller's look). */
  className?: string;
  /** auto = "@permanent" only when a display name is set; always = profile headers. */
  handle?: 'auto' | 'always' | 'never';
  numberOfLines?: number;
  badgeSize?: number;
};

/**
 * Every player name in the app goes through here: the display name (or the
 * permanent name when none is set), the official badge, and the @permanent name,
 * so a display name can never pass as someone else. Text-based: nests in sentences.
 */
export function UserName({ userId, username, className, handle = 'auto', numberOfLines, badgeSize = 12 }: UserNameProps) {
  const shown = useShownName(userId, username);
  const showHandle = handle === 'always' || (handle === 'auto' && shown.hasDisplayName);
  return (
    <Text className={className} numberOfLines={numberOfLines}>
      {shown.name}
      {shown.isOfficial ? (
        <>
          {' '}
          <OfficialBadge size={badgeSize} />
        </>
      ) : null}
      {showHandle ? <Text className={cn('font-normal text-retrogamingpc-text-muted')}> @{shown.handle}</Text> : null}
    </Text>
  );
}
