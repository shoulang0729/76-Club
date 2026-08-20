# 設計：ルーレット — ホール番号欄への大型勝敗表示 — 2026-08-20

- **区分**: 【確定】（2026-08-20 ユーザー確認済み）
- **要望原文**: 「結果発表の欄を大きく、ワンオンワンと同じようなものをホール番号が書いてある場所に表示できないでしょうか」
- **正本との関係**: §3/§4（計算・データモデル）に**非接触**（rlStandings・rlMarks・rlHoleScore ほか計算は不変。表示のみ）。正本への追記なし。投影原則は正本 **§11.14** 準拠（ルーレットは先行例＝同トークンを拡張適用）。
- **実装対象**: `js/roulette.js`（`renderRouletteTab` のみ）と `styles.css`（`.rl-res*` 追加）。**i18n 増減ゼロ**。

---

## 1. 前→後サマリ

| 項目 | 前（現行 main=c0a638c） | 後 |
|---|---|---|
| ホール確定時の勝敗表示 | 各チームカードの色（win=緑/lose=赤/tie=橙）＋ rl-info 行の小さな文字（引分のみ `rl.tie`。WIN テキストは §11.12 M で廃止済み） | **rl-head（ホール番号の並び）に大型勝敗表示を追加**: 「5H Par4 **チームレッド WIN**」。引分は「5H Par4 **引き分け（各0.5H）**」 |
| ホール番号 | `nH`（`--f-rl-hole`）＋ `Par n` | **残す**（置換しない。スコア入力・進行の文脈情報として必要）。勝敗はその右に併記 |
| rl-info 行 | `rl.repNoScore` または `rl.tie` | **`rl.repNoScore` のみ**（引分表示は rl-head の大型表示へ移動。min-height:24px は維持＝レイアウト不動） |
| 回転中・未確定 | — | 大型勝敗表示は**非表示**（回転中フラッシュ・確定→次のホールの既存フローは不変） |

## 2. 表示仕様（確定）

### 2.1 表示条件（既存 `stCls` のカード色付け条件と完全一致させる）

```
表示する ⟺ !rl.spinning && rlHoleDrawn(g) && 全チームの代表スコア(rlHoleScore)が非null
```
- スコアが1つでも未入力 → 現行どおり rl-info に `rl.repNoScore`（小・muted）。大型表示なし。
- 回転中（rl.spinning）→ 非表示（候補比較は既存の rlFlash 点滅が担う）。
- チャレンジ相手選択中（rl.challengeFrom）→ カード色と同じく**表示したまま**（現行 stCls と同条件。確定代表での現時点の勝敗）。
- 18H終了ビュー（R.cur>=18）は変更なし。

### 2.2 マークアップ（renderRouletteTab の rl-head 内・rl-par の直後に挿入）

```html
<!-- 勝ちチームあり（wi = 最小スコアのチーム index 群、wi.length < teams.length） -->
<div class="rl-res">
  <span class="rl-res-nm" style="color:{rColor(チーム名)}">チームレッド</span>  <!-- wi ぶん繰り返し -->
  <span class="rl-res-w">WIN</span>
</div>
<!-- 全チーム同点（wi.length === teams.length） -->
<div class="rl-res"><span class="rl-res-tie">${t('rl.tie')}</span></div>
```
- 勝敗判定は既存 `holeScores()`＋`Math.min` の再利用（rlStandings と同じ「最小=勝ち」。**計算関数の変更なし**）。
- **3チーム以上で一部同点**（例: 3チーム中2チームが最小タイ）: 勝ちチーム名を**並べて表示**し `WIN` は1つ（例「レッド ブルー WIN」）。0.5H 等の按分は各カード右上の取得Hカウンタで判る（大型表示には出さない）。
- `WIN` は**リテラル文字列**（i18n キーなし。UP/AS/nH/Par と同じ言語非依存の記号扱い。文字併記＝色弱対応の役割を兼ねる）。
- 引分は既存キー `rl.tie`（ja「引き分け（各0.5H）」/ zh「平局（各0.5洞）」/ en「Tie (0.5H each)」）をそのまま大型化。
- rl-head は既存の `flex / align-items:baseline / flex-wrap` のまま（狭い画面では勝敗表示が自然に折り返し。リセットボタンの `margin-left:auto` も既存どおり）。

### 2.3 スタイル（styles.css・ルーレット節に追加。数値はトークンのみ＝@media 再定義に自動追従）

```css
.rl-res{display:flex;align-items:baseline;column-gap:10px;flex-wrap:wrap;min-width:0}
.rl-res-nm{font-size:var(--f-rl-name);font-weight:var(--w-bold);line-height:1;overflow-wrap:anywhere}
.rl-res-w{font-size:var(--f-rl-score);font-weight:var(--w-bold);line-height:1;color:var(--win)}
.rl-res-tie{font-size:var(--f-rl-name);font-weight:var(--w-bold);line-height:1.1;color:var(--tie)}
```
- スケール: チーム名=`--f-rl-name`（30→40/44/48px）・`WIN`=`--f-rl-score`（44→64/68/76px）＝1 on 1 hero（.m1-nm/.m1-big）と同等級。引分文は長文のため `--f-rl-name` 級（30px〜＝現行 rl-info の約2倍超）。
- **機能色の意味維持**: チーム名=チームカラー（`rColor`）・WIN=`var(--win)` 緑・引分=`var(--tie)` 橙。**面の濃色ベタ塗りなし**（文字色のみ）。文字併記（WIN/引分文言）で色だけに頼らない。

### 2.4 rl-info の変更

- `holeInfo` から `rl.tie` 分岐を削除し、**`rl.repNoScore` のみ**を出す（`rl-info` の `min-height:24px`・`&nbsp;` プレースホルダは現行のまま＝ボタン位置が動かない）。

## 3. i18n（増減ゼロ）

- **追加・削除・値変更なし**。`rl.tie`・`rl.repNoScore` を流用。`WIN` はリテラル（§2.2）。ja/zh/en パリティ現状維持で `node tools/verify.mjs` を通す。

## 4. 触らない範囲（load-bearing）

- `js/roulette.js` の計算・進行系: `rlStandings`・`rlMarks`・`rlHoleScore`・`rlEvery`・`rlTick/rlFlash/rlBeginSpin/rlStop`・`rlChange/rlChallenge*`・`rlNextHole/rlCanAdvance/rlReset`・スコア表（rlScorecard）・開発者メニュー。
- チームカードの勝敗色（win/lose/tie・fwin/flose/ftie）と `.rl-panel/.rl-name/.rl-scorebig` 等の既存 `.rl-*` スタイル値・`--f-rl-*` トークン値。
- 回転中フラッシュ→停止→確定→「確定して次のホールへ」の既存フロー・チェンジ/チャレンジのハーフ単位ルール（§11.3）。
- localStorage キー・`golfCompe_v1` 構造（`g.roulette` 含む）・i18n 既存キー・非ESM/inline onclick 方針。

## 5. 受け入れ条件

1. 全代表確定＋全スコア入力済みのホールで、rl-head に「{n}H Par{p} {勝ちチーム名} WIN」が表示される（チーム名=チームカラー・WIN=緑・`--f-rl-name`/`--f-rl-score` スケールで @1024/@1194/@1366 の自動拡大に追従）。
2. 全チーム同打数のとき「{n}H Par{p} 引き分け（各0.5H）」（`rl.tie`・橙）が大型表示され、rl-info には出ない。
3. スコア未入力が混じる間は現行どおり rl-info に `rl.repNoScore`（小）のみ・大型表示なし。回転中は大型表示なし（フラッシュは従来どおり）。
4. 3チーム以上で一部同点の場合、最小タイの全チーム名が並び WIN が1つ表示される。負けチームのカード表示（赤）は従来どおり。
5. 「確定して次のホールへ」で次ホールに進むと大型表示が消え（未確定状態）、既存フロー・取得Hカウンタ・スコア表の印（rwin/rtie/adopt）に変化がない。18H終了ビューも無変化。
6. ホール番号「nH Par n」は従来位置・従来サイズのまま残る。リセットボタン位置（右端）不変。狭い画面では勝敗表示が折り返してもボタン類が操作可能。
7. **回帰なし**: rlStandings の取得H・computePoints 系の配点・`node tools/verify.mjs` 通過。i18n キー集合の増減ゼロ。濃色ベタ塗りの新設なし。

## 6. 推奨PR

- **単独PR**（例 `feat/roulette-hero-result`）: roulette.js の renderRouletteTab＋styles.css の `.rl-res*` 追加のみ。
- 1 on 1 第3版（`docs/handoff/2026-08-20-1on1-match.md` §14・results.js/styles.css）とは**触るJSが独立のため並走可**。styles.css は別セクション（ルーレット節 vs m1 節）だが同一ファイルのため、コンフリクト時は後発がリベースする。
