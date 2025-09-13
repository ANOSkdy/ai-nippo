import test from 'node:test';
import assert from 'node:assert';

import { parseReflectBody } from '../dist/lib/validation/admin.js';

test('reflect body schema validates', () => {
  const ok = parseReflectBody({
    updates: [{ id: 'rec1', fields: { type: 'IN' } }],
  });
  assert.equal(ok.success, true);
});
