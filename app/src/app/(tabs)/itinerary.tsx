import { useState } from "react";
import { CloudOff } from "lucide-react-native";
import { RefreshControl, View } from "react-native";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ItineraryTimeline, type ItineraryTimelineItem } from "@/components/itinerary-timeline";
import { useItinerary, type ItineraryItemWithEvent } from "@/lib/use-itinerary";

function ItineraryTimelineSkeleton() {
  return (
    <View className="mt-4 gap-4">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row gap-3">
          <Skeleton className="h-4 w-12 rounded" />
          <View className="flex-1 gap-2 rounded-md p-3">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </View>
        </View>
      ))}
    </View>
  );
}

function toTimelineItem(item: ItineraryItemWithEvent): ItineraryTimelineItem {
  return {
    id: item.event.id,
    title: item.event.title,
    venueName: item.event.venue.name,
    startsAt: item.event.startsAt,
    endsAt: item.event.endsAt,
    venue: { lat: item.event.venue.lat, lng: item.event.venue.lng },
  };
}

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(endsAt).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${start} – ${end}`;
}

export default function ItineraryScreen() {
  const { items, isLoading, isRefreshing, error, isOffline, pendingSyncCount, refresh, removeFromItinerary } =
    useItinerary();
  const [selected, setSelected] = useState<ItineraryTimelineItem | null>(null);
  const [wasClash, setWasClash] = useState(false);

  const timelineItems = items.map(toTimelineItem);

  async function handleRemove() {
    if (!selected) return;
    await removeFromItinerary(selected.id);
    setSelected(null);
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 pb-3 pt-16">
        <Text variant="h4">My Itinerary</Text>
      </View>

      <View className="flex-1 px-4">
        {isOffline || pendingSyncCount > 0 ? (
          <View className="bg-secondary mt-3 flex-row items-center gap-2 rounded-md px-3 py-2">
            <Icon as={CloudOff} size={14} className="text-secondary-foreground" />
            <Text variant="small">
              {isOffline ? "Offline- showing saved itinerary" : "Back online"}
              {pendingSyncCount > 0
                ? ` · ${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} pending sync`
                : ""}
            </Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive mb-2 mt-2">{error}</Text> : null}

        {isLoading ? (
          <ItineraryTimelineSkeleton />
        ) : (
          <ItineraryTimeline
            items={timelineItems}
            emptyMessage="Nothing here yet- add events from Discover."
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
            onItemPress={(item) => {
              setWasClash(false);
              setSelected(item);
            }}
            onConflictPress={(item) => {
              setWasClash(true);
              setSelected(item);
            }}
          />
        )}
      </View>

      <AlertDialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {selected ? formatRange(selected.startsAt, selected.endsAt) : ""}
              {"\n"}
              {selected?.venueName}
              {wasClash ? "\n\nThis clashes with another item in your itinerary." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Close</Text>
            </AlertDialogCancel>
            <AlertDialogAction onPress={handleRemove}>
              <Text>Remove</Text>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
