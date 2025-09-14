import test from 'node:test';
import assert from 'node:assert';

test('search query schema', async () => {
  const { searchQuerySchema } = await import('../dist/lib/validation/admin.js');
  const ok = searchQuerySchema.safeParse({ userId: 'u1', pageSize: 10 });
  assert.equal(ok.success, true);
});

