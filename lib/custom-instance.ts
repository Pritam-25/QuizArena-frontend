export const customInstance = async <T>(
  url: string,
  config: RequestInit = {}
): Promise<T> => {
  const response = await fetch(url, {
    ...config,
    headers: {
      'Content-Type': 'application/json',
      ...(config.headers ?? {}),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null);
    throw errorPayload ?? new Error(response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
