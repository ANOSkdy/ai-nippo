import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const routePath = join(__dirname, '../../app/api/dashboard/projects/route.ts');

test('projects route declares node runtime', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes("export const runtime = 'nodejs'"));
});

test('projects route has pagination validation errors', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes("INVALID_PAGE"));
  assert.ok(content.includes("INVALID_PAGE_SIZE"));
});

test('projects route returns items and total', async () => {
  const content = await readFile(routePath, 'utf8');
  assert.ok(content.includes('return NextResponse.json(data)'));
  assert.ok(content.includes('ProjectListResponse'));
});
