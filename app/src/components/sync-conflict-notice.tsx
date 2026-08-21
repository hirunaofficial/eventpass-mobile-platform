import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { clearConflicts, getConflictCount } from "@/lib/sync-queue";
import { useNetworkStatus } from "@/lib/use-network-status";

/**
 * Single, app-wide place that surfaces sync-queue conflicts (design spec
 * §9: conflicts must be surfaced to the user, never silently dropped).
 * Mounted once at the root layout- individual screens/hooks each still
 * call useNetworkStatus() for their own refresh-on-reconnect, but only
 * this component owns showing the conflict dialog, so the user sees it
 * exactly once per reconnect regardless of which tabs are mounted.
 *
 * Also checks for conflicts left over from a *previous* app session (the
 * app could have been closed before the user acknowledged them)- without
 * this, a reconnect-only check would only ever catch conflicts from the
 * current session.
 */
export function SyncConflictNotice() {
  const { token } = useAuth();
  const [conflictCount, setConflictCount] = useState(0);

  useEffect(() => {
    if (token) {
      getConflictCount().then(setConflictCount);
    }
  }, [token]);

  useNetworkStatus((result) => {
    if (result.conflicts > 0) {
      setConflictCount((count) => count + result.conflicts);
    }
  });

  async function acknowledge() {
    await clearConflicts();
    setConflictCount(0);
  }

  return (
    <AlertDialog open={conflictCount > 0} onOpenChange={(open) => !open && acknowledge()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Some offline changes couldn't sync</AlertDialogTitle>
          <AlertDialogDescription>
            {conflictCount === 1
              ? "1 change you made while offline couldn't be applied"
              : `${conflictCount} changes you made while offline couldn't be applied`}
            {" "}— for example, an event may have sold out or already been added.
            Check your Itinerary and Tickets tabs for the current state.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onPress={acknowledge}>
          <Text>OK</Text>
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
