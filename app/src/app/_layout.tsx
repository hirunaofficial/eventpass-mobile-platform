import "../../global.css";

import { PortalHost } from "@rn-primitives/portal";
import { Redirect, Slot, usePathname } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SyncConflictNotice } from "@/components/sync-conflict-notice";
import { AuthProvider, useAuth } from "@/lib/auth-context";

function AuthGate() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  if (isLoading) {
    return null;
  }

  if (!user && !isAuthRoute) {
    return <Redirect href="/login" />;
  }

  if (user && isAuthRoute) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate />
          <SyncConflictNotice />
          <PortalHost />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
