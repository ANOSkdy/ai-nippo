import Airtable, { FieldSet } from 'airtable';
import { NextRequest, NextResponse } from 'next/server';
import { utcToZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

interface LogFields extends FieldSet {
  timestamp: string;
  user?: string | number;
  username?: string;
  siteName?: string;
  workDescription?: string;
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

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY! }).base(
  process.env.AIRTABLE_BASE_ID!,
);

const logsTable = base<LogFields>('Logs');
const sessionTable = base<SessionFields>('Session');
const TZ = 'Asia/Tokyo';

export async function POST(req: NextRequest) {
  try {
    const { outLogId } = (await req.json()) as { outLogId?: string };
    if (!outLogId) {
      return NextResponse.json(
        { ok: false, error: 'outLogId required' },
        { status: 400 },
      );
    }

    // 1) OUT を取得
    const outRec = await logsTable.find(outLogId);
    const fOut = outRec.fields;
    if ((fOut.type || '').toUpperCase() !== 'OUT') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not OUT' });
    }

    const outTs = new Date(fOut.timestamp);

    // 2) 同じ user / siteName / workDescription の IN 候補を広めに取得
    const filter = `
AND(
  {user} = '${String(fOut.user)}',
  {siteName} = '${String(fOut.siteName)}',
  {workDescription} = '${String(fOut.workDescription)}',
  {type} = 'IN'
)`.trim();

    const ins = await logsTable
      .select({
        filterByFormula: filter,
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 20,
      })
      .firstPage();

    // 3) サーバ側で「outTs より前」の最新 IN を選択
    let best: LogFields | null = null;
    let bestTs = -Infinity;
    for (const rec of ins) {
      const ts = new Date(rec.fields.timestamp).getTime();
      if (ts < outTs.getTime() && ts > bestTs) {
        best = rec.fields;
        bestTs = ts;
      }
    }
    if (!best) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no IN match' });
    }

    const inTs = new Date(best.timestamp);

    // 4) 稼働時間と日付
    const hours = Math.max(0, (outTs.getTime() - inTs.getTime()) / 3600000);
    const hoursRounded = Math.round(hours * 100) / 100;
    const inJst = utcToZonedTime(inTs, TZ);

    const fields: SessionFields = {
      year: inJst.getFullYear(),
      month: inJst.getMonth() + 1,
      day: inJst.getDate(),
      userId: String(best.user ?? ''),
      username: String(best.username ?? ''),
      sitename: String(best.siteName ?? ''),
      workdescription: String(best.workDescription ?? ''),
      clockInAt: inTs.toISOString(),
      clockOutAt: outTs.toISOString(),
      hours: hoursRounded,
    };

    const created = await sessionTable.create([{ fields }], { typecast: true });

    return NextResponse.json({ ok: true, createdId: created[0].id, fields });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message) },
      { status: 500 },
    );
  }
}

