/**
 * 四半刻(15分)単位の値をそのまま見せるための表示フォーマッタ
 * - mode: 'h'  -> 1.25h など小数2桁（ぴったりは整数hで表示）
 *         'hm' -> 1h15m の hh:mm 風表示
 */
export function formatQuarterHours(value: number, mode: 'h' | 'hm' = 'h'): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  // 念のため値を四半刻へ丸め直して表示（サーバは既にV2で丸め済み）
  const mins = Math.round(value * 60);
  const qmins = Math.round(mins / 15) * 15;
  if (mode === 'hm') {
    const h = Math.floor(qmins / 60);
    const m = qmins % 60;
    return `${h}h${String(m).padStart(2, '0')}m`;
  }
  const qhours = qmins / 60;
  return Number.isInteger(qhours) ? `${qhours}h` : `${qhours.toFixed(2)}h`;
}

export type SessionRow = {
  user?: string | number;
  machineId?: number | string | null;
  machineName?: string | null;
  durationMin?: number | null;
  hours?: number | null;
  date?: string;
};

export function toMachineHeader(rowsForUser: SessionRow[]): string {
  const uniq = new Map<string, { id?: string | number | null; name?: string | null }>();
  for (const row of rowsForUser) {
    const id = row.machineId == null ? '' : String(row.machineId);
    const name = row.machineName ?? null;
    const key = `${id}::${name ?? ''}`;
    if (!uniq.has(key)) {
      uniq.set(key, { id: id || null, name });
    }
  }
  const arr = [...uniq.values()].filter((item) => item.id || item.name);
  if (arr.length === 0) {
    return '';
  }
  if (arr.length === 1) {
    const { id, name } = arr[0];
    return `${id ?? ''}${name ? `（${name}）` : ''}`;
  }
  return '複数';
}

export function sumColumnHours(rowsForUser: SessionRow[]): number {
  let totalMinutes = 0;
  for (const row of rowsForUser) {
    if (typeof row.durationMin === 'number') {
      totalMinutes += row.durationMin;
    } else if (typeof row.hours === 'number') {
      totalMinutes += row.hours * 60;
    }
  }
  if (totalMinutes === 0) {
    return 0;
  }
  const quarterMinutes = Math.round(totalMinutes / 15) * 15;
  return quarterMinutes / 60;
}
