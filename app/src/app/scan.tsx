import { useCallback, useState } from "react";
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Image, ImageDown, LogOut, Ticket as TicketIcon } from "lucide-react-native";
import { ActivityIndicator, Image as RNImage, Linking, Modal, Pressable, ScrollView, View } from "react-native";
import type { TicketWithEvent } from "@eventpass/shared";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { listTicketImages, type SavedTicketImage } from "@/lib/ticket-images";

type ScanResult =
  | { status: "success"; ticket: TicketWithEvent }
  | { status: "error"; message: string };

export default function ScanScreen() {
  const { user, token, signOut } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checkedInCount, setCheckedInCount] = useState(0);
  // Check-in hits the network; without feedback a slow connection
  // looks like a failed scan and staff re-scan unnecessarily.
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  // The image-source sheet: saved ticket images first, device gallery as
  // the other route. Opened rather than jumping straight to the gallery
  // because on Expo Go the gallery is usually the one that has nothing.
  const [sourceOpen, setSourceOpen] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedTicketImage[]>([]);

  async function handleScanned(qrToken: string) {
    if (scanned) return;
    setScanned(true);
    setIsCheckingIn(true);
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
    } finally {
      setIsCheckingIn(false);
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
  const openImageSource = useCallback(async () => {
    // Open first, then fill. Reading the manifest touches the file
    // system, and a failure there should still leave staff with the
    // gallery route rather than a button that silently does nothing.
    setSourceOpen(true);
    try {
      setSavedImages(await listTicketImages());
    } catch (e) {
      console.error("Couldn't list saved ticket images", e);
      setSavedImages([]);
    }
  }, []);

  /**
   * Decodes a QR out of an image file and runs the normal check-in.
   *
   * Reuses handleScanned(), so an image and a live camera frame hit
   * exactly the same server call and the same single-use enforcement.
   * This is a different input source, not a second check-in code path.
   */
  async function checkInFromImageUri(uri: string) {
    setIsPicking(true);
    try {
      const codes = await scanFromURLAsync(uri, ["qr"]);
      const data = codes?.[0]?.data;
      if (!data) {
        setResult({
          status: "error",
          message: "No QR code found in that image. Pick a saved ticket image.",
        });
        return;
      }
      // handleScanned() early-returns while `scanned` is true, so clear
      // it first - otherwise a previous scan would silently block this one.
      setScanned(false);
      await handleScanned(data);
    } catch {
      setResult({ status: "error", message: "Couldn't read that image." });
    } finally {
      setIsPicking(false);
    }
  }

  async function pickFromGallery() {
    setSourceOpen(false);
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
    await checkInFromImageUri(picked.assets[0].uri);
  }

  async function pickSaved(image: SavedTicketImage) {
    setSourceOpen(false);
    await checkInFromImageUri(image.uri);
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
        <View className="flex-1 items-center justify-center gap-5 p-8">
          <Text className="font-display text-center text-2xl text-white">
            Camera access needed
          </Text>
          <Text className="text-center text-white/60">
            Check-in scans a ticket's QR code, so EventPass needs the camera.
            {permission.canAskAgain
              ? ""
              : " Permission was declined- enable it in Settings to continue."}
          </Text>
          <View className="w-full gap-2">
            {permission.canAskAgain ? (
              <Button className="bg-primary rounded-md" onPress={requestPermission}>
                <Text>Allow camera</Text>
              </Button>
            ) : (
              <Button className="bg-primary rounded-md" onPress={() => Linking.openSettings()}>
                <Text>Open Settings</Text>
              </Button>
            )}
            {/* Always a way out: without this, staff who decline are
                stranded on a screen with no action that works. */}
            <Button variant="ghost" onPress={signOut}>
              <Text className="text-white/70">Sign out</Text>
            </Button>
          </View>
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
          <Text className="font-ui rounded-md bg-black/70 px-4 py-2 text-white">
            Point the camera at a ticket QR code
          </Text>
        </View>

        <View className="absolute inset-x-0 bottom-10 items-center px-6">
          <Button
            variant="outline"
            className="w-full flex-row rounded-md border-white/25 bg-black/60"
            loading={isPicking}
            onPress={openImageSource}
          >
            {!isPicking ? <Icon as={ImageDown} size={16} className="text-[#E8FF52]" /> : null}
            <Text className="text-white">
              {isPicking ? "Reading image..." : "Scan from image"}
            </Text>
          </Button>
          <Text className="mt-2 text-center text-white/50" variant="small">
            Use a saved ticket image when scanning on one device
          </Text>
        </View>

        <Modal
          visible={sourceOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setSourceOpen(false)}
        >
          <Pressable
            className="flex-1 justify-end bg-black/70"
            onPress={() => setSourceOpen(false)}
          >
            {/* Swallow taps inside the sheet so only the backdrop closes it.
                Hardcoded dark, like the rest of the scanner chrome: this
                screen is a door-staff tool and stays dark whichever theme
                the attendee side of the app is set to. */}
            <Pressable className="rounded-t-card gap-3 border-t border-white/10 bg-[#141210] p-5 pb-8">
              <Text className="font-title text-base text-white">Scan a ticket image</Text>
              <Text className="text-white/60">
                Pick the ticket image saved from the attendee's wallet.
              </Text>

              {savedImages.length > 0 ? (
                <ScrollView className="max-h-72" showsVerticalScrollIndicator={false}>
                  <View className="gap-2">
                    {savedImages.map((image) => (
                      <Pressable
                        key={image.ticketId}
                        accessibilityRole="button"
                        accessibilityLabel={`Check in ${image.title}`}
                        className="rounded-md flex-row items-center gap-3 border border-white/10 bg-white/5 p-2"
                        onPress={() => pickSaved(image)}
                      >
                        <RNImage
                          source={{ uri: image.uri }}
                          className="rounded-sm h-12 w-12"
                          resizeMode="cover"
                        />
                        <View className="flex-1">
                          <Text className="font-ui text-white" numberOfLines={1}>
                            {image.title}
                          </Text>
                          <Text variant="small" className="text-white/50" numberOfLines={1}>
                            {image.venue}
                          </Text>
                        </View>
                        <Icon as={TicketIcon} size={16} className="text-[#E8FF52]" />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <Text variant="small" className="text-white/50">
                  No ticket images saved on this device yet. Save one from the
                  Tickets tab, or browse the gallery below.
                </Text>
              )}

              <Button
                variant="outline"
                className="flex-row rounded-md border-white/25 bg-transparent"
                onPress={pickFromGallery}
              >
                <Icon as={Image} size={16} className="text-[#E8FF52]" />
                <Text className="text-white">Browse device photos</Text>
              </Button>
            </Pressable>
          </Pressable>
        </Modal>

        {isCheckingIn && !result ? (
          <View className="absolute inset-0 items-center justify-center bg-black/70">
            <View className="rounded-card items-center gap-3 border border-white/10 bg-[#141210] px-8 py-6">
              <ActivityIndicator color="#E8FF52" />
              <Text className="font-title text-base text-white">Checking in...</Text>
            </View>
          </View>
        ) : null}

        {result ? (
          <View className="absolute inset-0 items-center justify-center bg-black/70 p-6">
            <View className="rounded-card w-full items-center gap-3 border border-white/10 bg-[#141210] p-6">
              {result.status === "success" ? (
                <>
                  <Text className="font-title text-center text-lg text-[#E8FF52]">
                    Checked in ✓
                  </Text>
                  <Text className="text-white">{result.ticket.event.title}</Text>
                  <Text className="text-white/60">{result.ticket.event.venue.name}</Text>
                </>
              ) : (
                <>
                  <Text className="font-title text-center text-lg text-[#FF5B35]">
                    Check-in failed
                  </Text>
                  <Text className="text-center text-white/60">{result.message}</Text>
                </>
              )}
              <Button
                className="mt-2 w-full rounded-md bg-[#E8FF52]"
                onPress={scanNext}
              >
                <Text className="text-[#141210]">Scan next ticket</Text>
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
