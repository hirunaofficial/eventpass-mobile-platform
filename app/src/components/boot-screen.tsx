import { Image, View } from "react-native";

/**
 * Shown while the app is still starting: fonts loading, stored theme
 * being read, or the session being restored.
 *
 * It exists because those states previously rendered `null`. Nothing
 * rendered means no background either, so the launch sequence showed a
 * bare frame - white under Expo Go - between the splash disappearing
 * and the first screen painting. Any text drawn over it by the host
 * was unreadable.
 *
 * The colours are hardcoded rather than taken from Tailwind tokens on
 * purpose: this can render BEFORE the colour scheme has been applied,
 * so a token would be exactly the thing that is not ready yet.
 */
export function BootScreen() {
  return (
    <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#141210" }}>
      <Image
        source={require("../../assets/splash-icon.png")}
        style={{ width: 120, height: 120 }}
        resizeMode="contain"
        accessibilityLabel="EventPass"
      />
    </View>
  );
}
