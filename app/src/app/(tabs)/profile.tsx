/**
 * Profile / account screen.
 *
 * Also the app's settings surface: saved cards, appearance, sync state
 * and sign-out. The counts come from the same hooks the other tabs
 * use, so they stay correct offline and need no endpoint of their own.
 */
import Constants from "expo-constants";
import {
  CreditCard,
  DeviceMobile,
  Moon,
  SignOut,
  Sun,
  Trash,
  WifiSlash,
} from "phosphor-react-native";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Button } from "@/components/ui/button";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import {
  describeCard,
  getSavedCards,
  removeSavedCard,
  type SavedCard,
} from "@/lib/saved-cards";
import { useConnectivity } from "@/lib/use-connectivity";
import { useItinerary } from "@/lib/use-itinerary";
import { useTickets } from "@/lib/use-tickets";
import { useAppearance, type AppearancePreference } from "@/lib/use-appearance";

// Dark first: the app is designed dark-first, and "Auto" defers to the
// device setting.
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-7 gap-3">
      <Text className="font-heading text-xl">{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { preference, setAppearance } = useAppearance();
  const { items, pendingSyncCount } = useItinerary();
  const { tickets } = useTickets();
  const { state: connectivity } = useConnectivity();

  const [cards, setCards] = useState<SavedCard[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const loadCards = useCallback(async () => {
    try {
      setCards(await getSavedCards());
    } catch {
      // A local-storage failure must not break the whole screen.
      setCards([]);
    }
  }, []);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function handleRemoveCard(id: string) {
    setRemovingId(id);
    try {
      await removeSavedCard(id);
      await loadCards();
    } finally {
      setRemovingId(null);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  const initial = (user?.email?.[0] ?? "?").toUpperCase();
  const attended = tickets.filter((t) => t.checkedInAt).length;

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

        {/* Identity */}
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
          <Stat value={attended} label="Attended" />
        </View>

        {/* Sync- only shown when there is something to say. */}
        {connectivity !== "online" || pendingSyncCount > 0 ? (
          <View className="border-border bg-card mt-3 flex-row items-center gap-2.5 rounded-md border p-3">
            <PhosphorIcon as={WifiSlash} size={18} className="text-primary" />
            <Text variant="muted" className="flex-1">
              {connectivity === "no-server"
                ? "Can't reach the server."
                : connectivity === "no-network"
                  ? "No connection."
                  : "Online."}
              {pendingSyncCount > 0
                ? ` ${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} waiting to sync.`
                : ""}
            </Text>
          </View>
        ) : null}

        {/* Saved cards */}
        <Section title="Payment methods">
          {cards.length === 0 ? (
            <View className="border-border rounded-md border border-dashed p-4">
              <Text variant="muted">
                No saved cards. Buy a ticket and tick "save this card" to reuse it.
              </Text>
            </View>
          ) : (
            cards.map((c) => (
              <View
                key={c.id}
                className="border-border bg-card flex-row items-center gap-3 rounded-md border p-3"
              >
                <PhosphorIcon as={CreditCard} size={20} weight="duotone" className="text-primary" />
                <View className="flex-1">
                  <Text className="font-title text-base">{describeCard(c)}</Text>
                  <Text variant="muted">
                    {c.name} · expires {c.expiry}
                  </Text>
                </View>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={removingId === c.id}
                  onPress={() => handleRemoveCard(c.id)}
                  accessibilityLabel={`Remove ${describeCard(c)}`}
                >
                  {removingId !== c.id ? (
                    <PhosphorIcon as={Trash} size={16} className="text-destructive" />
                  ) : null}
                </Button>
              </View>
            ))
          )}
          <Text variant="muted" className="text-xs">
            Only the card type, last four digits, expiry and name are stored, on this device
            only. The full number and security code are never saved.
          </Text>
        </Section>

        {/* Appearance */}
        <Section title="Appearance">
          <View className="border-border bg-card rounded-card flex-row gap-1.5 border p-1.5">
            {APPEARANCE_OPTIONS.map((option) => {
              const active = preference === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setAppearance(option.key)}
                  accessibilityRole="button"
                  accessibilityState={active ? { selected: true } : {}}
                  accessibilityLabel={`${option.label} appearance`}
                  className={
                    active
                      ? "bg-primary flex-1 flex-row items-center justify-center gap-1.5 rounded-md py-3"
                      : "flex-1 flex-row items-center justify-center gap-1.5 rounded-md py-3"
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
          <Text variant="muted" className="text-xs">
            EventPass is designed dark-first. Auto follows your device setting.
          </Text>
        </Section>

        {/* Session */}
        <Section title="Session">
          <Button
            variant="outline"
            className="h-14 rounded-card"
            loading={isSigningOut}
            onPress={handleSignOut}
          >
            {!isSigningOut ? (
              <PhosphorIcon as={SignOut} size={18} weight="bold" className="text-destructive" />
            ) : null}
            <Text className="text-destructive">
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Text>
          </Button>
        </Section>

        <Text variant="muted" className="mt-8 text-center text-xs">
          EventPass v{Constants.expoConfig?.version ?? "1.0.0"}
        </Text>
      </ScrollView>
    </View>
  );
}
