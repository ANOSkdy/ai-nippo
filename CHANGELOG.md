# Changelog

## [Unreleased]
### Added
- 統一的な `ErrorBanner` コンポーネントと App Router エラーバウンダリ。
- Airtable 向けの指数バックオフ付きリトライと構造化ログ出力。
- エラー/トラブルシューティング/可観測性ドキュメント。
- エラーコード正規化テストと E2E 相当の失敗ケース検証スクリプト。

### Changed
- 打刻 API のバリデーションとエラー応答を `AppError` ベースに統一。
- NFC 打刻画面・ログインフォームのエラーUIを `ErrorBanner` に置換。

### Testing
- `pnpm test`, `pnpm test:e2e`, `pnpm lint` を追加実行手順として記載。
