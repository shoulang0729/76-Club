# 設計：ルーレット — 取得Hをカード外の大型スタンディング行へ移設＋抽選カード sticky 固定＋勝敗色のチームカラー化 — 2026-08-20

- **区分**: 【設計案】（要望原文「状況表示画面の『x.xH』を1on1のように大きめにカードの外にレイアウトしたい」「ルーレット このカードまではスクロール禁止」「『確定して次のホール』の上部の余白はもっと狭く」「負けた時の塗りつぶしはグレーの薄いやつ・勝った時はチームカラーの薄いやつ・ウィンの文字色はチームカラー・引き分けはこれまで通り」は確定。移設＝右上H廃止・並び順・18H終了後の統合・sticky 方式/フォールバック・余白数値・淡色トークン値は本設計の既定＝実装ブロックなし。Issue/PR で変更があれば本ファイルを改訂）
- **追補（同日・追加要件）**: §5=抽選カード一式の sticky 固定（スクロールはスコア表のみ）／§6=メインボタン上部の余白詰め／§9=**勝敗塗り・WIN 文字色のチームカラー化（スクリーンショット確認済み・ユーザー確定）**。sticky は並行設計 `docs/handoff/2026-08-20-results-regroup.md` の**共通タブ段仕様（D13/D15・§8.1/§8.3「.result-sticky 1コンテナ同居」方式）に揃える**（あちらのファイルは編集しない。同 §5 の「roulette=renderRouletteTab(g0) 現行そのまま」は本 §5 が上書き）。§9 は `docs/handoff/2026-08-20-roulette-hero.md` §2.3 の「WIN=var(--win) 緑」も上書きする（あちらも編集しない）。
- **正本との関係**: §3/§4（計算・データモデル）に**非接触**（rlStandings・wonH の丸め・取得H集計 §11.3 は不変。表示のみ）。正本への追記なし。
  - **上書き宣言**: 正本 **§11.12 J①** の「取得Hを各抽選カードの右上に常時表示（`.rl-h`）」規定、および **§11.12 J③/M** の「18H終了後もチームカード（`.rl-final`＝チーム名＋右上H）を取得H降順で残す」規定を、本ファイルの「カード外・中央の大型スタンディング行」に**置き換える**。J②（スコア表の並び）・M のその他（rl-stand/rl-prog 全廃・WIN テキスト廃止・リセット head）は有効のまま。
- **先行例**: 1 on 1 のチーム対抗サマリ行 `.m1-teamsum`／hero `.m1-hero`（§11.14 適用第1号）と、ルーレット rl-head の大型勝敗 `.rl-res*`（2026-08-20-roulette-hero.md）。本件は同じ投影用トークン `--f-rl-name`/`--f-rl-score` を使う。
- **実装対象**: `js/roulette.js`（`renderRouletteTab`。§7 で `renderRouletteParts` へ分割改名）・`styles.css`（ルーレット節。**セレクタ名基準**＝行番号参照禁止。並行PRとコンフリクトしたら後発リベース）・**§5 のみ** `js/results.js`（renderResult の roulette 分岐＝results-regroup 実装後の形が前提）。**i18n 増減ゼロ**。

---

## 1. 前→後サマリ（数値つき）

| 項目 | 前（現行 main=7f20d68） | 後 |
|---|---|---|
| 取得H表示（プレー中） | 各チームカード（`.rl-panel`）右上の `.rl-h`（`--f-title`≈17px・@820: 22px・@1194: 24px・チームカラー） | **カード外・中央寄せの大型スタンディング行 `.rl-standing`**（`.rl-panels` の直下＝メインボタンの上）。チーム名=`--f-rl-name`（30→40/44/48px）・H値=`--f-rl-score`（44→64/68/76px）・チームカラー |
| カード右上の H | 常時表示（0Hから） | **廃止**（外出しに一本化。`.rl-top` はチーム名のみ・中央寄せ化） |
| 並び順 | カード=チーム登録順（H値はカード内なので並び概念なし） | スタンディング行内=**取得H降順**（同点はチーム登録順＝安定ソート。J②スコア表・J③最終順と同じ流儀） |
| 18H終了後（`R.cur>=18`） | `.rl-final` カード群（チーム名＋右上H・取得H降順） | **カード廃止**。リセット head → **同じ `.rl-standing` 行**（取得H降順）→ スコア表 |
| 値 | `wonH(ti)=Math.round((won[ti]||0)*10)/10` ＋ `H` | **完全一致**（0Hから常時・引分0.5刻み・ラベル H 据え置き＝P化しない） |
| スクロール挙動（§5） | ページ全体がスクロール（抽選カードも画面外へ流れる） | **抽選カード一式（`card rl-play`＝rl-head 大型表示・チームカード群・スタンディング行・メインボタン）まで sticky 固定**。スクロールはスコア表＋開発者メニューのみ |
| メインボタン上部の余白（§6） | `.rl-ctrl` margin-top 12px ＋ `.rl-info` min-height 24px ＋ margin-bottom 8px ＝ **計44px** | 4px ＋ `calc(var(--f-name)*1.3)`≈21px ＋ 4px ＝ **計約29px**（base。約15px 減・ボタン不動原則は維持） |
| カード勝敗塗り（§9） | 勝ち=緑淡 `--win-bg`＋緑 inset 枠／負け=赤淡 `--danger-bg`＋赤 inset 枠 | 勝ち=**自チームカラーの淡色**（`--tm-*-bg` 新設5色×2テーマ）＋チームカラー inset 枠／負け=**薄グレー**（`--surface-2`・inset 枠なし）。引分=橙・回転中フラッシュ（fwin/flose/ftie）=従来どおり |
| 大型「WIN」の文字色（§9） | 緑 `--win`（roulette-hero §2.3） | **勝ちチームのチームカラー**（単独勝ちのとき。複数チーム同点勝ちは緑のまま）。引分表示=橙のまま |

表示例（3チーム・レッド6H/ブルー9.5H/グリーン2.5H）: 前=各カード右上に小さく `6H` `9.5H` `2.5H` → 後=中央1行で「**チームブルー 9.5H　チームレッド 6H　チームグリーン 2.5H**」（各チームカラー・降順）。

## 2. 表示仕様（確定）

### 2.1 スタンディング行の生成（renderRouletteTab 内・両分岐で共用）

```js
// 取得H降順（同点=登録順・Array#sort は安定）。won/wonH は既存のまま再利用＝計算不変
const standRow = `<div class="rl-standing">${
  teams.map((tm,ti)=>({tm,ti,v:won[ti]||0})).sort((a,b)=>b.v-a.v)
    .map(({tm,ti})=>{ const col=rColor(tm.name);
      return `<span class="rl-st"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h" style="color:${col}">${wonH(ti)}<small>H</small></span></span>`; }).join('')
}</div>`;
```

- 単位 `H` は `.rl-hole` の `nH` と同じ **`<small>` 内リテラル**（言語非依存の記号扱い・i18n キーなし）。
- `wonH`・`rlStandings` の呼び出し回数/引数は現行のまま（`pending` は現行どおり未使用で可）。

### 2.2 配置

- **プレー中分岐（`R.cur<18`）**: `card rl-play` 内で `<div class="rl-panels">…</div>` の**直後**（`.rl-ctrl` の前）に `standRow` を置く。
  - rl-head 直下にしない理由: rl-head の大型勝敗（`.rl-res`）は**当該ホールの結果**、スタンディングは**前ホールまでの累計**（rlStandings は `h < R.cur` のみ集計）。隣接させると「WIN したのに H が増えていない」ように見えるため、カード群を挟んで分離する。累計が増えるのは「確定して次のホール」押下時＝メインボタン近くに置くと変化が視認しやすい。
- **18H終了後分岐（`R.cur>=18`）**: `card rl-play` ＝ リセット head（§11.12 M の形のまま）→ `standRow` のみ。`rl-panels`/`.rl-final` カードは**描かない**。スコア表は従来どおり下。

### 2.3 チームカードの変更（プレー中分岐）

- `rl-top` から `.rl-h` の span を削除: `<div class="rl-top"><span class="rl-team" style="color:${col}">${esc(tm.name)}</span></div>`。
- パネル外殻の `style` は §9.2 で `--rl-tc`/`--rl-tc-bg` を追加した形（`style="border-color:${col};--rl-tc:${col};--rl-tc-bg:${rColorBg(tm.name)}"`）が最終形。
- それ以外のカード内容（`.rl-name`/`.rl-scorebig`/`.rl-ev`/`.rl-act`・勝敗色 win/lose/tie・フラッシュ fwin/flose/ftie）は不変。

### 2.4 スタイル（styles.css ルーレット節・セレクタ名基準）

追加（`.rl-panels` ルールの近くに。数値はトークンのみ＝`--f-rl-*` の @media 再定義に自動追従・新規 @media 追記不要）:

```css
/* 取得Hスタンディング行（カード外・中央・取得H降順。2026-08-20-roulette-standings.md／§11.14） */
.rl-standing{display:flex;justify-content:center;align-items:baseline;flex-wrap:wrap;
  column-gap:clamp(14px,4vw,40px);row-gap:2px;text-align:center;margin-top:12px}
.rl-st{display:inline-flex;align-items:baseline;gap:6px;min-width:0;max-width:100%}
.rl-st-team{font-size:var(--f-rl-name);font-weight:var(--w-bold);line-height:1.15;overflow-wrap:anywhere;min-width:0}
.rl-st-h{font-size:var(--f-rl-score);font-weight:var(--w-bold);line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.rl-st-h small{font-size:var(--f-rl-name);font-weight:var(--w-bold);margin-left:1px}
```

変更:

- `.rl-top` … `justify-content:space-between` → `justify-content:center`（子がチーム名のみになるため。他プロパティ不変）。
- `.rl-ctrl` … `margin-top:12px` → `margin-top:4px`（§6 余白詰め）。
- `.rl-info` … `min-height:24px;margin-bottom:8px` → **`line-height:1.3;min-height:calc(var(--f-name)*1.3);margin-bottom:4px`**（他プロパティ不変。min-height と line-height を同値にすることで、`rl.repNoScore` の出現/消滅・全ブレークポイント（--f-name 16/17px）でボタンが1pxも動かない。`&nbsp;` プレースホルダは現行のまま維持）。

削除（孤立化する旧セレクタ。**同名の @media 内再定義も含む**）:

- `.rl-h`（基本ルール＋ `@media(min-width:820px)` 内 `.rl-h{font-size:22px}` ＋ iPad 系 @media 内 `.rl-h{font-size:24px}`）。
- `.rl-final`（18H終了後カード廃止に伴い未参照化）。
- コメント「§11.12 J①: カード上段＝チーム名（左）＋取得H（右上…）」は本ファイル参照に書き換え。

### 2.5 折返し・チーム数・幅320px

- 2〜3チーム（rTeams≥2 が前提。`rl.need2` 分岐は不変）。行は flex-wrap で、320px 幅では 1チーム=1行に自然折返し（`.rl-st` ごとに名前+H値が離れないよう inline-flex。長いチーム名は `overflow-wrap:anywhere` で名前側だけ折返し）。横スクロールを発生させない。
- 順位が変わると行内の位置が入れ替わる（スタンディングの意味どおり。スコア表 J②・最終表示と同じ降順で一貫）。

## 3. i18n（増減ゼロ）

- 追加・削除・値変更なし。`H` はリテラル（§2.1）。ja/zh/en パリティ現状維持で `node tools/verify.mjs` を通す。

## 4. 触らない範囲（load-bearing）

- 計算・進行系すべて: `rlStandings`（won/pending・1/w.length の山分け）・`rlHoleScore`/`rlEvery`・`rlMarks`/`rlScorecard`・`rlTick/rlFlash/rlBeginSpin/rlStop`・`rlChange/rlChallenge*`・`rlNextHole/rlCanAdvance/rlReset`・開発者メニュー・§3計算・§11.3 ハーフ制。
- rl-head の構成（`nH Par n`・大型勝敗 `.rl-res*`・リセット右端）・カード勝敗色とフラッシュ・`--f-rl-*` トークン値・localStorage 全キー・`golfCompe_v1` 構造・非ESM/inline onclick 方針。
- 将来のチーム戦勝ち点（2026-08-20-team-points.md・`points.roulette` 廃止→teamRankPts）は本件と独立（あちらは配点、こちらは取得H表示の見た目のみ。rlStandings のシグネチャ不変で両立）。
- **sticky 共通側（§5 実装時）**: `.result-sticky` の宣言（top:95px・z-index:15）・`--tab-h` の定義値・header/.mainnav の sticky・タブ2段の中身は **results-regroup 側の実装のまま変更しない**（本件は同居する head を1つ足し、`.result-sticky .rl-play` ルールを追加するのみ）。

## 5. 追補①: 抽選カード一式の sticky 固定【追加要件・2026-08-20】

要望原文「ルーレット このカードまではスクロール禁止だね」＝ **`card rl-play`（rl-head のホール番号/WIN 大型表示・チームカード群・スタンディング行・rl-ctrl のメインボタンまで）を固定**し、スクロールするのはスコア表（rlScorecard）＋開発者メニューだけにする。

### 5.1 方式（results-regroup の共通仕様に揃える＝D15 と同型）

- **多段 sticky にしない**。rl-play は可変高（チーム数 2/3・challengeFrom 展開・rl-info・ホール数字の桁）なので top 定数の連鎖が組めない（regroup §8.3 と同じ理由）。→ **`.result-sticky` コンテナ（top:95px・z-index:15・不透明 var(--bg)・既存宣言のまま）に rl-play を同居**させる。
- **Parts 分割（regroup の m1 と同じパターン）**: `renderRouletteTab(g)` を `renderRouletteParts(g)`（返り値 `{head, body}`）に改名・分割する。
  - `head` = `<div class="rlwrap">` ＋ `card rl-play`（中身は §2 の形のまま）＋ `</div>`
  - `body` = `<div class="rlwrap">` ＋ rlScorecard ＋ devMenu ＋ `</div>`（`.rlwrap` は max-width:900px/margin:auto のスケールを両側に効かせるため head/body 双方に付ける）
  - ガード（`rl.need2`・teams<2）は `{head:'', body:空状態カード}`＝**空状態は固定しない**（regroup D15 の m1 ガードと同じ流儀）。
  - renderResult 側（regroup 実装後の `resGame.team==='roulette'` 分岐）: m1 と同様、sticky コンテナ末尾に head を同居させ body を下に置く。**regroup §5 の「roulette＝renderRouletteTab(g0) 現行そのまま」はこの節が上書き**（あちらのファイルは編集しない）。
- **18H終了後分岐（R.cur>=18）も同じ分割**: head=rl-play（リセット head＋スタンディング行・高さ約130px）を固定・body=スコア表。全環境でフォールバック（§5.2）発動なし。
- devMenu は body 側＝スクロール領域（現行もスコア表の下・§11.14「幹事の操作UIは控えめ」に合致・位置不変）。
- 追加 CSS（セレクタ名基準）:

```css
/* 抽選カード sticky（§5。コンテナは results-regroup の .result-sticky を共用＝top/z-index の新設なし） */
.result-sticky .rl-play{margin-bottom:0;
  max-height:calc(100dvh - 119px - 2*var(--tab-h,40px));overflow-y:auto;overscroll-behavior:contain}
```

  - `margin-bottom:0` … `.rlwrap .card` の margin-bottom:10px が sticky 底に透間を作るのを防ぐ（regroup §8.3 の `.result-sticky .card{margin-bottom:0}` が先に入っていれば重複でも無害）。
  - `max-height` … §5.2 フォールバック。`119px = コンテナ top 95px ＋ コンテナ内でタブ2段が占める固定余白 24px（regroup §8.1 の 8+6+2+8）`、タブ本体は `2*var(--tab-h)`（トークンは regroup/home-subtabs の先行PRが :root 定義・**本PRは参照のみ**・フォールバック値 40px）。
  - `overflow-y:auto` は **sticky コンテナの「子」**に付ける＝sticky 無効化（sticky 要素自身・祖先の overflow）に該当しない（regroup §8.1 の `.subtab-games{overflow-x:auto}` と同型）。
  - 透け防止: rl-play は `.card`＝不透明 `var(--card)` 面。@820 の max-width:900px 左右余白はコンテナの不透明 `var(--bg)` 地。追加不要。

### 5.2 フォールバック（固定領域が画面高を超える狭幅・低背ケース）

固定領域がはみ出す環境では、rl-play が `max-height` でクランプされ**カード内スクロール**になる（sticky は解除しない）。STOP／チェンジ／チャレンジ／「確定して次のホール」へは常に到達できる。スコア表はその下＝可視領域が実質なくなる環境もあるが、既定ユース（§11.14: 縦持ちスマホ〜iPad・投影）で成立していれば割り切る（regroup §8.4 の横持ち小型端末の割り切りと同じ）。

### 5.3 検算（rl-play 高さ概算・§6 の余白詰め適用後・2チーム=カード横並び）

| ブレークポイント | rl-play 概算 | 内訳（pad / head / panel / standing / ctrl+btn） |
|---|---|---|
| base（320〜819px） | **≈408px** | 24 / 58 / 189 / 56 / 81 |
| base・3チーム（320px 幅=パネル2段） | ≈607px | パネル +199 |
| @820〜（--f-rl 66/40/64） | ≈506px | 24 / 76 / 237 / 76 / 93 |
| @1194（70/44/68・tab-h 48） | ≈530px | — |

上部固定（header≈50＋mainnav≈45＋タブ2段 24+2×tab-h）＝base ≈199px／@1194 ≈211px として、スコア表の可視領域:

| 画面 | 2チーム | 3チーム |
|---|---|---|
| スマホ縦 390×844 | ≈237px（十分） | ≈38px（クランプ境界） |
| スマホ縦 375×667（SE級） | ≈60px（1〜2行） | **クランプ発動**（rl-play 内スクロール・max-height≈468px） |
| iPad 縦 768×1024 | ≈311px（十分） | ≈110px |
| iPad 横 1194×834 | ≈93px（数行） | **クランプ発動** |

### 5.4 依存関係

- **本節（§5）のみ results-regroup 実装PRのマージ後に着手**（`.result-sticky` コンテナ・resGame 分岐・`--tab-h` トークンが前提）。§1〜§4・§6（スタンディング行・余白詰め）は現行 `renderResult`（js/results.js の `resultSub==='roulette'` 分岐）のままで実装可＝先行できる。
- regroup 側が万一 roulette 分岐の形を変えていたら、**後発（本PR）が regroup の実装に合わせる**（regroup §8.2 注記と同じ運用）。

## 6. 追補②: メインボタン上部の余白詰め【追加要件・2026-08-20】

要望原文「『確定して次のホール』の上部の余白はもっと狭くして」。CSS 変更は §2.4 に併記済み。前→後:

| 区間 | 前 | 後 |
|---|---|---|
| `.rl-ctrl` margin-top（スタンディング行→rl-info） | 12px | **4px** |
| `.rl-info` 高さ | min-height 24px（line-height 未指定） | **min-height:calc(var(--f-name)*1.3) ≈21px**（line-height:1.3 明示・同値） |
| `.rl-info` margin-bottom（→メインボタン） | 8px | **4px** |
| **合計（スタンディング行下端→ボタン上端）** | **44px** | **≈29px**（base）／≈30px（@768・f-name17px） |

- **ボタン不動原則は維持**: rl-info は min-height=line-height 同値＋`&nbsp;` プレースホルダで、`rl.repNoScore` の出現/消滅・スピン開始/停止・チャレンジ選択のどの状態遷移でもメインボタンの縦位置が動かない。
- `.rl-standing` の margin-top:12px（カード群との間）・ボタン下の `rl.useChanges` 注意文（margin-top:6px・出現時のみ）は不変。

## 7. 受け入れ条件

1. プレー中（0H目含む）、抽選カード群とメインボタンの間に中央寄せのスタンディング行が常時表示される: 各チーム「{チーム名} {x.x}H」・チームカラー・名前=`--f-rl-name`／H値=`--f-rl-score` 級（@820/@1194/@1366 の自動拡大に追従）・取得H降順（同点は登録順）。
2. 値は従来のカード右上表示と完全一致（`wonH`＝0.5刻み・0Hから。例: 5H終了時点でレッド3勝・引分1 → 「チームレッド 3.5H」）。
3. 各チームカードの右上に H 表示がない（`.rl-h` 不存在）。カード上段はチーム名のみ・中央寄せ。カードのその他表示（代表名・大型スコア・チェンジ/チャレンジ・勝敗色・回転フラッシュ）は不変。
4. 18H終了後: リセットボタン head → スタンディング行（取得H降順・最上位が優勝）→ ルーレットスコア表、の順で表示され、`.rl-final` カードは存在しない。表示される取得H値・順序は改修前の最終カード群と完全一致。
5. rl-head の「nH Par n」・大型勝敗（WIN/引分）・リセット位置は不変。スタンディング行と `.rl-res` が同時に見えても位置が分離している（head 内 vs カード下）。
6. 320px 幅で横スクロールが発生しない（チームごとに折返し・長いチーム名は名前内で折返し）。3チームでも崩れない。
7. **回帰なし**: rlStandings・配点・スコア表の印（rwin/rtie/adopt）・`node tools/verify.mjs` 通過（i18n パリティ・CSS 孤立 var() を含む）。i18n キー集合の増減ゼロ。濃色ベタ塗りの新設なし。`.rl-h`/`.rl-final` の CSS 残骸なし。
8. **sticky（§5・PR-B）**: ルーレットタブでどれだけ下へスクロールしても、ヘッダ・主ナビ・タブ2段＋**rl-play 一式**（ホール番号/大型勝敗・チームカード群・スタンディング行・メインボタン）が画面上部に固定され、スコア表＋開発者メニューだけがスクロールする。固定位置のままスピン開始/STOP・チェンジ/チャレンジ・「確定して次のホール」・リセットが機能し、回転アニメ（rlTick の DOM 更新）も固定位置で動く。下を通るスコア表が透けない。
9. **フォールバック（§5.2）**: 固定領域が画面高を超える環境（例 375×667 の3チーム・iPad 横の3チーム）では rl-play 内スクロールで全ボタンに到達できる。sticky は解除されない（overflow は sticky コンテナの子のみ＝タブ固定に影響なし）。空状態（rl.need2）は固定されない。
10. **18H終了後の sticky（§5）**: rl-play（リセット＋スタンディング行）が固定・スコア表のみスクロール。クランプ発動なし。
11. **余白（§6・PR-A）**: スタンディング行下端〜メインボタン上端が base で約29px（前44px）。`rl.repNoScore` の出現/消滅・スピン開始/停止・チャレンジ相手選択のどの遷移でもメインボタンの縦位置が動かない（min-height=line-height 同値・`&nbsp;` 維持）。
12. **勝敗塗り（§9・PR-A）**: 単独勝ちホール確定時、勝ちカード=自チームカラー淡色塗り（`--tm-*-bg`）＋チームカラー inset 3px 枠、負けカード=`--surface-2` 塗り・inset 枠なし、rl-head の WIN=勝ちチームカラー。ライト/ダーク両テーマで塗りと本文（ink）のコントラストが保たれる。
13. **引分・回転中は不変（§9）**: 引分＝全カード橙塗り＋橙枠＋大型「引き分け（各0.5H）」橙、回転中フラッシュ fwin/flose/ftie（緑/赤/橙点滅）、スコア表の印（rwin/rtie/adopt）は完全に従来どおり。
14. **複数チーム同点勝ち（§9）**: 最小タイの各カードがそれぞれ自チームカラー淡色で塗られ、WIN は緑（`--win`）1つのまま。
15. **グレーチーム・色弱（§9.4）**: グレーチームの勝ち淡色（`--tm-gray-bg`）と負け薄グレー（`--surface-2`）が、inset 枠の有無（勝ち=border3px＋inset3px の計6px 相当）と WIN 文字で色に頼らず判別できる。`node tools/verify.mjs` 通過（`--rl-tc`/`--rl-tc-bg` は `.rl-panel` に既定定義済み＝孤立 var なし）。

## 8. 推奨PR（2段階・§5.4 の依存関係による分割）

- **PR-A `feat/roulette-standings-hero`**（先行・regroup 非依存）: §1〜§4＋§6＋**§9** ＝ スタンディング行への移設・勝敗塗り/WIN 色のチームカラー化（`js/roulette.js` renderRouletteTab＋rColorBg 追加）＋余白詰め・`.rl-h`/`.rl-final` 削除・`--tm-*-bg` トークン追加（`styles.css` :root/dark＋ルーレット節）。現行 renderResult のまま実装可。
- **PR-B `feat/roulette-sticky`**（後続・**results-regroup 実装PRマージ後**）: §5 ＝ `renderRouletteParts` 分割（`js/roulette.js`）＋ renderResult の roulette 分岐で head を `.result-sticky` に同居（`js/results.js`）＋ `.result-sticky .rl-play` ルール追加（`styles.css`）。
- 並行中の固定メニュー化PR・regroup 実装PRと styles.css が重なるため、**コンフリクト時は本件側がリベース**（セレクタ単位の追加/削除なので機械的に解決可能）。js/roulette.js は本件専有。

## 9. 追補③: 勝敗塗り・WIN 文字色のチームカラー化【追加要件・2026-08-20・ユーザー確定（スクリーンショット確認済み）】

要望原文「負けた時の塗りつぶしの色はグレーの薄いやつ、勝った時の塗りつぶしの色はチームカラーの薄いやつにしよう。ウィンの文字色はチームカラーにしよう。引き分けの時はこれまで通り。」

### 9.1 チームカラー淡色トークン（新設・:root＋dark 上書きのトークン管理原則どおり）

`--win-bg`（light `#d5f5e3` / dark `#123a28`）と同じ「明度高（light）／地色寄りの暗色面（dark）・低彩度」の作りで5色を定義:

| トークン | light | dark | 元色（light/dark） |
|---|---|---|---|
| `--tm-red-bg` | `#fbe3df` | `#45231d` | `--tm-red` #c0392b / #ff8b7a |
| `--tm-blue-bg` | `#dcecf7` | `#16344a` | `--tm-blue` #2471a3 / #62b0e8 |
| `--tm-green-bg` | `#daf0e2` | `#173f2b` | `--tm-green` #186a3b / #4fcf8c |
| `--tm-yellow-bg` | `#f9ecd2` | `#423512` | `--tm-yellow` #b9770e / #e0b04a |
| `--tm-gray-bg` | `#e7ecf1` | `#242f40` | `--tm-gray` #5d6d7e / #9fb0c4 |

- 定義場所: `:root` の `--tm-*` 行の直後に5つ＋ `html[data-theme="dark"]` の `--tm-*` 行の直後に5つ（**面の濃色ベタ塗り禁止の範囲内**＝ light は明度 92% 級・dark は win-bg 同等の暗色面。本文 ink とのコントラストは win-bg/tie-bg と同水準）。
- これらは **JS（inline style）からのみ参照**する。verify.mjs の孤立 var() チェックは「styles.css 内で*参照*されるが未定義」のみ検出するため、CSS 内未参照の定義は問題にならない。

### 9.2 チームカードの勝敗塗り（js/roulette.js＋styles.css）

- **js**: `rColor` の直後にヘルパー追加＝ `function rColorBg(name){ return rColor(name).replace(')','-bg)'); }`（`'var(--tm-red)'`→`'var(--tm-red-bg)'`。nav.js の tmColor は触らない＝固定メニュー化PRと非干渉）。通常分岐のパネルに custom property を渡す:
  `style="border-color:${col};--rl-tc:${col};--rl-tc-bg:${rColorBg(tm.name)}"`（全パネルに常時付与。クラス付け＝stCls のロジックは不変）。
- **css**（セレクタ名基準）:

```css
.rl-panel{--rl-tc:var(--win);--rl-tc-bg:var(--win-bg)}          /* 既定値＝verify の孤立var()対策兼フォールバック */
.rl-panel.win{background:var(--rl-tc-bg);box-shadow:0 0 0 3px var(--rl-tc) inset}   /* 前: var(--win-bg)/var(--win) */
.rl-panel.lose{background:var(--surface-2);box-shadow:none}                          /* 前: var(--danger-bg)/赤 inset */
```

- **不変**: `.rl-panel.tie`（橙塗＋橙 inset）・回転中フラッシュ `.rl-panel.fwin/.flose/.ftie`（緑/赤/橙の点滅予告＝従来どおり）・スコア表の印（rwin/rtie/adopt）・`--win/--red/--tie` 等の既存トークン値。
- 負けの薄グレーは**既存トークン `--surface-2`**（light `#f2f3f4` / dark `#1c2739`）を再利用＝新設なし。inset 枠は外す（負けは沈ませ、勝ちの太枠（border 3px＋inset 3px≒計6px）との構造差をつくる）。

### 9.3 大型「WIN」の文字色（rl-head・roulette-hero §2.3 の上書き）

- **単独勝ち**（`wi.length===1`）: `<span class="rl-res-w" style="color:${rColor(teams[wi[0]].name)}">WIN</span>`＝勝ちチームカラー。
- **複数チーム同点勝ち**（3チーム中2チームが最小タイ等）: WIN は1つのため単色にできない → **inline なし＝既定の緑 `var(--win)` のまま**（`.rl-res-w` の宣言は残す）。チーム名 span は従来どおり各チームカラーで並ぶ。
- **引分**: `rl.tie` 橙（`.rl-res-tie`）＝完全に従来どおり。

### 9.4 検算（グレーチーム・黄チーム・色弱）

- **グレーチーム勝ち vs 負け薄グレー**: `--tm-gray-bg`（青みグレー #e7ecf1/#242f40）と `--surface-2`（無彩色 #f2f3f4/#1c2739）は色相が近い → 色以外の判別手段＝**勝ちのみ inset 太枠（チームカラー3px＋border で計6px 相当）・負けは枠なし**＋ rl-head の **WIN 文字**（グレーチーム色）で担保。
- **黄チーム勝ち vs 引分橙**: `--tm-yellow-bg` と `--tie-bg` は近色 → 判別は**文字**（WIN vs 「引き分け（各0.5H）」）と**発生パターン**（引分=全カード同時橙／勝ち=勝者のみ淡色）で担保。
- **色弱対応**: 勝敗は 塗り色＋枠の太さ差＋文字（WIN/引分文言）の3重で伝達＝「色だけに頼らない」原則（§11.14）維持。

### 9.5 機能色原則（勝ち=緑）との関係【重要・原則の画面限定改訂】

- CLAUDE.md ★load-bearing「機能色の意味（勝ち=緑/引分=橙/採用=枠/危険=赤）は保持」および正本 §11.14 に対し、**ルーレット画面の「確定時の勝ち表示（カード塗り・WIN 文字）」に限りチームカラーへ改訂**する（2026-08-20 ユーザー確定要件）。引分=橙・危険=赤・採用=枠・回転中予告の緑/赤/橙・スコア表の緑/橙、および**他画面の勝ち=緑はすべて不変**。文字併記（WIN）があるため「色だけに頼らない」原則は維持される。
- **CLAUDE.md／正本の文言更新の判断**: 本実装PR（PR-A）には**含めない**（implementer は docs/設計書・CLAUDE.md を触らない運用）。**PM が docs 単独コミットで** CLAUDE.md の機能色行に注記を1つ追加することを**推奨**: 「勝ち=緑（**例外: ルーレットの確定時勝ち表示はチームカラー**＝2026-08-20-roulette-standings.md §9）」。正本 §11.14 は §3/§4 非接触のため追記せず、本ファイルの上書き宣言（冒頭）で足りる。
