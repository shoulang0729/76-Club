# 設計: リファクタ P3 — js/results.js の3ファイル分割（挙動不変）

- 作成: 2026-08-30（architect）
- 種別: **純粋リファクタ（挙動を1ミリも変えない）**。§3計算・§4データモデル・localStorage・i18nキー集合に**非接触**（正本 2026-07-12 への追記なし）。
- 正本参照: `docs/handoff/2026-07-13-refactor-split.md`（モジュール構成の正本・★2026-08-18/08-19 節）。本設計の §7 追記案を PM がそちらへ反映する。
- 関連: P1（`tools/verify.mjs --refactor <ref>` の導入・並行）／P2（results.js 小掃除・**本タスクより先に main へ入る前提**）。

---

## 1. ゴール / 非ゴール

- **ゴール**: `js/results.js`（522行・38関数・モジュール変数12個）を、**通常 `<script src>` 順次読込・グローバルスコープ共有のまま** 3ファイルに分割し、見通しを良くする。
- **非ゴール**: 機能追加・表示変更・関数名/クラス名変更・ロジック改変・`roulette.js` 内の歴史的同居ヘルパ（`leaderboard`/`renderPrizes`/`renderTeams`/`setPrize`）の移動（→後述 §8 別タスク候補）。

## 2. 分割方針（決定）

**3ファイル構成**（案の 4 ファイル `results-ind.js` 分離は**不採用**）:

| ファイル | 内容 | 概算行数 |
|---|---|---|
| `js/results.js`（残置・縮小） | 共有表示状態・2階層タブ骨格・ホール開封・配分タブ・共通部品（スコアカード/ニアドラヒーロー/ruleBox）・個人戦 | 約267行 |
| `js/results-team.js`（新設） | チーム戦（総合/ニアドラ/種目タブ振り分け・連携ボタン・勝ち点表示ヘルパ） | 約151行＋先頭コメント1行 |
| `js/results-m1.js`（新設） | 1 on 1 マッチプレー（オープン演出状態＋描画） | 約105行＋先頭コメント1行 |

### 2.1 なぜ 3 ファイルか（4ファイル案の不採用理由）

現行コードの実測で、案の「results-ind.js（順位カード・スコアカード・prize ヒーロー/登録）」候補は**チーム戦からも参照される共有部品**だった:

- `renderScorecard`（＋`SC_COLGROUP`）… `renderIndGame`（個人戦）と `renderTeamGame`（チーム戦 gross/net/hbh）の両方が呼ぶ。
- `renderPrizeHero` / `pzMasked` / `pzMode` / `pzExcept` … 個人戦ニアドラと `renderTeamNiadora`（チーム戦）で**伏せ状態を共有**する設計（意図的・§5.1.1）。
- `pzCfgOpen` / `pzCfgToggle`（勝者登録 details の開閉）… 同上、両タブで共有。

これらを個人戦ファイルへ出すと「team → ind 依存」ができて境界の意味が崩れる。共有部品を results.js（基盤）に置くと、純個人戦部分は `renderIndGame`＋`rankCardNS` の約40行しか残らず、独立ファイルにする価値がない。よって**共有基盤＋個人戦を results.js に同居**させる。

### 2.2 連続カットで済む（最重要の実装上の利点）

現行ファイルはセクション順が「共有＋個人戦（1〜266行）→ チーム戦（268〜417行）→ 1on1（419〜522行）」と**既に連続ブロック**になっている。**唯一の例外**は先頭 2〜4 行目の 1on1 表示状態ブロック:

```js
/* 1 on 1 のオープン演出用表示状態（§13.2/§14.1・揮発＝再読込で既定に戻る。localStorage には保存しない） */
let m1RevealMode='all';      // ...
let m1Opened=new Map();      // ...
```

→ この 3 行（コメント1＋let 2）だけを `results-m1.js` の先頭コメント直後へ移動する。それ以外は**2箇所の連続カット**（行の並び替えなし・バイト無改変の切り貼り）で完了する。

### 2.3 ファイル名

`results-m1.js`（`match1v1.js` ではなく）とする。理由: 1on1 の計算（`m1Result`/`m1HoleWin`/`m1Valid` 等）は calc.js、組合せ編集UIは players.js に既在で、本ファイルは**結果タブの 1on1 描画専用**。results ファミリーであることを名前で示す（コード内略号 `m1` とも一致）。

## 3. インベントリと分割先（関数名基準・全38関数＋変数12個）

> **行番号は 2026-08-30 時点の参考値。** P2（小掃除）が先に results.js を触るため、**実装時は最新 main 基準で関数名で照合**すること（§6 実装メモ）。

### 3.1 js/results.js（残置・21関数＋変数7個）

| 種別 | 名前 | 参考行 | 備考（外部参照） |
|---|---|---|---|
| let | `resGrp` / `resGame` | 6-7 | 2階層タブ状態（揮発） |
| let | `pzMode` / `pzExcept` | 9 | ニアドラ伏せ状態。**results-team.js（renderTeamNiadora）からも実行時参照** |
| let | `scOpen` | 12 | スコアカード開閉（揮発） |
| let | `pzCfgOpen` | 124 | 勝者登録 details 開閉。**results-team.js からも実行時参照** |
| const | `SC_COLGROUP` | 178 | IIFE（自己完結・読込順に無関係） |
| fn | `scOpenToggle` | 13 | inline ontoggle |
| fn | `pzMasked` | 14 | results-team.js から呼ばれる |
| fn | `togglePzAll` / `togglePzCell` | 15-16 | inline onclick |
| fn | `setResGrp` / `setResGame` | 17-22 | inline onclick |
| fn | `resGameTabs` | 24 | |
| fn | `viewGameN` / `viewGame` | 49 / 56 | results-m1.js から呼ばれる |
| fn | `openNextHole` / `closeHole` / `openAllHoles` / `resetHoles` | 57-60 | inline onclick（results-m1.js の生成HTMLからも） |
| fn | `renderResult` | 62 | **nav.js・roulette.js から多数呼ばれる**（名前不変必須） |
| fn | `ruleBox` | 88 | results-team/m1 から呼ばれる |
| fn | `renderStanding` | 95 | 配分タブ |
| fn | `pzCfgToggle` | 125 | inline ontoggle（team 側生成HTMLからも） |
| fn | `renderIndGame` | 126 | 個人戦 |
| fn | `renderPrizeHero` | 155 | results-team.js（`renderPrizeHero(g,true)`）から呼ばれる |
| fn | `renderScorecard` | 180 | results-team.js（renderTeamGame）から呼ばれる |
| fn | `rankCardNS` | 254 | 個人戦グロス/ネット順位カード |

### 3.2 js/results-team.js（新設・9関数＋変数3個）＝旧 268〜417 行の連続ブロック

| 種別 | 名前 | 参考行 | 備考 |
|---|---|---|---|
| fn | `renderTeamGame` | 271 | renderResult から呼ばれる |
| fn | `tpAnnounce` | 294 | inline onclick。save() する（データ系） |
| fn | `tpAnnounceUI` | 296 | **roulette.js から4箇所呼ばれる**（名前不変必須） |
| fn | `tpFmtWin` / `tpShare` | 308 / 315 | |
| fn | `setTeamEventPts` | 321 | inline onchange |
| let | `tpEvPtsOpen` | 326 | 揮発 |
| fn | `tpEvPtsToggle` | 327 | inline ontoggle |
| const | `TP_EV_LABEL` / `TP_EV_ORDER` | 328 / 332 | 自己完結リテラル |
| fn | `renderTeamOverall` | 333 | |
| fn | `renderTeamNiadora` | 390 | results.js の `pzMasked`/`pzCfgOpen`/`renderPrizeHero`、roulette.js の `renderPrizes` を実行時参照 |

### 3.3 js/results-m1.js（新設・8関数＋変数2個）＝先頭状態ブロック（旧2〜4行）＋旧 419〜522 行

| 種別 | 名前 | 参考行 | 備考 |
|---|---|---|---|
| let | `m1RevealMode` / `m1Opened` | 3-4 | **旧ファイル先頭から移動**（§2.2 の唯一の例外） |
| fn | `m1Key` | 423 | |
| fn | `m1SetMode` / `m1OpenCard` / `m1OpenNext` / `m1OpenAllCards` / `m1CoverAll` / `m1Holes` | 424-435 | inline onclick |
| fn | `renderMatch1v1Parts` | 439 | renderResult から呼ばれる |

### 3.4 同居必須の理由まとめ（境界の根拠）

- `pzMode/pzExcept/pzMasked/renderPrizeHero/pzCfgOpen/pzCfgToggle` は ind/team 共有 → **results.js（基盤）**。
- `renderScorecard/SC_COLGROUP` は ind/team 共有 → **results.js**。
- `viewGameN/viewGame/reveal系（openNextHole 等）/revealHoles(nav.js)` は ind/team/m1 共有 → **results.js**。
- `tpAnnounceUI` は team 専用に見えるが roulette.js からも呼ばれる → グローバル関数なのでどこでも可。チーム戦の「連携」概念の持ち場である **results-team.js** に置く（roulette → results-team は実行時参照で読込順に無関係）。

## 4. 読込順・index.html・CLAUDE.md

### 4.1 なぜ読込順が緩いか（確認済みの前提）

- 通常 `<script>` のトップレベル `let/const` は**グローバルレキシカルスコープを全スクリプトで共有**する（既存の nav.js の `revealHoles` 等を results/roulette が読む構造と同じ）。
- ファイル間参照はすべて**実行時**（render 呼び出し・イベントハンドラ）に解決される。トップレベルで即時実行するのは `SC_COLGROUP` の IIFE と `TP_EV_LABEL/ORDER` 等のリテラルのみで、いずれも自己完結＝**読込順ハザードなし**。
- 現状も「results.js → roulette.js の `renderPrizes` 等を呼ぶ」「roulette.js → results.js の `tpAnnounceUI` を呼ぶ」と相互参照済みで動作している。

### 4.2 index.html（既存慣例に従い results 系を現位置に連続配置）

現行 71 行目の `<script src="js/results.js?v=99"></script>` を以下の3行に置換（`?v=` は**実装PR番号**で全 script タグ一括更新・既存ルール）:

```html
<script src="js/results.js?v=NN"></script>
<script src="js/results-team.js?v=NN"></script>
<script src="js/results-m1.js?v=NN"></script>
```

位置は従来どおり **calc.js の後・roulette.js の前**。`tools/verify.mjs` は script タグからモジュール一覧を動的取得するため verify 側の改変は不要（refactor-split.md ★2026-08-19 節）。

### 4.3 CLAUDE.md の読込順記載（実装PRで同時更新）

「読込順は `index.html` の並び（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→roulette→backup→init）」の `results` を
`results→results-team→results-m1` に置換:

```
（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→results-team→results-m1→roulette→backup→init）
```

## 5. 検証仕様（行多重集合一致の定義）

**新規行は各新設ファイルの先頭コメント1行のみ（計2行）**とする:

- `js/results-team.js` 1行目: `/* ============================ RESULTS: チーム戦（js/results.js から分割・挙動不変） ============================ */`
- `js/results-m1.js` 1行目: `/* ============================ RESULTS: 1 on 1（js/results.js から分割・挙動不変） ============================ */`

results.js 既存 1 行目のバナー `/* ==== RESULTS ==== */` は改変しない。移動する行は**空行含めバイト単位で無改変**。分割点の空行（旧 267 行目・418 行目付近）は**どちらか一方のファイルに1回だけ**含める（重複・欠落なし）。

機械検証（P1 の `verify.mjs --refactor origin/main` が正。未導入の場合の代替コマンド）:

```bash
{ cat js/results.js; tail -n +2 js/results-team.js; tail -n +2 js/results-m1.js; } | sort \
  | diff - <(git show origin/main:js/results.js | sort) && echo "MULTISET OK"
```

（`tail -n +2` で新規ヘッダ行を除外。差分ゼロ＝行多重集合一致）

## 6. 実装メモ（implementer 向け）

1. **P2 直列制約**: P2（class属性重複修正・未使用ヘルパ削除等）が results.js を先に触る。**P2 マージ後の最新 main から着手**し、本書 §3 の行番号でなく**関数名で切り出し範囲を照合**すること（P2 で行番号がずれる。関数の増減があれば分割先は §3.4 の境界根拠で判断し、PR 本文に差異を明記）。
2. 手順（推奨コミット順・1PR内）:
   - (a) `js/results-m1.js` 新設: ヘッダコメント1行＋旧先頭の 1on1 状態ブロック（コメント1行＋let 2行）＋1on1 セクション（`/* ---- 1 on 1 マッチプレー タブ ... */` コメントから末尾まで）を切り取り移動。
   - (b) `js/results-team.js` 新設: ヘッダコメント1行＋チーム戦セクション（`/* チーム戦グループ（§5.2）...` コメントから `renderTeamNiadora` 閉じ括弧まで）を切り取り移動。
   - (c) index.html script タグ3行化＋`?v=` を PR 番号へ一括更新。
   - (d) CLAUDE.md 読込順記載の更新（§4.3）。
3. **禁止**: 関数名・変数名の改名／行の書き換え・整形／セクション内の並び替え／`roulette.js` 等 results ファミリー外のファイルへの変更（index.html の script タグ・?v= を除く）。
4. i18n キー追加なし・localStorage 非接触・§3/§4 非接触。

## 7. refactor-split.md への追記案（PM が正本へ反映・本ファイルは編集指示のみ）

`docs/handoff/2026-07-13-refactor-split.md` 末尾に以下を追記:

```markdown
---

## ★2026-08-30 追記（P3: results.js の3分割）
`js/results.js`（522行・38関数）を挙動不変で3ファイルに分割（設計: `docs/handoff/2026-08-30-results-split.md`）。方式は不変（通常 `<script src>` 順次読込・ESM化しない・関数名不変）。
- **js/results.js** … 共有表示状態（resGrp/resGame/pzMode/pzExcept/scOpen/pzCfgOpen）・2階層タブ骨格（renderResult/resGameTabs/setResGrp/setResGame）・ホール開封（viewGameN/viewGame/openNextHole ほか）・配分（renderStanding）・共通部品（renderScorecard/SC_COLGROUP/renderPrizeHero/rankCardNS/ruleBox）・個人戦（renderIndGame）
- **js/results-team.js** … チーム戦（renderTeamGame/renderTeamOverall/renderTeamNiadora・連携 tpAnnounce/tpAnnounceUI・tpFmtWin/tpShare/setTeamEventPts/tpEvPtsToggle・TP_EV_LABEL/TP_EV_ORDER）。tpAnnounceUI は roulette.js からも参照（実行時解決）
- **js/results-m1.js** … 1 on 1（m1RevealMode/m1Opened・m1Key/m1SetMode/m1Open系/m1Holes/renderMatch1v1Parts）。計算（m1Result 等）は calc.js・組合せ編集UIは players.js のまま
- 現行の読込順: **state → i18n → nav → home → basic → players → game → course → score → testdata → calc → results → results-team → results-m1 → roulette → backup → init**
- 既知の歴史的同居（今回は移動しない）: `leaderboard/renderPrizes/renderTeams/setPrize` は roulette.js 内に残置（移動は別Issue候補）
```

## 8. 別タスク候補（本PRではやらない）

- `roulette.js` に同居する結果表示ヘルパ `leaderboard`/`renderPrizes`/`renderTeams`/`setPrize` の results ファミリーへの移動（歴史的経緯。動作に問題はないため据え置き）。

## 9. 受け入れ条件

- [ ] `node tools/verify.mjs` 全PASS（構文／i18nパリティ／使用キー未定義参照／CSS孤立var／計算回帰 #3・Vegas）
- [ ] **行多重集合一致**: `node tools/verify.mjs --refactor origin/main`（P1 導入済みの場合）または §5 の代替コマンドで差分ゼロ。**新規行＝新設2ファイルの先頭コメント各1行のみ（計2行）**
- [ ] `node tools/regress.mjs` 全PASS（P1 で導入されている場合。未導入なら verify.mjs 内の計算回帰で代替）
- [ ] **関数インベントリ一致**: §3 の 38 関数＋モジュール変数 12 個が新3ファイル合計に過不足なく存在（P2 での増減があれば PR 本文に差異を明記して照合）
- [ ] Playwright スモーク（またはブラウザ手動）: テストデータ投入 → 結果タブで **個人戦（ニアドラ/グロス/ネット/ステーブル/オリンピック/キャロウェイ/握り）・チーム戦（総合/ニアドラ/グロス/ネット/HBH/ベスト2/ベガス/1on1/ルーレット）・配分** の全タブが描画され、コンソールエラー0。ホール開封（次へ/全部/リセット）・ニアドラ伏せトグル・1on1 一組ずつオープン・連携ボタンが各1回動作
- [ ] 分割前後で表示・数値・保存データ（`golfCompe_v1`）完全一致（挙動不変）
- [ ] index.html: script タグ3行化＋全 `?v=` が実装PR番号に一括更新
- [ ] CLAUDE.md の読込順記載が §4.3 のとおり更新
- [ ] 差分が「切り貼り＋新規ヘッダ2行＋index.html/CLAUDE.md の指定変更」のみ（reviewer が diff で確認）
