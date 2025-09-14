import test from 'node:test';
import assert from 'node:assert';

test('reflect body schema', async () => {
  const { reflectBodySchema } = await import('../dist/lib/validation/admin.js');
  const ok = reflectBodySchema.safeParse({
    updates: [{ id: 'rec1', fields: { type: 'IN' } }],
  });
  assert.equal(ok.success, true);
});

