export const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
export function formatExpiry(value: string | null) {
  if (!value) return 'No expiration';
  return `${new Date(value).toLocaleString('en-GB', {
    timeZone: localTimeZone, year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  })} (${localTimeZone})`;
}
