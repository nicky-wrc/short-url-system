export interface Link {
  id: string; code: string; originalUrl: string; shortUrl: string; title: string;
  createdAt: string; expiresAt: string | null; clicks: number;
}
export interface LinkPage { items: Link[]; total: number; page: number; limit: number }
export interface LinkPreview {
  code: string; title: string; originalUrl: string; destinationHost: string;
  shortUrl: string; previewUrl: string; expiresAt: string | null;
  status: 'active' | 'expired';
}
export interface Stats {
  totalLinks: number; activeLinks: number; totalClicks: number; todayClicks: number;
  daily: { date: string; clicks: number }[]; timezone: string;
}
export interface User { id: string; email: string; displayName: string }
export interface AuthSession { user: User | null; csrfToken: string | null; expiresAt: number | null }
let csrfToken = '';
export function clearAuthToken() { csrfToken = ''; }
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const write = options?.method && !['GET', 'HEAD', 'OPTIONS'].includes(options.method.toUpperCase());
  if (write && !csrfToken) {
    const session = await api<AuthSession>('/auth/session');
    csrfToken = session.csrfToken ?? '';
  }
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...(write ? { 'X-CSRF-Token': csrfToken } : {}), ...options?.headers },
  });
  if (response.status === 204) { clearAuthToken(); return undefined as T; }
  const fallback = 'The service is temporarily unavailable. Please try again.';
  // Hosts/proxies can return an HTML error page. Do not expose it or a JSON parser error.
  const body = await response.json().catch(() => { throw new Error(fallback); });
  if (!response.ok) {
    if (response.status === 401 && (!path.startsWith('/auth/') || path === '/auth/logout')) { clearAuthToken(); window.dispatchEvent(new Event('auth-required')); }
    throw new Error(body.error ?? 'Something went wrong. Please try again.');
  }
  if (typeof body.csrfToken === 'string') csrfToken = body.csrfToken;
  return body as T;
}
