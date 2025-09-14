import test from 'node:test';
import assert from 'node:assert';

test('health endpoint responds ok', async () => {
  const { GET } = await import('@/app/api/admin/health/route');
  const res = await GET();
  assert.equal(res.status, 200);
});
