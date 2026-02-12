# テーブル定義・設計レポート（最新リポジトリ解析）

- 対象リポジトリ: `ai-nippo`
- 解析日: 2026-02-12
- 解析方針: 実装コードを一次情報とし、Airtable テーブル/フィールドの実利用定義を抽出

---

## 1. エグゼクティブサマリー

本リポジトリは **Airtable を基盤とした勤怠・打刻アプリ**で、現在の主軸は `Logs` テーブルです。設計としては「書き込みは `/api/stamp` で Logs へ直接」「読み取り時にオンデマンド集計」という思想に統一されています。

一方で、実装を横断すると **フィールド命名ゆれ（`machineId` / `machineid`、`siteName` / `sitename`）** と **ユーザー同定方式の多重化（record id, userId, username, email）** が残っており、耐障害性を高める吸収コードが多く実装されています。これは運用継続には有効ですが、長期的にはスキーマ統一のほうが保守コスト低減に効きます。

---

## 2. 現行データモデル（コードベース準拠）

### 2.1 中核テーブル

#### Logs（中核）

現行の業務ロジック上、`Logs` が唯一の集計ソースです（旧 Session / ReportIndex は廃止方針）。

**主な保存フィールド（書き込み側）**

- `timestamp`（ISO）
- `date`（JST の `YYYY-MM-DD`）
- `user`（Users へのリンク配列）
- `machine`（Machines へのリンク配列）
- `siteName`
- `lat`, `lon`, `accuracy`
- `workDescription`
- `type`（`IN` / `OUT`）
- `clientName`（条件付き）

**読み取り時に参照される派生/lookup 系フィールド（吸収対象）**

- ユーザー系: `userName`, `username`, `userId`, `userName (from user)`, `name (from user)`, `userId (from user)`
- 機械系: `machineId`, `machineid`, `machineId (from machine)`, `machineid (from machine)`, `machineName`, `machinename`, `machineName (from machine)`, `machinename (from machine)`
- 現場系: `site`, `siteName`, （互換吸収として）`sitename`
- 作業系: `workType`, `workDescription`, `note`

#### Users

コード上の型定義では以下を想定:

- `userId`, `name`, `username`, `role`
- 任意: `active`, `excludeBreakDeduction`

実運用上は `email` も参照され、ユーザー照合キーとして利用されています。

#### Machines

コード上の型定義では以下を想定:

- `machineid`, `name`
- 任意: `active`

打刻 API では `machineid` で検索し、`active` 判定を必須化しています。

#### Sites

コード上の型定義では以下を想定:

- `siteId`, `name`, `lat`, `lon`, `client`
- 任意: `polygon_geojson`, `active`

打刻時は `active=1` な site 候補に対して位置情報で最近傍判定を行い、`siteName` / `clientName` を Logs に写像します。

#### WorkTypes

コード上の型定義では以下を想定:

- `workId`, `name`, `sortOrder`
- 任意: `active`

### 2.2 拡張テーブル（機能別）

#### Projects

`Projects` はダッシュボード表示用の拡張ドメインとして独立利用されています。

想定フィールド:

- `projectId`, `name`, `site`（Sites へのリンク）
- `status`（`準備中` / `進行中` / `保留` / `完了`）
- `startDate`, `endDate`, `progressPercent`, `spreadsheetUrl`

---

## 3. テーブル間リレーション設計

### 3.1 論理リレーション

- `Logs.user[] -> Users(recordId)`
- `Logs.machine[] -> Machines(recordId)`
- `Projects.site[] -> Sites(recordId)`

加えて、実装は lookup 文字列や業務キー（`userId` / `username` / `email` / `machineid`）でも補完解決する冗長設計になっています。

### 3.2 リレーション上の実務的特徴

1. **リンク正規性より可用性優先**
   - `Logs.user` が欠損しても lookup 群から人名復元する実装が存在。
2. **日次集計は JST 固定**
   - UTC ではなく JST 変換後の日付で grouping。
3. **IN/OUT ペアリングはユーザー単位**
   - 未マッチ OUT は警告スキップ、未クローズ IN は「稼働中」セッション化。

---

## 4. API から見た書き込み設計

### 4.1 `/api/stamp` の write contract

バリデーション通過後、以下を基に Logs レコードを作成します。

- クライアント必須: `machineId`, `workDescription`, `lat`, `lon`, `type`
- サーバー補完:
  - `timestamp`（現在時刻）
  - `date`（JST 日付）
  - `user`（セッションの `user.id`）
  - `machine`（`machineid` 解決後の recordId）
  - `siteName` / `clientName`（位置判定結果）

`LOGS_ALLOWED_FIELDS` によるフィールド allow-list フィルタが存在し、未知キー混入を防いでいます。

### 4.2 安全性・品質面

- 再試行: Airtable アクセスには指数バックオフ系 retry が複数レイヤで実装。
- 失敗時: API は構造化エラー JSON を返却。
- 注意点: `console.warn` によるペアリング異常ログは有効だが、運用監視基盤との統合は今後の余地あり。

---

## 5. 集計・帳票設計

### 5.1 月次/日次集計

- `timestamp` 昇順でログを正規化
- `formatJstDate` で日単位バケット化
- ユーザーごとに IN/OUT を突合
- 稼働時間は分単位から計算関数で時間へ変換

### 5.2 帳票検索系のギャップ

`/reports` 系は一部で `Logs.user` リンク前提の抽出が残っており、calendar 系ユーティリティよりスキーマ依存が強い箇所があります。結果として、

- calendar 系: lookup 欠損耐性が高い
- reports 系: link 完備前提が強い

という実装差が存在します。

---

## 6. 設計上の課題（優先度付き）

### P1: フィールド命名ゆれ

- 例: `machineId` vs `machineid`, `machineName` vs `machinename`, `siteName` vs `sitename`
- 影響: 吸収コード増大、クエリ最適化困難、誤設定時の不具合温床

### P1: ユーザー識別子の多重化

- recordId / userId / username / email を混在利用
- 影響: 集計一致性の追跡が難化、境界ケースの増加

### P2: 環境変数命名の非統一

- `AIRTABLE_API_KEY` を採用しており、`AIRTABLE_TOKEN` 系の一般表現と乖離
- 影響: 運用ドキュメントとの齟齬、導入時ミス増加

### P2: `Logs` の責務集中

- 現場・機械・作業・勤怠イベントを単一テーブルで管理
- 影響: 初速は高いが、監査/分析要件増加時に列肥大化しやすい

---

## 7. 推奨改善ロードマップ（段階的）

### Phase 1（低リスク）: スキーマ運用ガイドの明文化

- Airtable 側「正準フィールド名」を固定
- 互換フィールドは deprecate リスト化
- 実装に `schema-version` コメントと参照先ドキュメントを付与

### Phase 2（中リスク）: 読み取りアダプタの一本化

- `LogsRepository` などの Data Access 層を定義
- calendar/reports の抽出式を同一化
- ユーザー解決ロジックを共通関数に寄せる

### Phase 3（中〜高リスク）: 識別子戦略の収束

- 内部キーを `Users.recordId` に一本化
- 表示・外部連携のみ `userId`/`username` を利用
- backfill スクリプトで欠損 link を補完

### Phase 4（オプション）: テーブル分割の検討

- `Logs` を Event ソースとして維持しつつ、
  - `AttendanceSessions`（派生確定データ）
  - `WorkAnnotations`（業務メモ）
    へ分割する案を検証

---

## 8. 推奨 canonical テーブル定義（将来案）

### 8.1 Logs（canonical）

- `timestamp` (datetime, required)
- `dateJst` (date, required)
- `type` (`IN`/`OUT`, required)
- `user` (link Users, required)
- `machine` (link Machines, required)
- `site` (link Sites, optional)
- `siteNameSnapshot` (text, optional)
- `clientNameSnapshot` (text, optional)
- `workType` (single select, optional)
- `workDescription` (long text, optional)
- `lat`,`lon`,`accuracy` (number, optional)
- `source` (`web`/`nfc`/`api`, optional)

※ `Snapshot` 列は参照先名称変更に影響されない監査用途。

### 8.2 Users（canonical）

- `userId` (unique text)
- `name` (text)
- `username` (unique text)
- `email` (email, unique)
- `role` (single select)
- `active` (checkbox)
- `excludeBreakDeduction` (checkbox)

### 8.3 Machines / Sites / WorkTypes

- Machines: `machineid` を唯一識別子として固定
- Sites: `siteId` と地理情報 (`lat`,`lon`,`polygon_geojson`) を正準化
- WorkTypes: `workId` + `sortOrder` + `active`

---

## 9. 逆張り案（Opposites）

通常は「Airtable を正としてアプリが吸収」ですが、逆に **アプリ側 canonical schema を正とし、Airtable を view-storage として扱う** 運用も可能です。

- メリット: コード起点で整合性を制御しやすい
- デメリット: Airtable 直接編集の自由度が下がる
- 適用条件: 運用メンバーが CI/CD 中心に移行できる場合

---

## 10. 実施優先アクション（次スプリント向け）

1. `Logs` の正準フィールド名一覧を docs 化し、命名ゆれ列を明示的に非推奨化。
2. `/reports` と calendar 系で共通のログ取得アダプタを利用するよう統合。
3. 監視観点で「未マッチ IN/OUT 件数」をメトリクス化。
4. 環境変数命名の方針（`AIRTABLE_API_KEY` 維持 or `AIRTABLE_TOKEN` へ改称）を決定。

---

## 11. 参考にした主要コード（抜粋）

- テーブル・型定義: `lib/airtable.ts`, `types/index.ts`
- Logs フィールド定義: `lib/airtable/schema.ts`, `lib/airtableSchema.ts`
- 打刻書き込み: `app/api/stamp/route.ts`, `app/api/stamp/validator.ts`
- 集計/正規化: `lib/airtable/logs.ts`
- 補助資料: `docs/system-spec.md`, `reports/repo-scan/raw/reports.airtable-assumptions.txt`
