\# 引き継ぎメモ



\## 最終更新

2026-05-20 自宅PC作業終了時点



\## 現状サマリー



\### 完了済みPhase



\- ✅ \*\*Phase 0\*\*：環境構築（GitHub Bash・clasp・Googleアカウント連携）

\- ✅ \*\*Phase 1A\*\*：スケルトン作成（ディレクトリ構造・README・SYSTEM\_DESIGN.md）

\- ✅ \*\*Phase 1B\*\*：GASプロジェクト作成・clasp連携



\### 次回作業：Phase 1C（スプレッドシート構築）



予想所要時間：約90分（余裕を持って）



\#### Phase 1C のタスク



1\. Googleスプレッドシート新規作成（マイ活と同じアカウント）

2\. 6シート作成：Families / Students / Billings / BillingItems / FollowUps / Config

3\. 各シートの列ヘッダ設定（SYSTEM\_DESIGN.mdの2章参照）

4\. スプレッドシートID取得

5\. ConfigシートにスクリプトプロパティとしてスプレッドシートIDを登録

6\. GASからスプレッドシートに接続する初期コード書き込み

7\. テスト実行・動作確認



\## 環境情報



\### リポジトリ

\- URL：https://github.com/k-acdm/billing-line

\- Visibility：Private

\- ブランチ：dev（開発用）/ main（本番用）



\### ローカルパス

\- 自宅PC：`C:\\Users\\Manager\\billing-line`

\- 塾PC：未クローン（次回塾PC作業時は `git clone` から開始）



\### GASプロジェクト

\- 名前：billing-line

\- スクリプトID：1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx\_4r523epHF

\- ローカル連携：src/gas/ に clasp で連携済み



\### Googleアカウント

マイ活と同じアカウント（同一クラスタ内資産共有のため）



\## 運用ルール（マイ活と同じ）



\### dev/main 切替ルール



\*\*【再開時】\*\*

git checkout dev

git pull origin dev



\*\*【終了時】\*\*

git pull origin dev

git checkout main

git merge dev

git push origin main

git checkout dev



\### 本番反映4ステップ

1\. `git pull origin dev`

2\. `git checkout main` → `git merge dev` → `git push origin main`

3\. `clasp push`（GAS変更時）

4\. Apps ScriptエディタでF5 → 新バージョンデプロイ（GAS変更時）



\## 設計の重要ポイント



詳細は `docs/SYSTEM\_DESIGN.md` 参照。要点だけ：



\- \*\*スプレッドシート構造\*\*：6シート（Families/Students/Billings/BillingItems/FollowUps/Config）

\- \*\*配信タイプ\*\*：自動引落（自）と直接持参（直）の2テンプレート

\- \*\*兄弟まとめ\*\*：同一家族の兄弟分は1通にまとめ。最大3兄弟まで

\- \*\*Excel取込＋画面修正\*\*：従来Excelを取り込み、必要に応じて管理画面で修正

\- \*\*滞納フォロー\*\*：残高不足／ゆうちょ未処理 の2理由で文面出し分け（初期スコープ込み）



\## マイ活側の課題（未解決・billing-lineに影響）



\### LINE Login OAuth「access.line.me 接続拒否」



\- billing-line も同じOAuthフローを使用するため、解決が前提条件

\- 該当コミット：fd907e5（マイ活側）

\- 次回マイ活作業時の調査項目：

&#x20; - 別Googleアカウントでスマホ試行

&#x20; - ネットワーク環境（自宅Wi-Fi/塾Wi-Fi/モバイル回線）

&#x20; - LINE Developers Console 設定確認

&#x20; - OAuthスコープ設定

&#x20; - 別ブラウザ認証



→ Phase 2A として、Phase 1C完了後に着手予定



\## 配信規模・コスト試算



\- 在籍生徒数：約49名

\- 配信通数（兄弟まとめ後）：約40通/月

\- LINEライトプラン（5,000通/月）で十分。滞納フォローを足しても余裕



\## 次回再開時にやること



\### 自宅PCで再開する場合

cd \~/billing-line

git checkout dev

git pull origin dev



\### 塾PCで再開する場合（初回はclone）

cd \~/  # またはマイ活と同じ階層

git clone https://github.com/k-acdm/billing-line.git

cd billing-line

git checkout dev



→ 次に、`clasp clone 1tJRXW2lKU3y2H3Dw1Ne8VMgdSLISGFJUdhXEraJML3HqWx\_4r523epHF` を `src/gas/` で実行して、GAS連携を塾PCにも設定する必要あり



\## 困った時の参考



\- 設計：`docs/SYSTEM\_DESIGN.md`

\- 引き継ぎメモ（このファイル）：`docs/HANDOFF.md`

\- 元データ参考：マイ活アプリv15スレで議論した内容

\- 過去Excel：`引落額通知\_DATA\_22-04\_.xlsx`（DLサイト共有済）

\- 過去Wordテンプレ：`引落額通知\_送信用フォーム\_引落.docx` / `\_直払.docx`

