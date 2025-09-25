import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSessionsByMonth } from '@/lib/airtable/sessions';

export const runtime = 'nodejs';

const parseInteger = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'UNAUTHORIZED', code: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = parseInteger(searchParams.get('year'));
    const monthParam = parseInteger(searchParams.get('month'));

    if (!yearParam || !monthParam) {
      return NextResponse.json({ error: 'MISSING_PARAMS', code: 'MISSING_PARAMS' }, { status: 400 });
    }

    if (monthParam < 1 || monthParam > 12) {
      return NextResponse.json({ error: 'INVALID_MONTH', code: 'INVALID_MONTH' }, { status: 400 });
    }

    const data = await getSessionsByMonth({ year: yearParam, month: monthParam });
    return NextResponse.json(data);
  } catch (error) {
    console.error('[dashboard.calendar]', error);
    return NextResponse.json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
