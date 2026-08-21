import { useEffect, useState } from "react";
import * as Location from "expo-location";

type Coords = { lat: number; lng: number };

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setPermissionDenied(true);
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({});
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      } catch {
        // Location services disabled/unavailable (common on emulators
        // without GPS mocked)- not a permission problem, so don't set
        // permissionDenied. Callers already treat coords === null as
        // "skip distance-based sorting."
      }
    })();
  }, []);

  return { coords, permissionDenied };
}
