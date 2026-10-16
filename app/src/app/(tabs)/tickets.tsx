import * as LegacyFileSystem from "expo-file-system/legacy";
// The `/legacy` entry point, NOT the package root. The root's
// Asset.create() requires the ExpoMediaLibraryNext native module,
// which Expo Go does not bundle - importing it crashes the whole
// screen at module load with "Cannot find native module". The legacy
// entry is the path the deprecation notice itself points to, and it
// works in both Expo Go and a dev build.
import * as MediaLibrary from "expo-media-library/legacy";
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
import { captureRef } from "react-native-view-shot";
import type { TicketWithEvent } from "@eventpass/shared";
import { Badge } from "@/components/ui/badge";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { EventImage } from "@/components/event-image";
import { TicketShareCard } from "@/components/ticket-share-card";
import { storeTicketImage } from "@/lib/ticket-images";
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
          <View className="bg-primary/15 flex-row items-center gap-1 rounded-sm px-2 py-1">
            <Icon as={CheckCircle2} size={10} className="text-signal" />
            <Text className="text-signal font-ui text-eyebrow uppercase">In</Text>
          </View>
        ) : null}
      </View>
      <Button variant="outline" size="sm" className="mt-3 rounded-md" onPress={onShowQr}>
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
type SaveState = "idle" | "saving" | "saved" | "saved-in-app" | "error";

const SAVE_LABELS: Record<SaveState, string> = {
  idle: "Save ticket image",
  saving: "Saving...",
  saved: "Saved to Photos",
  "saved-in-app": "Saved to ticket images",
  error: "Couldn't save- tap to retry",
};

function TicketStub({
  ticket,
  onCancel,
}: {
  ticket: TicketWithEvent;
  onCancel: (ticket: TicketWithEvent) => void;
}) {
  // Ref to the off-screen export card, not the on-screen QR: the saved
  // image is a full branded ticket, not a bare bitmap of the code.
  const cardRef = useRef<View>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  /**
   * Exports the ticket twice over: to the device photo library when the
   * runtime allows it, and always into the app's own ticket-image store.
   *
   * The in-app copy is not a fallback for tidiness. Expo Go on Android
   * cannot write to the photo library at all, and without a file on disk
   * the scanner has nothing to read, so one-device check-in stops working
   * entirely. Writing our own copy unconditionally means the demo loop
   * never depends on which runtime the app happens to be running in.
   */
  async function saveTicketImage() {
    setSaveState("saving");
    try {
      // captureRef returns a temp file URI; both MediaLibrary and the
      // image store need a real file and cannot take a data URI.
      const uri = await captureRef(cardRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      let savedToPhotos = false;
      try {
        // Ask for WRITE access to PHOTOS only. The no-argument form
        // requests every granular media permission including AUDIO,
        // which is not declared in the manifest and makes the whole
        // request reject - saving an image should never need the
        // microphone or the music library.
        const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
        if (permission.granted) {
          await MediaLibrary.saveToLibraryAsync(uri);
          savedToPhotos = true;
        }
      } catch (e) {
        // Expected on Expo Go / Android, where media-library writes were
        // removed from the shared client. Not fatal: the in-app copy
        // below is what check-in actually reads.
        console.warn("Photo library unavailable, keeping in-app copy only", e);
      }

      await storeTicketImage(uri, ticket);
      setSaveState(savedToPhotos ? "saved" : "saved-in-app");
    } catch (e) {
      console.error("Failed to export ticket image", e);
      setSaveState("error");
    }
  }

  return (
    <View className="border-border bg-card rounded-card w-full overflow-hidden border">
      {/* Rendered off-screen purely so it can be captured. Positioned
          far left rather than display:none, because a view with no
          layout cannot be snapshotted. */}
      <View style={{ position: "absolute", left: -10000, top: 0 }} pointerEvents="none">
        <TicketShareCard ref={cardRef} ticket={ticket} />
      </View>
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
          />
        </View>
        {ticket.checkedInAt ? (
          <View className="bg-primary/15 flex-row items-center gap-1.5 rounded-sm px-3 py-1.5">
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
          className="mt-1 rounded-md"
          loading={saveState === "saving"}
          onPress={saveTicketImage}
        >
          {saveState !== "saving" ? <Icon as={Download} size={14} /> : null}
          <Text>{SAVE_LABELS[saveState]}</Text>
        </Button>
        <Text variant="muted" className="text-center">
          {saveState === "saved-in-app"
            ? "Kept in the app: this runtime cannot write to Photos. The scanner can still read it."
            : "Saves a full ticket image, so a single phone can scan its own ticket at check-in."}
        </Text>

        {!ticket.checkedInAt && ticket.status !== "cancelled" ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onPress={() => onCancel(ticket)}
          >
            <Text className="text-destructive">Cancel this ticket</Text>
          </Button>
        ) : null}
      </View>
    </View>
  );
}

export default function TicketsScreen() {
  const { tickets, isLoading, isRefreshing, error, isOffline, pendingSyncCount, refresh, cancelTicket } =
    useTickets();
  const [qrTicket, setQrTicket] = useState<TicketWithEvent | null>(null);
  const [pendingCancel, setPendingCancel] = useState<TicketWithEvent | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Cancellation releases a seat back to the event, so it is confirmed
  // rather than fired on a single tap.
  async function confirmCancel() {
    if (!pendingCancel) return;
    setIsCancelling(true);
    setCancelError(null);
    const result = await cancelTicket(pendingCancel.id);
    setIsCancelling(false);
    if (!result.ok) {
      setCancelError(result.error);
      return;
    }
    setPendingCancel(null);
    setQrTicket(null);
  }

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
          <View className="border-border bg-card mb-3 flex-row items-center gap-2 rounded-md border px-4 py-2.5">
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
          {qrTicket ? <TicketStub ticket={qrTicket} onCancel={setPendingCancel} /> : null}
          <Button className="mt-4 w-full" variant="secondary" onPress={() => setQrTicket(null)}>
            <Text>Close</Text>
          </Button>
        </View>
      </Modal>

      <AlertDialog
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCancel(null);
            setCancelError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Your seat for {pendingCancel?.event.title} is released back to the event and the
              ticket stops working. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelError ? <Text className="text-destructive">{cancelError}</Text> : null}
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Text>Keep it</Text>
            </AlertDialogCancel>
            {/* A plain Button, not AlertDialogAction: the dialog must stay
                open if cancellation fails, and AlertDialogAction closes
                before its own onPress runs. */}
            <Button variant="destructive" loading={isCancelling} onPress={confirmCancel}>
              <Text>{isCancelling ? "Cancelling..." : "Cancel ticket"}</Text>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}
