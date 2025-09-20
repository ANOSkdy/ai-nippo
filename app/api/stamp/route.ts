import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  logsTable,
  sitesTable,
  getMachineById,
} from '@/lib/airtable';
import { findNearestSiteDetailed } from '@/lib/geo';
import { LOGS_ALLOWED_FIELDS, filterFields } from '@/lib/airtableSchema';
import { LogFields } from '@/types';
import { AppError, toErrorResponse } from '@/src/lib/errors';
import { logger } from '@/src/lib/logger';
import { resolveErrorDictionary } from '@/src/i18n/errors';
import { validateStampRequest } from './validator';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    const error = new AppError({
      code: 'APP-401-UNAUTHENTICATED',
      message: '認証が必要です',
      hint: 'ログインしてから再試行してください',
      status: 401,
      severity: 'warning',
    });
    const { body, status } = toErrorResponse(error);
    const dict = resolveErrorDictionary(error.code);
    const responseBody = dict
      ? {
          ...body,
          ui: {
            title: dict.title,
            description: dict.description,
            action: dict.action,
            severity: dict.severity ?? error.severity,
          },
        }
      : body;
    return NextResponse.json(responseBody, { status });
  }

  const parsed = validateStampRequest(await req.json());
  if (!parsed.success) {
    const error = new AppError({
      code: 'APP-400-INVALID_REQUEST',
      message: 'リクエストの形式が正しくありません',
      hint: parsed.hint,
      status: 400,
      severity: 'warning',
    });
    const { body, status } = toErrorResponse(error);
    const dict = resolveErrorDictionary(error.code);
    const responseBody = dict
      ? {
          ...body,
          ui: {
            title: dict.title,
            description: dict.description,
            action: dict.action,
            severity: dict.severity ?? error.severity,
          },
        }
      : body;
    return NextResponse.json(responseBody, { status });
  }

  const {
    machineId,
    workDescription,
    lat,
    lon,
    accuracy,
    type,
  } = parsed.data;

  try {
    const machine = await getMachineById(machineId);

    if (!machine || !machine.fields.active) {
      throw new AppError({
        code: 'APP-404-NOT_FOUND',
        message: '機械IDが見つからないか非アクティブです',
        hint: 'NFCタグや機械IDを確認してください',
        status: 404,
        severity: 'warning',
      });
    }
    const machineRecordId = machine.id;

    const activeSites = await sitesTable
      .select({ filterByFormula: '{active} = 1' })
      .all()
      .catch((error: unknown) => {
        const statusCode = typeof (error as { statusCode?: number })?.statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : undefined;
        if (statusCode === 429) {
          throw new AppError({
            code: 'EXT-AIRTABLE-429',
            message: 'Airtableのレート制限に到達しました',
            hint: '1分ほど待ってから再試行してください',
            status: 429,
            severity: 'warning',
            cause: error,
          });
        }
        throw new AppError({
          code: 'EXT-AIRTABLE-500',
          message: '拠点データの取得に失敗しました',
          hint: 'ネットワーク環境を確認し、時間をおいて再試行してください',
          status: 502,
          severity: 'error',
          cause: error,
        });
      });
    logger.info({
      code: 'APP-200-SITES_SUMMARY',
      message: 'Active sites fetched',
      context: {
        count: activeSites.length,
        hasAcoru: activeSites.some((s) => s.fields.name === 'Acoru合同会社'),
      },
      route: '/api/stamp',
      userId: session.user.id,
    });
    const { site: nearestSite, method: decisionMethod, nearestDistanceM } =
      findNearestSiteDetailed(lat, lon, activeSites);

    const now = new Date();
    const timestamp = now.toISOString();
    const dateJST = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now).replace(/\//g, '-');

    const candidate = {
      timestamp,
      date: dateJST,
      user: [session.user.id], // AirtableのUsersテーブルのレコードID
      machine: [machineRecordId],
      siteName: nearestSite?.fields.name ?? null,
      lat,
      lon,
      accuracy,
      workDescription,
      type,
    };
    const fields = filterFields(candidate, LOGS_ALLOWED_FIELDS) as Partial<LogFields>;
    if (!fields.siteName && nearestSite?.fields?.name) {
      fields.siteName = nearestSite.fields.name;
    }
    if (!fields.timestamp) {
      fields.timestamp = timestamp;
    }

    await logsTable
      .create([{ fields }], { typecast: true })
      .catch((error: unknown) => {
        const statusCode = typeof (error as { statusCode?: number })?.statusCode === 'number'
          ? (error as { statusCode: number }).statusCode
          : undefined;
        if (statusCode === 429) {
          throw new AppError({
            code: 'EXT-AIRTABLE-429',
            message: 'Airtableのレート制限に到達しました',
            hint: '1分ほど待ってから再試行してください',
            status: 429,
            severity: 'warning',
            cause: error,
          });
        }
        throw new AppError({
          code: 'EXT-AIRTABLE-500',
          message: 'Airtableにログを保存できませんでした',
          hint: '時間をおいてから再試行してください',
          status: 502,
          severity: 'error',
          cause: error,
        });
      });

    return NextResponse.json(
      {
        decidedSiteId: nearestSite?.fields.siteId ?? null,
        decidedSiteName: nearestSite?.fields.name ?? null,
        decision_method: decisionMethod,
        nearest_distance_m: nearestDistanceM ?? null,
        accuracy,
      },
      { status: 200 },
    );
  } catch (error) {
    const appError = error instanceof AppError
      ? error
      : new AppError({
        code: 'APP-500-INTERNAL',
        message: '打刻処理に失敗しました',
        hint: '時間をおいてから再試行してください',
        status: 500,
        severity: 'error',
        cause: error,
      });
    const dictionary = resolveErrorDictionary(appError.code);
    logger.error({
      code: appError.code,
      message: 'Failed to record stamp',
      route: '/api/stamp',
      userId: session?.user?.id,
      context: { hint: appError.hint },
      error,
    });
    const payload = toErrorResponse(appError);
    const body = {
      ...payload.body,
      ui: dictionary
        ? {
            title: dictionary.title,
            description: dictionary.description,
            action: dictionary.action,
            severity: dictionary.severity ?? appError.severity,
          }
        : undefined,
    };
    return NextResponse.json(body, { status: payload.status });
  }
}
