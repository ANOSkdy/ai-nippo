export type SessionLike = {
  date?: string; // "YYYY-MM-DD" JST
  user?: number | string | null;
  userName?: string | null;
  ['name (from user)']?: string | null; // Airtable lookup 互換
  machineId?: number | string | null;
  machineName?: string | null; // Airtable lookup 互換
  durationMin?: number | null;
};

export type PivotColumn = { key: string; header: string };
export type PivotRow = {
  date: string;
  youbi: string;
  cells: Record<string, number>; // key = userId|machineId
  rowTotal: number;
};

export type PivotResult = {
  columns: PivotColumn[];
  rows: PivotRow[];
  grandTotal: number;
};

const toHours1 = (min?: number | null) => {
  const v = (min ?? 0) / 60;
  return Math.round(v * 10) / 10;
};

const dispName = (s: SessionLike) =>
  s.userName ?? s['name (from user)'] ?? '不明ユーザー';

const dispMachine = (id: SessionLike['machineId'], name: SessionLike['machineName']) => {
  const idTxt = (id ?? '未設定').toString();
  const nm = (name ?? '未設定').toString();
  return `${idTxt}（${nm}）`;
};

export function pivotByUserAndMachine(
  sessions: SessionLike[],
  opts?: { youbiOf?: (dateJst: string) => string }
): PivotResult {
  const youbiOf =
    opts?.youbiOf ??
    ((d: string) => {
      const wd = new Date(`${d}T00:00:00+09:00`).getDay();
      return '日月火水木金土'.charAt(wd);
    });

  const colKeyToHeader = new Map<string, string>();
  for (const s of sessions) {
    const userId = (s.user ?? 'NA').toString();
    const key = `${userId}|${s.machineId ?? 'NA'}`;
    if (!colKeyToHeader.has(key)) {
      colKeyToHeader.set(key, `${dispName(s)}｜${dispMachine(s.machineId, s.machineName)}`);
    }
  }
  const columns: PivotColumn[] = Array.from(colKeyToHeader.entries()).map(([key, header]) => ({
    key,
    header,
  }));

  const mapByDate = new Map<string, SessionLike[]>();
  for (const s of sessions) {
    const d = s.date ?? '';
    if (!d) continue;
    if (!mapByDate.has(d)) mapByDate.set(d, []);
    mapByDate.get(d)!.push(s);
  }

  const rows: PivotRow[] = [];
  const sortedDates = Array.from(mapByDate.keys()).sort();
  let grandTotalMin = 0;
  for (const d of sortedDates) {
    const list = mapByDate.get(d)!;
    const minuteCells = new Map<string, number>();
    let rowTotalMin = 0;
    for (const s of list) {
      const userId = (s.user ?? 'NA').toString();
      const key = `${userId}|${s.machineId ?? 'NA'}`;
      const addMin = s.durationMin ?? 0;
      minuteCells.set(key, (minuteCells.get(key) ?? 0) + addMin);
      rowTotalMin += addMin;
    }
    const cells: Record<string, number> = {};
    for (const [key, min] of minuteCells.entries()) {
      cells[key] = toHours1(min);
    }
    const rowTotal = toHours1(rowTotalMin);
    grandTotalMin += rowTotalMin;
    rows.push({ date: d, youbi: youbiOf(d), cells, rowTotal });
  }

  return { columns, rows, grandTotal: toHours1(grandTotalMin) };
}
