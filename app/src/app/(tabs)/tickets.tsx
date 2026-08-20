import { CalendarDays, CloudOff, MapPin, QrCode, ScanLine } from "lucide-react-native";
import { useState } from "react";
import { router } from "expo-router";
import { FlatList, Modal, RefreshControl, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import type { TicketWithEvent } from "@eventpass/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
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

function TicketCard({ ticket, onShowQr }: { ticket: TicketWithEvent; onShowQr: () => void }) {
  return (
    <Card className="mb-3">
      <CardHeader className="flex-row items-center gap-3">
        <View className="bg-primary h-10 w-10 items-center justify-center rounded-full">
          <Icon as={CalendarDays} size={18} className="text-primary-foreground" />
        </View>
        <View className="flex-1">
          <Text variant="large">{ticket.event.title}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={12} className="text-muted-foreground" />
            <Text variant="muted">{ticket.event.venue.name}</Text>
          </View>
        </View>
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

export default function TicketsScreen() {
  const { tickets, isLoading, error, isOffline, pendingSyncCount, refresh } = useTickets();
  const [qrTicket, setQrTicket] = useState<TicketWithEvent | null>(null);

  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-center justify-between border-b px-4 pb-3 pt-16">
        <Text variant="h4">My Tickets</Text>
        <Button variant="ghost" size="icon" onPress={() => router.push("/scan")}>
          <Icon as={ScanLine} size={20} />
        </Button>
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

        {!isLoading && tickets.length === 0 ? (
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
            refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
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
          <View className="bg-card w-full items-center gap-4 rounded-xl p-6">
            <Text variant="large">{qrTicket?.event.title}</Text>
            {qrTicket ? <QRCode value={qrTicket.qrToken} size={220} /> : null}
            <Text variant="muted">Show this at check-in</Text>
            <Button onPress={() => setQrTicket(null)}>
              <Text>Close</Text>
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}
