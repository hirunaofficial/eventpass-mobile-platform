import { useCallback, useEffect, useRef, useState } from "react";
import type { EventWithVenue } from "@eventpass/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cacheEvents, getCachedEvents } from "@/lib/cache";

type UseEventsResult = {
  events: EventWithVenue[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isOffline: boolean;
  refresh: () => Promise<void>;
};

export function useEvents(): UseEventsResult {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventWithVenue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const hasLoadedOnce = useRef(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    setError(null);
    // Distinguish first-load (skeleton) from a later refetch (pull-to-
    // refresh spinner)- a ref, not state, so this doesn't become a
    // dependency of the callback itself and retrigger the mount effect.
    if (hasLoadedOnce.current) {
      setIsRefreshing(true);
    }
    try {
      const data = await apiFetch<EventWithVenue[]>("/events", { token });
      setEvents(data);
      setIsOffline(false);
      await cacheEvents(data);
    } catch {
      const cached = await getCachedEvents();
      if (cached.length > 0) {
        setEvents(cached);
        setIsOffline(true);
      } else {
        setError("Couldn't load events. Pull down to try again.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedOnce.current = true;
    }
  }, [token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, isLoading, isRefreshing, error, isOffline, refresh };
}
