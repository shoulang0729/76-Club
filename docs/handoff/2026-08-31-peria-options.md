# 設計書：ダブルペリアの集計オプション2つ（ダブルパーカット／HDCPマイナス許可）（2026-08-31）

- 日付: 2026-08-31
- 種別: 計算仕様の**オプション追加**（既定OFFで現行と完全同一）
- 対象: `js/calc.js`（`periaHdcp` のみ）・`js/state.js`（`newGame`/`migrate`）・`js/game.js`（ペリア設定カード＋描画1箇所）・`js/i18n.js`（3言語×3キー）・`tools/regress.mjs`（新規フィクスチャ1件）
- **正本との関係**: `docs/handoff/2026-07-12-golf-compe-web.md` の **§3（計算仕様）／§4（データモデル）に触れる**。正本には **§11.22** として追記する（追記案文は本書 §9・そのまま転記）。本書は §11.2／§11.12 H を**上書きせず、その上にオプション分岐を足す**（両オプション OFF ＝ §11.12 H の現行式そのもの）。
- **★load-bearing 宣言**: `periaHdcp` は §3 計算仕様の中核。本 PR は「OFF のとき完全に同一（regress 差分ゼロ）」を最重要の受け入れ条件とする。

---

## 1. 背景（PM が実データで調査済み・本設計の前提）

ユーザーが参加したコンペで、幹事会社の集計 Excel と 76-Club のネットが食い違った。Excel（`score` シート）の HDCP 計算式を解析した結果：

```
隠しホールごとの寄与 = MIN(par, スコア − par) × 1.2      ← 隠し12ホールのみ
HDCP = MIN( Σ(上記), 36 )
ネット = エブリ適用後グロス − HDCP
```

- `MIN(par, スコア−par)` は **ダブルパーカット**（1ホールの打数をパーの2倍で頭打ち）と数学的に同じ。
- `MIN(…, 36)` は **HDCP 上限36**（76-Club の `periaCap` に相当・既に設定可能）。
- **下限クランプ（`MAX(…,0)`）が無い** ＝ 隠し12ホールを好スコアで回ると **HDCP がマイナス**になり、ネットがグロスより悪くなる。
- 係数 ×1.2 は 76-Club の一般式 `(Σ12 × 1.5 − 規定打数) × 0.8` と **隠し12ホールの par 合計が48・コース規定打数が72のとき数学的に同一**（§2.3 で証明）。

### 1.1 現行 `js/calc.js` の `periaHdcp`（変更前・行9-14）

```js
function periaHdcp(g,pid){
  let h=0; g.hidden.forEach((hid,i)=>{ if(hid){ const v=adjHole(g,pid,i); if(v!=null)h+=v; } });
  let hd=(h*1.5 - parTotal(g))*g.periaCoef;
  if(hd<0)hd=0; if(g.periaCap!=null && hd>g.periaCap)hd=g.periaCap;
  return Math.round(hd*10)/10;
}
```

不足しているのは次の2点だけ（係数 `periaCoef`＝既定0.8・上限 `periaCap`＝既定 null は**既にゲーム設定タブでコンペごとに設定可能**）。

1. **ダブルパーカットが無い**（オプションも無い）
2. **負の HDCP を 0 に固定クランプ**している（オプションも無い）

### 1.2 ユーザー確定事項（PM 確認済み）

> 既定は現行のまま（両方OFF・上限なし）で、必要なコンペだけONにする

⇒ **既定値では現行と完全に同一の結果**（`node tools/regress.mjs` 差分ゼロ）。ONにしたコンペだけ挙動が変わる。

---

## 2. 計算仕様（§3 追補・★load-bearing）

### 2.1 変更後の `periaHdcp`（実装はこの通り・最小差分）

```js
/* ダブルペリアHDCP（★§11.12 H・2026-08-19に算定基準を変更＝§3/§11.2 を上書き）:
   隠し12ホールの合計を「エブリ適用後スコア」(adjHole) 基準で取る。
   ＝①エブリを各ホールに先に反映 → ②その合計からHDCPを算定 → ③ネット＝(エブリ後グロス)−(このHDCP)。
   エブリ選手はHDCPが小さくなり（0クリップされやすく）ネットが上がる。二重控除にはならない。
   ★§11.22（2026-08-31・peria-options）幹事会社方式に合わせる任意オプション2つ。両方OFF（既定）＝上式と完全に同一:
     ①g.periaDblPar  … 隠しホールの集計値をパーの2倍で頭打ち（エブリ適用後の値に min。グロスは頭打ちしない）
     ②g.periaAllowNeg … 0クリップを外す（隠し12ホールが全て入力済みのときのみ＝経過表示の暴走防止）。上限 periaCap の判定は従来どおり */
function periaHdcp(g,pid){
  let h=0; g.hidden.forEach((hid,i)=>{ if(hid){ const v=adjHole(g,pid,i);
    if(v!=null) h += g.periaDblPar? Math.min(v, 2*g.par[i]) : v; } });
  let hd=(h*1.5 - parTotal(g))*g.periaCoef;
  const neg = g.periaAllowNeg && g.hidden.every((hid,i)=>!hid || adjHole(g,pid,i)!=null);
  if(hd<0 && !neg)hd=0;
  if(g.periaCap!=null && hd>g.periaCap)hd=g.periaCap;
  return Math.round(hd*10)/10;
}
```

**差分は 3 行だけ**（隠しホール加算の三項演算子／`neg` の 1 行／`if(hd<0)` の条件追加）。`if(hd<0)hd=0;` と `if(g.periaCap!=null…)` が同一行だったものを 2 行に分けるのみで、上限判定のロジックは不変。

### 2.2 明確化すべき規律（実装者はここを守る）

| # | 規律 | 理由・前例 |
|---|---|---|
| D1 | **ダブルパーカットは隠しホールの集計（HDCP算定）にのみ適用**。**グロスにはカットを適用しない** | Excel も `AT列`＝素の合計。大学対抗 `uvGrossA`（グロスはカットしない）と同じ規律 |
| D2 | エブリ ON のとき、カットの `min` 判定は **エブリ適用後の値**で行う（`adjHole` の戻り値に対して `Math.min(v, 2*g.par[i])`） | §11.12 H（HDCP はエブリ適用後基準）／`uvHdcpA` と同順。逆順（カット→エブリ）だと二重控除気味に HDCP が小さくなる（§5.5 に数値例） |
| D3 | 上限 `periaCap` の判定は従来どおり **カット/マイナス許可とは独立**。マイナス側に下限は設けない（`periaCap` は上限専用） | 既存フィールドの意味を変えない |
| D4 | 丸め `Math.round(hd*10)/10` は**変更しない**（負値も同じ関数を通す） | 既存挙動維持。`periaCoef=0.8` では `hd*10` は必ず整数になるためタイは発生しない |
| D5 | **マイナス許可は「隠し12ホールが全て入力済み」のときのみ有効**（未入力が1つでもあれば従来どおり 0 クリップ） | §2.4 の決定。経過ラウンド／段階開封中の表示破綻を防ぐ |
| D6 | **大学対抗（`uv*` 関数群）には一切連動させない**。`uvHdcpA` は規定準拠の独立計算（Wパーカット常時ON・上限 男36/女40・係数0.8固定）のまま | §11.20 が `periaCoef`/`periaCap` を非連動にしている前例と完全に同じ。`g.periaDblPar`/`g.periaAllowNeg` を `uv*` から参照しない |
| D7 | 他の種目関数（`stablefordPts`/`olympicPts`/`callawayHdcp`/`callawayNet`/`holesWon`/`vegas*`/`m1*`/`niadora*`/`customPts`）には触れない | §3 load-bearing |

### 2.3 「×1.2」と 76-Club 一般式の同値性（証明・PM 調査の裏取り）

ホール `i` のパーを `p_i`、エブリ適用後スコアを `s_i`、隠し12ホールの集合を `H`、コース規定打数を `P` とする。

```
Σ_{i∈H} min(s_i, 2·p_i) = Σ_{i∈H} ( min(s_i − p_i, p_i) + p_i ) = X + P_H
   ただし X = Σ_{i∈H} min(p_i, s_i − p_i)   ← Excel の「隠しホールごとの寄与」の素、P_H = 隠し12ホールの par 合計

76-Club 式 = (Σ min(s_i, 2p_i) × 1.5 − P) × 0.8
           = (1.5·X + 1.5·P_H − P) × 0.8
           = 1.2·X + (1.5·P_H − P) × 0.8
```

`P_H = 48` かつ `P = 72` のとき第2項 = `(72 − 72) × 0.8 = 0` ⇒ **76-Club 式 = 1.2·X = Excel 式**。

76-Club の隠し12ホール抽選は `pickHidden12`（`docs/handoff/2026-08-20-hidden12-balance.md`）で **Par3×4・Par4×4・Par5×4 ＝ par 合計48** を保証するので、標準的な par72 コースでは常に一致する。非標準コース（par 71 等）では一般式（`parTotal` を使う 76-Club 式）の方が妥当なので、**実装は一般式のまま**とし ×1.2 のハードコードはしない。

### 2.4 決定 D5：マイナス許可に「隠し12H全入力」ゲートを付ける【本設計の判断・PM 確認事項①】

ゲート無しだと、経過ラウンド／表彰式の段階開封で `h` が小さいまま `(h*1.5 − 72) × 0.8` が大きな負値になり、**ネットがグロスより大幅に大きい値として投影される**（下表）。Excel 方式はラウンド完了時の集計方法であり、途中経過に意味は無い。

par72・隠し12H の選手（最終グロス67・隠し12H合計43＝HDCP −6.0）の途中経過（`periaDblPar:true, periaAllowNeg:true, periaCap:36`）：

| 入力ホール数 | エブリ後グロス | ゲート**あり**（本設計） HDCP / ネット | ゲート**なし** HDCP / ネット |
|---|---|---|---|
| 0H | 0 | **0 / 0** | −57.6 / 57.6 |
| 3H | 9 | **0 / 9** | −46.8 / 55.8 |
| 9H | 32 | **0 / 32** | −20.4 / 52.4 |
| 15H | 54 | **0 / 54** | −8.4 / 62.4 |
| 17H（隠し12H が揃う） | 63 | **−6 / 69** | −6 / 69 |
| 18H（完了） | 67 | **−6 / 73** | −6 / 73 |

**18H 完了時の値は同一**＝Excel 再現性は損なわれない。ゲートは `periaAllowNeg` ON の経過表示のみに効き、OFF 時は一切通らない。
（PM が「ゲート不要・素直に `if(hd<0)hd=0` をスキップするだけ」を選ぶ場合は `const neg = g.periaAllowNeg;` の 1 行に置換すればよい。他の記述は全て有効。）

---

## 3. データモデル（§4 追補）

### 3.1 追加フィールド（**localStorage キーは増やさない**・`golfCompe_v1` 内の per-game フィールド）

| キー | 型 | 既定 | 位置 | 意味 |
|---|---|---|---|---|
| `g.periaDblPar` | boolean | `false` | `newGame()` の `periaCoef:0.8, periaCap:null,` の直後（同じ行に並べる） | 隠しホール集計にダブルパーカット（打数をパーの2倍で頭打ち）を適用 |
| `g.periaAllowNeg` | boolean | `false` | 同上 | HDCP のマイナスを許可（0 クリップを外す） |

命名根拠：既存の `periaCoef` / `periaCap` と同じ **`peria` プレフィックス＋短い camelCase**、per-game のトップレベル真偽値（`g.univ.every` と同型の「コンペごとのオプションフラグ」）。`DblPar` は既存語彙 `g.vegas.cap==='doublePar'`（ダブルパー上限）に合わせた略記。

### 3.2 `newGame()`（`js/state.js`）

```js
    periaCoef:0.8, periaCap:null, periaDblPar:false, periaAllowNeg:false,   // §11.22 幹事会社方式オプション（既定OFF＝従来と同一）
```

### 3.3 `migrate()`（`js/state.js`・`(s.games||[]).forEach(g=>{ … })` の中）

`if(g.announced===undefined) g.announced={};` の直前に 2 行追加（既存の per-key バックフィル慣例と同型）：

```js
    if(g.periaDblPar===undefined) g.periaDblPar=false;      // §11.22（既存ゲームは従来挙動のまま）
    if(g.periaAllowNeg===undefined) g.periaAllowNeg=false;
```

> 補足：`periaHdcp` 側は `g.periaDblPar?` / `g.periaAllowNeg &&` の**真偽値評価**なので、`undefined` でも従来挙動になる（migrate 前・`viewGame` コピー等でも安全）。migrate 補完は UI の checked 状態と backup JSON の可読性のため。

### 3.4 `dupGame()`（`js/basic.js:47`）

`JSON.parse(JSON.stringify(curGame()))` の**ディープコピーなので変更不要**。両フラグは複製先に引き継がれる（＝「同じ集計方式でもう1コンペ」が自然に動く）。

### 3.5 backup（`js/backup.js`）

- `exportData()` は `state` 丸ごとの JSON なので**変更不要**（新フィールドは自動的に含まれる）。
- `importData()` は `migrate(s)` を通すので、**旧バックアップ（フィールド無し）を読み込むと両方 false 補完**＝従来挙動。**変更不要**。

### 3.6 スキーマ非変更の確認

- `localStorage` キー集合は不変：データ `golfCompe_v1` ／ 表示状態 `golfCompe_lang`・`golfCompe_theme`・`golfCompe_channel`・`golfCompe_seenTop`。**新キーを作らない**。
- `players` スキーマ・`formats`・`points`・`announced`・`teams`・`prizes` は不変。
- 新しい種目（フォーマット）ではないので `g.formats` / `BETA_FMT` / `teamEventPts` / `TP_EV_ORDER` には**何も足さない**。

---

## 4. 影響範囲（ONにすると「どこの数字が変わるか」）

### 4.1 依存グラフ（コードを読んで実際に列挙）

```
periaHdcp(g,pid)
 ├─ netScore(g,pid)                       calc.js:25
 │   ├─ computePoints → awardInd(F.net)   calc.js:275  … 個人ネットの配点
 │   │    └─ computePayout               calc.js:304  … 賞金配分（pts合計が変わると全員の金額が動く）
 │   ├─ teamWinPoints 'teamNet'           calc.js:238  … 種目別勝ち点 → チーム総合順位 → teamRankPts → 個人pts → payout
 │   ├─ best2(g,t)                        calc.js:86   … β「ベスト2ボール」→ teamWinPoints 'best2ball'
 │   ├─ nextKanji(g)                      calc.js:316  … 次回幹事バッジ（表示専用・配点非関与）
 │   ├─ results.js:195                    … スコア表の **Net 列**
 │   ├─ results.js:199                    … 個人ネットのランキングカード（metric='net'）
 │   ├─ results.js:216 / 229              … チーム別スコア表の**チームネット小計**
 │   ├─ roulette.js:232                   … チーム対抗カード「ネット対抗」の値
 │   └─ roulette.js:102                   … ルーレットのスコア表内メンバー**並び順**（byNet）※表示順のみ・集計不変
 ├─ net9(g,pid,s,e)                       calc.js:49（HDCPの1/2を各ハーフに配分）
 │   └─ nassauTotalNet → results.js:144（β握りタブ）／ computePoints awardInd(F.nassau) calc.js:280
 └─ results.js:195                        … スコア表の **HD 列**（HDCP そのもの）
```

### 4.2 変わる／変わらない一覧

| 区分 | 対象 | ON時 |
|---|---|---|
| **変わる** | 個人ネット順位・ネットカード（`term.net`） | ○ |
| **変わる** | スコア表の HD 列 / Net 列 / チームネット小計 | ○ |
| **変わる** | チーム「ネット対抗」（`teamNet`）の値と順位 → 種目別勝ち点 → チーム総合順位 → `teamRankPts` | ○ |
| **変わる** | β「ベスト2ボール」（`best2`＝ネット下位2名の和） | ○ |
| **変わる** | β「握り/ナッソー」（`net9` が `periaHdcp/2` を使う） | ○ |
| **変わる** | 個人ポイント `computePoints` → **賞金配分 `computePayout`**（合計ポイントが動くため、ネット以外で得点した人の金額も動く） | ○ |
| **変わる** | 次回幹事バッジ `nextKanji`（ネット順で決めるため） | ○ |
| **変わる（表示順のみ）** | ルーレットのスコア表内メンバー並び（`byNet`）。採用/勝敗の印・集計には不変 | △ |
| 変わらない | グロス（`gross`/`effGross`）・グロス対抗・グロス順位 | × |
| 変わらない | ステーブルフォード・オリンピック（生スコア×par 基準） | × |
| 変わらない | キャロウェイ（`callawayHdcp`/`callawayNet` は独自ハンデ・グロス基準） | × |
| 変わらない | ホールバイホール（`holesWon`＝`adjHole` 直接） | × |
| 変わらない | ラスベガス（`vAdj` が独自にダブルパー上限を持つ） | × |
| 変わらない | 1 on 1 マッチ（`m1HoleWin`＝`adjHole` 直接） | × |
| 変わらない | **大学対抗**（`uvHdcpA`＝規定準拠の独立計算・D6） | × |
| 変わらない | ニアドラ（NP/DC）・任意対決（`customPts`） | × |
| 変わらない | エブリ支給額（`everyStrokes`）・`adjHole`/`adjArr` | × |

### 4.3 チーム値への波及の例（§4.4 の数値を使用）

`teamNet` はメンバーのネット合計（`Math.round(Σ×10)/10`）。E（エクセル氏）と D（標準氏）の2人チームなら：

| 設定 | E のネット | D のネット | teamNet |
|---|---|---|---|
| 両方OFF（現行） | 75.2 | 75.6 | **150.8** |
| カットON＋マイナス許可ON＋上限36 | 76.4 | 75.6 | **152.0** |

---

## 5. 数値例（前後比較・すべて `node` で実測）

### 5.0 共通条件

- コース：par72（OUT `4,5,3,4,4,3,4,5,4`＝36 ／ IN `4,3,5,4,4,3,4,5,4`＝36）
- 隠し12ホール：H1,H2,H3,H5,H6,H8 / H10,H11,H12,H14,H15,H17（`pickHidden12` の規則どおり 各半 Par3×2・Par4×2・Par5×2 ⇒ **隠し par 合計 48**）
- `periaCoef = 0.8`（既定）・エブリなし（§5.5 のみエブリON）

選手のホール別スコア（左からH1…H18・**太字が隠しホール**は省略。隠し合計は下表に明記）：

| 選手 | スコア（H1-H18） | グロス |
|---|---|---|
| E（Excel再現） | 5,6,4,5,9,3,5,6,5, 5,5,6,5,4,4,5,5,5 | 92 |
| A（大叩き） | 10,6,8,5,6,4,6,7,6, 5,4,7,6,9,5,5,7,5 | 111 |
| B（アンダー） | 3,4,2,4,4,3,4,4,4, 4,3,4,4,4,3,4,5,4 | 67 |
| C（ビギナー・上限例） | 8,7,9,7,6,5,6,7,7, 6,5,7,6,10,5,7,7,6 | 121 |
| D（標準） | 5,6,4,5,5,4,5,6,5, 5,4,6,5,5,4,5,6,5 | 90 |

隠し12ホール合計（カット前／カット後）：E = 62 / **61**、A = 78 / **73**、B = 43 / 43（カット該当なし）、C = 82 / **77**、D = 60 / 60（カット該当なし）。

### 5.1 ★幹事会社 Excel の再現（カットON＋マイナス許可ON＋上限36）

選手 E：グロス **92**・隠し12H合計（カット後）**61**。

| 設定 | HDCP 計算 | HDCP | ネット |
|---|---|---|---|
| 現行（両方OFF・上限なし） | (62×1.5 − 72) × 0.8 = 16.8 | 16.8 | **75.2** |
| **カットON＋マイナス許可ON＋上限36** | (61×1.5 − 72) × 0.8 = 15.6 | **15.6** | **76.4** |
| （Excel の式で検算） | X = 61 − 48 = 13 → 13 × 1.2 = 15.6・MIN(15.6,36)=15.6 | **15.6** | **76.4** |

⇒ **幹事会社 Excel（HDCP 15.6・ネット 76.4）と完全一致**。差はカットされた 1 打ぶんの `1×1.2 = 1.2`。

### 5.2 大叩きホールがある人（カット ON/OFF の差・上限なし）

| 選手 | 隠し12H（前/後） | OFF: HDCP / ネット | **カットON**: HDCP / ネット | 差 |
|---|---|---|---|---|
| A（H1で10・H3で8・H14で9） | 78 / 73 | 36.0 / 75.0 | **30.0 / 81.0** | HDCP −6.0・ネット +6.0 |
| C（H3で9・H14で10） | 82 / 77 | 40.8 / 80.2 | **34.8 / 86.2** | HDCP −6.0・ネット +6.0 |
| D（大叩きなし） | 60 / 60 | 14.4 / 75.6 | **14.4 / 75.6** | **差なし** |

A の内訳：H1(par4)10→8（−2）・H3(par3)8→6（−2）・H14(par4)9→8（−1）＝5打カット → `5×1.5×0.8 = 6.0` HDCP 減。

### 5.3 隠し12Hをアンダーで回った人（マイナス許可 ON/OFF の差・上限なし）

選手 B：グロス **67**・隠し12H合計 **43**（隠し par 48 に対し −5）。`(43×1.5 − 72) × 0.8 = −6.0`。

| 設定 | HDCP | ネット | 備考 |
|---|---|---|---|
| 現行（マイナス許可OFF） | **0** | **67.0** | 0 クリップ＝ネット＝グロス |
| **マイナス許可ON** | **−6.0** | **73.0** | ネットがグロスより 6 打悪くなる（Excel と同じ挙動） |
| カットON を併用 | −6.0 | 73.0 | B にダブルパー超過ホールが無いので**カットの影響ゼロ** |

### 5.4 上限36を併用したときの挙動（上限は上側のみ・マイナスとは独立）

| 選手 | 隠し12H（前/後） | 上限なしOFF | **上限36・両方OFF** | **上限36・カットON** | **上限36・カットON＋マイナス許可ON** |
|---|---|---|---|---|---|
| A | 78 / 73 | 36.0 → ネット75.0 | 36.0 → 75.0（ちょうど上限値） | **30.0 → 81.0** | 30.0 → 81.0 |
| C | 82 / 77 | 40.8 → 80.2 | **36.0 → 85.0**（頭打ち発動） | **34.8 → 86.2**（カット後は上限に届かない） | 34.8 → 86.2 |
| B | 43 / 43 | 0 → 67.0 | 0 → 67.0 | 0 → 67.0 | **−6.0 → 73.0**（上限36 はマイナス側に効かない） |
| E | 62 / 61 | 16.8 → 75.2 | 16.8 → 75.2 | 15.6 → 76.4 | **15.6 → 76.4** |

読み取り：**上限を先に当てるか後に当てるかで結果が変わる選手（C）が存在する**。本設計は Excel と同じく「カット後に上限」＝実装コード順のとおり。

### 5.5 エブリとカットの順序（D2 の裏取り・実測）

選手 F（`everyType='every1'`＝各ホール −1・18H入力）: 生スコア `6,7,7,6,7,5,6,7,6, 6,5,7,6,8,5,6,7,6`（生グロス113・エブリ後 95）。隠し12H の生合計 77・**エブリ後合計 65**。H3（par3）が生7＝ダブルパー超過の唯一のホール。

| 順序 | 隠し12H合計 | HDCP | ネット | 判定 |
|---|---|---|---|---|
| **本設計（エブリ → カット）** H3: 7−1=6 → `min(6,6)=6` | **65** | **20.4** | **74.6** | ○ 採用（§11.12 H・`uvHdcpA` と同順） |
| 誤（カット → エブリ）H3: `min(7,6)=6` → 6−1=5 | 64 | 19.2 | 75.8 | × 二重控除気味（HDCP が 1.2 小さくなる） |

※ この例では正しい順序だとカットが結果的に発動せず、`カットOFF` と同じ HDCP 20.4 になる（＝エブリ選手にはカットが効きにくい）。これは仕様どおり。

---

## 6. 設定UI（ゲーム設定タブ・既存カードに追加。**新規カードは作らない**）

### 6.1 レイアウト（`js/game.js` 冒頭の「ペリア設定」カード）

```
┌───────────────────────────────────────────────┐
│ ダブルペリア設定                    ← 既存 h2（game.periaCard）      │
│ HDCP =（隠し12H合計 × 1.5 − 規定打数）× 係数（上限で頭打ち）  ← 既存 .muted │
│ ┌──────────────┐ ┌──────────────┐                    │
│ │ 係数          │ │ HDCP上限（空欄=なし） │  ← 既存 .row > .fx1 ×2   │
│ │ [0.8        ] │ │ [        例:36     ] │                    │
│ └──────────────┘ └──────────────┘                    │
│ ☐ ダブルパーカット                    ← 追加（1行目）               │
│ ☐ HDCPのマイナスを許可                ← 追加（2行目）               │
│ 既定は両方OFF＝従来どおり。カット＝隠しホールの…   ← 追加（.muted 1本） │
└───────────────────────────────────────────────┘
```

- チェックボックス2つは **`.row` に横並びにせず縦に2行**（ラベルが長く、iPad 縦でも折り返さない）。
- 既存の同型パターン（`game.everyApply` / `univ.everyTgl`）と**まったく同じインラインスタイル**を使い、**新しい CSS クラスを追加しない**。注記は既存の `.muted` ＋ ユーティリティ `.mt6` / `.mt8`（`styles.css:128` に既存）。
- 投影原則 §11.14：ここは**幹事の操作UI**であり、結果・閲覧系画面ではない。ゲーム設定タブ内の既存カードに埋め込む＝控えめ配置。結果画面には**何も足さない**（インジケータ・タグ類は本 PR のスコープ外・§12 参照）。

### 6.2 実装コード（`js/game.js` の `let html = ...` ブロックを置換）

```js
  let html = `<div class="card"><h2>${t('game.periaCard')}</h2>
    <div class="muted">${t('game.periaFormula')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.coef')}</label><input type="number" step="0.05" value="${g.periaCoef}" onchange="setG('periaCoef',parseFloat(this.value))"></div>
      <div class="fx1"><label class="fl">${t('game.cap')}</label><input type="number" step="1" value="${g.periaCap??''}" placeholder="${t('game.capPh')}" onchange="setCap(this.value)"></div>
    </div>
    <label class="mt8" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.periaDblPar?'checked':''} onchange="setG('periaDblPar',this.checked)"> ${t('game.periaCut')}</label>
    <label class="mt6" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.periaAllowNeg?'checked':''} onchange="setG('periaAllowNeg',this.checked)"> ${t('game.periaNeg')}</label>
    <div class="muted mt6">${t('game.periaOptNote')}</div></div>`;
```

### 6.3 セッター（**新規関数を作らない**）

既存のグローバル関数 `setG(k,v)`（`js/game.js:111`）をそのまま使う：

```js
function setG(k,v){ const g=curGame(); g[k]=v; save(); if(k==='name'||k==='date'||k==='course')render(); }
```

- `g[k]=v; save();` で十分（トップレベルの真偽値・条件付き表示が無いので再描画不要）。
- inline `onchange`＝グローバル関数依存の方式を維持（**ESM 化しない**）。**新規 JS ファイルを作らない**。

---

## 7. i18n（ja/zh/en 同時追加・キー集合完全一致・**未使用キーゼロ**）

追加は **3キー×3言語＝9エントリ**。すべて §6.2 のコードから `t('…')` で参照されるため `tools/verify.mjs` の「未使用キー」検出に掛からない。既存キーの文言は変更しない。

追加位置：`js/i18n.js` の各言語ブロックで `'game.coef':…,'game.cap':…,'game.capPh':…` の**直後の行**（ja: 37行目付近／zh: 206行目付近／en: 375行目付近）。

| キー | ja | zh | en |
|---|---|---|---|
| `game.periaCut` | ダブルパーカット | 双标准杆封顶 | Double-par cut |
| `game.periaNeg` | HDCPのマイナスを許可 | 允许差点为负 | Allow negative HCP |
| `game.periaOptNote` | 既定は両方OFF＝従来どおり。カット＝隠しホールの打数をパーの2倍で頭打ち（グロスは頭打ちしません）。マイナス許可＝HDCPを0で止めず負のまま使います（隠し12H入力後に反映）。 | 默认两项均关闭＝与此前一致。封顶＝隐藏洞的杆数以标准杆的2倍封顶（总杆不封顶）。允许为负＝差点不再以0截断，可为负值（隐藏12洞全部录入后生效）。 | Both OFF by default (same as before). Cut = cap each hidden hole at double par (gross is not capped). Allow negative = do not clamp HCP at 0 (applies once all 12 hidden holes are entered). |

貼り付け用（3行・各言語ブロックへ1行ずつ）：

```js
  // ja
  'game.periaCut':'ダブルパーカット','game.periaNeg':'HDCPのマイナスを許可',
  'game.periaOptNote':'既定は両方OFF＝従来どおり。カット＝隠しホールの打数をパーの2倍で頭打ち（グロスは頭打ちしません）。マイナス許可＝HDCPを0で止めず負のまま使います（隠し12H入力後に反映）。',
  // zh
  'game.periaCut':'双标准杆封顶','game.periaNeg':'允许差点为负',
  'game.periaOptNote':'默认两项均关闭＝与此前一致。封顶＝隐藏洞的杆数以标准杆的2倍封顶（总杆不封顶）。允许为负＝差点不再以0截断，可为负值（隐藏12洞全部录入后生效）。',
  // en
  'game.periaCut':'Double-par cut','game.periaNeg':'Allow negative HCP',
  'game.periaOptNote':'Both OFF by default (same as before). Cut = cap each hidden hole at double par (gross is not capped). Allow negative = do not clamp HCP at 0 (applies once all 12 hidden holes are entered).',
```

> en にひらがな不使用（`verify.mjs` の「en 日本語残存」チェック対策）。空値なし。

---

## 8. regress フィクスチャ（`tools/regress.mjs`）

### 8.1 既存 7 ケースは**差分ゼロ**（実測で確認済み）

既存フィクスチャ（`indBasic` / `team3` / `team2Vegas` / `univOff` / `univOn` / `customTie` / `customNone`）は `periaDblPar` / `periaAllowNeg` を持たず、`migrate` で `false` 補完される ⇒ 新旧の `periaHdcp` は同一値。**本設計のパッチを当てた状態で `node tools/regress.mjs` を実行し、全7ケース一致（`--update` 不要）を確認済み**。

### 8.2 新規ケース H `periaOpts`（追加を推奨）

`CASES` の末尾に 1 件追加する。既存 12 名の選手マスターと `baseGame` をそのまま使い、**カット発動・負のHDCP・上限36 の 3 分岐すべてを 1 ケースで踏む**ように意図的に散らしたスコア式を使う。

```js
  // H) ペリアオプション（β・§11.22 / 2026-08-31-peria-options.md §2）: カットON＋マイナス許可ON＋上限36。
  //    p01/p02/p03 は隠し12Hをアンダー＝負のHDCP（マイナス許可の分岐）、p04/p08/p09 は隠しホールで
  //    ダブルパー超過4ホール（カットの分岐）、p09 はカット後も上限36 に当たる（上限の分岐）。
  //    womenEvery ON（p03/p07=every1・p05/p10=every2）でエブリ→カットの順序（D2）も踏む。
  //    握り(nassau)も ON にして net9 経由の HDCP/2 配分を回帰対象に含める。
  periaOpts: { channel: 'b', game: baseGame({
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => pi < 3 ? ((pi + h) % 3) - 2 : ((pi * 7 + h * 5) % 9) - 2),
    periaCap: 36, periaDblPar: true, periaAllowNeg: true, prizePool: 10000,
    prizes: { niapinWinner: { 2: 'p03', 7: 'p08', 11: 'p01', 16: 'p05' }, draconWinner: { 4: 'p02', 13: 'p10' } },
    formats: { gross: true, net: true, nassau: true, stableford: false, olympic: false, callaway: false,
      niadoraInd: true, niadoraTeam: false, roulette: false, teamGross: false, teamNet: false,
      holeByHole: false, best2ball: false, vegas: false, match1v1: false, univMatch: false, customMatch: false },
  }) },
```

### 8.3 スナップショットに HDCP 自体を含める（`univMatch` ゲートと同型・既存ケースの形は不変）

`driver` の `if (g.formats && g.formats.univMatch) { … }` の直後に追加：

```js
  // ペリアオプション（§11.22）: どちらか ON のケースのみ peria スナップショットを追加（既存ケースの形は不変＝差分ゼロを維持）
  if (g.periaDblPar || g.periaAllowNeg) {
    globalThis.__RESULTS[name].peria = {
      hdcp: Object.fromEntries(g.participants.map(pid => [pid, periaHdcp(g, pid)])),
      net:  Object.fromEntries(g.participants.map(pid => [pid, netScore(g, pid)])),
      nassau: Object.fromEntries(g.participants.map(pid => [pid, nassauTotalNet(g, pid)])),
    };
  }
```

### 8.4 新規ケースの期待値（実測済み・`--update` 後にこの値になることをレビューで確認する）

par70（regress の `PAR`）・隠し12H = `[0,1,3,4,6,8,10,12,13,15,16,17]`（隠し par 合計 49）・`periaCoef=0.8`・`periaCap=36`・`womenEvery` ON。

| 選手 | エブリ後G | 隠し12H（カット前/後） | カット該当H数 | **OFF**: HDCP / ネット | **ON**: HDCP / ネット |
|---|---|---|---|---|---|
| p01 | 52 | 34 / 34 | 0 | 0 / 52 | **−15.2 / 67.2** |
| p02 | 52 | 40 / 40 | 0 | 0 / 52 | **−8 / 60** |
| p03 | 34 | 25 / 25 | 0 | 0 / 34 | **−26 / 60** |
| p04 | 106 | 82 / 76 | 4 | 36 / 70 | **35.2 / 70.8** |
| p05 | 70 | 52 / 52 | 0 | 6.4 / 63.6 | 6.4 / 63.6 |
| p06 | 106 | 70 / 66 | 2 | 28 / 78 | **23.2 / 82.8** |
| p07 | 88 | 52 / 52 | 0 | 6.4 / 81.6 | 6.4 / 81.6 |
| p08 | 106 | 76 / 70 | 4 | 35.2 / 70.8 | **28 / 78** |
| p09 | 106 | 88 / 82 | 4 | 36（上限） / 70 | **36（カット後も上限） / 70** |
| p10 | 70 | 49 / 48 | 1 | 2.8 / 67.2 | **1.6 / 68.4** |
| p11 | 106 | 58 / 56 | 2 | 13.6 / 92.4 | **11.2 / 94.8** |
| p12 | 106 | 70 / 66 | 2 | 28 / 78 | **23.2 / 82.8** |

派生値（`computePoints` / `computePayout.payout` / `nextKanji`）：

| 出力 | OFF（参考） | **ON（新規ケースの期待値）** |
|---|---|---|
| `computePoints` | `{p01:11,p02:5,p03:17,p04:0,p05:2,p06:0,p07:0,p08:2,p09:0,p10:2,p11:0,p12:0}` | `{p01:5,p02:9,p03:17,p04:0,p05:4,p06:0,p07:0,p08:2,p09:0,p10:2,p11:0,p12:0}` |
| `computePayout.payout`（pool 10000） | `{p01:2821,p02:1282,p03:4359,p05:513,p08:513,p10:513,他0}` | `{p01:1282,p02:2308,p03:4359,p05:1026,p08:513,p10:513,他0}` |
| `nextKanji` | `["p01","p07"]` | `["p02","p12"]` |

> このケースはスコア式が合成的（グロス 34〜106 と幅が広い）だが、**目的は 3 分岐すべてを決定的に踏むこと**であり、既存フィクスチャ（`indBasic` 等）も同様の合成式である。

---

## 9. 正本 `2026-07-12-golf-compe-web.md` への追記案文（§11.22・そのまま転記）

> 追記は本設計を実装する PR（または PM の docs 単独コミット）で行う。挿入位置は §11.21 の直後（ファイル末尾）。

```markdown
### §11.22 ダブルペリアの集計オプション2つ【確定・2026-08-31・§3/§4 追補】
**詳細設計の正**: `docs/handoff/2026-08-31-peria-options.md`。
**§3 追補（`periaHdcp` にオプション分岐を追加。両方OFF＝既定＝現行式と完全に同一）**: 幹事会社の集計 Excel（`寄与 = MIN(par, スコア−par) × 1.2` を隠し12ホール合計し `MIN(…,36)`・下限クランプなし）に合わせるための per-game オプション。①**ダブルパーカット `g.periaDblPar`**（既定 false）: 隠しホールの集計値を `Math.min(v, 2*par[i])` で頭打ち。**HDCP 算定にのみ適用しグロスには適用しない**（`uvGrossA` と同じ規律）。エブリ ON 時の `min` 判定は**エブリ適用後の値**（`adjHole` の戻り値）に対して行う（§11.12 H・`uvHdcpA` と同順）。②**HDCPマイナス許可 `g.periaAllowNeg`**（既定 false）: `if(hd<0)hd=0` の 0 クリップを外す。ただし**隠し12ホールが全て入力済みのときのみ有効**（経過ラウンド・段階開封中は従来どおり 0 クリップ＝表示破綻の防止。18H 完了時の値は Excel と一致）。上限 `g.periaCap` の判定・丸め `Math.round(hd*10)/10` は**従来どおり**（マイナス許可と上限は独立・上限は上側のみ）。`periaCoef` 既定 0.8・隠し par 合計 48・規定打数 72 のとき 76-Club 一般式 `(Σ12×1.5 − 規定打数)×0.8` は Excel の `Σ MIN(par, スコア−par) × 1.2` と数学的に一致する（実データ検証: グロス92・隠し12H合計61 → HDCP 15.6・ネット 76.4）。**大学対抗 `uv*` には非連動**（`uvHdcpA` は規定準拠の独立計算のまま＝`periaCoef`/`periaCap` 非連動の前例と同じ）。他の種目関数（stableford/olympic/callaway/nassau の判定式/holesWon/vegas/m1/niadora/customMatch）には非接触（ネット経由で値が動く範囲は `docs/handoff/2026-08-31-peria-options.md` §4）。
**§4 追補（後方互換・migrate 補完）**: `game.periaDblPar`: bool（既定 false）／`game.periaAllowNeg`: bool（既定 false）。いずれも `periaCoef`/`periaCap` と同じ per-game トップレベル。`newGame()` に既定値・`migrate()` に `undefined` バックフィルを追加。`dupGame`（ディープコピー）・backup（`state` 丸ごと export ＋ import 時 `migrate`）は変更不要。**localStorage キー集合・players スキーマ・formats/points/announced は不変**（新種目ではないので `BETA_FMT`/`teamEventPts`/`TP_EV_ORDER` に追加しない）。UI はゲーム設定タブの既存「ダブルペリア設定」カードにチェックボックス2つ＋注記1行（新規カードなし・セッターは既存 `setG`）。
```

---

## 10. モックの要否【判断：**不要**】

- 変更は**既存カード内にチェックボックス2行＋注記1行を足すだけ**。新規画面・新規タブ・新規カード・ナビ再編は一切なし。
- **閲覧系（投影）画面には何も追加しない**（結果画面の見た目は変わらない。数値だけが設定に応じて変わる）。CLAUDE.md の「UI テーマは実装着手前にモック承認」は**大きな構造変更・閲覧系画面**を対象としており本件は該当しない。
- 既存の同型 UI（`game.everyApply` のチェックボックス、`univ.everyTgl` のチェックボックス＋注記）が既に稼働しており、見た目の方向性に不確実性がない。
- ⇒ `/feature` 手順 1.5（モック承認）は**スキップしてよい**。§6.1 のレイアウト図で十分。

---

## 11. 受け入れ条件

### 11.1 回帰（最重要）

1. `node tools/verify.mjs` が**全 PASS**（構文／i18n ja=zh=en キー数一致＋欠落なし／空値なし／en 日本語残存なし／未定義参照なし／**未使用キーなし**／CSS 孤立 var()／計算回帰）。
2. `node tools/regress.mjs` で**既存 7 ケースが差分ゼロ**（`indBasic`/`team3`/`team2Vegas`/`univOff`/`univOn`/`customTie`/`customNone`）。新規ケース `periaOpts` を追加した場合のみ `--update` を実行し、**`tools/regress-expected.json` の差分が新規キー `periaOpts` の追加だけ**であることを PR 差分で確認できること（既存 7 ケースのブロックが 1 行も変わらない）。
3. 新規ケース `periaOpts` の値が **§8.4 の表と一致**すること（HDCP・ネット・`computePoints`・`payout`・`nextKanji`）。

### 11.2 機能

4. 既存コンペ（保存済み `golfCompe_v1`）を開いても、ゲーム設定の 2 チェックボックスが **OFF** で、ネット・HDCP・賞金・次回幹事の値が**変更前と 1 つも変わらない**。
5. 旧バックアップ JSON をインポートしても同様（`migrate` で false 補完）。
6. 「ダブルパーカット」ON で、§5.2 の選手 A 相当（隠しホールにダブルパー超過あり）の HDCP が減り、ネットが増える。ダブルパー超過が無い選手は**値が動かない**。
7. **グロス（`effGross`）はカット ON でも変化しない**（スコア表の Total 列・グロス順位が不変）。
8. 「HDCPのマイナスを許可」ON かつ 18H 入力済みで、隠し12H をアンダーで回った選手の HDCP が負・ネットがグロスより大きく表示される（スコア表 HD 列に `-6` のように表示）。
9. 同 ON でも、**隠し12ホールに未入力が残っている間は HDCP が 0**（経過ラウンド・段階開封中の表示が現行と同じ）。§2.4 の表と一致すること。
10. 「HDCP上限」を 36 に設定した状態でカット ON にすると、§5.4 の選手 C 相当が上限から外れる（36 → 34.8）。マイナス側には上限が効かない。
11. 「コンペを複製」（`dupGame`）で 2 フラグが複製先に引き継がれる。
12. **大学対抗タブの数値が 2 フラグの ON/OFF で 1 つも変わらない**（`uvHdcpA`/`uvNetA`/`uvStanding` 非連動・D6）。
13. グロス対抗・ステーブルフォード・オリンピック・キャロウェイ・ホールバイホール・ラスベガス・1 on 1・ニアドラ・任意対決の値が 2 フラグで変わらない（§4.2 の「変わらない」行）。
14. ja/zh/en を切り替えて、追加した 2 ラベル＋注記が 3 言語で正しく表示される。

### 11.3 運用

15. `js/**`・`styles.css` を変更するので `index.html` の `?v=` を **PR 番号に一括更新**する（キャッシュ混在防止・reviewer が確認）。
16. 1タスク=1ブランチ=1PR。`docs/handoff/**` は実装者が変更しない（本設計書は architect が作成済み）。正本 §11.22 の追記（§9 の案文）は docs 単独コミットで PM が行う。

---

## 12. 触らない範囲（load-bearing）

- **`js/calc.js` の `periaHdcp` 以外の関数**：`gross`/`complete`/`enteredCount`/`everyStrokes`/`evPer`/`adjArr`/`adjHole`/`effGross`/`netScore`/`net9`/`nassauTotalNet`/`stablefordPts`/`olympicPts`/`callawayHdcp`/`callawayNet`/`tieBreak`/`ranked`/`teamRanked`/`holesWon`/`best2`/`vegas*`/`m1*`/`uv*`/`niadoraTeamCount`/`customPts`/`teamWinPoints`/`computePoints`/`computePayout`/`nextKanji` は**1 行も変更しない**。
- **大学対抗 `uv*` に 2 フラグを渡さない**（D6）。`uvHdcpA` の `Math.min(v,2*g.par[i])`・`if(hd<0)hd=0`・`cap = 男36/女40` はそのまま。
- **`localStorage` キーを増やさない**（`golfCompe_v1` / `golfCompe_lang` / `golfCompe_theme` / `golfCompe_channel` / `golfCompe_seenTop` のみ）。
- **新規 JS ファイルを作らない**。`index.html` の読込順・inline `onclick`/`onchange` 方式（非 ESM）を維持。
- **新規 CSS クラスを追加しない**（既存 `.muted` / `.mt6` / `.mt8` とインラインスタイルで完結）。
- 結果発表画面（`js/results.js` / `results-team.js` / `results-m1.js` / `roulette.js`）は**変更しない**。オプション ON を知らせるタグ（`univ.everyOn` 相当）やルール解説（`rule.net`）の文言変更は**本 PR のスコープ外**（必要なら別 Issue・S レーン）。
- 機能色の意味・投影用トークン・テーマトークンに非接触。

---

## 13. 推奨PR分割

**1 PR（推奨）**。差分規模が小さく（下表 合計 ≈ 40 行）、`regress-expected.json` の更新は計算変更と同一 PR に置いた方がレビューしやすい。

| ファイル | 変更 | 目安 |
|---|---|---|
| `js/calc.js` | `periaHdcp` のみ（コメント含む） | +6 / −2 行 |
| `js/state.js` | `newGame()` 1 行修正・`migrate()` 2 行追加 | +3 / −1 行 |
| `js/game.js` | ペリア設定カードに `<label>`×2 ＋ `.muted`×1 | +3 行 |
| `js/i18n.js` | ja/zh/en に 3 キー×3 言語 | +6 行 |
| `tools/regress.mjs` | 新規ケース `periaOpts` ＋ driver の peria スナップショット | +20 行 |
| `tools/regress-expected.json` | `--update` で `periaOpts` ブロック追加のみ | 自動生成 |
| `index.html` | `?v=` を PR 番号に一括更新 | 18 箇所 |

やむを得ず分割する場合：
- **PR1**: `js/state.js` ＋ `js/calc.js` ＋ `js/i18n.js` ＋ `js/game.js`（機能一式・regress は既存 7 ケース差分ゼロで通る）
- **PR2**: `tools/regress.mjs` ＋ `tools/regress-expected.json`（新規フィクスチャのみ・アプリコード非変更）

PR1 を先に main へ squash マージしてから PR2 を起こす（`regress-expected.json` の衝突回避）。

---

## 14. 既定で進める事項（実装ゲートではない・異議があれば Issue にコメント）

1. キー名は `g.periaDblPar` / `g.periaAllowNeg`（`periaCoef`/`periaCap` の並び・per-game トップレベル真偽値）。
2. マイナス許可には「隠し12H 全入力」ゲートを付ける（§2.4・D5）。18H 完了時の値は Excel と一致するため、Excel 再現性には影響しない。
3. 上限は上側のみ（マイナス側の下限設定は作らない）。カット→上限の順（Excel と同じ）。
4. 結果画面に「オプション適用中」のタグを出さない（`univ.everyOn` 相当は作らない）。`rule.net` の文言も変更しない。
5. i18n は 3 キーのみ（ラベル2＋共通注記1）。注記を 2 本に分けない（未使用キーゼロと文言量のバランス）。
6. `uv*`（大学対抗）は完全非連動。
7. モック承認はスキップ（§10）。

---

## 15. PM 確認事項（上記の既定で確定済み・変更希望があれば起票前 or Issue コメントで）

1. **【最重要】マイナス許可の「隠し12H 全入力」ゲート（§2.4・D5）**：PM 指示は「`if(hd<0)hd=0` をスキップするだけ」だった。ゲート無しだと**表彰式の段階開封中に全員のネットがグロス＋50 前後で投影される**ため、本設計はゲートを既定とした。18H 完了時の値は同一。ゲート不要なら `const neg = g.periaAllowNeg;` の 1 行に置換するだけで済む（他の記述はすべて有効）。
2. **上限の既定値**：本 PR では `periaCap` の既定（null＝上限なし）を変えない。幹事会社方式を使うコンペでは幹事が手動で 36 を入力する運用。「カット ON にしたら上限を自動で 36 にする」といった連動は**入れていない**（既存フィールドの意味を変えないため）。これで良いか。
3. **オプション ON の可視化**：結果画面（スコア表 HD 列の近く等）に「Wパーカット適用中」バッジを出すか。本 PR では出さない方針（§12）。投影で「なぜ HDCP がマイナス？」と聞かれる可能性があるため、必要なら別 Issue（S レーン）で `rule.net` に一文追加も可。
4. **ラベル文言**：「ダブルパーカット」「HDCPのマイナスを許可」で確定してよいか（`Wペリアの1ホール上限` / `HDCPを0で止めない` 等の代案あり）。
5. **regress 新規フィクスチャ**：§8.2 のスコア式はグロス 34〜106 と幅が広い合成データ。3 分岐（カット／マイナス／上限）を 1 ケースで踏むことを優先した。より現実的な値の別ケースに差し替えたい場合は連絡を。
