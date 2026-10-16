/**
 * Discover - the app's home screen.
 *
 * Composes five hooks, each owning one concern:
 *   useEvents    - catalogue + offline cache
 *   useItinerary - add, and the constraint check on add
 *   useLocation  - GPS, for distance sorting
 *   useShake     - accelerometer, shake to refresh
 *
 * The screen itself holds only view state (search text, category, which
 * dialog is open). All data and business logic lives in the hooks -
 * this is the Presentation layer talking to ViewModels.
 */
import { useMemo, useState } from "react";
import { router } from "expo-router";
import { CloudOff, MapPin, Search, TicketIcon } from "lucide-react-native";
import { Sparkle } from "phosphor-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { haversineDistanceKm, type ClashReason, type EventWithVenue, type Resolution } from "@eventpass/shared";
import { ClashResolutionSheet } from "@/components/clash-resolution-sheet";
import { EventImage } from "@/components/event-image";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PhosphorIcon } from "@/components/ui/phosphor-icon";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useConnectivity } from "@/lib/use-connectivity";
import { useEvents } from "@/lib/use-events";
import { useItinerary } from "@/lib/use-itinerary";
import { useLocation } from "@/lib/use-location";
import { useShake } from "@/lib/use-shake";

/** Space the floating tab bar needs so the last card isn't trapped under it. */
const TAB_BAR_CLEARANCE = 110;

/**
 * Deliberately not "Good morning/afternoon/evening". A time-of-day
 * greeting is filler- it says nothing the user does not already know.
 * This states what is actually true of the list below it.
 */
function headline(count: number): { kicker: string; title: string } {
  const hour = new Date().getHours();
  if (count === 0) return { kicker: "Nothing on", title: "Quiet right now" };
  if (hour >= 17) return { kicker: "Doors open soon", title: "Out tonight" };
  if (hour < 12) return { kicker: "Planning ahead", title: "What's coming up" };
  return { kicker: "Still time to decide", title: "On later today" };
}

function formatEventTime(startsAt: string) {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function sectionFor(startsAt: string): "Tonight" | "This week" | "Later" {
  const now = new Date();
  const start = new Date(startsAt);
  if (start.toDateString() === now.toDateString()) return "Tonight";
  const diffDays = (start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays < 7 ? "This week" : "Later";
}

function FeaturedCard({ event, onPress }: { event: EventWithVenue; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${event.title} at ${event.venue.name}`}
      accessibilityHint="Opens event details"
      className="border-border bg-card rounded-card overflow-hidden border"
    >
      <View className="h-52 w-full">
        <EventImage imageKey={event.imageKey} className="h-full w-full" iconSize={48} />
      </View>
      <View className="gap-2 p-4">
        <View className="flex-row items-center gap-1.5">
          <PhosphorIcon as={Sparkle} size={13} weight="fill" className="text-primary" />
          <Text className="text-primary font-ui text-eyebrow uppercase">Featured tonight</Text>
        </View>
        <Text numberOfLines={2} className="font-display text-2xl">
          {event.title}
        </Text>
        <View className="flex-row items-center gap-1.5">
          <Icon as={MapPin} size={12} className="text-muted-foreground" />
          <Text variant="muted" numberOfLines={1}>
            {event.venue.name} · {formatEventTime(event.startsAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EventCard({
  event,
  distanceKm,
  index,
  isAdding,
  onAdd,
  onBuy,
  onOpen,
}: {
  event: EventWithVenue;
  distanceKm: number | null;
  index: number;
  isAdding: boolean;
  onAdd: () => void;
  onBuy: () => void;
  onOpen: () => void;
}) {
  const soldOut = event.remaining <= 0;

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(320)}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        // Screen readers announce the whole card as one item; the
        // buttons inside remain separately focusable.
        accessibilityLabel={`${event.title}, ${event.venue.name}, ${formatEventTime(event.startsAt)}${soldOut ? ", sold out" : ""}`}
        accessibilityHint="Opens event details"
        className="border-border bg-card rounded-card flex-row gap-3 border p-3"
      >
        {/* Inner core: its own surface + radius inside the card shell. */}
        <View className="bg-elevated h-24 w-24 overflow-hidden rounded-xl">
          <EventImage imageKey={event.imageKey} className="h-full w-full" iconSize={26} />
        </View>

        <View className="flex-1 justify-between gap-2">
          <View className="gap-1">
            <Text numberOfLines={2} className="font-title text-base">
              {event.title}
            </Text>
            <View className="flex-row items-center gap-1">
              <Icon as={MapPin} size={11} className="text-muted-foreground" />
              <Text variant="muted" numberOfLines={1} className="flex-1">
                {event.venue.name}
                {distanceKm != null ? ` · ${distanceKm.toFixed(1)} km` : ""}
              </Text>
            </View>
            <Text variant="muted">{formatEventTime(event.startsAt)}</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <Button size="sm" className="flex-1 rounded-md" loading={isAdding} onPress={onAdd}>
              <Text>{isAdding ? "Adding..." : "Add to plan"}</Text>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-md"
              disabled={soldOut}
              onPress={onBuy}
            >
              <Icon as={TicketIcon} size={14} />
              <Text>{soldOut ? "Sold out" : "Ticket"}</Text>
            </Button>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// Skeleton mirrors the real card's layout exactly, so finishing a load
// causes no visible jump.
function EventCardSkeleton() {
  return (
    <View className="border-border bg-card rounded-card flex-row gap-3 border p-3">
      <Skeleton className="h-24 w-24 rounded-xl" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
        <Skeleton className="mt-2 h-8 w-full rounded-md" />
      </View>
    </View>
  );
}

// Only renders categories actually present in the current results, so
// there are never chips that would return nothing.
function CategoryFilterBar({
  events,
  selected,
  onSelect,
}: {
  events: EventWithVenue[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const options = useMemo(() => {
    const keys = Array.from(
      new Set(events.map((e) => e.imageKey).filter((k): k is string => !!k))
    ).sort();
    return keys.map((key) => ({ key, label: key[0]!.toUpperCase() + key.slice(1) }));
  }, [events]);

  if (options.length < 2) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 px-5">
      <View className="flex-row gap-2">
        {[{ key: null, label: "All" }, ...options].map((item) => {
          const active = selected === item.key;
          return (
            <Pressable
              key={item.key ?? "all"}
              onPress={() => onSelect(item.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter by ${item.label}`}
              className={
                active
                  ? "bg-primary rounded-md px-4 py-2"
                  : "border-border bg-card rounded-md border px-4 py-2"
              }
            >
              <Text
                className={active ? "text-primary-foreground font-title text-sm" : "font-ui text-sm"}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function Index() {
  const { user } = useAuth();
  const { events, isLoading, isRefreshing, error, isOffline, refresh } = useEvents();
  const { addToItinerary, removeFromItinerary } = useItinerary();
  const { coords } = useLocation();
  const { state: connectivity } = useConnectivity();
  useShake(refresh);

  const [clash, setClash] = useState<{
    event: EventWithVenue;
    reason: ClashReason;
    resolutions: Resolution[];
  } | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Which event is mid-add. Keyed by id rather than a single boolean
  // so only the pressed card's button shows a spinner.
  const [addingId, setAddingId] = useState<string | null>(null);
  const head = headline(events.length);

  // Filter -> search -> sort by distance. useMemo because this runs on
  // every keystroke and the list can be long.
  const sortedEvents = useMemo(() => {
    let filtered = category ? events.filter((e) => e.imageKey === category) : events;
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(q) || e.venue.name.toLowerCase().includes(q)
      );
    }
    if (!coords) return filtered;
    return [...filtered].sort(
      (a, b) => haversineDistanceKm(coords, a.venue) - haversineDistanceKm(coords, b.venue)
    );
  }, [events, coords, category, query]);

  const isBrowsingUnfiltered = !category && !query.trim();
  const featured = isBrowsingUnfiltered && events.length > 0 ? events[0]! : null;
  const listEvents = featured ? sortedEvents.filter((e) => e.id !== featured.id) : sortedEvents;

  // Group into Tonight / This week / Later. Grouping beats one flat
  // list: "what's on tonight" is the question users actually have.
  const sections = useMemo(() => {
    const groups: Record<string, EventWithVenue[]> = { Tonight: [], "This week": [], Later: [] };
    for (const event of listEvents) groups[sectionFor(event.startsAt)]!.push(event);
    return groups;
  }, [listEvents]);

  async function handleAdd(event: EventWithVenue) {
    setAddingId(event.id);
    try {
      // The whole catalogue is passed so the constraint solver can
      // propose real alternatives, not just reject.
      const result = await addToItinerary(event, events);
      if (!result.ok) {
        setClash({ event, reason: result.reason, resolutions: result.resolutions });
      }
    } finally {
      setAddingId(null);
    }
  }

  // Chosen from the resolution sheet: drop the blocking item, then retry.
  async function handleSwap(dropEventId: string) {
    const pending = clash;
    setClash(null);
    if (!pending) return;
    setAddingId(pending.event.id);
    try {
      await removeFromItinerary(dropEventId);
      await addToItinerary(pending.event, events);
    } finally {
      setAddingId(null);
    }
  }

  // Purchase now goes through checkout rather than buying instantly -
  // the capacity guard still runs server-side at the moment of payment.
  function handleBuy(event: EventWithVenue) {
    router.push(`/checkout/${event.id}`);
  }

  const distanceFor = (event: EventWithVenue) =>
    coords ? haversineDistanceKm(coords, event.venue) : null;

  return (
    <View className="bg-background flex-1">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: TAB_BAR_CLEARANCE }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#E8FF52" />}
      >
        <View className="flex-row items-end justify-between pt-16">
          <View className="flex-1 gap-1">
            <Text className="text-primary font-ui text-sm">{head.kicker}</Text>
            <Text className="font-display text-4xl">{head.title}</Text>
          </View>
          <Pressable
            onPress={() => router.push("/profile")}
            accessibilityLabel="Open your profile"
            className="border-border bg-card h-11 w-11 items-center justify-center rounded-full border"
          >
            <Text className="font-title text-base">
              {(user?.email?.[0] ?? "?").toUpperCase()}
            </Text>
          </Pressable>
        </View>

        <View className="relative mt-5">
          <View className="absolute left-4 top-0 bottom-0 z-10 justify-center">
            <Icon as={Search} size={16} className="text-muted-foreground" />
          </View>
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search events or venues"
            className="bg-card rounded-md pl-11"
          />
        </View>

        {isOffline ? (
          <View className="border-border bg-card mt-3 flex-row items-center gap-2 rounded-md border px-4 py-2.5">
            <Icon as={CloudOff} size={14} className="text-primary" />
            {/* Says WHICH kind of unreachable it is. "No connection" and
                "server not reachable" need opposite remedies. */}
            <Text variant="small" className="flex-1">
              {connectivity === "no-server"
                ? "Can't reach the server- showing saved events"
                : "No connection- showing saved events"}
            </Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive mt-3">{error}</Text> : null}

        {!isLoading && events.length > 0 ? (
          <View className="mt-4">
            <CategoryFilterBar events={events} selected={category} onSelect={setCategory} />
          </View>
        ) : null}

        {isLoading ? (
          <View className="mt-5 gap-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </View>
        ) : events.length === 0 ? (
          <View className="gap-3 py-16">
            <View className="bg-border h-px w-full" />
            <Text className="font-display text-2xl">Nothing listed yet</Text>
            <Text variant="muted" className="max-w-[280px]">
              Organisers haven't posted anything for this area. Pull down to check again.
            </Text>
          </View>
        ) : (
          <>
            {featured ? (
              <View className="mt-5">
                <FeaturedCard
                  event={featured}
                  onPress={() => router.push(`/event/${featured.id}`)}
                />
              </View>
            ) : null}

            {listEvents.length === 0 ? (
              <View className="gap-2 py-16">
                <View className="bg-border h-px w-full" />
                <Text className="font-title text-lg">No match for "{query.trim()}"</Text>
                <Text variant="muted">Try a venue name, or clear the filter.</Text>
              </View>
            ) : null}

            {(["Tonight", "This week", "Later"] as const).map((label) => {
              const group = sections[label]!;
              if (group.length === 0) return null;
              return (
                <View key={label} className="mt-7 gap-3">
                  <View className="flex-row items-baseline gap-3">
                    <Text className="font-heading text-xl">{label}</Text>
                    <View className="bg-border h-px flex-1" />
                    <Text className="text-muted-foreground font-ui text-sm">
                      {group.length}
                    </Text>
                  </View>
                  {group.map((event, i) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      index={i}
                      isAdding={addingId === event.id}
                      distanceKm={distanceFor(event)}
                      onAdd={() => handleAdd(event)}
                      onBuy={() => handleBuy(event)}
                      onOpen={() => router.push(`/event/${event.id}`)}
                    />
                  ))}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <ClashResolutionSheet
        candidate={clash?.event ?? null}
        reason={clash?.reason ?? null}
        resolutions={clash?.resolutions ?? []}
        events={events}
        onChooseAlternative={(event) => {
          setClash(null);
          handleAdd(event);
        }}
        onChooseSwap={handleSwap}
        onDismiss={() => setClash(null)}
      />

    </View>
  );
}
