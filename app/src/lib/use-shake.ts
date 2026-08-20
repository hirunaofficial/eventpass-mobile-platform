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
