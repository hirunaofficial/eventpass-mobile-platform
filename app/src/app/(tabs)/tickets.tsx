import * as LegacyFileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import {
  CheckCircle2,
  CloudOff,
  Download,
  MapPin,
  QrCode,
} from "lucide-react-native";
import { useRef, useState } from "react";
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
    <View className="border-border bg-card rounded-card mb-3 border p-3">
      <View className="flex-row items-center gap-3">
        <View className="bg-elevated h-14 w-14 overflow-hidden rounded-xl">
          <EventImage imageKey={ticket.event.imageKey} className="h-full w-full" iconSize={20} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-title text-base">
            {ticket.event.title}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon as={MapPin} size={11} className="text-muted-foreground" />
            <Text variant="muted" numberOfLines={1}>
              {ticket.event.venue.name}
            </Text>
          </View>
          <Text variant="muted">{formatEventTime(ticket.event.startsAt)}</Text>
        </View>
        {ticket.checkedInAt ? (
          <View className="bg-signal/15 flex-row items-center gap-1 rounded-full px-2.5 py-1">
            <Icon as={CheckCircle2} size={10} className="text-signal" />
            <Text className="text-signal font-ui text-eyebrow uppercase">In</Text>
          </View>
        ) : null}
      </View>
      <Button variant="outline" size="sm" className="mt-3 rounded-full" onPress={onShowQr}>
        <Icon as={QrCode} size={16} />
        <Text>Show ticket QR</Text>
      </Button>
    </View>
  );
}

/**
 * Writes the rendered QR out as a PNG in the device's photo library.
 *
 * This is what makes the full purchase -> check-in loop demonstrable on a
 * SINGLE phone: the staff scanner cannot photograph a QR displayed on its
 * own screen, so the ticket is saved here and picked from the library on
 * the scanner side instead.
 *
 * react-native-qrcode-svg exposes the underlying SVG through `getRef`,
 * whose `toDataURL` hands back base64 PNG data. That is written to the
 * cache directory and handed to MediaLibrary, which needs a real file URI
 * and cannot take a data URI directly.
 */
function TicketStub({ ticket }: { ticket: TicketWithEvent }) {
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function saveQrToPhotos() {
    setSaveState("saving");
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setSaveState("error");
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        if (!qrRef.current) return reject(new Error("QR not rendered yet"));
        qrRef.current.toDataURL(resolve);
      });

      const uri = `${LegacyFileSystem.cacheDirectory}eventpass-ticket-${ticket.id}.png`;
      await LegacyFileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
      // `MediaLibrary.saveToLibraryAsync` is NOT merely deprecated in
      // SDK 57- it throws unconditionally. `Asset.create()` replaces it.
      await MediaLibrary.Asset.create(uri);
      setSaveState("saved");
    } catch (e) {
      // Surface the real reason instead of a blank failure; a silent
      // "couldn't save" gave no clue that the API itself was throwing.
      console.error("Failed to save ticket QR to photo library", e);
      setSaveState("error");
    }
  }

  return (
    <View className="border-border bg-card rounded-card w-full overflow-hidden border">
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
        {/* The QR sits on an explicit white plate. On the dark theme the
            surrounding surface is near-black, and scanners need the
            light quiet-zone around the code to find it reliably. */}
        <View className="rounded-2xl bg-white p-4">
          <QRCode
            value={ticket.qrToken}
            size={200}
            backgroundColor="#FFFFFF"
            color="#000000"
            getRef={(c) => (qrRef.current = c)}
          />
        </View>
        {ticket.checkedInAt ? (
          <View className="bg-signal/15 flex-row items-center gap-1.5 rounded-full px-3 py-1.5">
            <Icon as={CheckCircle2} size={12} className="text-signal" />
            <Text className="text-signal font-ui text-sm">
              Checked in at {formatCheckedInTime(ticket.checkedInAt)}
            </Text>
          </View>
        ) : (
          <Text variant="muted">Show this at check-in</Text>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-1 rounded-full"
          disabled={saveState === "saving"}
          onPress={saveQrToPhotos}
        >
          <Icon as={Download} size={14} />
          <Text>
            {saveState === "saving"
              ? "Saving..."
              : saveState === "saved"
                ? "Saved to Photos"
                : saveState === "error"
                  ? "Couldn't save- tap to retry"
                  : "Save QR to Photos"}
          </Text>
        </Button>
        <Text variant="muted" className="text-center">
          Saving lets a single phone scan its own ticket from the gallery.
        </Text>
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
      <View className="gap-1 px-5 pb-4 pt-16">
        <Text className="text-primary font-ui text-sm">Your wallet</Text>
        <View className="flex-row items-end justify-between">
          <Text className="font-display text-4xl">Tickets</Text>
          {!isLoading ? (
            <View className="border-border bg-card rounded-md border px-3 py-1.5">
              <Text className="font-ui text-sm">
                {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View className="flex-1 px-5">
        {isOffline || pendingSyncCount > 0 ? (
          <View className="border-border bg-card mb-3 flex-row items-center gap-2 rounded-full border px-4 py-2.5">
            <Icon as={CloudOff} size={14} className="text-signal" />
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
          <View className="gap-3 py-16">
            <View className="bg-border h-px w-full" />
            <Text className="font-display text-2xl">No tickets yet</Text>
            <Text variant="muted" className="max-w-[280px]">
              Anything you buy shows up here with a QR code, and keeps working offline.
            </Text>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TicketCard ticket={item} onShowQr={() => setQrTicket(item)} />
            )}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={refresh} tintColor="#E8FF52" />
            }
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
