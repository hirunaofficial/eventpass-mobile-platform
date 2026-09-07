const API_URL = process.env.EXPO_PUBLIC_API_URL;

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
