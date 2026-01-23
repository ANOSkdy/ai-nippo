import { NextResponse } from 'next/server';
import { machinesTable } from '@/lib/airtable';

function isUnknownFieldError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const statusCode = (error as { statusCode?: number }).statusCode;
  const message = (error as { message?: string }).message;
  if (statusCode !== 422 || typeof message !== 'string') {
    return false;
  }
  return message.includes('UNKNOWN_FIELD_NAME') || message.includes('Unknown field name');
}

export async function GET() {
  try {
    let records;
    try {
      records = await machinesTable
        .select({
          filterByFormula: '{active} = 1',
          sort: [{ field: 'machineid', direction: 'asc' }],
        })
        .all();
    } catch (error) {
      if (!isUnknownFieldError(error)) {
        throw error;
      }
      console.warn('[machines] fallback without machineid sort due to unknown field');
      records = await machinesTable
        .select({
          filterByFormula: '{active} = 1',
        })
        .all();
    }

    const machines = records.map((record) => ({
      id: record.id,
      fields: record.fields,
    }));

    return NextResponse.json(machines);
  } catch (error) {
    console.error('Failed to fetch machines:', error);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
