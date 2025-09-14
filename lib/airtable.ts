import Airtable, { FieldSet, Table } from 'airtable';
import {
  UserFields,
  MachineFields,
  SiteFields,
  WorkTypeFields,
  LogFields,
} from '@/types';

// 環境変数が設定されていない場合にエラーを投げる
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  throw new Error('Airtable API Key or Base ID is not defined in .env.local');
}

// Airtableの基本設定を初期化
export const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// 型付けされたテーブルを返すヘルパー関数
const getTypedTable = <T extends FieldSet>(tableName: string): Table<T> => {
  return base(tableName);
};

// 各テーブルをエクスポート
export const usersTable = getTypedTable<UserFields>('Users');
export const machinesTable = getTypedTable<MachineFields>('Machines');
export const sitesTable = getTypedTable<SiteFields>('Sites');
export const workTypesTable = getTypedTable<WorkTypeFields>('WorkTypes');
export const logsTable = getTypedTable<LogFields>('Logs');
// ... (既存のコード) ...

// machineid(URLのパラメータ)を使って機械レコードを1件取得する関数
export const getMachineById = async (machineId: string) => {
  try {
    const records = await machinesTable
      .select({
        filterByFormula: `{machineid} = '${machineId}'`,
        maxRecords: 1,
      })
      .firstPage();
    return records[0] || null;
  } catch (error) {
    console.error('Error fetching machine by ID:', error);
    throw error;
  }
};
// ... (既存の airtable, tables, getMachineById などの定義) ...

// ユーザーのレコードIDとJSTでの今日の日付を元に、当日のログを取得する関数
export const getTodayLogs = async (userRecordId: string) => {
  // JSTで今日の日付 (YYYY-MM-DD) を取得
  const todayJST = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/\//g, '-');

  try {
    const records = await logsTable
      .select({
        // まず日付で絞り込む
        filterByFormula: `{date} = '${todayJST}'`,
        // 時刻順で並び替え
        sort: [{ field: 'timestamp', direction: 'asc' }],
      })
      .all();

    // Airtableのuser(Link to Record)フィールドはレコードIDの配列なので、
    // 取得したレコードから、さらに対象ユーザーのログのみを絞り込む
    return records.filter(
      (record) =>
        record.fields.user && record.fields.user.includes(userRecordId)
    );
  } catch (error) {
    console.error('Error fetching today logs:', error);
    throw error;
  }
};

type WithRetryFn<T> = (...args: unknown[]) => Promise<T>;

export async function withRetry<T>(
  fn: WithRetryFn<T>,
  attempts = 5,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      last = e;
      const wait = Math.min(1000 * 2 ** i, 8000);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

export function table(name: string) {
  const candidates = [name, name.toUpperCase(), name.toLowerCase()];
  let use = 0;
  return {
    select: (opt: Parameters<Table<FieldSet>['select']>[0]) =>
      (base as unknown as (n: string) => Table<FieldSet>)(candidates[use]).select(opt),
    update: (
      records: Parameters<Table<FieldSet>['update']>[0],
      opt?: Parameters<Table<FieldSet>['update']>[1],
    ) =>
      (base as unknown as (n: string) => Table<FieldSet>)(candidates[use]).update(
        records,
        opt,
      ),
    _use: (i: number) => {
      use = i;
    },
  };
}
