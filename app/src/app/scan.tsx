import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { LogOut } from "lucide-react-native";
import { View } from "react-native";
import type { TicketWithEvent } from "@eventpass/shared";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ScanResult =
  | { status: "success"; ticket: TicketWithEvent }
  | { status: "error"; message: string };

export default function ScanScreen() {
  const { user, token, signOut } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkedInCount, setCheckedInCount] = useState(0);

  async function handleScanned(qrToken: string) {
    if (scanned) return;
    setScanned(true);
    try {
      const data = await apiFetch<{ valid: true; ticket: TicketWithEvent }>(
        "/tickets/check-in",
        { method: "POST", token, body: JSON.stringify({ qrToken }) }
      );
      setResult({ status: "success", ticket: data.ticket });
      setCheckedInCount((count) => count + 1);
    } catch (e) {
      setResult({
        status: "error",
        message: e instanceof ApiError ? e.message : "Couldn't check in this ticket.",
      });
    }
  }

  function scanNext() {
    setResult(null);
    setScanned(false);
  }

  const header = (
    <View className="border-border flex-row items-center justify-between border-b bg-black px-4 pb-3 pt-16">
      <View>
        <Text className="text-white" variant="large">
          Check-In Scanner
        </Text>
        <Text className="text-white/60" variant="small">
          {user?.email} · {checkedInCount} checked in this session
        </Text>
      </View>
      <Button variant="ghost" size="icon" onPress={signOut}>
        <Icon as={LogOut} size={20} className="text-white" />
      </Button>
    </View>
  );

  if (!permission) {
    return <View className="flex-1 bg-black">{header}</View>;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-black">
        {header}
        <View className="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-center text-white">
            Camera access is needed to scan ticket QR codes.
          </Text>
          <Button onPress={requestPermission}>
            <Text>Grant camera permission</Text>
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {header}
      <View className="flex-1">
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={(event) => handleScanned(event.data)}
        />

        <View className="pointer-events-none absolute inset-0 items-center justify-center">
          <View className="h-64 w-64 rounded-2xl border-2 border-white/70" />
        </View>

        <View className="absolute inset-x-0 top-4 items-center">
          <Text className="rounded-md bg-black/60 px-4 py-2 text-white">
            Point the camera at a ticket QR code
          </Text>
        </View>

        {result ? (
          <View className="absolute inset-0 items-center justify-center bg-black/70 p-6">
            <View className="bg-card w-full items-center gap-3 rounded-xl p-6">
              {result.status === "success" ? (
                <>
                  <Text variant="large" className="text-center">
                    Checked in ✓
                  </Text>
                  <Text>{result.ticket.event.title}</Text>
                  <Text variant="muted">{result.ticket.event.venue.name}</Text>
                </>
              ) : (
                <>
                  <Text variant="large" className="text-destructive text-center">
                    Check-in failed
                  </Text>
                  <Text variant="muted" className="text-center">
                    {result.message}
                  </Text>
                </>
              )}
              <Button className="mt-2 w-full" onPress={scanNext}>
                <Text>Scan next ticket</Text>
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
