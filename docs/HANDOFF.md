# 引き継ぎメモ

## 最終更新
2026-05-22 自宅PC作業終了時点

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
- ✅ **Phase 2B Step C**：管理画面に登録済み家族一覧・登録解除機能を追加 ← 今夜完成！

### Phase 2B Step C で実装したこと

**GAS（src/gas/コード.js 末尾に追加）：**
- `getRegisteredFamilies()`：登録済み家族一覧API
  - LINE_USER_IDの先頭8文字＋登録日を返す
- `unregisterFamily(familyId)`：登録解除API
  - Familiesシートの該当行のLINE_USER_IDと登録日を空にする
- `testGetRegistered()`：動作確認用テスト関数

**admin.html：**
- サマリーに「登録済み家族数」を追加
- 「登録済み家族一覧」セクションを新設
  - 家族ID、宛名、区分、生徒、LINE_USER_ID（先頭8文字）、登録日、登録解除ボタン
- 登録解除フロー：確認ダイアログ→GAS呼び出し→アラート→一覧再読み込み

### 動作確認済み

藤本様で登録→管理画面で確認→登録解除→未登録に戻る、の一連の動作OK。

### Phase 2B 残り

- 🔜 **Step 5**：Webhook受信（方式B用）
- 🔜 **Step 6**：未紐付けメッセージ画面＋紐付け確定

### 並行して検討すべきこと

**実保護者データの投入**
- 現在5家族のテストデータのみ
- 49家族分の本データ投入は別途まとまった時間が必要
- マイ活アプリのStudentsシートをベースに整理する想定

**ID収集の運用開始**
- 方式A（LINE Login OAuth）は完全稼働可能
- 管理画面で登録状況も確認できるようになった（Step C完成）
- ふくちさんが公式LINEで「次回からLINE配信」を一斉案内
- 各保護者に個別URLを送付（管理画面で発行）

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Public
- ブランチ：dev / main

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- Webアプリ URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec

### GitHub Pages URL
- 保護者登録画面：https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 7シート構成（Families/Students/Billings/BillingItems/FollowUps/Config/Tokens）
- 現状：5家族のテストデータ、登録データは空（藤本様のテスト解除済み）

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

## 次回（塾PC）の進め方

### 第一候補：実保護者データの投入＋ID収集運用開始

**STEP 1：本データ投入の準備（30分）**
- マイ活Studentsシートから49家族分のデータを整理
- Familiesシート用のデータ作成（家族ID/宛名/配信区分）
- Studentsシート用のデータ作成（生徒ID/家族ID/学年/生徒氏名/兄弟順位/在籍フラグ）

**STEP 2：データ投入（15分）**
- スプレッドシートに一括投入
- 管理画面で正しく表示されるか確認

**STEP 3：ID収集運用開始（20分）**
- 公式LINEで一斉案内文を準備
- ふくちさんが配信
- 反応を見ながら個別URL送付

### 第二候補：Step 5（Webhook受信）

公式LINEメッセージ受信での紐付け方式。方式Aで取り切れない保護者向け。
- 所要：60〜90分

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js` の L19000〜L19560
- 過去Excel：`引落額通知_DATA_22-04_.xlsx`

## Phase進捗マップ
✅ Phase 0：環境構築
✅ Phase 1A：スケルトン作成
✅ Phase 1B：GASプロジェクト作成
✅ Phase 1C：スプレッドシート構築・GAS接続確認
✅ Phase 2B Step 1：管理画面骨格・未登録家族リスト
✅ Phase 2B Step 2：個別URL発行機能
✅ Phase 2B Step 3：保護者登録画面の骨格
✅ Phase 2B Step 4：LINE Login OAuth処理
✅ Phase 2B Step C：登録済み家族一覧・解除機能 ← 今夜完成！
🔜 実保護者データ投入＋ID収集運用開始（次回最優先候補）
🔜 Phase 2B Step 5：Webhook受信
🔜 Phase 2B Step 6：未紐付けメッセージ画面
🔜 Phase 3：管理画面・配信エンジン
🔜 Phase 4：滞納フォロー機能