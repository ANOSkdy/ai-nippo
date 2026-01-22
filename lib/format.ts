export function formatMinutes(mins: number): string {
  const minutes = Number.isFinite(mins) ? Math.max(0, Math.round(mins)) : 0;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}:${String(remainder).padStart(2, '0')}`;
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return '—';
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return '—';
  }
  try {
    const date = new Date(timestamp);
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '—';
  }
}

export function fmtDate(ymd?: string | null): string {
  return ymd && ymd.trim() ? ymd : '—';
}
