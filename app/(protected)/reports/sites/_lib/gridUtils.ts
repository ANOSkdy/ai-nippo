import { compareMachineId, type MachineRef } from '@/lib/utils/sort';

/**
 * 四半刻(15分)単位の値をそのまま見せるための表示フォーマッタ
 * - mode: 'h'  -> 1.25 など小数2桁（ぴったりは整数で表示）
 *         'hm' -> 1:15 の hh:mm 風表示
 */
export function formatQuarterHours(value: number, mode: 'h' | 'hm' = 'h'): string {
  if (!Number.isFinite(value) || value <= 0) return '';
  // 念のため値を四半刻へ丸め直して表示（サーバは既にV2で丸め済み）
  const mins = Math.round(value * 60);
  const qmins = Math.round(mins / 15) * 15;
  if (mode === 'hm') {
    const h = Math.floor(qmins / 60);
    const m = qmins % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  }
  const qhours = qmins / 60;
  return Number.isInteger(qhours) ? `${qhours}` : `${qhours.toFixed(2)}`;
}

export type SessionRow = {
  user?: string | number;
  machineId?: number | string | null;
  machineName?: string | null;
  durationMin?: number | null;
  hours?: number | null;
  date?: string;
};

export function toMachineHeader(rowsForUser: SessionRow[]): MachineRef[] {
  const uniq = new Map<string, MachineRef>();
  for (const row of rowsForUser) {
    const idRaw = row.machineId == null ? '' : String(row.machineId).trim();
    const nameRaw = typeof row.machineName === 'string' ? row.machineName.trim() : '';
    if (!idRaw) {
      continue;
    }
    const existing = uniq.get(idRaw);
    if (!existing) {
      uniq.set(idRaw, { machineId: idRaw, machineName: nameRaw || null });
      continue;
    }
    if (!existing.machineName && nameRaw) {
      uniq.set(idRaw, { machineId: idRaw, machineName: nameRaw });
    }
  }
  const arr = [...uniq.values()];
  arr.sort((a, b) => {
    const diff = compareMachineId(a, b);
    if (diff !== 0) {
      return diff;
    }
    const nameA = a.machineName ?? '';
    const nameB = b.machineName ?? '';
    if (nameA && nameB) {
      const nameDiff = nameA.localeCompare(nameB, 'ja');
      if (nameDiff !== 0) {
        return nameDiff;
      }
    } else if (nameA) {
      return -1;
    } else if (nameB) {
      return 1;
    }
    return 0;
  });
  return arr;
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
