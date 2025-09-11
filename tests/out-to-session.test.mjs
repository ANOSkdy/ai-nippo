import { test } from 'node:test';
import assert from 'node:assert';
import { toUtcFromMaybeLocal } from './dist/utils.js';

test('toUtcFromMaybeLocal parses JST string to UTC', () => {
  const dt = toUtcFromMaybeLocal('2025/9/9 7:49:40');
  assert.ok(dt);
  assert.strictEqual(dt.toISOString(), '2025-09-08T22:49:40.000Z');
});
