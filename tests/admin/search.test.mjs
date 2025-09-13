import test from 'node:test';
import assert from 'node:assert';

import { parseSearchQuery } from '../dist/lib/validation/admin.js';

test('search query schema validates', () => {
  const ok = parseSearchQuery({ userId: 'u1', pageSize: '10' });
  assert.equal(ok.success, true);
});
