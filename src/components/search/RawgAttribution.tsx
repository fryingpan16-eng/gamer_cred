import { Link } from 'expo-router';
import { Text, View } from 'react-native';

/** RAWG's API terms require a visible, active link back to RAWG wherever its data is shown. */
export function RawgAttribution() {
  return (
    <View className="flex-row justify-center py-2">
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        People data provided by{' '}
        <Link href="https://rawg.io" target="_blank" className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">
          RAWG
        </Link>
      </Text>
    </View>
  );
}
