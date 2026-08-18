import { useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "@/lib/auth-context";
import { drainSyncQueue } from "@/lib/sync-queue";

/**
 * Tracks connectivity and drains the offline sync queue automatically the
 * moment the device transitions from offline back to online (design spec
 * §9's "ahead-of-time / store-and-forward" pattern)- not on a timer, on
 * the actual reconnect event.
 */
type SyncResult = { synced: number; conflicts: number };

export function useNetworkStatus(onSynced?: (result: SyncResult) => void) {
  const { token } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const wasOffline = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);

      if (online && wasOffline.current && token) {
        drainSyncQueue(token).then((result) => {
          onSyncedRef.current?.(result);
        });
      }
      wasOffline.current = !online;
    });

    return () => unsubscribe();
  }, [token]);

  return { isOnline };
}
