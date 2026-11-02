import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { steamColors, steamLayout } from '@/constants/theme';
import { cn } from '@/utils/cn';

type SteamTabBarProps = BottomTabBarProps & { variant: 'bottom' | 'sidebar' };

function TabItem({
  label,
  focused,
  sidebar,
  renderIcon,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  label: string;
  focused: boolean;
  sidebar: boolean;
  renderIcon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const color = focused ? steamColors.textBright : steamColors.textMuted;

  return (
    <Pressable
      role="tab"
      aria-selected={focused}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        // Same 1px border in every state: active/inactive only swaps colors (no layout shift).
        'border',
        sidebar ? 'h-9 flex-row items-center gap-2 px-2' : 'flex-1 items-center justify-center gap-0.5',
        focused
          ? 'border-t-steam-highlight border-l-steam-highlight border-b-steam-bevel-dark border-r-steam-bevel-dark bg-steam-card'
          : pressed
            ? 'steam-bevel-inset bg-steam-dark'
            : cn('border-steam-accent', hovered ? 'bg-steam-button' : 'bg-steam-panel'),
      )}
    >
      {/* Active indicator stripe: always rendered (transparent when inactive) to keep geometry fixed. */}
      <View
        className={cn('absolute', sidebar ? 'bottom-0 left-0 top-0 w-[3px]' : 'left-0 right-0 top-0 h-[2px]')}
        style={{ backgroundColor: focused ? steamColors.highlight : 'transparent' }}
      />
      {renderIcon(color)}
      <Text
        numberOfLines={1}
        className={cn(sidebar ? 'text-steam-base' : 'text-steam-xs', focused ? 'font-bold' : 'font-normal')}
        style={{ color }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Custom 2004-Steam tab bar. One component renders as either the mobile
 * bottom bar or the desktop sidebar; both have fixed dimensions.
 */
export function SteamTabBar({ state, descriptors, emitter, navigateToTab, insets, variant }: SteamTabBarProps) {
  const sidebar = variant === 'sidebar';

  return (
    <View
      role="tablist"
      className={cn(
        'bg-steam-panel',
        sidebar ? 'gap-1 border-r border-r-steam-bevel-dark p-2' : 'flex-row gap-px border-t border-t-steam-bevel-light p-px',
      )}
      style={
        sidebar
          ? { width: steamLayout.sidebarWidth }
          : { height: steamLayout.bottomBarHeight + insets.bottom, paddingBottom: insets.bottom }
      }
    >
      {sidebar ? <Text className="steam-label px-1 pb-1">Navigation</Text> : null}
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const { options } = descriptor;
        const focused = index === state.index;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);

        return (
          <TabItem
            key={route.key}
            label={label}
            focused={focused}
            sidebar={sidebar}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            renderIcon={(color) =>
              options.tabBarIcon?.({ focused, color, size: sidebar ? 18 : 20 }) ?? null
            }
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}
