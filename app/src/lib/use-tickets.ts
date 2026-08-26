import { useCallback, useEffect, useRef, useState } from "react";
import type { TicketWithEvent } from "@eventpass/shared";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cacheTickets, getCachedTickets } from "@/lib/cache";
import { enqueueSyncAction, getPendingSyncCount } from "@/lib/sync-queue";
import { useNetworkStatus } from "@/lib/use-network-status";

type PurchaseResult = { ok: true; queued?: boolean } | { ok: false; error: string };

export function useTickets() {
  const { token } = useAuth();
  const [tickets, setTickets] = useState<TicketWithEvent[]>([]);
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
      const data = await apiFetch<TicketWithEvent[]>("/tickets", { token });
      setTickets(data);
      setIsOffline(false);
      await cacheTickets(data);
    } catch {
      const cached = await getCachedTickets();
      setTickets(cached);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      hasLoadedOnce.current = true;
    }
    setPendingSyncCount(await getPendingSyncCount());
  }, [token]);

  useNetworkStatus(refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function purchaseTicket(eventId: string): Promise<PurchaseResult> {
    try {
      await apiFetch("/tickets", {
        method: "POST",
        token,
        body: JSON.stringify({ eventId }),
      });
      await refresh();
      return { ok: true };
    } catch (e) {
      if (e instanceof ApiError) {
        // A real rejection from a reachable server- e.g. sold out.
        return { ok: false, error: e.message };
      }

      // Network unreachable: queue the purchase. Capacity can't be
      // verified locally, so this is deliberately NOT applied
      // optimistically to the visible ticket list- the server is the
      // only source of truth for "did this actually succeed," and it
      // may come back as a conflict (sold out) once synced.
      await enqueueSyncAction("buy_ticket", { eventId });
      setPendingSyncCount(await getPendingSyncCount());
      return { ok: true, queued: true };
    }
  }

  return {
    tickets,
    isLoading,
    isRefreshing,
    error,
    isOffline,
    pendingSyncCount,
    refresh,
    purchaseTicket,
  };
}
