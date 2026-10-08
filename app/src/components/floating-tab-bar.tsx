import { Tabs } from "expo-router";
import { useColorScheme } from "nativewind";
import { Compass, ListChecks, Ticket, UserCircle, type Icon as PhosphorIconType } from "phosphor-react-native";
import type * as React from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@/components/ui/text";

/**
 * <FloatingTabBar> - a hand-built replacement for Expo Router's default
 * bottom tab bar. Custom-built (not a library component) for three
 * reasons the stock bar can't satisfy:
 *
 *   1. It floats as a detached pill above the content rather than being
 *      glued edge-to-edge to the bottom of the screen, which is what
 *      lets the dark canvas read as a continuous surface behind it.
 *   2. The active pill physically slides between tabs on a spring, so
 *      the transition shows WHERE you moved from, not just where you
 *      landed.
 *   3. Labels animate in only for the active tab, keeping the resting
 *      state icon-only and uncluttered.
 *
 * The animation runs entirely on the UI thread via Reanimated shared
 * values, so it stays at 60fps even while the screen it reveals is
 * still fetching.
 *
 * Props: consumes React Navigation's standard `BottomTabBarProps`
 * (`state`, `navigation`), so it is a drop-in `tabBar={...}` and carries
 * no EventPass-specific coupling.
 * Events: emits `tabPress` through `navigation.emit` and honours
 * `preventDefault()`, matching the contract of the bar it replaces.
 */

/**
 * Derived from the public `Tabs` component rather than imported from
 * `@react-navigation/bottom-tabs`: Expo Router v6 (SDK 57) no longer
 * depends on that package - it vendors React Navigation internally - so
 * importing it directly would mean either a redundant dependency or a
 * reach into expo-router's `build/` internals.
 */
type TabBarProps = Parameters<
  NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>
>[0];

type TabRoute = TabBarProps["state"]["routes"][number];

const ICONS: Record<string, PhosphorIconType> = {
  index: Compass,
  itinerary: ListChecks,
  tickets: Ticket,
  profile: UserCircle,
};

const LABELS: Record<string, string> = {
  index: "Discover",
  itinerary: "Plan",
  tickets: "Tickets",
  profile: "You",
};

function TabItem({
  routeName,
  isFocused,
  onPress,
}: {
  routeName: string;
  isFocused: boolean;
  onPress: () => void;
}) {
  const Icon = ICONS[routeName] ?? Compass;
  const { colorScheme } = useColorScheme();
  // Lucide icons take a `color` prop, not a className, so the token has
  // to be resolved in JS. Hardcoding the dark-theme grey left inactive
  // tabs washed out on the light theme.
  const inactiveColor = colorScheme === "dark" ? "#8A8276" : "#6B6459";
  const progress = useDerivedValue(() =>
    withSpring(isFocused ? 1 : 0, { damping: 18, stiffness: 180 })
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.8, 1]) }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    width: interpolate(progress.value, [0, 1], [0, 58]),
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={LABELS[routeName] ?? routeName}
      onPress={onPress}
      className="flex-row items-center justify-center gap-1 rounded-full px-4 py-2.5"
    >
      <Animated.View
        style={pillStyle}
        className="bg-primary absolute inset-0 rounded-full"
      />
      {/* The WEIGHT changes on focus, not just the colour- a filled icon
          against outlined neighbours reads as selected instantly, and is
          what separates this from stock thin-stroke tab iconography. */}
      <Icon
        size={22}
        // The active pill is acid yellow, so its icon must be DARK.
        color={isFocused ? "#141210" : inactiveColor}
        weight={isFocused ? "fill" : "regular"}
      />
      <Animated.View style={labelStyle} className="overflow-hidden">
        <Text numberOfLines={1} className="text-primary-foreground font-title text-xs">
          {LABELS[routeName] ?? routeName}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      className="absolute inset-x-0 bottom-0 items-center"
    >
      <View className="border-border bg-elevated flex-row items-center gap-1 rounded-full border p-1.5">
        {state.routes.map((route: TabRoute, index: number) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              isFocused={isFocused}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}
