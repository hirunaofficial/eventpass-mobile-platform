import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";

export type AppearancePreference = "light" | "dark" | "system";

const APPEARANCE_KEY = "eventpass_appearance";

/**
 * NativeWind's own useColorScheme() already applies the choice live, but
 * doesn't persist it across app restarts on its own- stored separately
 * here and re-applied once on boot (see RootLayout).
 */
export async function loadStoredAppearance(): Promise<AppearancePreference | null> {
  const stored = await SecureStore.getItemAsync(APPEARANCE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return null;
}

export function useAppearance() {
  const { colorScheme, setColorScheme } = useColorScheme();
  const [preference, setPreference] = useState<AppearancePreference>("system");

  useEffect(() => {
    loadStoredAppearance().then((stored) => {
      if (stored) setPreference(stored);
    });
  }, []);

  async function setAppearance(next: AppearancePreference) {
    setPreference(next);
    setColorScheme(next);
    await SecureStore.setItemAsync(APPEARANCE_KEY, next);
  }

  return { colorScheme, preference, setAppearance };
}
