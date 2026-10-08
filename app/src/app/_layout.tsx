import "../../global.css";

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import { PortalHost } from "@rn-primitives/portal";
import { Redirect, Slot, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colorScheme, useColorScheme } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SyncConflictNotice } from "@/components/sync-conflict-notice";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { loadStoredAppearance } from "@/lib/use-appearance";

// Hold the native splash until fonts AND the stored theme are both ready,
// so the first painted frame is already correct. Without this the app
// flashes system-font/light-theme content for a frame or two on launch.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (fast refresh) - not an error worth surfacing.
});

// Nocturne is dark-first, so dark is applied at MODULE scope- before React
// renders anything- rather than inside an effect. Doing it in an effect
// left a window in which the light token values were the active ones, and
// made the theme depend on an effect winning a race against first paint.
// A stored user preference still overrides this below, asynchronously.
//
// NOTE: this alone is not enough if the native container forces an
// appearance. `app.json`'s `userInterfaceStyle` was "light", which on iOS
// pins the whole app light no matter what JS asks for; it is now
// "automatic". That is a MANIFEST change, so Expo Go must fully reopen the
// project to pick it up- a JS reload will not do it.
colorScheme.set("dark");

function AuthGate() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/signup" || pathname === "/staff-login";

  if (isLoading) {
    return null;
  }

  if (!user && !isAuthRoute) {
    return <Redirect href="/login" />;
  }

  if (user && isAuthRoute) {
    return <Redirect href={user.role === "staff" ? "/scan" : "/"} />;
  }

  // Staff only ever see the check-in scanner- no attendee tabs, no
  // itinerary/tickets/discover. Attendees are kept out of /scan too, even
  // though the server already rejects non-staff check-in requests- this is
  // just about not showing a screen that can't do anything for them.
  if (user?.role === "staff" && pathname !== "/scan" && !isAuthRoute) {
    return <Redirect href="/scan" />;
  }
  if (user?.role === "attendee" && pathname === "/scan") {
    return <Redirect href="/" />;
  }

  return <Slot />;
}

export default function RootLayout() {
  const { colorScheme: active } = useColorScheme();
  const [themeReady, setThemeReady] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    // Dark is already applied at module scope; this only re-applies an
    // explicitly stored preference on top of it. NativeWind applies a
    // scheme live but does not persist it across restarts.
    loadStoredAppearance()
      .then((stored) => {
        if (stored) colorScheme.set(stored);
      })
      .catch(() => {
        // Keep the module-scope dark default.
      })
      .finally(() => setThemeReady(true));
  }, []);

  // A font that fails to load is not worth blocking launch over - RN falls
  // back to the system face, which is ugly but usable.
  const ready = themeReady && (fontsLoaded || !!fontError);

  const onLayout = useCallback(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <SafeAreaProvider>
        <View className="bg-background flex-1">
          <StatusBar style={active === "dark" ? "light" : "dark"} />
          <AuthProvider>
            <AuthGate />
            <SyncConflictNotice />
            <PortalHost />
          </AuthProvider>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
