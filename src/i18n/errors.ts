export type ErrorDictionaryEntry = {
  title: string;
  description: string;
  action: string;
  severity?: 'info' | 'warning' | 'error';
};

export const errorDictionary: Record<string, ErrorDictionaryEntry> = {
  'APP-400-INVALID_REQUEST': {
    title: '入力内容を確認してください',
    description: '送信された内容に誤りがあります。必須項目や形式を今一度ご確認ください。',
    action: '内容を修正してから再度送信してください。',
    severity: 'warning',
  },
  'APP-401-UNAUTHENTICATED': {
    title: 'ログインが必要です',
    description: 'セッションが切れたか、まだログインしていません。',
    action: 'ログインし直してから操作を続けてください。',
    severity: 'warning',
  },
  'APP-403-FORBIDDEN': {
    title: '閲覧権限がありません',
    description: '指定された画面や機能にアクセスする権限がありません。',
    action: '管理者に権限追加を依頼してください。',
    severity: 'warning',
  },
  'APP-404-NOT_FOUND': {
    title: 'お探しの情報が見つかりません',
    description: '指定されたリソースは存在しないか、削除された可能性があります。',
    action: 'URLを確認するか、トップページへ戻って操作をやり直してください。',
    severity: 'info',
  },
  'APP-409-CONFLICT': {
    title: '処理が競合しました',
    description: '同時操作などにより処理が完了できませんでした。',
    action: '数秒待ってから再試行してください。',
    severity: 'warning',
  },
  'APP-403-LOCATION_DENIED': {
    title: '位置情報へのアクセスが許可されていません',
    description: '端末またはブラウザが位置情報の利用を拒否しています。',
    action: 'ブラウザ設定から位置情報の利用を許可し、再読み込みしてください。',
    severity: 'warning',
  },
  'APP-408-GEO_TIMEOUT': {
    title: '位置情報の取得に時間がかかっています',
    description: '電波状況や設定により測位が完了していません。',
    action: '屋外に移動する、Wi-Fiを有効にするなど測位条件を改善して再試行してください。',
    severity: 'warning',
  },
  'APP-503-NETWORK': {
    title: 'ネットワークに接続できません',
    description: 'オフライン状態のためサーバーと通信できません。',
    action: '通信環境を確認して再読み込みしてください。',
    severity: 'warning',
  },
  'APP-429-RATE_LIMITED': {
    title: 'アクセスが集中しています',
    description: '短時間に多数のリクエストが送られました。',
    action: 'しばらく待ってから再試行してください。',
    severity: 'warning',
  },
  'APP-500-INTERNAL': {
    title: 'サーバーで問題が発生しました',
    description: '内部エラーにより処理を完了できませんでした。',
    action: '時間をおいて再度お試しください。',
    severity: 'error',
  },
  'APP-500-UNEXPECTED': {
    title: '想定外のエラーが発生しました',
    description: '操作を完了できませんでした。',
    action: '時間をおいて再試行し、続く場合はサポートへご連絡ください。',
    severity: 'error',
  },
  'EXT-AIRTABLE-429': {
    title: '外部サービスが混み合っています',
    description: 'Airtable側のレート制限により一時的に処理できません。',
    action: '1分ほど待ってから再試行してください。',
    severity: 'warning',
  },
  'EXT-AIRTABLE-500': {
    title: '外部サービスでエラーが発生しました',
    description: 'Airtableからエラー応答が返されました。',
    action: '時間をおいて再実行し、継続する場合はシステム管理者へ報告してください。',
    severity: 'error',
  },
};

export function resolveErrorDictionary(code: string) {
  return errorDictionary[code];
}
