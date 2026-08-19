# 76-Club — Claude Code 運用ガイド

ゴルフコンペ集計＆運営 Web アプリ。単一ページ＋モジュール分割（`index.html` ＋ `styles.css` ＋ `js/*.js`）。GitHub Pages で公開（main → ルート配信）。

## 開発フロー（設計と実装を分ける・一方通行）
1. **設計（architect）**: 要件を `docs/handoff/` の設計書に落とし、GitHub Issue を起票する。**アプリのコードは書かない**（`index.html`/`js/**`/`styles.css` に触れない）。
2. **実装（implementer）**: Issue と設計書を読み、**1タスク=1ブランチ=1PR** で実装する。**設計書 `docs/handoff/**` は変更しない**。§3 の計算仕様は load-bearing なので、設計書が明示していない限り変えない。
3. **レビュー（reviewer）**: PR を機械検証（`node tools/verify.mjs`）＋差分精査し、問題なければ承認コメント→ squash マージ→ 公開反映を確認する。

`/feature "<やりたいこと>"` で 設計→実装→レビュー を一括で回せる（`.claude/commands/feature.md`）。各役はサブエージェント（`.claude/agents/`）。

## 設計正本（触る前に必ず読む）
- **`docs/handoff/2026-07-12-golf-compe-web.md`** … 計算仕様(§3)・データモデル(§4)＋ §10/§11 の追補（実装済みの正本）。§11.12 が現行リニューアルの設計。
- **`docs/handoff/2026-07-13-refactor-split.md`** … モジュール分割の構成（★2026-08-18 更新節が最新）。

## ★load-bearing（勝手に変えない）
- **§3 の計算式**（ダブルペリア／エブリ／ステーブル／オリンピック／キャロウェイ／握り／ベスト2／HBH／ラスベガス）。変更は設計書を先に更新してから。
  - 現行の重要仕様（§11.12 H・2026-08-19）: **ペリアHDCP はエブリ適用後スコア(`adjHole`)基準**で隠し12ホール合計を取る。
- **localStorage キー**: データ=`golfCompe_v1`（`state`）／表示状態=`golfCompe_lang`・`golfCompe_theme`・`golfCompe_channel`・`golfCompe_seenTop`。**データと表示状態は分離**（表示状態を `golfCompe_v1` に入れない）。
- **i18n 辞書**（`js/i18n.js` の `I18N`）は **ja/zh/en のキー集合が完全一致**であること。追加時は3言語同時。
- **inline `onclick`/`onchange` はグローバル関数依存** → **ESM 化しない**（通常 `<script src>` 順次読込）。読込順は `index.html` の並び（state→i18n→nav→home→players→game→course→score→testdata→calc→results→roulette→backup→init）。
- **機能色の"意味"**（勝ち=緑/引分=橙/採用=枠/危険=赤）は保持。デザインは**トークン**（`styles.css` の `:root` ＋ `html[data-theme="dark"]`）で管理。面に濃色ベタ塗りを使わない（黒＝文字・罫線）。

## 検証（reviewer 必須）
```bash
node tools/verify.mjs         # 構文/ i18n パリティ / 使用キー未定義参照 / CSS孤立var() / 計算回帰(#3・Vegas)
```
リファクタ（挙動不変）の PR では、旧 main との**行多重集合一致**も併せて確認する（`tools/verify.mjs --refactor` は将来拡張）。公開反映は `curl https://shoulang0729.github.io/76-Club/...` で確認。

## git / gh
- gh CLI は認証済み前提（`gh pr view/create/merge`、`gh issue create/comment`）。
- マージは **squash＋ブランチ削除**。スタックPRを squash する場合、子PRのベースが消えると自動クローズされるので、**子は main へリベースして新規PR再作成**する。
- main 直コミットは docs/設計・CI設定のみ。アプリ実装は必ずPR。
