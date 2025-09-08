import { test } from 'node:test';
import assert from 'node:assert';
import { validateStampRequest } from './dist/validator.js';
import tailwindConfig from '../tailwind.config.js';

test('validateStampRequest fails on missing fields', () => {
  const result = validateStampRequest({});
  assert.strictEqual(result.success, false);
});

test('tailwind config includes custom accent colors', () => {
  assert.strictEqual(tailwindConfig.theme.extend.colors['accent-1'], '#FFD166');
  assert.strictEqual(tailwindConfig.theme.extend.colors['accent-2'], '#F25F5C');
  assert.strictEqual(tailwindConfig.theme.extend.colors['accent-3'], '#9D59EC');
});
