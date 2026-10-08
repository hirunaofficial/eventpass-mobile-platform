import Constants from "expo-constants";

/**
 * Resolves the API base URL.
 *
 * A hard-coded LAN IP in `.env` is fragile: DHCP reassigns it (it changed
 * twice in one afternoon on this machine), and the address at a demo or
 * viva on a different network will certainly not be the one baked in at
 * home. Because `EXPO_PUBLIC_*` values are inlined at BUILD time, a stale
 * one cannot be fixed by reloading - it needs a Metro restart - and the
 * only symptom is every request failing to connect, which reads like a
 * server or database problem rather than a wrong address.
 *
 * So the dev host is derived from Expo itself. `hostUri` is whatever
 * address this app was actually served from, which is by definition
 * reachable from this device - if Metro loaded, the API host is correct.
 *
 * Precedence:
 *   1. EXPO_PUBLIC_API_URL, when set - an explicit override always wins,
 *      and is what a real deployment would use.
 *   2. Expo's own host, with the API port substituted - the dev default.
 */
function resolveApiUrl(): string | undefined {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit;

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(":")[0];
  if (host) return `http://${host}:4000`;

  return undefined;
}

const API_URL = resolveApiUrl();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// zod validation failures come back as { error: { field: ["message"] } },
// not a string- routes send `parsed.error.flatten().fieldErrors` as-is.
// Without this, every validation error (bad email, short password,
// missing eventId/qrToken) silently became a useless generic "Request
// failed" instead of the actual reason.
function extractErrorMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return "Request failed";
  }
  const error = (body as { error: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const messages = Object.values(error as Record<string, unknown>)
      .flat()
      .filter((m): m is string => typeof m === "string");
    if (messages.length > 0) return messages.join(" ");
  }
  return "Request failed";
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not set");
  }

  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, extractErrorMessage(body));
  }

  return body as T;
}
