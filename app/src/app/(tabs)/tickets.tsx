import { CheckCircle2, CloudOff, MapPin, QrCode } from "lucide-react-native";
import { useState } from "react";
import { FlatList, Modal, RefreshControl, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { TicketWithEvent } from "@eventpass/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { EventImage } from "@/components/event-image";
import { useTickets } from "@/lib/use-tickets";

function formatEventTime(startsAt: string) {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCheckedInTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function TicketCardSkeleton() {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-lg" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </View>
      </CardHeader>
      <CardContent className="gap-3">
        <Skeleton className="h-3 w-2/3 rounded" />
        <Skeleton className="h-9 w-36 rounded-md" />
      </CardContent>
    </Card>
  );
}

function TicketCard({ ticket, onShowQr }: { ticket: TicketWithEvent; onShowQr: () => void }) {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center gap-3">
        <EventImage imageKey={ticket.event.imageKey} className="h-14 w-14 rounded-lg" iconSize={20} />
        <View className="flex-1">
          <Text variant="large">{ticket.event.title}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={12} className="text-muted-foreground" />
            <Text variant="muted">{ticket.event.venue.name}</Text>
          </View>
        </View>
        {ticket.checkedInAt ? (
          <Badge variant="secondary">
            <Icon as={CheckCircle2} size={10} className="text-secondary-foreground" />
            <Text variant="small">Checked in</Text>
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="gap-3">
        <Text variant="muted">{formatEventTime(ticket.event.startsAt)}</Text>
        <Button variant="outline" size="sm" onPress={onShowQr}>
          <Icon as={QrCode} size={16} />
          <Text>Show ticket QR</Text>
        </Button>
      </CardContent>
    </Card>
  );
}

function TicketStub({ ticket }: { ticket: TicketWithEvent }) {
  return (
    <View className="bg-card w-full overflow-hidden rounded-2xl">
      <EventImage imageKey={ticket.event.imageKey} className="h-32 w-full" iconSize={32} />

      <View className="gap-1 p-5">
        <Text variant="h4">{ticket.event.title}</Text>
        <View className="flex-row items-center gap-1">
          <Icon as={MapPin} size={12} className="text-muted-foreground" />
          <Text variant="muted">{ticket.event.venue.name}</Text>
        </View>
        <Text variant="muted">{formatEventTime(ticket.event.startsAt)}</Text>
      </View>

      <View className="flex-row items-center px-2">
        <View className="bg-background h-6 w-6 rounded-full" style={{ marginLeft: -12 }} />
        <View className="border-border h-px flex-1 border-t border-dashed" />
        <View className="bg-background h-6 w-6 rounded-full" style={{ marginRight: -12 }} />
      </View>

      <View className="items-center gap-3 p-6">
        <QRCode value={ticket.qrToken} size={200} />
        {ticket.checkedInAt ? (
          <Badge variant="secondary">
            <Icon as={CheckCircle2} size={10} className="text-secondary-foreground" />
            <Text variant="small">Checked in at {formatCheckedInTime(ticket.checkedInAt)}</Text>
          </Badge>
        ) : (
          <Text variant="muted">Show this at check-in</Text>
        )}
      </View>
    </View>
  );
}

export default function TicketsScreen() {
  const { tickets, isLoading, isRefreshing, error, isOffline, pendingSyncCount, refresh } =
    useTickets();
  const [qrTicket, setQrTicket] = useState<TicketWithEvent | null>(null);

  return (
    <View className="bg-background flex-1">
      <View className="border-border border-b px-4 pb-3 pt-16">
        <Text variant="h4">My Tickets</Text>
      </View>

      <View className="flex-1 px-4">
        {isOffline || pendingSyncCount > 0 ? (
          <View className="bg-secondary mt-3 flex-row items-center gap-2 rounded-md px-3 py-2">
            <Icon as={CloudOff} size={14} className="text-secondary-foreground" />
            <Text variant="small">
              {isOffline ? "Offline- showing saved tickets" : "Back online"}
              {pendingSyncCount > 0
                ? ` · ${pendingSyncCount} purchase${pendingSyncCount === 1 ? "" : "s"} pending sync`
                : ""}
            </Text>
          </View>
        ) : null}

        {error ? <Text className="text-destructive mb-2 mt-2">{error}</Text> : null}

        {isLoading ? (
          <View className="mt-3">
            <TicketCardSkeleton />
            <TicketCardSkeleton />
          </View>
        ) : tickets.length === 0 ? (
          <Text variant="muted" className="mt-4">
            No tickets yet- buy one from an event on Discover.
          </Text>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TicketCard ticket={item} onShowQr={() => setQrTicket(item)} />
            )}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
          />
        )}
      </View>

      <Modal
        visible={qrTicket !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQrTicket(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 p-6">
          {qrTicket ? <TicketStub ticket={qrTicket} /> : null}
          <Button className="mt-4 w-full" variant="secondary" onPress={() => setQrTicket(null)}>
            <Text>Close</Text>
          </Button>
        </View>
      </Modal>
    </View>
  );
}
