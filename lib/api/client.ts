import { AppError } from '@/lib/api/api-error';
import { env } from '@/lib/env';

const baseUrl = env.NEXT_PUBLIC_API_BASE_URL;

export async function apiClient<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const fullUrl = `${baseUrl}${url}`;

  const res = await fetch(fullUrl, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => null);

    throw new AppError({
      message: errPayload?.error?.message || res.statusText,
      statusCode: errPayload?.error?.statusCode || res.status,
      errorCode: errPayload?.error?.errorCode || 'UNKNOWN_ERROR',
      details: errPayload?.error?.details,
    });
  }

  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
