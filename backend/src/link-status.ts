export type LinkStatus = 'active' | 'disabled' | 'expired';
// Disabled takes precedence; enabling never changes expiry.
export function linkStatus(isActive: unknown, expiresAt: string | Date | null, now: number): LinkStatus {
  if (isActive === false) return 'disabled';
  return expiresAt && new Date(expiresAt).getTime() <= now ? 'expired' : 'active';
}
