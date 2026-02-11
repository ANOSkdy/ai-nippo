# 休憩控除の「特定ユーザー除外」再設計メモ（Airtable前提）

## 1. 目的の要約
- `/reports` `/reports/sites` `/reports/attendance` の表示稼働時間に対して、**特定ユーザーのみ休憩控除を適用しない**ルールを、画面差異なく一貫適用する。
- Airtable の実データ癖（Link/Lookup の型揺れ・名前重複・`filterByFormula` 制約・429）を前提に、**壊れにくい実装順序**で導入する。

---

## 2. Core プラン（MVP）

### やること（実装順）
1. **Users に運用フラグを追加**
   - 追加列: `excludeBreakDeduction` (checkbox / boolean)
   - 意味: `true` のユーザーは標準休憩控除の対象外。
2. **サーバー共通ポリシー解決層を追加**（`lib/policies/breakDeduction.ts`）
   - 入力キー: `userRecordId` を最優先、次に `userId`、最後に `userName`。
   - 返却: `{ excludeBreakDeduction: boolean, source: 'recordId' | 'userId' | 'userName' | 'default' }`
   - 同一リクエスト内で Map キャッシュ（重複解決を抑制）。
3. **適用箇所を3系統に実装**
   - `/reports`: `lib/services/reports.ts`
   - `/reports/sites`: `lib/reports/siteReport.ts`
   - `/reports/attendance`: `lib/report/work/attendance/aggregateMonthlyAttendance.ts`（＋必要なら `computeDailyAttendance` オプション）
4. **算出値の定義を統一**
   - `rawMinutes`（セッション素の分）
   - `netMinutes`（休憩控除後）
   - `effectiveMinutes`（表示用。対象外ユーザーは `rawMinutes`、通常ユーザーは `netMinutes`）
5. **最小表示差分**
   - まずは数値のみ反映（UI注記は任意）。
   - API に `breakPolicyApplied`（boolean）を載せると将来の説明性が高い。

### やらないこと（MVP外）
- 画面からフラグ編集する管理UI。
- ルール式（雇用区分/時間帯/現場別）の一般化。
- 過去データ再計算バッチの自動化。

### Why / Impact / Rollback
- **Why**: 画面ごとに計算地点が異なるため、ユーザー判定を共通層へ寄せないと将来的に乖離する。
- **Impact**: 対象ユーザーの表示時間が増える。既存帳票との比較時に「控除免除」注記が必要。
- **Rollback**: `excludeBreakDeduction` を無視する feature flag（`ENABLE_BREAK_POLICY=false`）で即時無効化可能。

### 最小ファイルツリー（案）
- `lib/policies/breakDeduction.ts`（新規）
- `lib/services/reports.ts`（修正）
- `lib/reports/siteReport.ts`（修正）
- `lib/report/work/attendance/aggregateMonthlyAttendance.ts`（修正）
- `lib/report/work/attendance/computeDailyAttendance.ts` or 既存相当（修正）
- `tests/lib/policies/breakDeduction.test.ts`（新規）
- `tests/lib/report/work/attendance/*.test.ts`（1本追加）

### 主要コード（擬似コード）
```ts
// lib/policies/breakDeduction.ts
export type BreakPolicyIdentity = {
  userRecordId?: string | null;
  userId?: number | null;
  userName?: string | null;
};

export type BreakPolicyResult = {
  excludeBreakDeduction: boolean;
  source: 'recordId' | 'userId' | 'userName' | 'default';
};

export async function resolveBreakPolicy(
  id: BreakPolicyIdentity,
  cache?: Map<string, BreakPolicyResult>,
): Promise<BreakPolicyResult> {
  // 1) userRecordId exact
  // 2) userId exact
  // 3) userName exact (normalized)
  // 4) default false
}
```

```ts
// aggregate側イメージ
const policy = await resolveBreakPolicy({ userRecordId, userId, userName }, policyCache);
const effectiveMinutes = policy.excludeBreakDeduction ? rawMinutes : netMinutes;
```

---

## 3. Airtable 特有の懸念点（重要）

### A. 識別子の不安定性
1. `userName` は重複・改名が起きるため、主キーに不適。
2. `user` Link が欠落したセッションが現実に存在しうる。
3. `userId` が number/string 揺れする可能性。

**対策**
- 判定優先順位を `userRecordId > userId > userName` に固定。
- `source` を返してログで追跡可能にする。

### B. `filterByFormula` の罠
1. 文字列エスケープ不備で検索漏れ・式エラー。
2. OR条件が長くなると URL 長・可読性・保守性が悪化。
3. 大量ページング時に API コールが増える。

**対策**
- 既存 `escapeFormulaValue` 相当を必ず通す。
- 15件前後でチャンク分割（既存 hydrate 方針に合わせる）。
- 「まず月の Sessions を取得→アプリ側でポリシー適用」を基本にし、過度な formula 最適化を避ける。

### C. レート制限（429）/ 一時障害（5xx）
1. policy解決で追加 API が増えると 429 リスクが上がる。

**対策**
- 同一リクエストで Map キャッシュ。
- Users の参照は必要最小フィールドのみ（`name`, `userId`, `excludeBreakDeduction`）。
- 429/5xx は既存の retry ヘルパー経由で吸収。

### D. 型揺れ（Lookup/Link/Array/Object）
1. `name (from user)` が string/array/object 混在。
2. boolean が `true/false` 文字列で来るケース。

**対策**
- 現行の `asString/asNumber/asBoolean` 互換ヘルパーを policy層でも再利用。
- `excludeBreakDeduction` は strict に boolean 判定し、曖昧値は false 扱い。

### E. 計算整合
1. 画面ごとに「日単位正規化」「セッション単位丸め」など粒度が異なる。

**対策**
- `effectiveMinutes` の定義を統一し、どの粒度で適用するかを明文化。
- MVPでは **各画面の既存集計単位を尊重**しつつ、休憩控除適用だけ切り替える。

---

## 4. 画面別の実装再考

### `/reports`（個別集計）
- 既存はユーザー選択→`getReportRowsByUserName()` で行を構築。
- **提案**: `getReportRowsByUserName` 内で policy を1回解決し、日次集約で `effectiveMinutes` を反映。
- **注意**: 同日の複数セッションをまとめた後に適用しないと、丸め差分が増える可能性。

### `/reports/sites`（現場別）
- 既存は `buildSiteReport()` で month全体を組み、列は user+machine 系。
- **提案**: セッション処理ループでユーザーごとに policy キャッシュを参照して minutes 加算値を切替。
- **注意**: 同一ユーザーが複数 machine 列に分かれても、policy はユーザー単位で共通。

### `/reports/attendance`（月次）
- 既存は `aggregateMonthlyAttendance()` で `computeDailyAttendance` 結果を rows に展開。
- **提案**: `computeDailyAttendance` に `skipStandardBreakDeduction` を追加し、ユーザー別に制御。
- **注意**: `daily.breakDeductMin` の意味（実控除/理論控除）をAPI仕様に明記しないと混乱する。

---

## 5. Bold プラン（創造的拡張）

### Diverge（3案）
1. **A: Usersフラグ + サーバー共通判定** / 狙い: 最短で整合 / 期待: 低リスク導入 / コスト: 低
2. **B: BreakPolicyテーブル新設（期間付き）** / 狙い: 監査性 / 期待: 将来運用が柔軟 / コスト: 中
3. **C: 事前マテビュー化（user-day facts）** / 狙い: 高速表示 / 期待: 大量データ安定 / コスト: 高

### Converge
- **採択: A**（今回）
  - 理由: 「特定ユーザー除外」の単一要件には十分で、既存構造に最小差分。
- **見送り: B/C**
  - 理由: データモデル変更・運用負荷が先行し、今は過剰。

### Opposites（逆張り案）
- 通常はサーバー集計で統一するが、逆に**UI側で控除ON/OFF切替を持つ**案。
  - 長所: 検証が速い。
  - 短所: 画面間整合が崩れやすく本番運用に不向き（今回は不採用）。

---

## 6. 設定・環境変数

### Core
- 新規環境変数は原則不要。
- 任意でロールバック用フラグを追加する場合のみ:

```env
ENABLE_BREAK_POLICY=true
```

### Vercel
- `ENABLE_BREAK_POLICY` を使う場合のみ Environment Variables に登録。
- Airtableトークンは既存どおりサーバー側のみ。

---

## 7. 確認手順（ローカル / Preview）

1. Usersに `excludeBreakDeduction=true/false` の2ユーザーを用意。
2. 同日・同現場で比較しやすいセッションを作成。
3. `/reports` で対象ユーザーのみ増分が出ることを確認。
4. `/reports/sites` で同一ユーザー列の合計が方針どおり変わることを確認。
5. `/reports/attendance` で `breakDeductMin` と `totals` が仕様どおりか確認。
6. Excel出力（個別/現場/月次）と画面値が一致することを確認。
7. 429/5xx 擬似テスト（モック）で policy 解決が劣化しないことを確認。

---

## 8. 追加テスト観点（最小）
1. `resolveBreakPolicy` の優先順位テスト（recordId > userId > userName）。
2. `aggregateMonthlyAttendance` で対象ユーザーのみ控除スキップされるテスト。
3. name重複ユーザー時、recordId があるケースで誤判定しないテスト。

---

## 9. Idea Bank（将来メモ）
1. `BreakPolicies` テーブル化（有効期間・理由・承認者を持つ）。
2. APIレスポンスに `rawMinutes/netMinutes/effectiveMinutes` を常時返す監査モード。
3. 日次ファクトを別テーブルへ書き出して重い月次集計をオフロード。
