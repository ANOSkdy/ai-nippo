import test from 'node:test';
import assert from 'node:assert';

import { parseSearchQuery } from '../dist/lib/validation/admin.js';

test('search query schema validates', () => {
  const ok = parseSearchQuery({ userId: 'u1', pageSize: '10' });
  assert.equal(ok.success, true);
});

test('search query schema default page size', () => {
  const ok = parseSearchQuery({});
  assert.equal(ok.success, true);
  assert.equal(ok.data.pageSize, 25);
});
