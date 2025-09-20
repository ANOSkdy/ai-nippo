import Airtable, { FieldSet } from 'airtable';
import { AppError, toErrorResponse } from '@/src/lib/errors';
import { logger } from '@/src/lib/logger';
import { resolveErrorDictionary } from '@/src/i18n/errors';

export const runtime = 'nodejs';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID || ''
);
const LOGS_TABLE = process.env.AIRTABLE_TABLE_LOGS || 'Logs';
const SESSIONS_TABLE = process.env.AIRTABLE_TABLE_SESSIONS || 'Session';

interface LogFields extends FieldSet {
  timestamp: string;
  user: string;
  username: string;
  siteName: string;
  workDescription: string;
  type: 'IN' | 'OUT';
}

interface SessionFields extends FieldSet {
  year: number;
  month: number;
  day: number;
  userId: string;
  username: string;
  sitename: string;
  workdescription: string;
  clockInAt: string;
  clockOutAt: string;
  hours: number;
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const statusCode = typeof (error as { statusCode?: number })?.statusCode === 'number'
      ? (error as { statusCode: number }).statusCode
      : undefined;
    if (statusCode === 429) {
      logger.warn({
        code: 'EXT-AIRTABLE-429',
        message: 'Airtable rate limited request',
        route: '/api/out-to-session',
        context: { delay },
      });
    }
    if (retries === 0) {
      throw new AppError({
        code: statusCode === 429 ? 'EXT-AIRTABLE-429' : 'EXT-AIRTABLE-500',
        message: statusCode === 429 ? 'Airtableのレート制限に達しました' : 'Airtable処理に失敗しました',
        hint: '時間をおいて再試行してください',
        status: statusCode === 429 ? 429 : 502,
        severity: statusCode === 429 ? 'warning' : 'error',
        cause: error,
      });
    }
    await new Promise((r) => setTimeout(r, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

function jstParts(date: Date): { year: number; month: number; day: number } {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const error = new AppError({
      code: 'APP-400-INVALID_REQUEST',
      message: 'JSONの解析に失敗しました',
      hint: '送信フォーマットを確認してください',
      status: 400,
      severity: 'warning',
    });
    const { body, status } = toErrorResponse(error);
    const dict = resolveErrorDictionary(error.code);
    return Response.json(
      dict
        ? {
            ...body,
            ui: {
              title: dict.title,
              description: dict.description,
              action: dict.action,
              severity: dict.severity ?? error.severity,
            },
          }
        : body,
      { status },
    );
  }
  const outLogId = (body as { outLogId?: unknown }).outLogId;
  if (typeof outLogId !== 'string') {
    const error = new AppError({
      code: 'APP-400-INVALID_REQUEST',
      message: 'outLogId が指定されていません',
      hint: '打刻データを再度選択してください',
      status: 400,
      severity: 'warning',
    });
    const { body, status } = toErrorResponse(error);
    const dict = resolveErrorDictionary(error.code);
    return Response.json(
      dict
        ? {
            ...body,
            ui: {
              title: dict.title,
              description: dict.description,
              action: dict.action,
              severity: dict.severity ?? error.severity,
            },
          }
        : body,
      { status },
    );
  }

  try {
    const outLog = await withRetry(() => base<LogFields>(LOGS_TABLE).find(outLogId));
    if (outLog.fields.type !== 'OUT') {
      const error = new AppError({
        code: 'APP-409-CONFLICT',
        message: 'OUT打刻ではありません',
        hint: '退勤打刻を選択してください',
        status: 409,
        severity: 'warning',
      });
      const { body, status } = toErrorResponse(error);
      const dict = resolveErrorDictionary(error.code);
      return Response.json(
        dict
          ? {
              ...body,
              ui: {
                title: dict.title,
                description: dict.description,
                action: dict.action,
                severity: dict.severity ?? error.severity,
              },
            }
          : body,
        { status },
      );
    }
    const outTs = new Date(outLog.fields.timestamp);
    const { user, username, siteName, workDescription } = outLog.fields;

    const candidates = await withRetry(() =>
      base<LogFields>(LOGS_TABLE)
        .select({
          filterByFormula: `AND({type}='IN',{user}='${user}',{siteName}='${siteName}',{workDescription}='${workDescription}')`,
          sort: [{ field: 'timestamp', direction: 'desc' }],
          maxRecords: 50,
        })
        .all()
    );

    const inRecord = candidates.find((r) => new Date(r.fields.timestamp) < outTs);
    if (!inRecord) {
      logger.warn({
        code: 'APP-404-NO_IN_LOG',
        message: 'INログが見つかりません',
        route: '/api/out-to-session',
        context: { outLogId },
      });
      return Response.json({ ok: true, skipped: true, reason: 'no IN match' });
    }
    const inTs = new Date(inRecord.fields.timestamp);
    const { year, month, day } = jstParts(inTs);
    const hours = Math.max((outTs.getTime() - inTs.getTime()) / 3600000, 0);
    const roundedHours = Math.round(hours * 100) / 100;

    const session: SessionFields = {
      year,
      month,
      day,
      userId: String(user),
      username: String(username),
      sitename: String(siteName),
      workdescription: String(workDescription),
      clockInAt: inRecord.fields.timestamp,
      clockOutAt: outLog.fields.timestamp,
      hours: roundedHours,
    };

    const exists = await withRetry(() =>
      base<SessionFields>(SESSIONS_TABLE)
        .select({
          filterByFormula: `AND({userId}='${session.userId}',{sitename}='${session.sitename}',{workdescription}='${session.workdescription}',{clockInAt}='${session.clockInAt}',{clockOutAt}='${session.clockOutAt}')`,
          maxRecords: 1,
        })
        .all()
    );
    if (exists.length > 0) {
      return Response.json({ ok: true, skipped: true, reason: 'duplicate' });
    }

    const created = await withRetry(() =>
      base<SessionFields>(SESSIONS_TABLE).create(session)
    );
    logger.info({
      code: 'APP-201-SESSION_CREATED',
      message: 'Session record created',
      route: '/api/out-to-session',
      context: { sessionId: created.id, outLogId },
    });
    return Response.json({ ok: true, createdId: created.id, fields: created.fields });
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError({
          code: 'APP-500-INTERNAL',
          message: 'セッション生成に失敗しました',
          hint: '時間をおいて再試行してください',
          status: 500,
          severity: 'error',
          cause: error,
        });
    logger.error({
      code: appError.code,
      message: 'Failed to convert OUT log to session',
      route: '/api/out-to-session',
      context: { outLogId },
      error,
    });
    const { body, status } = toErrorResponse(appError);
    const dict = resolveErrorDictionary(appError.code);
    return Response.json(
      dict
        ? {
            ...body,
            ui: {
              title: dict.title,
              description: dict.description,
              action: dict.action,
              severity: dict.severity ?? appError.severity,
            },
          }
        : body,
      { status },
    );
  }
}
