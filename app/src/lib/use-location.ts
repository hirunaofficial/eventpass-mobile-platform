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
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
    })();
  }, []);

  return { coords, permissionDenied };
}
