/** Thin fetch wrapper shared by every /admin page: attaches the admin key header and normalizes error handling. */
export async function adminFetch<T>(key: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { ...(init.headers ?? {}), 'x-admin-api-key': key },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `request failed (${res.status})`);
  }
  return body as T;
}
