import Airtable, { FieldSet } from 'airtable';
import { NextRequest, NextResponse } from 'next/server';
import { utcToZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

interface LogFields extends FieldSet {
  timestamp: string;
  user?: string;
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

const pad = (n: number): string => String(n).padStart(2, '0');

export async function POST(req: NextRequest) {
  try {
    const { outLogId } = (await req.json()) as { outLogId?: string };
    if (!outLogId) {
      return NextResponse.json(
        { ok: false, error: 'outLogId required' },
        { status: 400 },
      );
    }

    const outRec = await logsTable.find(outLogId);
    const fOut = outRec.fields;

    if ((fOut.type || '').toUpperCase() !== 'OUT') {
      return NextResponse.json({ ok: true, skipped: true, reason: 'not OUT' });
    }

    const outTs = new Date(fOut.timestamp);
    const outLocal = utcToZonedTime(outTs, TZ);
    const outStr =
      `${outLocal.getFullYear()}-` +
      `${pad(outLocal.getMonth() + 1)}-` +
      `${pad(outLocal.getDate())} ` +
      `${pad(outLocal.getHours())}:${pad(outLocal.getMinutes())}:${pad(outLocal.getSeconds())}`;

    const filter = `
AND(
  {user} = '${String(fOut.user)}',
  {siteName} = '${String(fOut.siteName)}',
  {workDescription} = '${String(fOut.workDescription)}',
  {type} = 'IN',
  IS_BEFORE({timestamp}, DATETIME_PARSE('${outStr}', 'YYYY-MM-DD HH:mm:ss'))
)`.trim();

    const ins = await logsTable
      .select({
        filterByFormula: filter,
        sort: [{ field: 'timestamp', direction: 'desc' }],
        maxRecords: 1,
      })
      .firstPage();

    if (!ins[0]) {
      return NextResponse.json({ ok: true, skipped: true, reason: 'no IN' });
    }

    const fIn = ins[0].fields;

    const inTs = new Date(fIn.timestamp);
    const hours = Math.max(0, (outTs.getTime() - inTs.getTime()) / 3600000);
    const hoursRounded = Math.round(hours * 100) / 100;

    const inJst = utcToZonedTime(inTs, TZ);
    const year = inJst.getFullYear();
    const month = inJst.getMonth() + 1;
    const day = inJst.getDate();

    const fields: SessionFields = {
      year,
      month,
      day,
      userId: String(fIn.user ?? ''),
      username: String(fIn.username ?? ''),
      sitename: String(fIn.siteName ?? ''),
      workdescription: String(fIn.workDescription ?? ''),
      clockInAt: inTs.toISOString(),
      clockOutAt: outTs.toISOString(),
      hours: hoursRounded,
    };

    const created = await sessionTable.create([{ fields }], { typecast: true });

    return NextResponse.json({
      ok: true,
      createdId: created?.[0]?.id,
      fields,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: String((e as Error).message) },
      { status: 500 },
    );
  }
}
