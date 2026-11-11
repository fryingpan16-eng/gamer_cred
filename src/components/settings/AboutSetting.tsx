import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCButton } from '@/components/ui';

const linkClass = 'text-retrogamingpc-xs text-retrogamingpc-text-bright underline';

/** Settings → About: version, legal pages, open-source licenses and data credits. */
export function AboutSetting() {
  const version = Constants.expoConfig?.version;
  return (
    <View className="gap-2">
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        GamerCred{version ? <Text className="font-mono text-retrogamingpc-text-muted"> v{version}</Text> : null}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <RetroGamingPCButton variant="navigate" label="Terms & Community Guidelines" onPress={() => router.push('/terms')} />
        <RetroGamingPCButton variant="navigate" label="Privacy Policy" onPress={() => router.push('/privacy')} />
        <RetroGamingPCButton variant="navigate" label="Open-source licenses" onPress={() => router.push('/licenses')} />
      </View>
      <View className="gap-0.5">
        <Text className="retrogamingpc-label">Data credits</Text>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text">
          Game and studio data from{' '}
          <Link href="https://www.igdb.com" target="_blank" className={linkClass}>
            IGDB
          </Link>
          . Creator data and PC requirements from{' '}
          <Link href="https://rawg.io" target="_blank" className={linkClass}>
            RAWG
          </Link>
          .
        </Text>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          GamerCred isn’t affiliated with the games, studios or platforms shown; their names and artwork belong to their owners.
        </Text>
      </View>
    </View>
  );
}
