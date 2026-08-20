import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AlertTriangle, MapPin } from "lucide-react-native";
import { findClash } from "@eventpass/shared";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";

/**
 * Custom-built vertical itinerary timeline (spec §8)- no calendar library.
 * Blocks are time-proportional to each event's duration; gaps between
 * blocks are proportional to (a capped version of) the real time gap so
 * multi-day itineraries stay a reasonable scroll height. Clashing items
 * (per the shared findClash() constraint algorithm) are highlighted in
 * red, matching the itinerary's own clash-prevention rule.
 *
 * `onReorder` from the original design note was dropped deliberately-
 * itinerary items are inherently time-ordered, so manual reordering
 * would fight the chronological display rather than complement it.
 */
export interface ItineraryTimelineItem {
  id: string;
  title: string;
  venueName: string;
  startsAt: string;
  endsAt: string;
  venue: { lat: number; lng: number };
}

export interface ItineraryTimelineProps {
  items: ItineraryTimelineItem[];
  onItemPress?: (item: ItineraryTimelineItem) => void;
  onConflictPress?: (item: ItineraryTimelineItem) => void;
}

const PIXELS_PER_MINUTE = 1.1;
const MIN_BLOCK_HEIGHT = 56;
const MAX_GAP_HEIGHT = 48;
const MIN_GAP_HEIGHT = 16;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function ItineraryTimeline({ items, onItemPress, onConflictPress }: ItineraryTimelineProps) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [items]
  );

  const clashingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of sorted) {
      const others = sorted.filter((other) => other.id !== item.id);
      const reason = findClash(item, others);
      if (reason) {
        ids.add(item.id);
        ids.add(reason.withEventId);
      }
    }
    return ids;
  }, [sorted]);

  if (sorted.length === 0) {
    return (
      <View className="items-center justify-center py-12">
        <Text variant="muted">Your itinerary is empty.</Text>
      </View>
    );
  }

  let lastDay: string | null = null;

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {sorted.map((item, index) => {
        const isClashing = clashingIds.has(item.id);
        const day = formatDay(item.startsAt);
        const showDayDivider = day !== lastDay;
        lastDay = day;

        const durationMinutes = Math.max(
          15,
          (new Date(item.endsAt).getTime() - new Date(item.startsAt).getTime()) / 60000
        );
        const blockHeight = Math.max(MIN_BLOCK_HEIGHT, durationMinutes * PIXELS_PER_MINUTE);

        let gapHeight = 0;
        let gapLabel: string | null = null;
        if (index > 0 && !showDayDivider) {
          const prev = sorted[index - 1];
          const gapMinutes =
            (new Date(item.startsAt).getTime() - new Date(prev.endsAt).getTime()) / 60000;
          gapHeight = Math.min(MAX_GAP_HEIGHT, Math.max(MIN_GAP_HEIGHT, gapMinutes * 0.15));
          if (gapMinutes > 180) {
            gapLabel = `${Math.round(gapMinutes / 60)}h gap`;
          }
        }

        return (
          <Animated.View key={item.id} entering={FadeInDown.delay(index * 40)}>
            {showDayDivider ? (
              <View className="mb-2 mt-4 flex-row items-center gap-2">
                <View className="bg-border h-px flex-1" />
                <Text variant="small" className="text-muted-foreground">
                  {day}
                </Text>
                <View className="bg-border h-px flex-1" />
              </View>
            ) : null}

            {gapHeight > 0 ? (
              <View className="flex-row" style={{ height: gapHeight }}>
                <View className="w-16" />
                <View className="ml-2 flex-1 items-center justify-center">
                  {gapLabel ? (
                    <Text variant="small" className="text-muted-foreground">
                      {gapLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            <Pressable
              onPress={() => (isClashing ? onConflictPress?.(item) : onItemPress?.(item))}
              className="flex-row"
              style={{ minHeight: blockHeight }}
            >
              <View className="w-16 items-end pr-2 pt-1">
                <Text variant="small" className="text-muted-foreground">
                  {formatTime(item.startsAt)}
                </Text>
              </View>

              <View className="relative ml-2 flex-1 flex-row">
                <View className={isClashing ? "bg-destructive w-1 rounded-full" : "bg-primary w-1 rounded-full"} />
                <View
                  className={
                    isClashing
                      ? "border-destructive bg-destructive/10 ml-3 flex-1 justify-center rounded-md border p-3"
                      : "border-border bg-card ml-3 flex-1 justify-center rounded-md border p-3"
                  }
                >
                  <View className="flex-row items-center justify-between">
                    <Text variant="large" numberOfLines={1} className="flex-1">
                      {item.title}
                    </Text>
                    {isClashing ? (
                      <Icon as={AlertTriangle} size={16} className="text-destructive ml-2" />
                    ) : null}
                  </View>
                  <View className="mt-1 flex-row items-center gap-1">
                    <Icon as={MapPin} size={12} className="text-muted-foreground" />
                    <Text variant="muted">{item.venueName}</Text>
                  </View>
                  {isClashing ? (
                    <Text variant="small" className="text-destructive mt-1">
                      Conflicts with another event- tap to resolve
                    </Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}
