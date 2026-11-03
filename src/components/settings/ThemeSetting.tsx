import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCAlert } from '@/components/ui';
import { THEME_LABELS, THEME_NAMES, themePalette, type ThemeName } from '@/constants/themes';
import { useUpdateUiTheme } from '@/hooks/useProfile';
import { useThemeStore } from '@/hooks/useTheme';

/** A tiny window drawn in a theme's own colours (not the active theme's). */
function ThemeSwatch({ name, selected, onPress }: { name: ThemeName; selected: boolean; onPress: () => void }) {
  const p = themePalette(name);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${THEME_LABELS[name]} theme`}
      onPress={onPress}
      className="items-center gap-1"
    >
      <View
        className="h-12 w-14 overflow-hidden border-2"
        style={{ borderColor: selected ? p.textBright : 'transparent' }}
      >
        <View className="h-3" style={{ backgroundColor: p.panel, borderBottomWidth: 1, borderBottomColor: p.bevelDark }} />
        <View className="flex-1 flex-row items-center justify-center gap-1" style={{ backgroundColor: p.dark }}>
          <View className="h-4 w-4" style={{ backgroundColor: p.card, borderWidth: 1, borderColor: p.accent }} />
          <View className="h-2 w-4" style={{ backgroundColor: p.highlight }} />
        </View>
      </View>
      <Text className={selected ? 'text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-xs text-retrogamingpc-text-muted'}>
        {THEME_LABELS[name]}
        {name === 'olive' ? ' (default)' : ''}
      </Text>
    </Pressable>
  );
}

/** Colour theme: applies instantly, saved to the profile so it follows you across devices. */
export function ThemeSetting() {
  const theme = useThemeStore((s) => s.theme);
  const update = useUpdateUiTheme();
  return (
    <View className="gap-1.5">
      <View className="flex-row flex-wrap gap-3" accessibilityRole="radiogroup">
        {THEME_NAMES.map((name) => (
          <ThemeSwatch key={name} name={name} selected={theme === name} onPress={() => update.mutate(name)} />
        ))}
      </View>
      {update.isError ? <RetroGamingPCAlert message={update.error.message} /> : null}
    </View>
  );
}
