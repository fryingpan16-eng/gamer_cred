import { Link } from 'expo-router';
import { Text, View } from 'react-native';

type Props = {
  /** With a slug, also links to this game's / company's own IGDB page. */
  page?: { kind: 'games' | 'companies'; slug: string | null };
};

/** Credit for IGDB, the source of the game catalogue (plain text, no logos). */
export function IgdbAttribution({ page }: Props) {
  const href = page?.slug ? (`https://www.igdb.com/${page.kind}/${encodeURIComponent(page.slug)}` as const) : null;
  return (
    <View className="flex-row flex-wrap justify-center gap-x-2 py-2">
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        {page?.kind === 'companies' ? 'Studio' : 'Game'} data from{' '}
        <Link href="https://www.igdb.com" target="_blank" className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">
          IGDB
        </Link>
      </Text>
      {href ? (
        <Link
          href={href}
          target="_blank"
          accessibilityLabel={`View this ${page?.kind === 'companies' ? 'studio' : 'game'} on IGDB`}
          className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline"
        >
          View on IGDB ↗
        </Link>
      ) : null}
    </View>
  );
}
