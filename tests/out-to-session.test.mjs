import { test } from 'node:test';
import assert from 'node:assert';

test('out-to-session requires outLogId', async () => {
  process.env.AIRTABLE_API_KEY = 'key';
  process.env.AIRTABLE_BASE_ID = 'base';
  const { POST } = await import('./dist/app/api/out-to-session/route.js');
  const res = await POST({ json: async () => ({}) });
  assert.strictEqual(res.status, 400);
});

