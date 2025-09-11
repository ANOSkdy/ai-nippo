export const TZ_OFFSET = 9 * 60 * 60 * 1000; // Asia/Tokyo offset in ms

export function toUtcFromMaybeLocal(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const m = raw
      .trim()
      .match(
        /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/,
      );
    if (!m) return null;
    const [, y, mo, d, h, mi, s = '0'] = m;
    return new Date(
      Date.UTC(
        Number(y),
        Number(mo) - 1,
        Number(d),
        Number(h) - 9,
        Number(mi),
        Number(s),
      ),
    );
  }
  const d = new Date(raw as number);
  return isNaN(d.getTime()) ? null : d;
}
