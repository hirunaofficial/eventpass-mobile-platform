/**
 * "My plan" screen - renders the custom <ItineraryTimeline>.
 *
 * The screen owns the data and the remove flow; the timeline owns the
 * drawing and works out clashes itself by calling the shared
 * findClash(). That split is why the component can be reused without
 * the caller having to understand the constraint rules.
 */
import { useState } from "react";
import { CloudOff } from "lucide-react-native";
import { RefreshControl, View } from "react-native";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ItineraryTimeline, type ItineraryTimelineItem } from "@/components/itinerary-timeline";
import { ApiError } from "@/lib/api";
import { useItinerary, type ItineraryItemWithEvent } from "@/lib/use-itinerary";

function ItineraryTimelineSkeleton() {
  return (
    <View className="gap-4">
      {[0, 1, 2].map((i) => (
        <View key={i} className="flex-row gap-3">
          <Skeleton className="h-4 w-12 rounded" />
          <View className="border-border bg-card flex-1 gap-2 rounded-xl border p-3">
            <Skeleton className="h-4 w-2/3 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </View>
        </View>
      ))}
    </View>
  );
}

// Maps the API shape onto the component's own minimal prop shape, so
// the timeline never depends on EventPass's API types.
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
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const timelineItems = items.map(toTimelineItem);

  async function handleRemove() {
    if (!selected) return;
    setRemoveError(null);
    setIsRemoving(true);
    try {
      await removeFromItinerary(selected.id);
      setSelected(null);
    } catch (e) {
      // removeFromItinerary re-throws on a real server rejection (as
      // opposed to "offline," which it already handles by queuing)- if
      // that happens, keep the dialog open and say why instead of
      // leaving the user wondering if "Remove" did anything.
      setRemoveError(e instanceof ApiError ? e.message : "Couldn't remove this item.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <View className="bg-background flex-1">
      <View className="gap-1 px-5 pb-4 pt-16">
        <Text className="text-primary font-ui text-sm">Your schedule</Text>
        <View className="flex-row items-end justify-between">
          <Text className="font-display text-4xl">My plan</Text>
          {!isLoading ? (
            <View className="border-border bg-card rounded-md border px-3 py-1.5">
              <Text className="font-ui text-sm">
                {items.length} event{items.length === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-1 px-5">
        {isOffline || pendingSyncCount > 0 ? (
          <View className="border-border bg-card mb-3 flex-row items-center gap-2 rounded-md border px-4 py-2.5">
            <Icon as={CloudOff} size={14} className="text-signal" />
            <Text variant="small">
              {isOffline ? "Offline- showing saved itinerary" : "Back online"}
              {pendingSyncCount > 0
                ? ` · ${pendingSyncCount} change${pendingSyncCount === 1 ? "" : "s"} pending sync`
                : ""}
            </Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive mb-2">{error}</Text> : null}

        {isLoading ? (
          <ItineraryTimelineSkeleton />
        ) : (
          <ItineraryTimeline
            items={timelineItems}
            emptyMessage="Nothing planned yet- add events from Discover."
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#E8FF52" />
            }
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

      <AlertDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
            setRemoveError(null);
          }
        }}
      >
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
          {removeError ? <Text className="text-destructive">{removeError}</Text> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Close</Text>
            </AlertDialogCancel>
            <Button variant="destructive" loading={isRemoving} onPress={handleRemove}>
              <Text>{isRemoving ? "Removing..." : "Remove"}</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
