import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const routePath = join(__dirname, '../../app/api/dashboard/day-detail/route.ts');

test('day-detail route declares node runtime', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes("export const runtime = 'nodejs'"));
});

test('day-detail route validates date param', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes('MISSING_DATE'));
  assert.ok(content.includes('DATE_PATTERN'));
});

test('day-detail route combines session detail and spreadsheet url', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes('getDaySessions'));
  assert.ok(content.includes('findSpreadsheetUrlForSites'));
  assert.ok(content.includes("return NextResponse.json({ ...detail, spreadsheetUrl: spreadsheetUrl ?? null })"));
});
