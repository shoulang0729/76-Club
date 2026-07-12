# 指示書：`index.html` のモジュール分割リファクタ（コード整理）

- 作成: 2026-07-13（Mulmo 設計）
- 対象リポジトリ: `shoulang0729/76-Club`
- 実装担当: **VS Code（Claude Code）**
- 種別: **純粋リファクタ（挙動を1ミリも変えない）**。新機能・仕様変更なし。
- 現状: Phase 1 アプリは `index.html` **単一ファイル**（GitHub Pages で公開中）。CSS/JS が全部入りで肥大化したので、**素直な複数ファイル構成に分割して読みやすくする**のがゴール。

---

## 1. ゴール / 非ゴール
- **ゴール**：`index.html`（1176行・`<style>`230行・`<script>`908行）を、CSS と JS を役割ごとのファイルに切り出し、**見通しの良い構成**にする。
- **非ゴール**：機能追加・UI変更・計算ロジック変更・localStorage スキーマ変更は**しない**。**出力（画面・数値・保存データ）は完全一致**を保つ。

---

## 2. 現状の構造（正確）
`index.html` は「`<style>` + `<body>`マークアップ + 単一 `<script>`」。`<script>` は既に**セクションのバナーコメントで区切られている**（下記の行はコミット `b5b2791` 時点の目安）：

| バナー | 役割 |
|---|---|
| `STATE` | `load/migrate/newRoulette/defaultPoints/save/uid/toast/curGame/newGame` ほか。`const LS_KEY="golfCompe_v1"`、`let state` |
| `TAB NAV` | `views/activeTab/revealHoles/rl/show/nsMode/tgMode` 等のグローバル、`toggleMenu/go/render/esc/EVERY_LABEL/EYE/EYEOFF/posBadge` |
| `PLAYERS` | `renderPlayers/addPlayer/setPlayerField/editPlayer/setPlayerEvery/setPlayerKanji/delPlayer` |
| `GAME SETUP` | `renderGame/hostMenuCard/setG/setCap/setWE/setPar/... /setRoulette/createGame/...チーム/prizes` |
| `SCORE ENTRY` | `renderScore/sum/setScore/updateRowSums/fillRandomScores/clearScores` |
| `TEST DATA` | `allComplete/statusBadge/seedTestData` |
| `CALCULATIONS` | `parTotal/gross/complete/periaHdcp/enteredCount/womenEvery/effGross/evPer/adjArr/adjHole/net/stableford/olympic/callaway/nassau/ranked/tieBreak/teamRanked/holesWon/best2/computePoints/computePayout/nextKanji` |
| `RESULTS` | `viewGame/renderResult/renderStanding/renderIndividual/renderTeamTab/rankCardNS/leaderboard/renderPrizeTab/renderScorecard/renderPrizes/renderTeams/setPrize/reveal系/toggleShow/ns系/tg系` |
| `ルーレット対抗` | `rTeams/rColor/rlEvery/rlRaw/rlHoleScore/rlDraw/rlTick/rlBeginSpin/rlStop/rlStart.../rlChange/rlChallenge.../rlNextHole/rlReset/rlStandings/rlForceRep/rlRefund/rlMarks/rlScorecard/renderRouletteTab` |
| `BACKUP` | `exportData/importData` |
| `INIT` | 末尾の `render();` |

### ★超重要な制約（分割方式を決める前提）
1. **inline `onclick` ハンドラが大量にある**（例：`onclick="rlStop()"`, `onclick="setResultSub('ind')"`）。これらは**関数がグローバルスコープにある前提**で動く。
2. 関数どうし・グローバル変数（`state`,`rl`,`show`,`revealHoles`,`nsMode`,`tgMode`,`resultSub` 等）を**同一スコープで共有**している。

→ したがって **ES Modules（`type="module"`）にすると全関数を `window.` に手動公開する必要が出て破壊リスクが高い**。**推奨は「複数の“通常 `<script src>`”を順番に読み込む（グローバルスコープ共有のまま）」**。バンドラ不要・onclick もそのまま動く・差分は純粋な切り貼りで済む。

---

## 3. 目標ファイル構成（推奨＝通常スクリプトの順次読み込み）
```
index.html            # <head>に<link>、</body>直前に<script src>を「順番どおり」に列挙。markupは現状のまま
assets/style.css      # 現 <style> の中身をそのまま移設
src/state.js          # STATE ＋ TAB NAV のグローバル宣言（LS_KEY/state/各グローバル/定数/EYE等）＋ load/migrate/save/uid/toast/curGame/newGame/newRoulette/defaultPoints
src/nav.js            # TAB NAV の関数（toggleMenu/go/render/esc）
src/players.js        # PLAYERS
src/game.js           # GAME SETUP ＋ TEST DATA（seedTestData等）
src/score.js          # SCORE ENTRY
src/calc.js           # CALCULATIONS（純粋関数中心）
src/result.js         # RESULTS
src/roulette.js       # ルーレット対抗
src/backup.js         # BACKUP
src/main.js           # 末尾の init（render() 呼び出し）だけ。最後に読み込む
```
`index.html` 末尾の読み込み順（**この順序が重要＝依存を満たす**）：
```html
<script src="src/state.js"></script>
<script src="src/calc.js"></script>
<script src="src/nav.js"></script>
<script src="src/players.js"></script>
<script src="src/game.js"></script>
<script src="src/score.js"></script>
<script src="src/result.js"></script>
<script src="src/roulette.js"></script>
<script src="src/backup.js"></script>
<script src="src/main.js"></script>
```
- 関数定義は巻き上げ（hoisting）されるので、`render()` を最後（main.js）で呼べば前方参照は問題ない。ただし**トップレベルで即時実行する `let state=load()` 等はファイル順に依存**するため、`state.js` を最初に置く。
- どうしても ES Modules にしたい場合は**別提案**（全ハンドラの `window` 公開 or `addEventListener` 化が必要＝大工事）なので、**今回は通常スクリプト方式で行う**こと。

### CSS
- `<style>…</style>` の中身を丸ごと `assets/style.css` へ。`<head>` に `<link rel="stylesheet" href="assets/style.css">`。
- **クラス名・セレクタは一切変更しない**（JSが文字列でクラス名を生成しているため）。
- ⚠ `assets/style.css` に prettier 等の自動整形を**全体がけしない**（巨大diff化・確認不能を避ける）。

---

## 4. 触ってはいけない範囲（load-bearing）
- **localStorage キー `golfCompe_v1` とデータスキーマ**（`players/games/... /roulette{changeN,challengeM,reps,pool,remChange,remChallenge,cur}` 等）。
- **計算ロジックの結果**（ダブルペリア・エブリ表示＝各ホール−1/−2の `evPer/adjHole/adjArr`・タイブレーク・ルーレット比較・ポイント配分）。**数値が1つでも変わったら不可**。
- **inline `onclick` が参照する関数名**（改名禁止）。
- **CSSクラス名**（JSが生成）。
- ライブは **リポジトリ直下 `index.html`**（GitHub Pages `main`/ルート配信）。パスは相対（`assets/…`, `src/…`）。
- バンドラ/ビルド工程を**足さない**（Pages 直配信のまま）。

---

## 5. 受け入れ条件（チェックリスト）
- [ ] 分割後の見た目・数値・保存データが**現行ライブと完全一致**（下記を目視確認）
  - [ ] 選手タブ：追加/編集/性別/生年月日/ハンデ区分/幹事対象外
  - [ ] ゲームタブ：コース/隠し12/ペリア係数/エブリ/参加者/チーム/ニアドラ/競技ON-OFF/配点/賞金総額/ルーレット回数/幹事メニューのテストデータ
  - [ ] 入力タブ：手入力・ランダム・クリア（フォーカスが飛ばない）
  - [ ] 結果タブ：ニアドラ/個人戦/チーム戦/ルーレット/配分。表示切替（合計値/名前スコア/目隠しボタン/幹事バッジ）
  - [ ] 個人戦：ホール開封で順位が入れ替わる／エブリ適用後グロス表示（入力タブのみ生スコア）
  - [ ] ルーレット：START/STOP/確定（同一ボタン）・チェンジ/チャレンジ・スコア表の採用/勝敗の印・エブリ反映
  - [ ] JSON書き出し/読み込み
- [ ] ブラウザのコンソールに**エラー0**
- [ ] GitHub Pages にデプロイして `https://shoulang0729.github.io/76-Club/` が正常表示
- [ ] **差分が“切り貼り”に限られる**（ロジックの書き換えが混ざっていない＝レビューで確認）

### 検証のやり方（テストが無いので）
- リグレッションの基準＝**現行 `index.html` の視覚/機能リファレンス** `docs/handoff/assets/2026-07-12-phase1-reference.html`（＝分割前の全部入り）。分割後と**同じ操作で同じ結果**になることを目視で突き合わせる。
- localStorage 互換：分割前に作った `golfCompe_v1` のデータ（or JSON書き出し）を分割後に読み込んで**そのまま表示できる**こと。

---

## 6. 運用（ブランチ / PR / Issue）
- 1タスク=1ブランチ=1PR。ベースは `main`。
- ブランチ名：`refactor/split-single-file`
- コミットは**「CSS抽出」「state/calc抽出」…と段階的**に分けると差分が読みやすい（各段でアプリが壊れないことを確認しながら）。
- Issue：本ドキュメントを参照（`Closes #<番号>`）。

## 7. 完了後（任意・別タスク）
- さらに整えるなら「ESM化（各ハンドラを `data-action` 委譲へ）」だが**別Issue**。今回はスコープ外。
