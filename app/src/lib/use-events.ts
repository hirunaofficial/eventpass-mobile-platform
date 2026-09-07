import { useCallback, useEffect, useRef, useState } from "react";
import type { EventWithVenue } from "@eventpass/shared";
import { ApiError, apiFetch } from "@/lib/api";
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
  const { token, signOut } = useAuth();
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
      try {
        await cacheEvents(data);
      } catch (cacheErr) {
        // The fetch already succeeded and state is already correct- a
        // failure writing today's cache snapshot shouldn't regress the
        // UI back to stale data or falsely claim we're offline. Just
        // means a future offline session won't have this batch cached.
        console.error("Failed to cache events locally", cacheErr);
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // The session itself is invalid (not "offline")- falling back
        // to cached data here would silently show stale events forever
        // with no way for the user to realize they need to log back
        // in. Sign out so AuthGate routes them to /login instead.
        await signOut();
        return;
      }
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
  }, [token, signOut]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, isLoading, isRefreshing, error, isOffline, refresh };
}
