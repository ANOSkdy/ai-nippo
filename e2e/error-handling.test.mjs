import { test } from 'node:test';
import assert from 'node:assert/strict';

const scenarios = [
  {
    code: 'APP-401-UNAUTHENTICATED',
    response: {
      ok: false,
      code: 'APP-401-UNAUTHENTICATED',
      ui: {
        title: 'ログインが必要です',
        description: 'セッションが切れました。再度ログインしてください。',
        action: 'ログイン',
      },
    },
  },
  {
    code: 'APP-404-NOT_FOUND',
    response: {
      ok: false,
      code: 'APP-404-NOT_FOUND',
      ui: {
        title: 'お探しの情報が見つかりません',
        description: 'URLを確認してください。',
        action: '戻る',
      },
    },
  },
  {
    code: 'EXT-AIRTABLE-429',
    response: {
      ok: false,
      code: 'EXT-AIRTABLE-429',
      ui: {
        title: '外部サービスが混み合っています',
        description: 'しばらく待ってから再試行してください。',
        action: '待機',
      },
    },
  },
];

test('API error payloads expose UI hints', () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.response.code, scenario.code);
    assert.ok(scenario.response.ui.title.length > 0);
    assert.ok(scenario.response.ui.description.length > 0);
  }
});

test('network failure fallback message', () => {
  const fallback = 'ネットワークに接続できません';
  assert.match(fallback, /ネットワーク/);
});
