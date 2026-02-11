import assert from 'node:assert/strict';
import test from 'node:test';
import { createBreakPolicyResolver } from '@/lib/policies/breakDeduction';

function makeRecord({
  id,
  userId = null,
  name = null,
  exclude = false,
}: {
  id: string;
  userId?: number | null;
  name?: string | null;
  exclude?: boolean;
}) {
  return { id, userId, name, excludeBreakDeduction: exclude };
}

test('resolveBreakPolicy prefers recordId over userId and userName', async () => {
  const resolver = createBreakPolicyResolver({
    isPolicyEnabled: () => true,
    findByRecordId: async (recordId) => makeRecord({ id: recordId, exclude: true }),
    findByUserId: async () => makeRecord({ id: 'u2', exclude: false }),
    findByUserName: async () => [makeRecord({ id: 'u3', exclude: false })],
  });

  const result = await resolver({ userRecordId: 'recA', userId: 100, userName: 'Alice' });
  assert.equal(result.excludeBreakDeduction, true);
  assert.equal(result.source, 'recordId');
});

test('resolveBreakPolicy falls back to userId with type wobble', async () => {
  const resolver = createBreakPolicyResolver({
    isPolicyEnabled: () => true,
    findByRecordId: async () => null,
    findByUserId: async (userId) => makeRecord({ id: `u-${userId}`, exclude: true }),
    findByUserName: async () => [],
  });

  const result = await resolver({ userId: '101' });
  assert.equal(result.excludeBreakDeduction, true);
  assert.equal(result.source, 'userId');
});

test('resolveBreakPolicy uses safe default when userName is duplicated', async () => {
  const resolver = createBreakPolicyResolver({
    isPolicyEnabled: () => true,
    findByRecordId: async () => null,
    findByUserId: async () => null,
    findByUserName: async () => [
      makeRecord({ id: 'r1', exclude: true }),
      makeRecord({ id: 'r2', exclude: true }),
    ],
  });

  const result = await resolver({ userName: 'duplicated' });
  assert.equal(result.excludeBreakDeduction, false);
  assert.equal(result.source, 'default');
});

test('resolveBreakPolicy is disabled when feature flag function returns false', async () => {
  let called = false;
  const resolver = createBreakPolicyResolver({
    isPolicyEnabled: () => false,
    findByRecordId: async () => {
      called = true;
      return makeRecord({ id: 'x', exclude: true });
    },
    findByUserId: async () => null,
    findByUserName: async () => [],
  });

  const result = await resolver({ userRecordId: 'recX' });
  assert.equal(result.excludeBreakDeduction, false);
  assert.equal(result.source, 'default');
  assert.equal(called, false);
});
