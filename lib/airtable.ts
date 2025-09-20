import Airtable, { FieldSet, Table } from 'airtable';
import {
  UserFields,
  MachineFields,
  SiteFields,
  WorkTypeFields,
  LogFields,
} from '@/types';
import { AppError } from '@/src/lib/errors';
import { logger } from '@/src/lib/logger';

const MAX_RETRY = 3;
const INITIAL_DELAY_MS = 500;

async function withAirtableRetry<T>(
  operation: () => Promise<T>,
  opts: { action: string; retryCount?: number } = { action: 'unknown' },
): Promise<T> {
  const attempt = opts.retryCount ?? 0;
  try {
    return await operation();
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: unknown })?.statusCode === 'number'
      ? ((error as { statusCode: number }).statusCode)
      : undefined;
    const code = statusCode === 429 ? 'EXT-AIRTABLE-429' : 'EXT-AIRTABLE-500';
    logger.warn({
      code,
      message: `Airtable operation failed (${opts.action})`,
      context: { attempt, statusCode },
      error,
    });

    if (statusCode === 429 && attempt < MAX_RETRY) {
      const delay = INITIAL_DELAY_MS * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withAirtableRetry(operation, { action: opts.action, retryCount: attempt + 1 });
    }

    throw new AppError({
      code,
      message: statusCode === 429 ? 'Airtableのレート制限を超えました' : 'Airtableの処理に失敗しました',
      status: statusCode === 429 ? 429 : 502,
      hint: statusCode === 429 ? '少し時間をおいてから再試行してください' : '時間をおいて再試行してください',
      severity: statusCode === 429 ? 'warning' : 'error',
      cause: error,
    });
  }
}

// 環境変数が設定されていない場合にエラーを投げる
if (!process.env.AIRTABLE_API_KEY || !process.env.AIRTABLE_BASE_ID) {
  throw new AppError({
    code: 'APP-500-CONFIG',
    status: 500,
    message: 'Airtableの接続設定が未完了です',
    hint: '環境変数 AIRTABLE_API_KEY / AIRTABLE_BASE_ID を設定してください',
    severity: 'error',
  });
}

// Airtableの基本設定を初期化
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
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
    const records = await withAirtableRetry(
      () =>
        machinesTable
          .select({
            filterByFormula: `{machineid} = '${machineId}'`,
            maxRecords: 1,
          })
          .firstPage(),
      { action: 'getMachineById' },
    );
    return records[0] || null;
  } catch (error) {
    logger.error({
      code: 'EXT-AIRTABLE-500',
      message: 'Error fetching machine by ID',
      context: { machineId },
      error,
    });
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
    const records = await withAirtableRetry(
      () =>
        logsTable
          .select({
            filterByFormula: `{date} = '${todayJST}'`,
            sort: [{ field: 'timestamp', direction: 'asc' }],
          })
          .all(),
      { action: 'getTodayLogs' },
    );

    // Airtableのuser(Link to Record)フィールドはレコードIDの配列なので、
    // 取得したレコードから、さらに対象ユーザーのログのみを絞り込む
    return records.filter(
      (record) =>
        record.fields.user && record.fields.user.includes(userRecordId)
    );
  } catch (error) {
    logger.error({
      code: 'EXT-AIRTABLE-500',
      message: 'Error fetching today logs',
      context: { userRecordId, todayJST },
      error,
    });
    throw error;
  }
};
