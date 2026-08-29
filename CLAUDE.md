# 76-Club — Claude Code 運用ガイド

ゴルフコンペ集計＆運営 Web アプリ。単一ページ＋モジュール分割（`index.html` ＋ `styles.css` ＋ `js/*.js`）。GitHub Pages で公開（main → ルート配信）。

## 開発フロー（設計と実装を分ける・一方通行）
着手前に PM（親セッション）が**サイズ判定**する:
- **S（見た目のみの小変更）**: 文言・余白・要素の削除/移動など、§3計算・データモデル・localStorage・i18nキー集合・タブ/モジュール構成に**非接触**のもの。**architect を省略**し、PM が受け入れ条件つきの簡潔な Issue を起票 → implementer が直接実装 → reviewer は verify＋差分精査のみの軽量レビュー。設計書追記なし（変更記録は Issue/PR 本文）。
- **M/L（それ以外すべて）**: 下記フルパイプライン。計算・データ・i18n構造・タブ/モジュール構成に触れるものは必ずこちら。**判定に迷ったら M/L**。

1. **設計（architect）**: 要件を `docs/handoff/` の設計書に落とし、GitHub Issue を起票する。**アプリのコードは書かない**（`index.html`/`js/**`/`styles.css` に触れない）。
2. **実装（implementer）**: Issue と設計書を読み、**1タスク=1ブランチ=1PR** で実装する。**設計書 `docs/handoff/**` は変更しない**。§3 の計算仕様は load-bearing なので、設計書が明示していない限り変えない。
3. **レビュー（reviewer）**: PR を機械検証（`node tools/verify.mjs`）＋差分精査し、問題なければ承認コメント→ squash マージ→ 公開反映を確認する。

`/feature "<やりたいこと>"` で 設計→実装→レビュー を一括で回せる（`.claude/commands/feature.md`）。各役はサブエージェント（`.claude/agents/`）。

**並列化とまとめ出し**:
- 互いに独立なタスク（触るファイル群が重ならない）は**別ブランチで並走してよい**。同じファイル群を触るタスクは直列。
- タスクNの実装中にタスクN+1の**設計を先行**させるパイプライン運用を推奨（設計ファイルは機能別なので衝突しない）。
- 関連する小変更が複数あるときは **1 Issue（箇条書き）＋1PR にまとめる**（Issue/PR/デプロイ確認の固定費を1回分にする）。

## 設計正本（触る前に必ず読む）
- **`docs/handoff/2026-07-12-golf-compe-web.md`** … 計算仕様(§3)・データモデル(§4)＋ §10/§11 の追補（実装済みの正本）。§11.12 が現行リニューアルの設計。
- **`docs/handoff/2026-07-13-refactor-split.md`** … モジュール分割の構成（★2026-08-18 更新節が最新）。
- **新機能の設計は機能ごとに別ファイル**（2026-08-19 以降）: `docs/handoff/YYYY-MM-DD-<slug>.md` を新設する。正本 2026-07-12 への追記は **§3/§4（計算・データモデル）に触れる場合のみ**。機能別ファイル化により architect の並走と、設計コミットの分離（docs 単独コミット。main 直コミット可、不可な環境では実装ブランチ先頭の単独コミット）が可能。

## ★load-bearing（勝手に変えない）
- **§3 の計算式**（ダブルペリア／エブリ／ステーブル／オリンピック／キャロウェイ／握り／ベスト2／HBH／ラスベガス）。変更は設計書を先に更新してから。
  - 現行の重要仕様（§11.12 H・2026-08-19）: **ペリアHDCP はエブリ適用後スコア(`adjHole`)基準**で隠し12ホール合計を取る。
- **localStorage キー**: データ=`golfCompe_v1`（`state`）／表示状態=`golfCompe_lang`・`golfCompe_theme`・`golfCompe_channel`・`golfCompe_seenTop`。**データと表示状態は分離**（表示状態を `golfCompe_v1` に入れない）。
- **i18n 辞書**（`js/i18n.js` の `I18N`）は **ja/zh/en のキー集合が完全一致**であること。追加時は3言語同時。
- **inline `onclick`/`onchange` はグローバル関数依存** → **ESM 化しない**（通常 `<script src>` 順次読込）。読込順は `index.html` の並び（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→roulette→backup→init）。
- **機能色の"意味"**（勝ち=緑/引分=橙/採用=枠/危険=赤）は保持。デザインは**トークン**（`styles.css` の `:root` ＋ `html[data-theme="dark"]`）で管理。面に濃色ベタ塗りを使わない（黒＝文字・罫線）。
- **投影前提の表示原則**（2026-08-20 制定・正本 §11.14 が詳細）: 結果・閲覧系画面はプロジェクター投影が既定ユース。後方席から読める**大型表示を主役**に（投影用トークン `--f-rl-hole/--f-rl-name/--f-rl-score` を共用）、**幹事の操作UIは控えめ配置**（`<details>` 折りたたみ・`sm` ボタン）。機能色の意味は大型表示でも保持し色だけに頼らず文字併記。演出の進行状態（開封・めくり）は揮発の表示状態にし localStorage に保存しない。新規の閲覧系画面は必須・既存画面は個別Issueで順次適用。

## 検証（reviewer 必須）
```bash
node tools/verify.mjs         # 構文/ i18n パリティ / 使用キー未定義参照 / CSS孤立var() / 計算回帰(#3・Vegas)
```
リファクタ（挙動不変）の PR では、旧 main との**行多重集合一致**も併せて確認する（`tools/verify.mjs --refactor` は将来拡張）。公開反映は `curl https://shoulang0729.github.io/76-Club/...` で確認。

## git / gh
- gh CLI は認証済み前提（`gh pr view/create/merge`、`gh issue create/comment`）。
- **gh CLI が無い環境（クラウドセッション等）**: Issue/PR/マージ操作は PM（親）が GitHub MCP で代行する。サブエージェントは Issue/PR 本文を**ドラフトファイル**（親指定のパス）に書き出して渡し、git は **commit まで**（push は親）。公開反映確認は github.io へ直接アクセスできない場合、GitHub Actions「pages build and deployment」の success で代替する。
- マージは **squash＋ブランチ削除**。スタックPRを squash する場合、子PRのベースが消えると自動クローズされるので、**子は main へリベースして新規PR再作成**する。
- main 直コミットは docs/設計・CI設定のみ。アプリ実装は必ずPR。
