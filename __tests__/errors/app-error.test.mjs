import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, toErrorResponse } from '../../tests/dist/src/lib/errors.js';
import { resolveErrorDictionary } from '../../tests/dist/src/i18n/errors.js';

test('AppError exposes structured payload', () => {
  const error = new AppError({
    code: 'APP-401-UNAUTHENTICATED',
    message: '認証が必要です',
    status: 401,
    hint: 'ログインしてください',
    severity: 'warning',
  });
  const { body, status } = toErrorResponse(error);
  assert.equal(status, 401);
  assert.equal(body.code, 'APP-401-UNAUTHENTICATED');
  assert.equal(body.hint, 'ログインしてください');
  assert.equal(body.severity, 'warning');
});

test('Unknown error falls back to generic message', () => {
  const { body, status } = toErrorResponse(new Error('boom'));
  assert.equal(status, 500);
  assert.equal(body.code, 'APP-500-UNEXPECTED');
  assert.equal(body.ok, false);
});

test('dictionary resolves known code', () => {
  const entry = resolveErrorDictionary('APP-401-UNAUTHENTICATED');
  assert.ok(entry);
  assert.equal(entry.title, 'ログインが必要です');
});
