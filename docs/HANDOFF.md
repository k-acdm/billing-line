# 引き継ぎメモ

## 最終更新
2026-05-21 塾PC作業（並行作業中）終了時点

## 現状サマリー

### 完了済みPhase

- ✅ **Phase 0**：環境構築
- ✅ **Phase 1A**：スケルトン作成
- ✅ **Phase 1B**：GASプロジェクト作成・clasp連携
- ✅ **Phase 1C**：スプレッドシート構築・GAS接続確認
- ✅ **Phase 2B Step 1**：管理画面の骨格＋未登録家族リスト
- ✅ **Phase 2B Step 2**：個別URL発行機能
- ✅ **Phase 2B Step 3**：保護者登録画面の骨格（GitHub Pages公開済）

### Phase 2B Step 4：着手準備完了、本実装はこれから

**Step 4 で完了している準備作業：**
- ✅ マイ活側のLINE Login OAuth実装の解析完了
- ✅ スクリプトプロパティ設定完了
  - LINE_LOGIN_CHANNEL_ID（マイ活と同値）
  - LINE_LOGIN_CHANNEL_SECRET（マイ活と同値）
  - LINE_MESSAGING_CHANNEL_ACCESS_TOKEN（マイ活と同値）
- ✅ LINE Developers Console にコールバックURL追加完了
  - 春日部アカデミー > LINEログイン > 「LINEログイン設定」タブ
  - 既存（マイ活用）と並列で billing-line 用URLを追加
  - 追加URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec?action=lineLoginCallback

**Step 4 で実装すべき関数（マイ活コードを移植）：**

マイ活 Code.js の以下行から移植：
- L19114-19119：スクリプトプロパティ取得関数（_getLineLoginChannelId 等）
- L19125-19156：CacheService による一時トークン管理
- L19180-19191：_lineRedirectUri()
- L19192-19292：HTML レンダリング系（_renderLineLayoutHtml 等）
- L19293-19470：OAuth 本体処理
  - _handleLineLoginStart()
  - _handleLineLoginCallback()
  - _handleLineLoginRegister()
  - _handleLineRawAction()

**billing-line 側で変更が必要な箇所：**
- マイ活では「役割（生徒/保護者）」を引数 → billing-line では「家族ID」を引数
- マイ活では Studentsシートに書き込み → billing-line では Familiesシートの「保護者LINE_USER_ID」列に書き込み
- 家族ID の検証にトークンを使う（Tokensシート参照）

### Phase 2B 残り

- 🔜 **Step 4**：LINE Login OAuth処理（本実装）← 次ここから
- 🔜 **Step 5**：Webhook受信（方式B用）
- 🔜 **Step 6**：未紐付けメッセージ画面＋紐付け確定

## 設計の重要ポイント

### マイ活のOAuthフロー（移植元）

ユーザーが LINE Login ボタンをタップ
GAS の doGet?action=lineLoginStart へ
LINE 認証ページへリダイレクト（HTTP 302）
ユーザー認証
callback URL に code 付きで戻る
= doGet?action=lineLoginCallback&code=xxx
GAS が code → access_token → profile → userId を取得
tempToken（UUID）で CacheService に5分間保存
登録確認フォーム表示
ユーザーが「登録」ボタン
doGet?action=lineLoginRegister&tempToken=xxx
スプレッドシートに書き込み
完了画面


### billing-line でのフロー

保護者が個別URL（register.html?t=xxx）をタップ
register.html が表示される
「LINEで登録する」ボタンをタップ
GAS billing-line の doGet?action=lineLoginStart&token=xxx へ
※トークンを引き渡す必要あり（家族IDの特定のため）
5-11) マイ活と同様のフロー
Familiesシートの該当家族IDの行に LINE_USER_ID を書き込み
Tokensシートの該当トークンを「使用済」に更新
完了画面


## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：**Public**（GitHub Pages無料利用のため）
- ブランチ：dev / main
- 最新コミット：5fd9f14（Phase 2B Step 3完了時）

### ローカルパス
- 自宅PC：`C:\Users\Manager\billing-line`
- 塾PC：`C:\Users\Manager\billing-line`

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- Webアプリ URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec
- 認証：自分のみ・自分として実行

### GitHub Pages URL
- https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 7シート構成

### LINE Developers Console
- プロバイダー：春日部アカデミー
- LINEログインチャネル：マイ活と共用（同じChannel ID/Secret）
- コールバックURL：マイ活用URL + billing-line用URL の2件登録済

## 運用ルール

### dev/main 切替（マイ活と同じ）
**再開時：**`git checkout dev` → `git pull origin dev`
**終了時：**`git pull origin dev` → `git checkout main` → `git merge dev` → `git push origin main` → `git checkout dev`

### 本番反映4ステップ
1. `git pull origin dev`
2. `git checkout main` → `git merge dev` → `git push origin main`（GitHub Pages反映 = register.html等）
3. `clasp push`（GAS変更時）
4. GASエディタで「デプロイを管理」→既存デプロイを編集→「新バージョン」選択→デプロイ

## Step 4 着手の最初の手順

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

### Step 4 実装の進め方
1. マイ活 Code.js から LINE Login 関連関数を `/tmp/line_login_extract.txt` に再抽出
2. billing-line の `src/gas/コード.js` の末尾に追加
3. 家族ID対応に書き換え
4. register.html を更新（LINE Loginボタンを本物のリンクに）
5. clasp push → デプロイ → 動作確認

### 動作確認方法
1. 管理画面で F001（藤本様）の URL発行
2. 発行されたURLを別タブで開く
3. 「LINEで登録する」ボタンを押下
4. LINE認証ページへ遷移すれば成功
5. 認証後、Familiesシートに LINE_USER_ID が書き込まれているか確認

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認
✅ Phase 2B Step 1：管理画面骨格・未登録家族リスト
✅ Phase 2B Step 2：個別URL発行機能
✅ Phase 2B Step 3：保護者登録画面の骨格
🔜 Phase 2B Step 4：LINE Login OAuth処理 ← イマココ準備完了、本実装これから
🔜 Phase 2B Step 5：Webhook受信
🔜 Phase 2B Step 6：未紐付けメッセージ画面
🔜 Phase 3：管理画面・配信エンジン
🔜 Phase 4：滞納フォロー機能

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js` の L19114〜L19470
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- 過去Wordテンプレ：`引落額通知_送信用フォーム_引落.docx` / `_直払.docx`