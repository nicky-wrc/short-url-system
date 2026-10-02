export interface Link {
  id: string; code: string; originalUrl: string; shortUrl: string; title: string;
  createdAt: string; expiresAt: string | null; clicks: number;
}
export interface LinkPage { items: Link[]; total: number; page: number; limit: number }
export interface Stats {
  totalLinks: number; activeLinks: number; totalClicks: number; todayClicks: number;
  daily: { date: string; clicks: number }[]; timezone: string;
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
}
