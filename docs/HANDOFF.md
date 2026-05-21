# 引き継ぎメモ

## 最終更新
2026-05-22 塾PC作業終了時点

## 現状サマリー

### 完了済みPhase

- ✅ **Phase 0**：環境構築
- ✅ **Phase 1A**：スケルトン作成
- ✅ **Phase 1B**：GASプロジェクト作成・clasp連携
- ✅ **Phase 1C**：スプレッドシート構築・GAS接続確認
- ✅ **Phase 2B Step 1**：管理画面の骨格＋未登録家族リスト
- ✅ **Phase 2B Step 2**：個別URL発行機能
- ✅ **Phase 2B Step 3**：保護者登録画面の骨格
- ✅ **Phase 2B Step 4**：LINE Login OAuth処理 ← 今夜完成！

### Phase 2B Step 4 で実装したこと

**GAS（src/gas/コード.js 末尾に追加）：**
- 定数：LINE_LOGIN_TEMP_TTL_SEC、AUTHORIZE_URL、TOKEN_URL、PROFILE_URL
- `_getLineLoginChannelId/Secret`、`_getLineMessagingAccessToken`：スクリプトプロパティ取得
- `_getWebAppUrl`、`_getCallbackUrl`：URL関連（access.line.me接続拒否対策）
- `_saveTempLineToken`、`_getTempLineToken`、`_deleteTempLineToken`：CacheService管理
- `_findFamilyByToken`：トークンから家族特定（Tokensシート参照）
- `_renderLineLayoutHtml`、`_renderLineErrorHtml`、`_renderLineSuccessHtml`、`_renderLineConfirmHtml`：HTML生成
- `_handleLineLoginStart`：LINE認証ページへリダイレクト
- `_handleLineLoginCallback`：code→access_token→profile→userId取得
- `_handleLineLoginRegister`：Familiesシートに書き込み、Tokensシート更新
- `doGet()`：?action=lineLogin* で振り分け
- `_testTriggerPermission`：権限承認発動用テスト関数

**register.html：**
- LINE Loginボタンの本実装
- トークンを?action=lineLoginStart&token=XXXに渡す形

**appsscript.json：**
- oauthScopes 追加：
  - script.external_request（UrlFetchApp用）
  - spreadsheets（SpreadsheetApp.openById用）
  - script.container.ui（HtmlService用）
  - userinfo.email
- webapp セクション：executeAs USER_DEPLOYING / access MYSELF

**スクリプトプロパティ（追加）：**
- WEB_APP_URL：billing-lineのWebアプリURL（access.line.me対策の核心）
- LINE_LOGIN_CHANNEL_ID（マイ活と同値）
- LINE_LOGIN_CHANNEL_SECRET（マイ活と同値）
- LINE_MESSAGING_CHANNEL_ACCESS_TOKEN（マイ活と同値）

**LINE Developers Console：**
- コールバックURL に billing-line用を追加登録済み

**UI改善：**
- 「この内容で登録する」ボタン押下時の処理中表示・二度押し防止

### 動作確認済み

藤本様・山﨑様の2家族でテスト完了。以下が全て動作：
- 管理画面でURL発行→保護者URL→LINE認証→確認画面→登録完了
- Familiesシートに LINE_USER_ID 自動書き込み
- Tokensシートの状態が「使用済」に更新
- 管理画面で未登録家族数が自動減少
- ボタン二度押し防止UI

テスト後、シートはクリーンアップ済（再度テストデータのみの状態）。

### Phase 2B 残り

- 🔜 **Step 5**：Webhook受信（方式B用）
- 🔜 **Step 6**：未紐付けメッセージ画面＋紐付け確定

### 並行して検討すべきこと

**実保護者データの投入**
- 現在5家族のテストデータのみ
- 49家族分の本データ投入は別途まとまった時間が必要
- マイ活アプリのStudentsシートをベースに整理する想定

**ID収集の運用開始**
- Step 4 完成により、方式Aは完全稼働可能
- ふくちさんが公式LINEで「次回からLINE配信」を一斉案内
- 各保護者に個別URLを送付（管理画面で発行）

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Public（GitHub Pages無料利用のため）
- ブランチ：dev / main
- 最新コミット：3eceb03（Phase 2B Step 4実装後）+ UI改善追加分

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- Webアプリ URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec

### GitHub Pages URL
- 保護者登録画面：https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 7シート構成（Families/Students/Billings/BillingItems/FollowUps/Config/Tokens）
- 現状：5家族のテストデータ、登録データは空

### LINE Developers Console
- プロバイダー：春日部アカデミー
- LINEログインチャネル：マイ活と共用
- Messaging APIチャネル：春日部アカデミー公式（@pwg1825g）
- コールバックURL：マイ活用URL + billing-line用URL 登録済

## 運用ルール

### dev/main 切替
**再開時：**`git checkout dev` → `git pull origin dev`
**終了時：**`git pull origin dev` → `git checkout main` → `git merge dev` → `git push origin main` → `git checkout dev`

### 本番反映4ステップ
1. `git pull origin dev`
2. `git checkout main` → `git merge dev` → `git push origin main`（GitHub Pages反映）
3. `clasp push`（GAS変更時）
4. GASエディタで「デプロイを管理」→既存デプロイを編集→「新バージョン」選択→デプロイ

## 次回（自宅PC）の進め方

### 選択肢

**A：Step 5（Webhook受信）に着手**
- 公式LINEで保護者がメッセージ送信→ふくちさんが手動紐付け
- 60〜90分

**B：実保護者データの投入＋ID収集運用開始**
- Familiesシート・Studentsシートに49家族分の本データ投入
- ふくちさんが公式LINEで一斉案内
- 各保護者に個別URLを送付開始
- データ投入次第、所要時間は変動

**C：管理画面の使い勝手改善**
- 登録済み家族の表示・統計
- 取り消し機能
- 30〜45分

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js` の L19000〜L19560
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- 過去Wordテンプレ：`引落額通知_送信用フォーム_引落.docx` / `_直払.docx`

## 重要な技術的知見（今夜得た学び）

### GASのoauthScopes問題

- `appsscript.json` に `oauthScopes` を明示すると、配列内のものしか許可されない
- 暗黙の自動検出に頼るより、明示する方が確実だが、スコープ名を正確に書く必要がある
- 必須：`script.external_request`、`spreadsheets`（currentonlyではダメ）、`script.container.ui`、`userinfo.email`
- `spreadsheets.currentonly` は openById では使えない（注意）

### access.line.me 接続拒否対策

- `ScriptApp.getService().getUrl()` は環境によって /dev URL を返すバグがある
- スクリプトプロパティ `WEB_APP_URL` に本番URLを保存して、そこから取得するのが確実
- billing-line でも同方式を採用済み

### UI改善のポイント

- フォーム送信中は数秒かかるため、ボタンの状態変化を即座に見せる必要あり
- 「⏳ 登録中...」+ disabled + pointer-events:none で二度押し防止
- 押した感覚を保護者に与えるのが重要

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認
✅ Phase 2B Step 1：管理画面骨格・未登録家族リスト
✅ Phase 2B Step 2：個別URL発行機能
✅ Phase 2B Step 3：保護者登録画面の骨格
✅ Phase 2B Step 4：LINE Login OAuth処理 ← 今夜完成！
🔜 Phase 2B Step 5：Webhook受信
🔜 Phase 2B Step 6：未紐付けメッセージ画面
🔜 Phase 3：管理画面・配信エンジン
🔜 Phase 4：滞納フォロー機能