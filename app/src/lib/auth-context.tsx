import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@eventpass/shared";
import { ApiError, apiFetch } from "@/lib/api";

const TOKEN_KEY = "eventpass_token";
const USER_KEY = "eventpass_user";

type AuthUser = { id: string; email: string; role: UserRole };

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await apiFetch<AuthUser>("/auth/me", { token: storedToken });
        setToken(storedToken);
        setUser(me);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(me));
      } catch (e) {
        if (e instanceof ApiError) {
          // A real rejection from a reachable server (401: token
          // genuinely invalid/expired)- signing out is correct here.
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          await SecureStore.deleteItemAsync(USER_KEY);
        } else {
          // Network unreachable- NOT the same as "logged out." Falling
          // back to deleting the token here would sign out any user who
          // opens the app offline, then trap them: /login also needs
          // network, so they'd have no way back in until reconnecting.
          // Stay signed in using the last-known user, so every other
          // screen's own offline/cache handling can take over normally.
          const cachedUser = await SecureStore.getItemAsync(USER_KEY);
          if (cachedUser) {
            setToken(storedToken);
            setUser(JSON.parse(cachedUser) as AuthUser);
          }
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function handleAuthResponse(
    promise: Promise<{ token: string; user: AuthUser }>
  ): Promise<AuthUser> {
    const { token: newToken, user: newUser } = await promise;
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }

  const signIn = useCallback((email: string, password: string) => {
    return handleAuthResponse(
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })
    );
  }, []);

  const signUp = useCallback((email: string, password: string) => {
    return handleAuthResponse(
      apiFetch("/auth/signup", { method: "POST", body: JSON.stringify({ email, password }) })
    );
  }, []);

  // Stable across renders (useCallback, empty deps)- consumed as a
  // dependency by hooks like useEvents/useItinerary/useTickets to sign
  // out on a 401. An unstable signOut would make their `refresh`
  // callback a new reference every render, retriggering their mount
  // effect in a loop.
  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
