import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const routePath = join(__dirname, '../../app/api/dashboard/calendar/route.ts');

test('calendar route declares node runtime', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes("export const runtime = 'nodejs'"));
});

test('calendar route validates params', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes('MISSING_PARAMS'));
  assert.ok(content.includes('INVALID_MONTH'));
});

test('calendar route uses getSessionsByMonth helper', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes('getSessionsByMonth'));
  assert.ok(content.includes('return NextResponse.json(data)'));
});
