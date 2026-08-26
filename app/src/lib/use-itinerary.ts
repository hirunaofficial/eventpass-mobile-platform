import { useCallback, useEffect, useRef, useState } from "react";
import type { ClashReason, EventWithVenue, ItineraryItem } from "@eventpass/shared";
import { findClash } from "@eventpass/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cacheItinerary, getCachedItinerary } from "@/lib/cache";
import { enqueueSyncAction, getPendingSyncCount } from "@/lib/sync-queue";
import { useNetworkStatus } from "@/lib/use-network-status";

export type ItineraryItemWithEvent = ItineraryItem & { event: EventWithVenue };

type AddResult = { ok: true } | { ok: false; reason: ClashReason };

export function useItinerary() {
  const { token } = useAuth();
  const [items, setItems] = useState<ItineraryItemWithEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    if (hasLoadedOnce.current) {
      setIsRefreshing(true);
    }
    try {
      const data = await apiFetch<ItineraryItemWithEvent[]>("/itinerary", { token });
      setItems(data);
      setIsOffline(false);
      await cacheItinerary(data);
    } catch {
      const cached = await getCachedItinerary();
      setItems(cached);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedOnce.current = true;
    }
    setPendingSyncCount(await getPendingSyncCount());
  }, [token]);

  // Auto-drains queued offline changes the moment connectivity returns,
  // then refetches so local optimistic entries are replaced by real data.
  useNetworkStatus(refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addToItinerary(event: EventWithVenue): Promise<AddResult> {
    const existing = items.map((item) => ({
      id: item.event.id,
      startsAt: item.event.startsAt,
      endsAt: item.event.endsAt,
      venue: { lat: item.event.venue.lat, lng: item.event.venue.lng },
    }));
    const candidate = {
      id: event.id,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      venue: { lat: event.venue.lat, lng: event.venue.lng },
    };

    const localClash = findClash(candidate, existing);
    if (localClash) {
      return { ok: false, reason: localClash };
    }

    try {
      await apiFetch("/itinerary", {
        method: "POST",
        token,
        body: JSON.stringify({ eventId: event.id }),
      });
      await refresh();
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError) {
        // A real rejection from a reachable server (e.g. a race with
        // another device)- not an offline scenario.
        return {
          ok: false,
          reason: { type: "time_overlap", withEventId: event.id },
        };
      }

      // Network unreachable: apply optimistically and queue for later.
      const optimisticItem: ItineraryItemWithEvent = {
        id: `local-${event.id}-${Date.now()}`,
        userId: "",
        eventId: event.id,
        addedAt: new Date().toISOString(),
        event,
      };
      const next = [...items, optimisticItem];
      setItems(next);
      await cacheItinerary(next);
      await enqueueSyncAction("add_itinerary", { eventId: event.id });
      setPendingSyncCount(await getPendingSyncCount());
      return { ok: true };
    }
  }

  async function removeFromItinerary(eventId: string) {
    try {
      await apiFetch(`/itinerary/${eventId}`, { method: "DELETE", token });
      await refresh();
    } catch (e) {
      if (e instanceof ApiError) {
        throw e;
      }
      const next = items.filter((item) => item.eventId !== eventId);
      setItems(next);
      await cacheItinerary(next);
      await enqueueSyncAction("remove_itinerary", { eventId });
      setPendingSyncCount(await getPendingSyncCount());
    }
  }

  return {
    items,
    isLoading,
    isRefreshing,
    error,
    isOffline,
    pendingSyncCount,
    refresh,
    addToItinerary,
    removeFromItinerary,
  };
}
