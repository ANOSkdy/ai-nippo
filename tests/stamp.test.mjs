import { test } from 'node:test';
import assert from 'node:assert';
import { validateStampRequest } from './dist/validator.js';

test('validateStampRequest fails on missing fields', () => {
  const result = validateStampRequest({});
  assert.strictEqual(result.success, false);
});

test('validateStampRequest succeeds with valid data', () => {
  const result = validateStampRequest({
    machineId: 'm1',
    workDescription: '作業',
    lat: 35.0,
    lon: 139.0,
    accuracy: 5,
    type: 'IN',
  });
  assert.strictEqual(result.success, true);
});
