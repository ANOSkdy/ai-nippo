# エラーカタログ

| ID | 概要 | 発生箇所 | 例外型/HTTPコード | ユーザー影響度 | 再現手順 | 既存UI表示 | ログ出力 | 推奨UI文言 | ユーザー対応手順 | 運用側対応 | 優先度 | 関連Issue/PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| APP-400-INVALID_REQUEST | リクエストの必須項目欠落・形式不備 | `/api/stamp`, `/api/out-to-session` | 400 / `AppError` | 中 | 必須フィールドを空で送信する | ErrorBannerが「入力内容を確認してください」を表示 | `logger.warn` が入力内容と共にJSONで出力 | 「入力内容を確認してください。必須項目の抜けがないか見直してください。」 | 入力内容を修正し再送信 | バリデーションルールの確認、監視アラート | 中 | 本PR |
| APP-401-UNAUTHENTICATED | 未ログイン・セッション切れ | `/api/stamp`, NFCページ | 401 / `AppError` | 高 | 未ログイン状態でAPI実行 | ErrorBannerが「ログインが必要です」を表示 | `logger.warn` が userId無しで出力 | 「セッションが切れました。再度ログインしてください。」 | ログインページに遷移し再認証 | 認証サーバーの稼働確認、NextAuth設定確認 | 高 | 本PR |
| APP-403-FORBIDDEN | 権限不足 | middleware想定 | 403 / `AppError` | 中 | 認可外ユーザーで保護ページアクセス | ErrorBanner（セグメント） | `logger.error` | 「アクセス権がありません。管理者へ連絡してください。」 | 管理者へ権限申請 | IAM設定を確認 | 中 | - |
| APP-404-NOT_FOUND | 機械ID未登録・リソース欠落 | NFCサーバーコンポーネント, `/api/stamp` | 404 / `AppError` | 中 | 登録されていない machineId を指定 | ErrorBannerが警告表示 | `logger.warn` | 「登録されていない機械IDです。担当者へ確認してください。」 | NFCタグ再確認 | Airtableマスタを更新 | 中 | 本PR |
| APP-409-CONFLICT | OUTログではない等の競合 | `/api/out-to-session` | 409 / `AppError` | 低 | INログIDを指定 | ErrorBanner（APIレスポンス） | `logger.warn` | 「処理が競合しました。正しい打刻を選択してください。」 | 正しいデータを選択 | ログで原因調査 | 低 | 本PR |
| APP-429-RATE_LIMITED | アプリ側リトライ限界 | fetch層 | 429 / `AppError` | 中 | 短時間にAPI連打 | ErrorBannerが待機案内 | `logger.warn` に attempt, delay を記録 | 「アクセスが集中しています。しばらく待って再試行してください。」 | 数分待って再試行 | WAF/レート制限調整 | 中 | 本PR |
| APP-500-INTERNAL | アプリ内部エラー | `/api/*`, NFCページ | 500 / `AppError` | 高 | サーバー例外発生 | ErrorBanner（赤） | `logger.error` が stack 付きで出力 | 「サーバーで問題が発生しました。時間をおいて再試行してください。」 | リトライ、解消しない場合は問い合わせ | ログ確認・Sentry/監視へ連携 | 高 | 本PR |
| APP-500-SEGMENT | セグメントエラーバウンダリ捕捉 | `app/error.tsx` | - / `ErrorBoundary` | 中 | クライアント描画時例外 | ErrorBanner | `logger.error` digest付与 | 「画面の表示に失敗しました。再読み込みしてください。」 | 再読み込み | 例外解析 | 中 | 本PR |
| APP-500-GLOBAL | グローバルエラーバウンダリ | `app/global-error.tsx` | - | 高 | SSR/初期化時例外 | ErrorBanner | `logger.error` | 「予期しないエラーが発生しました。」 | 再読み込み・サポート連絡 | 監視と復旧 | 高 | 本PR |
| APP-500-PROTECTED | 保護セグメントでの例外 | `app/(protected)/error.tsx` | - | 高 | `/nfc` で例外 | ErrorBanner | `logger.error` | 「データの読み込みに失敗しました。」 | 通信確認・再読み込み | ログ調査 | 高 | 本PR |
| APP-500-UNEXPECTED | 未分類のサーバー例外 | 任意 | 500 / fallback | 高 | 未捕捉例外 | ErrorBanner | `logger.error` | 「想定外のエラーが発生しました。」 | リトライ/問い合わせ | SRE対応 | 高 | 本PR |
| APP-500-CONFIG | Airtable設定不足 | `lib/airtable` 初期化 | throw `AppError` | 致命 | 環境変数未設定 | build/起動時に失敗 | `logger.error` | 「Airtableの接続設定が未完了です。」 | 管理者へ設定依頼 | Vercel環境変数設定 | 高 | 本PR |
| EXT-AIRTABLE-429 | Airtableレート制限 | Airtable操作全般 | 429 / `AppError` | 中 | Airtableに連続アクセス | ErrorBanner待機案内 | `logger.warn` attempt数 | 「外部サービスが混み合っています。少し待ってください。」 | 1分後に再試行 | 利用状況の調整、Airtableステータス確認 | 中 | 本PR |
| EXT-AIRTABLE-500 | Airtable障害/不正レスポンス | Airtable操作全般 | 502 / `AppError` | 高 | Airtable APIエラー | ErrorBanner | `logger.error` cause付き | 「外部サービスでエラーが発生しました。」 | 後ほど再試行 | Airtableサポートへ連絡、リトライ戦略見直し | 高 | 本PR |
| APP-404-NO_IN_LOG | INログ未検出でセッション生成不可 | `/api/out-to-session` | 200 (skipped) | 低 | OUTのみ存在 | UIは完了扱い＋警告 | `logger.warn` | 「対応する出勤打刻が見つかりません。」 | 管理者へ確認 | データ整合性チェック | 中 | 本PR |
| APP-403-LOCATION_DENIED | 位置情報アクセス拒否 | StampCard (ブラウザ) | ブラウザAPI | 中 | 位置情報アクセスを拒否 | ErrorBanner が許可設定変更を案内 | ブラウザコンソール警告 | 「位置情報の利用を許可してください。」 | ブラウザ設定で位置情報を許可 | MDM/端末設定を見直し | 中 | 本PR |
| APP-408-GEO_TIMEOUT | 位置情報タイムアウト | StampCard | クライアント例外 | 中 | 屋内などで測位に失敗 | ErrorBanner | ブラウザコンソール | 「位置情報の取得に時間がかかっています。」 | 屋外移動・端末再試行 | 測位環境の改善を案内 | 中 | 本PR |
| APP-503-NETWORK | オフライン/ネットワーク断 | StampCard / LoginForm | Fetch失敗 | 高 | 機内モードで操作 | ErrorBanner がネットワーク復旧を促す | ブラウザコンソール | 「ネットワークに接続できません。」 | 通信環境を確認 | ネットワーク監視 | 高 | 本PR |

## セクション別補足

### 認証・権限
- NextAuth セッション切れ時は `APP-401-UNAUTHENTICATED` を返却。ErrorBanner で再ログイン導線を提示。
- middleware で認可失敗時は `APP-403-FORBIDDEN` を想定（ログ連携のみ）。

### 外部依存 (Airtable)
- `withAirtableRetry` と `AppError` で 429 の指数バックオフとメッセージ統一。
- PII を含まないコンテキストのみログに残し、Vercel Functions 上限に配慮した JSON ログ形式。

### UI 表示
- すべての主要画面で `ErrorBanner` を使用し、再試行ボタン・閉じる操作・詳細トグルを提供。
- API レスポンスには `ui` 情報を含め、クライアント側でユーザー向け文言に利用可能。

### 運用ポイント
- `docs/observability.md` にログ・メトリクスの読み方とダッシュボード手順を整理。
- 重大エラー (`APP-500-*`, `EXT-AIRTABLE-*`) は監視ツールで即時検知し、トリアージフローを用意。
