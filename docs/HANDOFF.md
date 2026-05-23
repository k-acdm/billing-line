# 引き継ぎメモ

## 最終更新
2026-05-23 塾PC作業終了時点

## 現状サマリー

### 完了済みPhase

- ✅ **Phase 0**：環境構築
- ✅ **Phase 1A**：スケルトン作成
- ✅ **Phase 1B**：GASプロジェクト作成・clasp連携
- ✅ **Phase 1C**：スプレッドシート構築・GAS接続確認
- ✅ **Phase 2B Step 1**：管理画面の骨格＋未登録家族リスト
- ✅ **Phase 2B Step 2**：個別URL発行機能
- ✅ **Phase 2B Step 3**：保護者登録画面の骨格
- ✅ **Phase 2B Step 4**：LINE Login OAuth処理
- ✅ **Phase 2B Step C**：登録済み家族管理（一覧・解除機能）
- ✅ **実保護者データ投入**：41家族・49生徒
- ✅ **マイ活で取得済LINE_USER_ID転記**：12家族分
- ✅ **管理画面「文面ごとコピー」機能追加**
- ✅ **一斉案内文・予約配信**：2026-05-22朝に配信完了
- ✅ **個別URL送付**：29家族全員に送信完了（2026-05-23）
- ✅ **Phase 2B Step 5**：Webhook受信機能 ← 今日完成！
- ✅ **Phase 2B Step 6**：未紐付けメッセージ管理画面 ← 今日完成！

### ID収集の現状（2026-05-23終了時点）

- 在籍：41家族・49生徒
- 登録済：27家族
- 未登録：14家族
- 進捗率：66%

### 今日の最大の成果：Webhook受信機能の完成

**新規入塾者がID自動取得できる基盤が完成しました**。

**仕組み：**
[公式LINEに保護者がメッセージ送信 or 友だち追加]
↓
[LINE Messaging API]
↓ Webhook
[マイ活 GAS の doPost]
↓
_isLineWebhookRequest() で判定
↓
_handleLineWebhook() を呼ぶ
↓
_forwardWebhookToBillingLine() で転送
↓
[billing-line GAS の doPost]
↓
_isLineWebhookRequestBL() で判定
↓
_handleLineWebhookBL() でメッセージ処理
↓
LINE プロフィール取得（_getLineProfile）
↓
[IncomingMessagesシートに「未紐付け」状態で記録]
↓
[管理画面の「未紐付けメッセージ一覧」に表示]
↓
[ふくちさんが家族選択→「紐付け確定」]
↓
[Familiesシートに自動書き込み・登録完了]

### 今日の重要な発見・設定変更

**1. LINE Official Account Manager の「Webhook」トグル**
- LINE Developers Console とは別に、Official Account Manager 側にも Webhook 設定がある
- 場所：https://manager.line.biz/ → 設定 → 応答設定 → 「Webhook」
- これがオンでないと、LINE Console側でURL設定してもWebhook通知は届かない

**2. LINE Developers Console の Webhook URL**
- 設定先：https://developers.line.biz/ → 春日部アカデミー → Messaging API → Messaging API設定 → Webhook設定
- 現在の登録：マイ活のWebアプリURL（`https://script.google.com/macros/s/AKfycbyuf6o6RD_FLv4xwNlnYlaoxNmVGNATB5HyAV3rixQU6aSoiW8kP0uNEkf-7Pa2nOY6GQ/exec`）
- マイ活のdoPost内でbilling-lineに転送している

**3. 管理画面リンクは絶対URLに**
- 開発者プレビューURL（`script.googleusercontent.com/userCodeAppPanel`）から開くと、相対URLは正しく機能しない
- admin.htmlのリンクは完全な絶対URLで指定
- 本番URL：`https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec`

### 課題（未対応）

**Webhookで受信したメッセージのLINEプロフィール（表示名・画像URL等）が空欄になる問題**
- IncomingMessagesシートのC列（表示名）、D列（プロフィール画像URL）、E列（ステータスメッセージ）が空
- 原因未調査（LINE_MESSAGING_CHANNEL_ACCESS_TOKEN は設定済み）
- 影響：管理画面の表示が「（不明）」になるが、紐付け機能自体は動作する
- 優先度：中（運用に支障はないが、UX向上のため後で対応）

## Phase 2B 完成！

すべてのStep（1〜6 + C）が完成。実運用に必要な基盤が揃った。

## 全体工程マップ
■ ID収集フェーズ ■
✅ Phase 2B Step 1-6 + C：全機能完成
✅ 実保護者データ投入（41家族・49生徒）
✅ 既取得LINE_USER_ID転記（12家族）
✅ 一斉配信完了
✅ 個別URL送付完了（29家族）
🔜 残り14家族の登録待ち（自然な流れで完了予定）
【新規入塾者対応も自動化済み】

公式LINE友だち追加 or メッセージ送信
→ 自動でIncomingMessagesに記録
→ ふくちさんが管理画面で紐付け確定
→ 登録完了

■ 配信フェーズ ■（次の優先課題）
🔜 Phase 3：引き落とし通知の自動配信エンジン（本丸）

Phase 3-1：Excel取込機能
Phase 3-2：配信プレビュー機能
Phase 3-3：テスト配信機能
Phase 3-4：本配信機能

■ 運用安定化フェーズ ■
🔜 Phase 4：滞納フォロー機能
🔜 LINEプロフィール取得問題の調査・修正
🔜 マイ活との統合検討（将来）

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Public
- ブランチ：dev / main

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- 本番URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec
- 未紐付け管理：本番URL + `?page=unlinked`

### マイ活GASプロジェクト（Webhook転送元）
- 本番URL：https://script.google.com/macros/s/AKfycbyuf6o6RD_FLv4xwNlnYlaoxNmVGNATB5HyAV3rixQU6aSoiW8kP0uNEkf-7Pa2nOY6GQ/exec
- 改修箇所：`_handleLineWebhook` 関数に転送処理追加、`_forwardWebhookToBillingLine` 関数を新規追加

### GitHub Pages
- 保護者登録画面：https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 8シート構成（Families/Students/Billings/BillingItems/FollowUps/Config/Tokens/IncomingMessages）
- 現状：41家族・49生徒・登録済27家族

### LINE 設定
- LINE Developers Console
  - Webhook URL：マイ活URLが登録済み
  - Webhook の利用：オン
- LINE Official Account Manager
  - Webhook：オン（重要：これも必須）
  - 応答方法：手動チャット
  - あいさつメッセージ：オン
- LINE Messaging API
  - チャネル：春日部アカデミー公式（@pwg1825g）
  - Webhook URL：マイ活経由でbilling-lineに転送

## 運用ルール

### dev/main 切替
**再開時：**`git checkout dev` → `git pull origin dev`
**終了時：**`git pull origin dev` → `git checkout main` → `git merge dev` → `git push origin main` → `git checkout dev`

### 本番反映4ステップ
1. `git pull origin dev`
2. `git checkout main` → `git merge dev` → `git push origin main`（GitHub Pages反映）
3. `clasp push`（GAS変更時）
4. GASエディタで「デプロイを管理」→既存デプロイを編集→「新バージョン」選択→デプロイ

### Git操作の注意
- `git add .` は必ず ~/billing-line ルートで実行する
  - src/gas 配下で実行すると docs/HANDOFF.md が漏れる（過去のミスあり）

## 次回作業の選択肢

### 第一候補：Phase 3（配信エンジン）着手 - プロジェクトの本丸
- Phase 3-1：Excel取込機能（30〜60分）
- Phase 3-2：配信プレビュー機能（45〜60分）
- Phase 3-3：テスト配信機能（30分）
- Phase 3-4：本配信機能（45〜60分）
- 合計：3〜4時間

### 第二候補：LINEプロフィール取得問題の調査
- 表示名・画像URL等が空になる原因調査
- アクセストークンの値確認（マイ活と同一か、Bot Channel Token か）
- 所要：30〜45分

### 第三候補：未登録14家族へのフォロー
- 反応がない家族に対して、個別の声かけや再送
- ふくちさんマターの作業

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js` のL19000〜L19560（OAuth）、L20576〜L20700（Webhook）
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- 既取得LINE_USER_ID：`取得済LINE_ID-26-05-22.xlsx`

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認
✅ Phase 2B Step 1：管理画面骨格・未登録家族リスト
✅ Phase 2B Step 2：個別URL発行機能
✅ Phase 2B Step 3：保護者登録画面の骨格
✅ Phase 2B Step 4：LINE Login OAuth処理
✅ Phase 2B Step C：登録済み家族一覧・解除機能
✅ 実保護者データ投入＋既取得LINE_USER_ID転記
✅ 管理画面「文面ごとコピー」機能追加
✅ 一斉配信・個別URL送付完了
✅ Phase 2B Step 5：Webhook受信機能 ← 今日完成！
✅ Phase 2B Step 6：未紐付けメッセージ管理画面 ← 今日完成！
🔜 Phase 3：管理画面・配信エンジン（本丸）
🔜 Phase 4：滞納フォロー機能
🔜 LINEプロフィール取得問題の調査