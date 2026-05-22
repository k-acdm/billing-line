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
- ✅ **Phase 2B Step 4**：LINE Login OAuth処理
- ✅ **Phase 2B Step C**：登録済み家族管理（一覧・解除機能）
- ✅ **実保護者データ投入**：41家族・49生徒
- ✅ **マイ活で取得済LINE_USER_ID転記**：12家族分
- ✅ **「文面ごとコピー」機能追加**：管理画面の利便性向上
- ✅ **一斉案内文確定・予約配信設定**：明日配信予定

### ID収集の現状

- 在籍：41家族・49生徒
- 既に登録済：12家族（マイ活で取得済）
- 未登録：29家族
- ステータス：明日朝の一斉配信から運用開始

### Phase 2B 残り

- 🔜 **Step 5**：Webhook受信（**新規入塾者対応で必須**）
- 🔜 **Step 6**：未紐付けメッセージ画面＋紐付け確定

## 明日（2026-05-23以降）の運用作業

### 朝の配信後の流れ
[1] 公式LINE一斉配信が予約時刻に自動送信される
[2] ふくちさんが未登録29家族に個別URLを送付
- 管理画面でURL発行
- 「文面ごとコピー」ボタンで完成文面を取得
- 保護者LINE個別チャットに貼り付け→送信
- 1家族あたり数十秒で完了
[3] 保護者が順次登録（数日〜数週間）
[4] 管理画面で登録状況を確認しながら、未登録家族に個別フォロー

### 個別URL送付の文面（確定版）
〇〇様
先ほどご案内した、毎月の引落金額連絡用のLINE登録のご案内です。
下のURLをタップして、画面の指示に従ってご登録ください。（１分以内で終わります🙇‍♂️）
【ご登録用URL】
https://k-acdm.github.io/billing-line/register.html?t=XXXXXXXX
ご不明な点がございましたら、お気軽にお声がけください。
よろしくお願いいたします。

→ 管理画面の「文面ごとコピー」ボタンで自動生成される

## 全体工程マップ
■ ID収集フェーズ ■
✅ Phase 2B Step 1-4：方式A（個別URL方式）完成
✅ Phase 2B Step C：登録済み家族管理
✅ 実保護者データ投入＋既取得ID転記
🔜 一斉配信（明日朝）
🔜 個別URL送付（29家族、明日以降）
【ここで既存49家族のID収集を進める】
🔜 Phase 2B Step 5：Webhook受信実装 ← 新規入塾者の自動ID取得のため必須
🔜 Phase 2B Step 6：未紐付けメッセージ管理画面
【ここで新規入塾者の自動ID取得が可能になる】
■ 配信フェーズ ■
🔜 Phase 3：引き落とし通知の自動配信エンジン（本丸）

Phase 3-1：Excel取込機能
Phase 3-2：配信プレビュー機能
Phase 3-3：テスト配信機能
Phase 3-4：本配信機能

■ 運用安定化フェーズ ■
🔜 Phase 4：滞納フォロー機能
🔜 マイ活との統合検討（将来）

## 環境情報

### リポジトリ
- URL：https://github.com/k-acdm/billing-line
- Visibility：Public
- ブランチ：dev / main

### GASプロジェクト
- 名前：billing-line
- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx_4r523epHF
- Webアプリ URL：https://script.google.com/macros/s/AKfycbyWqIdWCDoj9QY0FDtX5YaiuhSKyf57NyEpmranwzOhAww73bk4VDs6RF2IukFpDw7k/exec

### GitHub Pages
- 保護者登録画面：https://k-acdm.github.io/billing-line/register.html?t=【トークン】

### スプレッドシート
- billing-line-data：1XHy8nEx7sTaHIN3EmLPpNjJRd9kSWzFnXw_eBxS7eKQ
- 7シート構成（Families/Students/Billings/BillingItems/FollowUps/Config/Tokens）
- 現状：41家族・49生徒・登録済12家族

### LINE Developers Console
- プロバイダー：春日部アカデミー
- LINEログインチャネル：マイ活と共用
- Messaging APIチャネル：春日部アカデミー公式（@pwg1825g）

### 公式LINE
- @pwg1825g（ライトプラン）
- 明日朝の一斉配信予約済み

## 運用ルール

### dev/main 切替
**再開時：**`git checkout dev` → `git pull origin dev`
**終了時：**`git pull origin dev` → `git checkout main` → `git merge dev` → `git push origin main` → `git checkout dev`

### 本番反映4ステップ
1. `git pull origin dev`
2. `git checkout main` → `git merge dev` → `git push origin main`（GitHub Pages反映）
3. `clasp push`（GAS変更時）
4. GASエディタで「デプロイを管理」→既存デプロイを編集→「新バージョン」選択→デプロイ

## 次回作業の選択肢

### 第一候補：未登録家族への個別URL送付の作業
- 管理画面で29家族分のURL発行＋文面コピー＋送信
- 1家族あたり数十秒、全体で20〜40分程度
- 一気にやるか、グループ分けして数日に分けるかは判断

### 第二候補：Phase 2B Step 5-6（Webhook受信）の実装
- 新規入塾者対応として必須
- 既存49家族のID収集と並行して実装可能
- 所要：合計2〜3時間

### 第三候補：Phase 3（配信エンジン）の設計・実装着手
- プロジェクトの本丸
- ID収集の進捗と並行して進められる
- 所要：合計4〜6時間

### 再開時の標準手順
cd ~/billing-line
git checkout dev
git pull origin dev

## 困った時の参考

- 設計書：`docs/SYSTEM_DESIGN.md`、`docs/PHASE_2B_DESIGN.md`
- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`
- マイ活の参照箇所：`mykt-eitango/gas/Code.js` の L19000〜L19560
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
✅ 一斉案内文確定・予約配信設定 ← 明日朝配信予定
🔜 個別URL送付フェーズ（明日〜）
🔜 Phase 2B Step 5：Webhook受信（新規入塾者対応・必須）
🔜 Phase 2B Step 6：未紐付けメッセージ画面
🔜 Phase 3：管理画面・配信エンジン（本丸）
🔜 Phase 4：滞納フォロー機能