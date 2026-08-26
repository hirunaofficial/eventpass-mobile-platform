import { useMemo, useState } from "react";
import { router } from "expo-router";
import { CloudOff, LogOut, MapPin, TicketIcon } from "lucide-react-native";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { haversineDistanceKm, type ClashReason, type EventWithVenue } from "@eventpass/shared";
import { EventImage } from "@/components/event-image";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useEvents } from "@/lib/use-events";
import { useItinerary } from "@/lib/use-itinerary";
import { useLocation } from "@/lib/use-location";
import { useShake } from "@/lib/use-shake";
import { useTickets } from "@/lib/use-tickets";

function formatEventTime(startsAt: string) {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventCard({
  event,
  distanceKm,
  onAdd,
  onBuy,
}: {
  event: EventWithVenue;
  distanceKm: number | null;
  onAdd: (event: EventWithVenue) => void;
  onBuy: (event: EventWithVenue) => void;
}) {
  return (
    <Card className="mb-3 overflow-hidden">
      <Pressable onPress={() => router.push(`/event/${event.id}`)}>
        <EventImage imageKey={event.imageKey} className="h-40 w-full" iconSize={36} />
        <CardHeader>
          <Text variant="large">{event.title}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={12} className="text-muted-foreground" />
            <Text variant="muted">
              {event.venue.name}
              {distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km away` : ""}
            </Text>
          </View>
        </CardHeader>
        <CardContent className="gap-3">
          <Text variant="muted" numberOfLines={2}>
            {event.description}
          </Text>
          <View className="flex-row gap-2">
            <Badge variant="secondary">
              <Text variant="small">{formatEventTime(event.startsAt)}</Text>
            </Badge>
            <Badge variant="outline">
              <Icon as={TicketIcon} size={10} className="text-foreground" />
              <Text variant="small">{event.remaining} left</Text>
            </Badge>
          </View>
        </CardContent>
      </Pressable>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" size="sm" onPress={() => onBuy(event)}>
          <Text>Buy ticket</Text>
        </Button>
        <Button size="sm" onPress={() => onAdd(event)}>
          <Text>Add to itinerary</Text>
        </Button>
      </CardFooter>
    </Card>
  );
}

function EventCardSkeleton() {
  return (
    <Card className="mb-3 overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <CardHeader className="gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </CardHeader>
      <CardContent className="gap-3">
        <Skeleton className="h-3 w-full rounded" />
        <View className="flex-row gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </View>
      </CardContent>
    </Card>
  );
}

const CATEGORIES: { key: string; label: string }[] = [
  { key: "tech", label: "Tech" },
  { key: "music", label: "Music" },
  { key: "art", label: "Art" },
  { key: "business", label: "Business" },
  { key: "comedy", label: "Comedy" },
  { key: "wellness", label: "Wellness" },
  { key: "film", label: "Film" },
  { key: "sports", label: "Sports" },
  { key: "food", label: "Food" },
  { key: "workshop", label: "Workshop" },
  { key: "classical", label: "Classical" },
];

function CategoryFilterBar({
  events,
  selected,
  onSelect,
}: {
  events: EventWithVenue[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const present = new Set(events.map((e) => e.imageKey).filter((k): k is string => !!k));
  const options = CATEGORIES.filter((c) => present.has(c.key));

  if (options.length < 2) return null;

  return (
    <FlatList
      horizontal
      data={[{ key: null, label: "All" }, ...options]}
      keyExtractor={(item) => item.key ?? "all"}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      renderItem={({ item }) => (
        <Pressable onPress={() => onSelect(item.key)}>
          <Badge variant={selected === item.key ? "default" : "outline"}>
            <Text variant="small">{item.label}</Text>
          </Badge>
        </Pressable>
      )}
    />
  );
}

function clashMessage(reason: ClashReason): string {
  if (reason.type === "time_overlap") {
    return "This event overlaps with something already in your itinerary.";
  }
  return `You'd only have ${reason.availableMinutes} min to travel between venues, but need about ${reason.neededMinutes} min.`;
}

export default function Index() {
  const { user, signOut } = useAuth();
  const { events, isLoading, isRefreshing, error, isOffline, refresh } = useEvents();
  const { addToItinerary } = useItinerary();
  const { purchaseTicket } = useTickets();
  const { coords } = useLocation();
  useShake(refresh);
  const [clashInfo, setClashInfo] = useState<{ event: EventWithVenue; reason: ClashReason } | null>(
    null
  );
  const [purchaseNotice, setPurchaseNotice] = useState<{ title: string; message: string } | null>(
    null
  );
  const [category, setCategory] = useState<string | null>(null);

  const sortedEvents = useMemo(() => {
    const filtered = category ? events.filter((e) => e.imageKey === category) : events;
    if (!coords) return filtered;
    return [...filtered].sort(
      (a, b) =>
        haversineDistanceKm(coords, a.venue) - haversineDistanceKm(coords, b.venue)
    );
  }, [events, coords, category]);

  async function handleAdd(event: EventWithVenue) {
    const result = await addToItinerary(event);
    if (!result.ok) {
      setClashInfo({ event, reason: result.reason });
    }
  }

  async function handleBuy(event: EventWithVenue) {
    const result = await purchaseTicket(event.id);
    if (!result.ok) {
      setPurchaseNotice({ title: "Couldn't buy this ticket", message: result.error });
    } else if (result.queued) {
      setPurchaseNotice({
        title: "Purchase queued",
        message: "You're offline- this ticket will be purchased automatically once you're back online.",
      });
    }
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-16">
        <View>
          <Text variant="h4">EventPass</Text>
          <Text variant="muted">{user?.email}</Text>
        </View>
        <Button variant="ghost" size="icon" onPress={signOut}>
          <Icon as={LogOut} size={20} />
        </Button>
      </View>

      <View className="flex-1 px-4">
        {isOffline ? (
          <View className="bg-secondary mt-3 flex-row items-center gap-2 rounded-md px-3 py-2">
            <Icon as={CloudOff} size={14} className="text-secondary-foreground" />
            <Text variant="small">Offline- showing saved events</Text>
          </View>
        ) : null}

        <Text variant="h4" className="mb-2 mt-4 text-lg">
          Upcoming events
        </Text>

        {error ? <Text className="text-destructive mb-2">{error}</Text> : null}

        {!isLoading && events.length > 0 ? (
          <CategoryFilterBar events={events} selected={category} onSelect={setCategory} />
        ) : null}

        {isLoading ? (
          <View>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </View>
        ) : events.length === 0 ? (
          <Text variant="muted">No events yet- check back soon.</Text>
        ) : sortedEvents.length === 0 ? (
          <Text variant="muted" className="mt-4">
            No events in this category right now.
          </Text>
        ) : (
          <FlatList
            data={sortedEvents}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <EventCard
                event={item}
                distanceKm={coords ? haversineDistanceKm(coords, item.venue) : null}
                onAdd={handleAdd}
                onBuy={handleBuy}
              />
            )}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
          />
        )}
      </View>

      <AlertDialog open={clashInfo !== null} onOpenChange={(open) => !open && setClashInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can't add this event</AlertDialogTitle>
            <AlertDialogDescription>
              {clashInfo ? clashMessage(clashInfo.reason) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onPress={() => setClashInfo(null)}>
            <Text>OK</Text>
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={purchaseNotice !== null}
        onOpenChange={(open) => !open && setPurchaseNotice(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{purchaseNotice?.title}</AlertDialogTitle>
            <AlertDialogDescription>{purchaseNotice?.message ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onPress={() => setPurchaseNotice(null)}>
            <Text>OK</Text>
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
