# 引き継ぎメモ

## 最終更新
2026-05-21 自宅PC作業終了時点

## 現状サマリー

### 完了済みPhase

- ✅ **Phase 0**：環境構築（GitHub Bash・clasp・Googleアカウント連携）
- ✅ **Phase 1A**：スケルトン作成（ディレクトリ構造・README・SYSTEM_DESIGN.md）
- ✅ **Phase 1B**：GASプロジェクト作成・clasp連携
- ✅ **Phase 1C**：スプレッドシート構築・GAS接続確認
- ✅ **Phase 2B Step 1**：管理画面の骨格＋未登録家族リスト
- ✅ **Phase 2B Step 2**：個別URL発行機能（方式A用）

### Phase 2B 残り

- 🔜 **Step 3**：保護者登録画面（GitHub Pages・register.html）
- 🔜 **Step 4**：LINE Login OAuth処理（マイ活流用）
- 🔜 **Step 5**：Webhook受信（方式B用）
- 🔜 **Step 6**：未紐付けメッセージ画面＋紐付け確定（方式B用）

## Phase 2B Step 1-2 で動いていること

### 管理画面
- WebアプリURL：GASエディタの「デプロイを管理」から確認可能
- 未登録家族一覧の表示（5家族のテストデータで確認済）
- 家族ごとの「URL発行」ボタン
- URL発行→モーダル表示→クリップボードコピーまで動作確認済

### GAS関数
- `doGet()`：admin.html を返すWebアプリエントリポイント
- `getUnregisteredFamilies()`：未登録家族一覧取得API
- `generateToken()`：8文字英数字ランダムトークン生成
- `issueTokenForFamily(familyId)`：トークン発行＋既存トークン無効化
- `testConnection()`、`testGetUnregistered()`、`testIssueToken()`：動作確認用

### スプレッドシート構造
- ファイル名：`billing-line-data`
- スプレッドシートID：`1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ`
- シート構成：Families / Students / Billings / BillingItems / FollowUps / Config / Tokens（計7シート）
- テストデータ：5家族・6生徒（F001〜F005、生徒1001〜1006）

### GASスクリプトプロパティ
- `SPREADSHEET_ID`：設定済み
- `LINE_CHANNEL_ACCESS_TOKEN`：TODO（Phase 2B Step 4 で実値登録予定）
- `ADMIN_LINE_USER_IDS`：TODO（同上）

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Private
- ブランチ：dev（開発用）/ main（本番用）
- 最新コミット：d4480e5（Phase 2B Step 1-2完了）

### ローカルパス
- 自宅PC：`C:\Users\Manager\billing-line`
- 塾PC：`C:\Users\Manager\billing-line`
- 両PC clone済み・clasp連携済み

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- Webアプリとしてデプロイ済み（自分のみアクセス可能）
- 「デプロイを管理」からURLを確認可能

### Googleアカウント
kasukabe.academy@gmail.com（マイ活と同じ）

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
4. GASエディタで「デプロイを管理」→既存デプロイを編集→「新バージョン」選択→デプロイ

## Phase 2B Step 3 着手前の準備事項

### 必要な作業
1. GitHub Pagesの有効化（billing-lineリポジトリ・mainブランチ・rootから配信）
2. リポジトリのSettings → Pages から設定
3. `register.html` を作成（リポジトリのルート or `/docs` フォルダ）
4. URLは `https://k-acdm.github.io/billing-line/register.html`

### 設計確認ポイント
- トークン受け取り→Tokensシート参照→家族特定の処理
- LINE Login ボタンの実装（Phase 2B Step 4 で本格実装）
- 「藤本様として登録します」確認画面
- 登録完了画面

### マイ活側の参考
マイ活アプリでLINE Login OAuth が既に稼働中。
コードベースを参考にしながら billing-line に移植する形が最効率。

## 設計の重要ポイント（再掲）

詳細は `docs/SYSTEM_DESIGN.md` と `docs/PHASE_2B_DESIGN.md` 参照。

- **2方式併用**：方式A（個別URL）と方式B（公式LINEメッセージ受信）
- **配信タイプ**：自動引落（自）と直接持参（直）の2テンプレート
- **兄弟まとめ**：同一家族の兄弟分は1通にまとめ。最大3兄弟まで
- **Excel取込＋画面修正**：従来Excelを取り込み、必要に応じて管理画面で修正
- **滞納フォロー**：残高不足／ゆうちょ未処理 の2理由で文面出し分け（Phase 4）

## 配信規模・コスト試算

- 在籍生徒数：約49名
- 配信通数（兄弟まとめ後）：約40通/月
- LINEライトプラン（5,000通/月）で十分

## 次回再開時にやること

### Phase 2B Step 3 着手
1. 再開時の標準手順実行
2. GitHub Pages の有効化作業
3. register.html の骨格作成
4. トークン検証API実装
5. テスト

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- 動作確認用関数：`コード.js` の testXxx 系
- 元データ参考：マイ活アプリv15スレで議論した内容
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- 過去Wordテンプレ：`引落額通知_送信用フォーム_引落.docx` / `_直払.docx`

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認
✅ Phase 2B Step 1：管理画面骨格・未登録家族リスト
✅ Phase 2B Step 2：個別URL発行機能
🔜 Phase 2B Step 3：保護者登録画面  ← 次ここから
🔜 Phase 2B Step 4：LINE Login OAuth
🔜 Phase 2B Step 5：Webhook受信
🔜 Phase 2B Step 6：未紐付けメッセージ画面
🔜 Phase 3：管理画面・配信エンジン
🔜 Phase 4：滞納フォロー機能