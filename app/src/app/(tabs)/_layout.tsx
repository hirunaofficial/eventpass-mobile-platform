import { Tabs } from "expo-router";
import { FloatingTabBar } from "@/components/floating-tab-bar";

export default function TabsLayout() {
  return (
    <Tabs
      // The stock bar is replaced wholesale by a hand-built one- see
      // components/floating-tab-bar.tsx for why.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="itinerary" options={{ title: "Plan" }} />
      <Tabs.Screen name="tickets" options={{ title: "Tickets" }} />
      <Tabs.Screen name="profile" options={{ title: "You" }} />
    </Tabs>
  );
}
