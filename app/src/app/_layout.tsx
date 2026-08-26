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
