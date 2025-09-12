import { test } from 'node:test';
import assert from 'node:assert';
import {
  validateStartRequest,
  validateGeoUpdateRequest,
} from './dist/validator.js';

test('validateStartRequest fails on missing fields', () => {
  const result = validateStartRequest({});
  assert.strictEqual(result.success, false);
});

test('validateStartRequest succeeds on minimal data', () => {
  const result = validateStartRequest({
    machineId: '1',
    workDescription: 'test',
    type: 'IN',
  });
  assert.strictEqual(result.success, true);
});

test('validateGeoUpdateRequest requires lon or lng', () => {
  const result = validateGeoUpdateRequest({ sessionId: 's', lat: 0 });
  assert.strictEqual(result.success, false);
});

test('validateGeoUpdateRequest accepts lng', () => {
  const result = validateGeoUpdateRequest({ sessionId: 's', lat: 0, lng: 0 });
  assert.strictEqual(result.success, true);
});

