# 可観測性ガイド

## ログ
- すべての API / サーバー処理は `src/lib/logger.ts` を経由して JSON 形式で出力します。
- 主要フィールド: `timestamp`, `level`, `code`, `message`, `route`, `context`, `error`。
- Vercel Functions / Edge で収集する際は以下に注意。
  - Functions: Cloud Logs で 4 KB 以上の行は折り返されるため、`context` は必要最小限に。
  - Edge Runtime: `console.*` しか利用できないため、`logger` が `console` バインドを利用。
- エラー調査手順:
  1. `code` で検索（例: `APP-500-INTERNAL`）。
  2. `correlationId` が付与されていればトレースに紐付け。
  3. `error.stack` が含まれる場合はスタックトレースを Sentry 等へ転送。

## メトリクス
- Vercel Analytics を有効にしている場合、API レスポンスのレイテンシを監視。
- Airtable 429 レート制限は `EXT-AIRTABLE-429` のログカウントを Cloud Logging でメトリクス化。
- 主要 KPI:
  - 成功打刻率（成功レスポンス / 全リクエスト）
  - レート制限発生率（429 レスポンス数 / 全リクエスト）
  - 位置情報取得成功率（ErrorBanner に `APP-403-LOCATION_DENIED` が出ない割合）

## ダッシュボード
- 例: BigQuery / Looker Studio で `code`, `route`, `level` を軸にヒートマップ化。
- 週間レビュー: `APP-500-*` と `EXT-AIRTABLE-*` の発生件数を可視化して対応状況を確認。

## 監視ルール
- 5分間で `APP-500-INTERNAL` が 5件以上 → PagerDuty でアラート。
- 15分間で `EXT-AIRTABLE-429` が 20件以上 → Airtable サポート窓口へ連絡。
- ログインエラーが 3連続 (`APP-401-UNAUTHENTICATED`) → 認証サーバーの死活監視を確認。

## 運用 Tips
- ログには PII を含めない。ユーザー識別子はハッシュ済み ID などを利用。
- 本番障害時は `docs/troubleshooting.md` をユーザーに案内し一次切り分けを促す。
- ロールバック手順を CHANGELOG.md に追記し、状況共有を円滑化。
