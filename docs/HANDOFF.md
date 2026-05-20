# 引き継ぎメモ

## 最終更新
2026-05-20 塾PC作業終了時点

## 現状サマリー

### 完了済みPhase

- ✅ **Phase 0**：環境構築（GitHub Bash・clasp・Googleアカウント連携）
- ✅ **Phase 1A**：スケルトン作成（ディレクトリ構造・README・SYSTEM_DESIGN.md）
- ✅ **Phase 1B**：GASプロジェクト作成・clasp連携
- ✅ **Phase 1C**：スプレッドシート構築・GAS接続確認

### 次回作業：Phase 2A → Phase 2B

**Phase 2A：LINE Login OAuth問題の解決（マイ活側で先行）**
- マイ活アプリ側の「access.line.me 接続拒否」問題が未解決
- billing-line も同じOAuthフローを使うため、解決が前提条件
- マイ活スレで集中対応する

**Phase 2B：保護者登録画面（billing-line側）**
- Phase 2A 解決後に着手
- GitHub Pages で保護者用LINE Login画面を構築
- 登録専用URL発行機能を管理画面側に実装

## Phase 1Cで確認できたこと

### スプレッドシート構造
- ファイル名：`billing-line-data`
- スプレッドシートID：`1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ`
- 6シート全部作成済み（Families/Students/Billings/BillingItems/FollowUps/Config）
- 各シートのヘッダ設定済み

### GASスクリプトプロパティ
- `SPREADSHEET_ID`：設定済み（実値あり）
- `LINE_CHANNEL_ACCESS_TOKEN`：TODO（Phase 2Bで実値登録予定）
- `ADMIN_LINE_USER_IDS`：TODO（Phase 2Bで実値登録予定）

### GAS初期コード（src/gas/コード.js）
- `getConfig()`：スクリプトプロパティ取得関数
- `testConnection()`：スプレッドシート接続確認関数
- `testConnection`実行で6シート・ヘッダ全部正常確認済み

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Private
- ブランチ：dev（開発用）/ main（本番用）
- 最新コミット：79ddc79（Phase 1C完了）

### ローカルパス
- 自宅PC：`C:\Users\Manager\billing-line`
- 塾PC：`C:\Users\Manager\billing-line`（両PC clone済み・clasp連携済み）

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- ローカル連携：src/gas/ に clasp で連携済み

### Googleアカウント
マイ活と同じアカウント

## 運用ルール（マイ活と同じ）

### dev/main 切替ルール

**【再開時】**
git checkout dev
git pull origin dev

**【終了時】**
git pull origin dev
git checkout main
git merge dev
git push origin main
git checkout dev

### 本番反映4ステップ
1. `git pull origin dev`
2. `git checkout main` → `git merge dev` → `git push origin main`
3. `clasp push`（GAS変更時）
4. Apps ScriptエディタでF5 → 新バージョンデプロイ（GAS変更時）

## 設計の重要ポイント

詳細は `docs/SYSTEM_DESIGN.md` 参照。要点だけ：

- **スプレッドシート構造**：6シート（Families/Students/Billings/BillingItems/FollowUps/Config）
- **配信タイプ**：自動引落（自）と直接持参（直）の2テンプレート
- **兄弟まとめ**：同一家族の兄弟分は1通にまとめ。最大3兄弟まで
- **Excel取込＋画面修正**：従来Excelを取り込み、必要に応じて管理画面で修正
- **滞納フォロー**：残高不足／ゆうちょ未処理 の2理由で文面出し分け（初期スコープ込み）

## マイ活側の課題（未解決・billing-lineに影響）

### LINE Login OAuth「access.line.me 接続拒否」

- billing-line も同じOAuthフローを使用するため、解決が前提条件
- 該当コミット：fd907e5（マイ活側）
- 次回マイ活作業時の調査項目：
  - 別Googleアカウントでスマホ試行
  - ネットワーク環境（自宅Wi-Fi/塾Wi-Fi/モバイル回線）
  - LINE Developers Console 設定確認
  - OAuthスコープ設定
  - 別ブラウザ認証

## 配信規模・コスト試算

- 在籍生徒数：約49名
- 配信通数（兄弟まとめ後）：約40通/月
- LINEライトプラン（5,000通/月）で十分。滞納フォローを足しても余裕

## 次回再開時にやること

### Phase 2A（マイ活側で先行）
1. マイ活スレに移動
2. LINE Login OAuth問題の切り分け診断
3. 解決後、billing-line スレに戻る

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計：`docs/SYSTEM_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- 元データ参考：マイ活アプリv15スレで議論した内容
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- 過去Wordテンプレ：`引落額通知_送信用フォーム_引落.docx` / `_直払.docx`

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認  ← イマココ完了
🔜 Phase 2A：OAuth問題解決（マイ活側）
🔜 Phase 2B：保護者登録画面
🔜 Phase 3：管理画面・配信エンジン
🔜 Phase 4：滞納フォロー機能

