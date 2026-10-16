import type { TicketWithEvent } from "@eventpass/shared";
import { forwardRef } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { EventImage } from "@/components/event-image";
import { Text } from "@/components/ui/text";

/**
 * <TicketShareCard> - the ticket as it is SAVED to the photo library.
 *
 * Saving used to export the bare QR bitmap, which is functional but
 * anonymous: a square of pixels with no indication of what event it is
 * for or that it came from EventPass. Since the saved image is also
 * what gets scanned at the door on a single device, and what a user
 * might send to a friend, it should carry the context.
 *
 * Rendered OFF-SCREEN at a fixed size and captured with
 * `captureRef`, so the exported image is always the same dimensions
 * regardless of the device it was saved on. It is deliberately not the
 * on-screen stub component: that one is laid out for a phone viewport,
 * this one is laid out for a saved image.
 *
 * Colours are hardcoded rather than Tailwind tokens because the export
 * must look identical whatever theme the app is in - a ticket saved in
 * light mode should not come out white.
 */

const WIDTH = 820;
const INK = "#E8FF52";
const PAPER = "#141210";
const SURFACE = "#1E1B17";
const BONE = "#F2EFE6";
const MUTED = "#8A8276";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const TicketShareCard = forwardRef<View, { ticket: TicketWithEvent }>(
  function TicketShareCard({ ticket }, ref) {
    return (
      <View
        ref={ref}
        collapsable={false}
        style={{ width: WIDTH, backgroundColor: PAPER, padding: 44 }}
      >
        {/* Wordmark */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <View style={{ width: 16, height: 16, borderRadius: 3, backgroundColor: INK }} />
          <Text style={{ color: INK, fontSize: 15, letterSpacing: 3, fontFamily: "PlusJakartaSans_600SemiBold" }}>
            EVENTPASS
          </Text>
        </View>

        {/* Event artwork */}
        <View style={{ height: 240, borderRadius: 4, overflow: "hidden", backgroundColor: SURFACE }}>
          <EventImage imageKey={ticket.event.imageKey} className="h-full w-full" iconSize={52} />
        </View>

        {/* Details */}
        <Text
          numberOfLines={2}
          style={{ color: BONE, fontSize: 44, lineHeight: 50, marginTop: 26, fontFamily: "PlusJakartaSans_800ExtraBold" }}
        >
          {ticket.event.title}
        </Text>
        <Text style={{ color: MUTED, fontSize: 20, marginTop: 10, fontFamily: "PlusJakartaSans_400Regular" }}>
          {ticket.event.venue.name}
        </Text>
        <Text style={{ color: MUTED, fontSize: 20, marginTop: 2, fontFamily: "PlusJakartaSans_400Regular" }}>
          {formatWhen(ticket.event.startsAt)}
        </Text>

        {/* Perforation, echoing the app icon */}
        <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 30 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: PAPER, marginLeft: -58 }} />
          <View style={{ flex: 1, height: 2, backgroundColor: "#322C25" }} />
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: PAPER, marginRight: -58 }} />
        </View>

        {/* QR on an explicit white plate- scanners need the light
            quiet-zone, and the card itself is near-black. */}
        <View style={{ alignItems: "center", gap: 18 }}>
          <View style={{ backgroundColor: "#FFFFFF", padding: 22, borderRadius: 6 }}>
            <QRCode value={ticket.qrToken} size={300} backgroundColor="#FFFFFF" color="#000000" />
          </View>
          <Text style={{ color: MUTED, fontSize: 17, fontFamily: "PlusJakartaSans_500Medium" }}>
            Show this at check-in
          </Text>
          <Text style={{ color: "#4A443B", fontSize: 14, fontFamily: "PlusJakartaSans_400Regular" }}>
            REF {ticket.qrToken.slice(-10).toUpperCase()}
          </Text>
        </View>
      </View>
    );
  }
);
