import { test } from 'node:test';
import assert from 'node:assert';
import config from '../tailwind.config.js';

test('tailwind config has extended colors', () => {
  assert.strictEqual(config.theme?.extend?.colors?.primary, '#4A90E2');
});
