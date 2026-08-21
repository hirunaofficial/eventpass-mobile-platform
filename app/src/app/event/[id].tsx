import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { MapPin, TicketIcon, Users } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import type { ClashReason } from "@eventpass/shared";
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
import { Icon } from "@/components/ui/icon";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
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

function clashMessage(reason: ClashReason): string {
  if (reason.type === "time_overlap") {
    return "This event overlaps with something already in your itinerary.";
  }
  return `You'd only have ${reason.availableMinutes} min to travel between venues, but need about ${reason.neededMinutes} min.`;
}

export default function EventDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { events, isLoading } = useEvents();
  const { addToItinerary } = useItinerary();
  const { purchaseTicket } = useTickets();

  const [clashInfo, setClashInfo] = useState<ClashReason | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);

  const event = events.find((item) => item.id === id);

  async function handleAdd() {
    if (!event) return;
    const result = await addToItinerary(event);
    if (!result.ok) {
      setClashInfo(result.reason);
    } else {
      setNotice({ title: "Added", message: "This event was added to your itinerary." });
    }
  }

  async function handleBuy() {
    if (!event) return;
    const result = await purchaseTicket(event.id);
    if (!result.ok) {
      setNotice({ title: "Couldn't buy this ticket", message: result.error });
    } else if (result.queued) {
      setNotice({
        title: "Purchase queued",
        message: "You're offline- this ticket will be purchased automatically once you're back online.",
      });
    } else {
      setNotice({ title: "Ticket purchased", message: "Find your QR code under the Tickets tab." });
    }
  }

  if (isLoading && !event) {
    return (
      <View className="bg-background flex-1">
        <View className="border-border border-b px-4 pb-3 pt-16">
          <Button variant="ghost" size="sm" className="self-start" onPress={() => router.back()}>
            <Text>Back</Text>
          </Button>
        </View>
        <View className="gap-3 p-4">
          <Skeleton className="h-6 w-3/4 rounded" />
          <Skeleton className="h-4 w-1/2 rounded" />
          <Skeleton className="h-32 w-full rounded" />
        </View>
      </View>
    );
  }

  if (!event) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Text variant="large" className="text-center">
          This event couldn't be found.
        </Text>
        <Button onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 pb-3 pt-16">
        <Button variant="ghost" size="sm" className="self-start" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <EventImage uri={event.imageUrl} className="h-56 w-full" iconSize={48} />

        <View className="p-4">
          <Text variant="h3">{event.title}</Text>

          <View className="mt-3 flex-row flex-wrap gap-2">
            <Badge variant="secondary">
              <Text variant="small">
                {formatDateTime(event.startsAt)} – {formatEndTime(event.endsAt)}
              </Text>
            </Badge>
            <Badge variant="outline">
              <Icon as={TicketIcon} size={10} className="text-foreground" />
              <Text variant="small">{event.remaining} left</Text>
            </Badge>
          </View>

          <View className="mt-4 flex-row items-start gap-2">
            <Icon as={MapPin} size={16} className="text-muted-foreground mt-0.5" />
            <View className="flex-1">
              <Text variant="large">{event.venue.name}</Text>
              <Text variant="muted">{event.venue.address}</Text>
            </View>
          </View>

          <View className="mt-4 gap-1.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Icon as={Users} size={16} className="text-muted-foreground" />
                <Text variant="muted">
                  {event.capacity - event.remaining} of {event.capacity} tickets claimed
                </Text>
              </View>
              <Text variant="small" className="text-muted-foreground">
                {event.remaining} left
              </Text>
            </View>
            <Progress value={((event.capacity - event.remaining) / event.capacity) * 100} />
          </View>

          <Text variant="muted" className="mt-4">
            {event.description}
          </Text>

          <View className="mt-6 flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={handleBuy}>
              <Text>Buy ticket</Text>
            </Button>
            <Button className="flex-1" onPress={handleAdd}>
              <Text>Add to itinerary</Text>
            </Button>
          </View>
        </View>
      </ScrollView>

      <AlertDialog open={clashInfo !== null} onOpenChange={(open) => !open && setClashInfo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Can't add this event</AlertDialogTitle>
            <AlertDialogDescription>{clashInfo ? clashMessage(clashInfo) : ""}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogAction onPress={() => setClashInfo(null)}>
            <Text>OK</Text>
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>

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
