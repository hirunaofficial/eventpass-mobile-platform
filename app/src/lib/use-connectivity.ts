import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

/**
 * Distinguishes the three reasons a request can fail, which the app
 * otherwise collapses into one undifferentiated "offline".
 *
 *   "online"      device has a network AND the API answered
 *   "no-network"  the device itself has no connection
 *   "no-server"   the device is online but the API did not answer -
 *                 usually a wrong host, a stopped server, or being on
 *                 a different network from it
 *
 * The distinction matters because the remedies are opposite: one is
 * "turn your wifi on", the other is "the backend is not reachable from
 * here". Collapsing them produced a genuinely misleading banner during
 * development, where a stale hardcoded API address looked identical to
 * being offline.
 */
export type Connectivity = "online" | "no-network" | "no-server" | "checking";

export function useConnectivity() {
  const [state, setState] = useState<Connectivity>("checking");

  const probe = useCallback(async () => {
    const net = await NetInfo.fetch();
    if (!net.isConnected) {
      setState((prev) => (prev === "no-network" ? prev : "no-network"));
      return;
    }
    try {
      // /health is unauthenticated on purpose: this must work before
      // and independently of having a valid session.
      await apiFetch<{ status: string }>("/health");
      // Only write when the value actually changes - NetInfo can fire
      // repeatedly, and an unconditional setState on every event is a
      // cheap way to create a render loop.
      setState((prev) => (prev === "online" ? prev : "online"));
    } catch {
      setState((prev) => (prev === "no-server" ? prev : "no-server"));
    }
  }, []);

  useEffect(() => {
    probe();
    const unsubscribe = NetInfo.addEventListener(() => {
      probe();
    });
    return unsubscribe;
  }, [probe]);

  return { state, recheck: probe };
}
