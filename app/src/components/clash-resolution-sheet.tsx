import type { ClashReason, EventWithVenue, Resolution } from "@eventpass/shared";
import { ArrowRight, CalendarClock, MapPin, Repeat2, TriangleAlert } from "lucide-react-native";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { EventImage } from "@/components/event-image";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * <ClashResolutionSheet> - the UI half of the constraint algorithm.
 *
 * `findClash` says no; `suggestAlternatives` says what you can do about
 * it. This sheet is what turns the second half into something the user
 * can act on, so a rejected add is never a dead end.
 *
 * It renders two distinct kinds of repair, deliberately styled
 * differently because they cost the user different things:
 *   - ALTERNATIVE: a different event that fits as-is. Costs nothing, so
 *     it is listed first and styled as the primary path.
 *   - SWAP: drop something already planned to make room. Costs the user
 *     an existing commitment, so it is visually secondary and always
 *     names exactly what would be given up.
 */

function formatWhen(startsAt: string) {
  return new Date(startsAt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function reasonHeadline(reason: ClashReason): string {
  return reason.type === "time_overlap"
    ? "That overlaps something you've already planned"
    : "There isn't enough time to travel between venues";
}

function reasonDetail(reason: ClashReason, clashTitle: string): string {
  if (reason.type === "time_overlap") {
    return `It runs at the same time as ${clashTitle}.`;
  }
  return `After ${clashTitle} you'd have ${reason.availableMinutes} min to get there, but the trip takes about ${reason.neededMinutes} min.`;
}

export interface ClashResolutionSheetProps {
  /** The event the user tried to add, or null when the sheet is closed. */
  candidate: EventWithVenue | null;
  /** Why the constraint check rejected it. */
  reason: ClashReason | null;
  /** Repairs from suggestAlternatives(), best-first. */
  resolutions: Resolution[];
  /** Full catalogue, used to resolve alternative ids to real events. */
  events: EventWithVenue[];
  /** Fired when the user picks a different event that fits. */
  onChooseAlternative: (event: EventWithVenue) => void;
  /** Fired with the event id to drop so the candidate becomes legal. */
  onChooseSwap: (dropEventId: string) => void;
  onDismiss: () => void;
}

export function ClashResolutionSheet({
  candidate,
  reason,
  resolutions,
  events,
  onChooseAlternative,
  onChooseSwap,
  onDismiss,
}: ClashResolutionSheetProps) {
  if (!candidate || !reason) return null;

  const byId = (id: string) => events.find((e) => e.id === id);
  const clashTitle = byId(reason.withEventId)?.title ?? "another event";

  const alternatives = resolutions.flatMap((r) =>
    r.type === "alternative"
      ? [{ resolution: r, event: byId(r.eventId) }].filter((x) => x.event)
      : []
  ) as { resolution: Extract<Resolution, { type: "alternative" }>; event: EventWithVenue }[];

  const swaps = resolutions.flatMap((r) =>
    r.type === "swap" ? [{ dropId: r.dropEventId, event: byId(r.dropEventId) }] : []
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable onPress={onDismiss} className="flex-1 justify-end bg-black/70">
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="border-border bg-background max-h-[85%] rounded-t-card border-t px-5 pb-10 pt-3"
        >
          <View className="bg-border mb-5 h-1 w-10 self-center rounded-full" />

          <View className="flex-row items-start gap-3">
            <View className="bg-destructive/15 h-10 w-10 items-center justify-center rounded-full">
              <Icon as={TriangleAlert} size={18} className="text-destructive" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-heading text-xl">{reasonHeadline(reason)}</Text>
              <Text variant="muted">{reasonDetail(reason, clashTitle)}</Text>
            </View>
          </View>

          <ScrollView className="mt-6" showsVerticalScrollIndicator={false}>
            {alternatives.length > 0 ? (
              <View className="gap-3">
                <Text variant="eyebrow">Fits your schedule</Text>
                {alternatives.map(({ resolution, event }) => (
                  <Pressable
                    key={event.id}
                    onPress={() => onChooseAlternative(event)}
                    className="border-border bg-card flex-row items-center gap-3 rounded-xl border p-3"
                  >
                    <View className="h-14 w-14 overflow-hidden rounded-lg">
                      <EventImage imageKey={event.imageKey} className="h-full w-full" iconSize={20} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text numberOfLines={1} className="font-title text-base">
                        {event.title}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Icon as={CalendarClock} size={11} className="text-muted-foreground" />
                        <Text variant="muted" numberOfLines={1}>
                          {formatWhen(event.startsAt)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Icon as={MapPin} size={11} className="text-muted-foreground" />
                        <Text variant="muted" numberOfLines={1}>
                          {event.venue.name}
                        </Text>
                      </View>
                    </View>
                    {resolution.sameCategory ? (
                      <View className="bg-primary/15 rounded-full px-2 py-1">
                        <Text className="text-primary font-ui text-eyebrow uppercase">Similar</Text>
                      </View>
                    ) : null}
                    <Icon as={ArrowRight} size={16} className="text-muted-foreground" />
                  </Pressable>
                ))}
              </View>
            ) : null}

            {swaps.length > 0 ? (
              <View className="mt-6 gap-3">
                <Text variant="eyebrow">Or make room for it</Text>
                {swaps.map(({ dropId, event }) => (
                  <Pressable
                    key={dropId}
                    onPress={() => onChooseSwap(dropId)}
                    className="border-border flex-row items-center gap-3 rounded-xl border border-dashed p-3"
                  >
                    <View className="bg-secondary h-10 w-10 items-center justify-center rounded-full">
                      <Icon as={Repeat2} size={16} className="text-secondary-foreground" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-title text-base">
                        Drop {event?.title ?? "the clashing event"}
                      </Text>
                      <Text variant="muted">
                        Removes it from your plan, then adds {candidate.title}.
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {alternatives.length === 0 && swaps.length === 0 ? (
              <View className="bg-card border-border rounded-xl border p-4">
                <Text variant="muted">
                  Nothing else in the catalogue fits around your current plan, and no single change
                  would make room for this one.
                </Text>
              </View>
            ) : null}
          </ScrollView>

          <Button variant="outline" className="mt-6" onPress={onDismiss}>
            <Text>Keep my plan as it is</Text>
          </Button>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
