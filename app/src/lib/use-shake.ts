/**
 * Accelerometer "shake to refresh" (hardware integration #3).
 *
 * Shake detection is just a magnitude threshold on the raw accelerometer
 * vector: at rest the reading is ~1g, so anything well above that is
 * deliberate movement. The debounce matters - one physical shake spans
 * many sensor samples, and without it a single gesture would fire the
 * callback dozens of times.
 */
import { useEffect, useRef } from "react";
import { Accelerometer } from "expo-sensors";

const SHAKE_THRESHOLD = 1.8;
const SHAKE_COOLDOWN_MS = 1500;

/** Calls onShake() when the device is shaken, debounced so a single shake doesn't fire repeatedly. */
export function useShake(onShake: () => void) {
  const lastShakeAt = useRef(0);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    Accelerometer.setUpdateInterval(150);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - lastShakeAt.current > SHAKE_COOLDOWN_MS) {
        lastShakeAt.current = now;
        onShakeRef.current();
      }
    });

    return () => subscription.remove();
  }, []);
}
