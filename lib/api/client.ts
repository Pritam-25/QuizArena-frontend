// lib/api/client.ts
import { AppError } from "@/lib/api/api-error";
import { env } from "@/lib/env";

const baseUrl = env.NEXT_PUBLIC_API_BASE_URL;

export async function apiClient<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${url}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => null);
    throw new AppError({
      message: errPayload?.message || res.statusText,
      statusCode: errPayload?.statusCode || res.status,
      errorCode: errPayload?.errorCode || "UNKNOWN_ERROR",
      details: errPayload?.details,
    });
  }

  const json = await res.json();

  return json;
}
