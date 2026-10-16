/**
 * Event detail screen.
 *
 * Reads the event out of the ALREADY-FETCHED list from useEvents()
 * rather than fetching by id. That means it works offline for free (the
 * list is cached) and costs no extra request. Trade-off: deep-linking
 * straight here before the list loads shows the not-found state.
 */
import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CalendarClock, MapPin, TicketIcon, Users } from "lucide-react-native";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import type { ClashReason, Resolution } from "@eventpass/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ClashResolutionSheet } from "@/components/clash-resolution-sheet";
import { EventImage } from "@/components/event-image";
import { useEvents } from "@/lib/use-events";
import { useItinerary } from "@/lib/use-itinerary";
import { useTickets } from "@/lib/use-tickets";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatEndTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function BackButton() {
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      className="border-border bg-card/90 h-10 w-10 items-center justify-center rounded-full border"
    >
      <Icon as={ArrowLeft} size={18} className="text-foreground" />
    </Pressable>
  );
}

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, isLoading, isRefreshing, refresh } = useEvents();
  const { addToItinerary, removeFromItinerary } = useItinerary();
  const { purchaseTicket } = useTickets();

  const [clash, setClash] = useState<{ reason: ClashReason; resolutions: Resolution[] } | null>(
    null
  );
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const event = events.find((item) => item.id === id);

  // Passing the whole catalogue lets the constraint solver propose real
  // alternatives on rejection instead of just saying no.
  async function handleAdd() {
    if (!event) return;
    setIsAdding(true);
    try {
      const result = await addToItinerary(event, events);
      if (!result.ok) {
        setClash({ reason: result.reason, resolutions: result.resolutions });
      } else {
        setNotice({
          title: "Added to your plan",
          message: `${event.title} is now in your itinerary.`,
        });
      }
    } finally {
      setIsAdding(false);
    }
  }

  // "Make room for it": drop the blocking item, then retry the add.
  async function handleSwap(dropEventId: string) {
    setClash(null);
    if (!event) return;
    setIsAdding(true);
    try {
      await removeFromItinerary(dropEventId);
      await addToItinerary(event, events);
    } finally {
      setIsAdding(false);
    }
  }

  function handleBuy() {
    if (!event) return;
    router.push(`/checkout/${event.id}`);
  }

  if (isLoading && !event) {
    return (
      <View className="bg-background flex-1">
        <View className="px-5 pt-16">
          <BackButton />
        </View>
        <View className="gap-3 p-5">
          <Skeleton className="h-52 w-full rounded-card" />
          <Skeleton className="h-7 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Text className="font-title text-center text-lg">This event couldn't be found.</Text>
        <Button className="rounded-md" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  // `remaining` is server-authoritative; a cached value can be stale,
  // which is why buying is never applied optimistically offline.
  const claimed = event.capacity - event.remaining;
  const soldOut = event.remaining <= 0;

  return (
    <View className="bg-background flex-1">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        // The detail screen reads from the cached list, so refreshing
        // here refetches that list and this screen follows.
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#E8FF52" />
        }
      >
        <View className="h-72 w-full">
          <EventImage imageKey={event.imageKey} className="h-full w-full" iconSize={56} />
          <View className="absolute left-5 top-16">
            <BackButton />
          </View>
        </View>

        {/* Pulled up over the artwork so the sheet reads as a layer above
            it rather than a seam between two blocks. */}
        <View className="bg-background rounded-t-card -mt-6 gap-5 px-5 pt-6">
          <View className="gap-2">
            <Text variant="eyebrow">{event.imageKey ?? "Event"}</Text>
            <Text className="font-display text-3xl">{event.title}</Text>
          </View>

          <View className="border-border bg-card rounded-card gap-4 border p-4">
            <View className="flex-row items-start gap-3">
              <Icon as={CalendarClock} size={16} className="text-primary mt-0.5" />
              <View className="flex-1">
                <Text className="font-title text-base">
                  {formatDateTime(event.startsAt)}
                </Text>
                <Text variant="muted">Ends {formatEndTime(event.endsAt)}</Text>
              </View>
            </View>

            <View className="bg-border h-px" />

            <View className="flex-row items-start gap-3">
              <Icon as={MapPin} size={16} className="text-primary mt-0.5" />
              <View className="flex-1">
                <Text className="font-title text-base">{event.venue.name}</Text>
                <Text variant="muted">{event.venue.address}</Text>
              </View>
            </View>
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon as={Users} size={14} className="text-muted-foreground" />
                <Text variant="muted">
                  {claimed} of {event.capacity} claimed
                </Text>
              </View>
              <Text className={soldOut ? "text-destructive font-ui text-sm" : "font-ui text-sm"}>
                {soldOut ? "Sold out" : `${event.remaining} left`}
              </Text>
            </View>
            <Progress value={(claimed / event.capacity) * 100} />
          </View>

          <View className="gap-2">
            <Text variant="eyebrow">About</Text>
            <Text variant="muted" className="leading-6">
              {event.description}
            </Text>
          </View>

          <View className="mt-2 flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-md"
              disabled={soldOut}
              onPress={handleBuy}
            >
              <Icon as={TicketIcon} size={15} />
              <Text>{soldOut ? "Sold out" : "Buy ticket"}</Text>
            </Button>
            <Button className="flex-1 rounded-md" loading={isAdding} onPress={handleAdd}>
              <Text>{isAdding ? "Adding..." : "Add to plan"}</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      <ClashResolutionSheet
        candidate={clash ? event : null}
        reason={clash?.reason ?? null}
        resolutions={clash?.resolutions ?? []}
        events={events}
        onChooseAlternative={(alternative) => {
          setClash(null);
          router.replace(`/event/${alternative.id}`);
        }}
        onChooseSwap={handleSwap}
        onDismiss={() => setClash(null)}
      />

      <AlertDialog open={notice !== null} onOpenChange={(open) => !open && setNotice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{notice?.title}</AlertDialogTitle>
            <AlertDialogDescription>{notice?.message ?? ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onPress={() => setNotice(null)}>
            <Text>OK</Text>
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
