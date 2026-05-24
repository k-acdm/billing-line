# 引き継ぎメモ

## 最終更新
2026-05-24 塾PC作業終了時点（Phase 3-3 完成）

## 現状サマリー：Phase 2B + Phase 3-1〜3-3 完成

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
- ✅ **Phase 2B Step 5**：Webhook受信機能
- ✅ **Phase 2B Step 6**：未紐付けメッセージ管理画面
- ✅ **Phase 3-1**：Excel取込機能 ← 今日完成！
- ✅ **Phase 3-2**：配信プレビュー機能 ← 今日完成！
- ✅ **Phase 3-3**：テスト配信機能 ← 今日完成！

### ID収集の現状（2026-05-24時点）

- 在籍：41家族・49生徒
- 登録済：33家族
- 未登録：8家族
- 進捗率：80.5%

### Phase 3 で実現したこと
[従来のフロー]
Excelの260526シート → Word差し込み印刷 → PDFメール送信
↑
ふくちさんが手動
[新フロー（完成）]
Excelの260526シート → Ctrl+A→Ctrl+C
↓
billing-line 管理画面に貼り付け
↓
プレビューで内容確認
↓
Billings/BillingItems に自動展開
↓
配信プレビューで全41家族の本文を確認・編集
↓
全家族テスト配信（ふくちさんLINEへ）
↓
Phase 3-4で本配信（来月実装予定）

**作業フローは従来通り。送信ツールがメール→LINEに変わるだけ。**

## 今日の重要な発見・修正

### 1. LINE_MESSAGING_CHANNEL_ACCESS_TOKEN の不一致問題

- billing-line のスクリプトプロパティに登録されていたトークンが、LINE Developers Console の現行値と異なっていた
- 結果：プッシュ送信が HTTP 401 エラー、Webhook受信時のプロフィール取得も失敗
- 対処：LINE Developers Console の「チャネルアクセストークン（長期）」をコピー → billing-lineのプロパティに上書き
- 副次的に：Webhook受信時の表示名・プロフィール画像URL取得問題も同時解決

### 2. Excel取込時の文字処理

- Excelの項目名には既に「・」が含まれているため、コード側は「・」を追加しない（charAt判定）
- Excelの「兄弟名１」には既に「【】」が含まれているため、同様に追加しない

### 3. 兄弟3人対応・項目10対応

- コードは既に対応済み
- Excel側で項目10を追加する時の命名規則は別途記載（下記）

## 重要：項目10列を追加する時のリマインド（恒久）

ふくちさんがExcelの月次シートに項目10列を追加する時：

**列名は必ず全角で命名**：
- `項目１１０`（兄弟1の項目10）
- `金額１１０`（兄弟1の金額10）
- `項目２１０`（兄弟2の項目10）
- `金額２１０`（兄弟2の金額10）
- `項目３１０`（兄弟3の項目10）
- `金額３１０`（兄弟3の金額10）

コード側は既に1〜10まで対応済みなので、Excelに列を追加するだけで自動対応される。

## 次回（約1ヶ月後・6月末頃）の作業

### Phase 3-4：本配信機能の実装

来月の本番引き落とし通知タイミングで実装する。所要時間：1〜2時間（慎重に設計）。

#### 実装すべき機能
[配信プレビュー画面の各家族カードに「本配信」ボタン追加]

個別の「本配信」ボタン（緊急時の個別送信用）
全家族「本配信実行」ボタン（メインフロー）

[本配信実行時の安全策]

確認ダイアログを多重化
送信前に「対象X家族、合計Y家族中Z家族未登録」を表示
「LINE未登録家族は除外する」を明示
送信中はキャンセル不可（最初の確認で慎重に）

[Billings の更新]

配信ステータスを「未配信」→「配信済」に更新
配信日時を記録
エラー時は「エラー」状態にしてエラー詳細を保存

[配信結果サマリー]

成功数 / 失敗数
失敗があれば個別にリトライ可能


#### 本配信実装前のチェックリスト

1. □ Phase 3-3 のテスト配信を改めて何度か走らせて、本文に違和感がないか最終確認
2. □ 未登録家族（その時点で残っている数）に対する対応方針を決める
   - メール継続？個別連絡？登録を待つ？
3. □ 配信時刻の判断
   - 平日朝？昼？夜？
   - 一斉送信のタイミング
4. □ 配信失敗時のフォロー手順
   - 失敗した家族にはメール代替？
5. □ 配信履歴の運用ルール
   - Billingsシートが月ごとに肥大化する想定

### 次回作業の開始手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Public
- ブランチ：dev / main

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- 本番URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec
- 未紐付けメッセージ管理：本番URL + `?page=unlinked`

### マイ活GASプロジェクト（Webhook転送元）
- 本番URL：https://script.google.com/macros/s/AKfycbyuf6o6RD_FLv4xwNlnYlaoxNmVGNATB5HyAV3rixQU6aSoiW8kP0uNEkf-7Pa2nOY6GQ/exec
- 改修箇所：`_handleLineWebhook` 関数に転送処理追加、`_forwardWebhookToBillingLine` 関数を新規追加

### GitHub Pages
- 保護者登録画面：https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 8シート構成（Families/Students/Billings/BillingItems/FollowUps/Config/Tokens/IncomingMessages）
- 現状：41家族・49生徒・登録済33家族

### スクリプトプロパティ（billing-line）
- WEB_APP_URL：billing-line本番URL（access.line.me対策）
- LINE_LOGIN_CHANNEL_ID
- LINE_LOGIN_CHANNEL_SECRET
- LINE_MESSAGING_CHANNEL_ACCESS_TOKEN（最新の長期トークン）
- ADMIN_LINE_USER_ID：ふくちさんのLINE_USER_ID（テスト配信用）

### LINE 設定
- LINE Developers Console
  - Webhook URL：マイ活URLが登録済み
  - Webhookの利用：オン
- LINE Official Account Manager
  - Webhook：オン
  - 応答方法：手動チャット
  - あいさつメッセージ：オン

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
- src/gas 配下で実行すると docs/HANDOFF.md が漏れる（過去2回のミス経験あり）

## 全体工程マップ
■ ID収集フェーズ ■
✅ Phase 2B Step 1-6 + C：全機能完成
✅ 実保護者データ投入（41家族・49生徒）
✅ 既取得LINE_USER_ID転記（12家族）
✅ 一斉配信完了
✅ 個別URL送付完了（29家族）
✅ Webhook受信完成（新規入塾者の自動ID取得）
🔜 残り8家族の自然な登録待ち
■ 配信フェーズ ■
✅ Phase 3-1：Excel取込機能
✅ Phase 3-2：配信プレビュー機能
✅ Phase 3-3：テスト配信機能
🔜 Phase 3-4：本配信機能（来月の本番タイミングで実装）
■ 運用安定化フェーズ ■
🔜 Phase 4：滞納フォロー機能（残高不足／ゆうちょ未処理）
🔜 マイ活との統合検討（将来）

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js`
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`
- Wordテンプレ：`引落額通知_送信用フォーム_引落.docx`、`_直払.docx`

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
✅ Phase 2B Step 5：Webhook受信機能
✅ Phase 2B Step 6：未紐付けメッセージ管理画面
✅ 実保護者データ投入＋既取得LINE_USER_ID転記
✅ 管理画面「文面ごとコピー」機能追加
✅ 一斉配信・個別URL送付完了
✅ Phase 3-1：Excel取込機能 ← 今日完成！
✅ Phase 3-2：配信プレビュー機能 ← 今日完成！
✅ Phase 3-3：テスト配信機能 ← 今日完成！
🔜 Phase 3-4：本配信機能（来月の本番タイミング）
🔜 Phase 4：滞納フォロー機能