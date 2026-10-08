/**
 * Profile / account screen.
 *
 * Also the app's settings surface: theme preference and sign-out. The
 * counts come straight from the same hooks the other tabs use, so they
 * stay correct offline and never need their own endpoint.
 */
import Constants from "expo-constants";
import { ChevronRight } from "lucide-react-native";
import { DeviceMobile, Moon, SignOut, Sun } from "phosphor-react-native";
import { Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useItinerary } from "@/lib/use-itinerary";
import { useTickets } from "@/lib/use-tickets";
import { useAppearance, type AppearancePreference } from "@/lib/use-appearance";

// Dark first in the list because the app is designed dark-first; "Auto"
// defers to the OS setting.
const APPEARANCE_OPTIONS: { key: AppearancePreference; label: string; icon: typeof Sun }[] = [
  { key: "dark", label: "Dark", icon: Moon },
  { key: "light", label: "Light", icon: Sun },
  { key: "system", label: "Auto", icon: DeviceMobile },
];

/** Small read-only metric tile. Derived state only- no fetching. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="border-border bg-card flex-1 gap-1 rounded-md border px-3 py-4">
      <Text className="font-display text-2xl">{value}</Text>
      <Text className="text-muted-foreground font-ui text-xs">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { preference, setAppearance } = useAppearance();
  const { items } = useItinerary();
  const { tickets } = useTickets();
  const initial = (user?.email?.[0] ?? "?").toUpperCase();

  return (
    <View className="bg-background flex-1">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 110 }}
      >
        <View className="gap-1 pb-5 pt-16">
          <Text className="text-primary font-ui text-sm">Account</Text>
          <Text className="font-display text-4xl">You</Text>
        </View>

        <View className="border-border bg-card rounded-card flex-row items-center gap-4 border p-4">
          <View className="bg-primary h-16 w-16 items-center justify-center rounded-full">
            <Text className="text-primary-foreground font-display text-2xl">{initial}</Text>
          </View>
          <View className="flex-1 gap-1">
            <Text numberOfLines={1} className="font-title text-base">
              {user?.email}
            </Text>
            <View className="bg-primary self-start rounded-sm px-2 py-0.5">
              <Text className="text-primary-foreground font-ui text-xs">{user?.role}</Text>
            </View>
          </View>
        </View>

        <View className="mt-3 flex-row gap-3">
          <Stat value={items.length} label="Planned" />
          <Stat value={tickets.length} label="Tickets" />
          <Stat value={tickets.filter((t) => t.checkedInAt).length} label="Attended" />
        </View>

        <View className="mt-7 gap-3">
          <Text className="font-heading text-xl">Appearance</Text>
          <View className="border-border bg-card rounded-card flex-row gap-1.5 border p-1.5">
            {APPEARANCE_OPTIONS.map((option) => {
              const active = preference === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setAppearance(option.key)}
                  accessibilityRole="button"
                  accessibilityState={active ? { selected: true } : {}}
                  className={
                    active
                      ? "bg-primary flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3"
                      : "flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-3"
                  }
                >
                  <PhosphorIcon
                    as={option.icon}
                    size={16}
                    weight={active ? "fill" : "regular"}
                    className={active ? "text-primary-foreground" : "text-muted-foreground"}
                  />
                  <Text
                    className={
                      active
                        ? "text-primary-foreground font-title text-sm"
                        : "text-muted-foreground font-ui text-sm"
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text variant="muted">
            EventPass is designed dark-first. Auto follows your device setting.
          </Text>
        </View>

        <View className="mt-7 gap-3">
          <Text className="font-heading text-xl">Session</Text>
          <Button
            variant="outline"
            className="h-14 flex-row justify-between rounded-card"
            onPress={signOut}
          >
            <View className="flex-row items-center gap-2">
              <PhosphorIcon as={SignOut} size={18} weight="bold" className="text-destructive" />
              <Text className="text-destructive">Sign out</Text>
            </View>
            <Icon as={ChevronRight} size={16} className="text-muted-foreground" />
          </Button>
        </View>

        <Text variant="muted" className="mt-8 text-center">
          EventPass v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </ScrollView>
    </View>
  );
}
