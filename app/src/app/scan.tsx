import { useState } from "react";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { View } from "react-native";
import type { TicketWithEvent } from "@eventpass/shared";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type ScanResult =
  | { status: "success"; ticket: TicketWithEvent }
  | { status: "error"; message: string };

export default function ScanScreen() {
  const { token } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleScanned(qrToken: string) {
    if (scanned) return;
    setScanned(true);
    try {
      const data = await apiFetch<{ valid: true; ticket: TicketWithEvent }>(
        "/tickets/check-in",
        { method: "POST", token, body: JSON.stringify({ qrToken }) }
      );
      setResult({ status: "success", ticket: data.ticket });
    } catch (e) {
      setResult({
        status: "error",
        message: e instanceof ApiError ? e.message : "Couldn't check in this ticket.",
      });
    }
  }

  function scanAgain() {
    setResult(null);
    setScanned(false);
  }

  if (!permission) {
    return <View className="bg-background flex-1" />;
  }

  if (!permission.granted) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Text variant="large" className="text-center">
          Camera access is needed to scan check-in QR codes.
        </Text>
        <Button onPress={requestPermission}>
          <Text>Grant camera permission</Text>
        </Button>
        <Button variant="ghost" onPress={() => router.back()}>
          <Text>Back</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(event) => handleScanned(event.data)}
      />

      <View className="absolute inset-x-0 top-16 items-center">
        <Text className="rounded-md bg-black/60 px-4 py-2 text-white">
          Point the camera at a ticket QR code
        </Text>
      </View>

      <View className="absolute bottom-10 left-0 right-0 items-center">
        <Button variant="secondary" onPress={() => router.back()}>
          <Text>Cancel</Text>
        </Button>
      </View>

      {result ? (
        <View className="absolute inset-0 items-center justify-center bg-black/70 p-6">
          <View className="bg-card w-full items-center gap-3 rounded-xl p-6">
            {result.status === "success" ? (
              <>
                <Text variant="large">Checked in ✓</Text>
                <Text>{result.ticket.event.title}</Text>
                <Text variant="muted">{result.ticket.event.venue.name}</Text>
              </>
            ) : (
              <>
                <Text variant="large" className="text-destructive">
                  Check-in failed
                </Text>
                <Text variant="muted">{result.message}</Text>
              </>
            )}
            <View className="mt-2 flex-row gap-2">
              <Button variant="outline" onPress={scanAgain}>
                <Text>Scan again</Text>
              </Button>
              <Button onPress={() => router.back()}>
                <Text>Done</Text>
              </Button>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}
