import { useState } from "react";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { ImageDown, LogOut } from "lucide-react-native";
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

  /**
   * Check in from a QR image in the photo library instead of the live
   * camera.
   *
   * This exists for a real constraint, not convenience: with a single
   * phone the attendee's ticket QR is displayed on the very screen whose
   * camera would have to read it, so a live scan is physically
   * impossible. Saving the ticket QR from the Tickets tab and picking it
   * here makes the whole purchase -> check-in loop demonstrable on one
   * device.
   *
   * It reuses handleScanned(), so the image path and the camera path hit
   * exactly the same server call and the same single-use enforcement -
   * this is a different input source, not a second check-in code path.
   */
  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setResult({
        status: "error",
        message: "Photo library access is needed to scan a saved ticket image.",
      });
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]) return;

    try {
      const codes = await scanFromURLAsync(picked.assets[0].uri, ["qr"]);
      const data = codes?.[0]?.data;
      if (!data) {
        setResult({
          status: "error",
          message: "No QR code found in that image. Pick the saved ticket screenshot.",
        });
        return;
      }
      // handleScanned() early-returns while `scanned` is true, so clear it
      // first- otherwise a previous scan would silently block this one.
      setScanned(false);
      await handleScanned(data);
    } catch {
      setResult({ status: "error", message: "Couldn't read that image." });
    }
  }

  const header = (
    <View className="border-border flex-row items-center justify-between border-b bg-black px-4 pb-3 pt-16">
      <View>
        <Text className="font-title text-base text-signal">
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
          <View className="border-signal h-64 w-64 rounded-card border-2" />
        </View>

        <View className="absolute inset-x-0 top-4 items-center">
          <Text className="font-ui rounded-full bg-black/70 px-4 py-2 text-white">
            Point the camera at a ticket QR code
          </Text>
        </View>

        <View className="absolute inset-x-0 bottom-10 items-center px-6">
          <Button
            variant="outline"
            className="w-full flex-row rounded-full border-white/25 bg-black/60"
            onPress={pickFromLibrary}
          >
            <Icon as={ImageDown} size={16} className="text-signal" />
            <Text className="text-white">Scan from photo</Text>
          </Button>
          <Text className="mt-2 text-center text-white/50" variant="small">
            Use a saved ticket image when scanning on one device
          </Text>
        </View>

        {result ? (
          <View className="absolute inset-0 items-center justify-center bg-black/70 p-6">
            <View className="border-border bg-card rounded-card w-full items-center gap-3 border p-6">
              {result.status === "success" ? (
                <>
                  <Text className="font-title text-center text-lg">
                    Checked in ✓
                  </Text>
                  <Text>{result.ticket.event.title}</Text>
                  <Text variant="muted">{result.ticket.event.venue.name}</Text>
                </>
              ) : (
                <>
                  <Text className="font-title text-destructive text-center text-lg">
                    Check-in failed
                  </Text>
                  <Text variant="muted" className="text-center">
                    {result.message}
                  </Text>
                </>
              )}
              <Button className="bg-signal mt-2 w-full rounded-full" onPress={scanNext}>
                <Text>Scan next ticket</Text>
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
