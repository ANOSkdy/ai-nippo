# システム仕様メモ

## ER図メモ
- **Projects** テーブルを追加。Sites テーブルと Link で結合し、プロジェクトごとに `projectId`, `name`, `status`, `startDate`, `endDate`, `progressPercent`, `spreadsheetUrl` を保持する。
- Session テーブルは `year`, `month`, `day`, `username`, `sitename`, `workdescription`, `clockInAt`, `clockOutAt`, `hours` を保持し、Sites 名から代表スプレッドシートURLを導出する。

## API エンドポイント
### GET `/api/dashboard/projects`
- クエリ: `search`, `status`, `sort` (`progress`/`startDate`/`endDate`), `order` (`asc`/`desc`), `page`, `pageSize`。
- レスポンス: `{ items: [{ projectId, name, siteName, status, startDate, endDate, progressPercent, spreadsheetUrl }], total }`。

### GET `/api/dashboard/calendar`
- クエリ: `year`, `month`。必須。
- レスポンス: `{ year, month, days: [{ date, hours, sessions }] }`。hours は小数第2位で丸め。

### GET `/api/dashboard/day-detail`
- クエリ: `date` (YYYY-MM-DD)。必須。
- レスポンス: `{ date, sessions: [{ username, sitename, workdescription, clockInAt, clockOutAt, hours, projectName? }], spreadsheetUrl }`。
- `spreadsheetUrl` は Sites をキーに Projects の最新 (endDate 優先) URL を返却。
