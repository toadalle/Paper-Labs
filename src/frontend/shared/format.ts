export function formatRelative(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  return Number.isFinite(value) ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}

export function formatPrice(value: number | null | undefined): string {
  return Number.isFinite(value) ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—';
}
