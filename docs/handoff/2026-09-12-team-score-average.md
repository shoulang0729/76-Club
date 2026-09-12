# 設計：チーム対抗グロス／ネットの「合計 → 平均」切替 — 2026-09-12

**種別**: M（★§3 計算仕様に触れる **load-bearing** 変更・要前後比較）
**発端**: ユーザー指摘（2026-09-12）「チームのグロス・ネットは合計でなくて平均で勝負すべきでないの？」
**実害**: Issue #171 — 4人目が削除されて3人になったチームが **3名合計 230.8 対 他チーム4名合計 301.4 / 344.4** で優勝していた。
**関連正本**: `2026-07-12-golf-compe-web.md` §3.5／§4、`2026-08-20-team-points.md` §3、`2026-08-30-univ-match.md` §4（平均の前例）、`2026-09-12-nonparticipant-ghost.md` §6.1（`teamMembers`）、`2026-09-12-settings-consolidation.md` §3.2（コンペ設定タブのカード順）

---

## 0. ★最重要の解釈（PM 判断・これが設計の土台）

**既存コンペの結果は後から書き換えない。**
このアプリは結果を保存せず毎回計算し直すので、式を変えると**過去コンペを開いたときの表示も変わる**。「あのとき優勝したのは誰か」が後から変わるのは記録として不可。したがって「デフォルトで平均」を次の意味に確定する:

| 対象 | 方式 | 実装 |
|---|---|---|
| **既存ゲーム**（保存済み・インポート含む） | **合計**（1打も変わらない） | `migrate()` が `g.teamScoreMode='sum'` を backfill |
| **今後作るゲーム** | **平均** | `newGame()` が `teamScoreMode:'avg'` |
| 既存ゲームの複製（`dupGame`） | 元コンペを引き継ぐ（=`sum`） | 特別扱いしない（深いコピー） |

**「過去コンペも平均で言い直す」に切り替える seam**（§5.4）: `teamAvgOn()` 1関数と `migrate` の1行だけを触れば済むように隔離する。

---

## 1. PM への確認事項（既定案で最後まで書いてある・異議がなければそのまま実装）

| # | 論点 | 既定案（本設計の採用値） | 根拠 |
|---|---|---|---|
| Q1 | 過去コンペも平均で言い直すか | **しない**（`migrate` で `'sum'` backfill） | §0・記録の不可変性 |
| Q2 | 複製（`dupGame`）の方式 | **元コンペを引き継ぐ**（複製＝設定のコピー） | 既存の複製セマンティクスを変えない |
| Q3 | 平均の丸め | **0.1（小数第1位）で判定＝表示も同じ値**（`uvStanding` の4桁方式は採らない） | §4.2 |
| Q4 | 平均の母数 | **1H以上入力済みのメンバー**（実測で決定・§3） | §3.1 の実測 |
| Q5 | 「人数不揃い」警告の判定基準 | **登録（参加中）メンバー数**（入力済み数ではない） | §6.2（経過中の偽陽性回避） |
| Q6 | PR 分割 | **2本**（計算＋データ＋表示追随 / 設定UI＋警告）・**連続マージ前提** | §10 |
| Q7 | `best2` の未入力メンバー `net=0` 採用バグ（実測で発見） | **本件では触らない・別Issue** | §11.2 |

---

## 2. 現状（コード実測）

### 2.1 式（`js/calc.js` 267–268・§3.5 の実装）

```js
if(F.teamGross) add('teamGross', teams.map(t=>teamMembers(g,t).reduce((a,pid)=>a+effGross(g,pid),0)),'asc');
if(F.teamNet) add('teamNet', teams.map(t=>Math.round(teamMembers(g,t).reduce((a,pid)=>a+netScore(g,pid),0)*10)/10),'asc');
```

人数で割らない＝**人数が少ないチームが自動的に有利**（少ないほど合計が小さい）。

### 2.2 同じ式が3箇所に重複している（★実装の落とし穴）

| 箇所 | 用途 | 本設計での扱い |
|---|---|---|
| `js/calc.js:267-268` | 勝ち点・勝敗の**正** | 共有ヘルパー呼び出しに置換 |
| `js/roulette.js:251-252`（`renderTeams`） | グロス対抗／ネット対抗**カードの表示値・並び** | 同じヘルパーを呼ぶ（値の二重管理をやめる） |
| `js/results.js:286-287`（`renderScorecard`） | スコア表の**チームの並べ替え**（`scSortTeam`） | 同じヘルパーを呼ぶ（順位カードと並びを一致させる） |
| `js/results.js:299-300` | スコア表の**チーム「計」行**の表示値 | **変更しない**（§6.4 の判断） |

> #157 の教訓（同じ式を calc と results で二重管理して項がずれた）を繰り返さないため、**勝敗に使う値の計算式は calc.js の1本に集約する**。

### 2.3 アプリ内に既にある「平均」の前例

`uvStanding`（大学対抗・`2026-08-30-univ-match.md` §4）は **平均**で比べ、母数を `uvMembers`（参加中 ∩ マスタ実在 ∩ **1H以上入力済み**）に絞り、さらに上位N名（`uvTargetN`）に足切りする。**チーム対抗グロス／ネットだけが合計のまま**という不整合。

### 2.4 一般慣例（調査）

公開されている幹事向けガイドは**チーム人数が揃っている前提**で「合計」を書いているものが大半で、人数が揃わない場合の作法は ①**対象スコア数を揃える（上位N名）** ②**平均** の2流派。決定的な業界標準は無い（森林公園ゴルフ場の団体戦要項が「参加人数に合わせて対象スコアーを増す」＝①の流儀）。幹事会社 Excel（`2026-08-31-host-excel-analysis.md` §C21）も**2チーム固定・同人数**前提で「NET の少ないチームが勝利」としか書いていない。
→ **ユーザー確定（母数＝チームの人数／上位N名にはしない）** は②で、`uvStanding` と同系。設計として一貫している。

---

## 3. 決定 A：平均の母数に誰を数えるか（★最重要・実測で確定）

### 3.1 実測：1打も入力されていないメンバーの値

`tools/regress.mjs` と同じ vm ハーネスで実測（12名フィクスチャ・`womenEvery` ON・`periaCoef` 0.8・`periaCap` null・隠し12H あり）。

| 選手 | 入力H | `gross` | `effGross` | `periaHdcp` | `netScore` |
|---|---|---|---|---|---|
| p01（18H入力） | 18 | 61 | 61 | 0 | 61 |
| p02（18H入力） | 18 | 98 | 98 | 29.2 | 68.8 |
| p03（18H入力・every1） | 18 | 97 | 79 | 11.2 | 67.8 |
| **p04（1打も未入力）** | **0** | **0** | **0** | **0** | **0** |

理由（コード上の必然）: `gross=0` → `everyStrokes = evPer × enteredCount = 0` → `effGross=0`。隠しホールが全て `null` なので `h=0` → `hd=(0×1.5−70)×0.8=−56 < 0` → **0クリップ**（`periaAllowNeg` は「隠し12H全入力」条件を満たさないので効かない）→ `netScore = 0−0 = 0`。

### 3.2 だから母数を間違えると二重に歪む（実測値）

T1＝4名登録（うち p04 が1打も未入力）／T2＝4名全員入力。

| 指標 | 合計（現行） | 平均・母数=**登録4名**（誤） | 平均・母数=**入力済**（採用） |
|---|---|---|---|
| T1 グロス | 238 | **59.5** ← 実在しない数字 | **79.3**（238÷3） |
| T2 グロス | 302 | 75.5 | 75.5 |
| 勝者(グロス) | T1 | **T1**（誤） | **T2**（正） |
| T1 ネット | 197.6 | **49.4** ← 実在しない数字 | **65.9**（197.6÷3） |
| T2 ネット | 262.8 | 65.7 | 65.7 |
| 勝者(ネット) | T1 | **T1**（誤） | **T2**（正） |

登録人数を母数にすると「0点の人」で平均が押し下げられ、**合計より酷い**（59.5 というスコアは人類に不可能）。

### 3.3 決定

> **平均の母数＝`teamScoreMembers(g,T)` ＝ `teamMembers(g,T)` かつ 1H以上入力済み。分子も同じ集合で合計する。**

- `teamMembers`（`memberIds ∩ participants ∩ マスタ実在`・#151/#171 のゴースト対策）は**そのまま踏襲**（`.filter` を後ろに足すだけ）。
- `uvMembers` / `teamWinPoints` の `entered` と**完全に同じ概念**（3箇所目の同型・判定式も同一 `(g.scores[pid]||[]).some(v=>v!=null&&v!=='')`）。
- **合計モードの分子は従来の `teamMembers` 全員のまま**（フィルタしない）。§3.4 の病的ケースがあるため。

### 3.4 ★合計モードの分子にフィルタを入れてはいけない理由（実測）

通常は「未入力メンバーは 0 なので合計に影響しない」＝**分子をどちらの集合で取っても同値**（実測: 238=238 / 197.6=197.6）。しかし **`g.hidden` が全 false（隠しホール未設定）＋ `periaAllowNeg` ON** のとき、`g.hidden.every(...)` が空条件で `true` を返すため未入力選手にも `hd=−56` が付き、`netScore(p04)=+56 ≠ 0` になる（実測）。

| 病的ケース（hidden 全false＋periaAllowNeg ON） | Σ over `teamMembers` | Σ over 入力済のみ |
|---|---|---|
| T1 ネット合計 | **443** | 387 |

→ **合計モードは現行の式を1文字も変えない**（`teamMembers` 全員の `reduce`）ことで、「既存コンペは1打も動かない」を**無条件に**保証する。分子のフィルタは平均モード専用。

---

## 4. 決定：集計式（★§3.5 追補・load-bearing）

### 4.1 式（前 → 後）

```
# 前（現行・全ゲーム共通）
teamGross(T) = Σ effGross(pid)                                  for pid in teamMembers(g,T)
teamNet(T)   = round1( Σ netScore(pid) )                         for pid in teamMembers(g,T)

# 後（g.teamScoreMode で分岐）
## teamScoreMode==='sum'（既存ゲーム・従来と完全に同一）
teamGross(T) = Σ effGross(pid)                                  for pid in teamMembers(g,T)
teamNet(T)   = round1( Σ netScore(pid) )                         for pid in teamMembers(g,T)

## teamScoreMode==='avg'（新規ゲームの既定）
M(T)         = teamScoreMembers(g,T) = { pid ∈ teamMembers(g,T) | 1H以上入力済み }
teamGross(T) = M(T)=∅ ? null : round1( Σ_{M} effGross(pid) / |M(T)| )
teamNet(T)   = M(T)=∅ ? null : round1( Σ_{M} netScore(pid)  / |M(T)| )

round1(v) = Math.round(v*10)/10
```

- `'asc'`（小さいほど上位）は不変。`add()` のシグネチャ・同点山分け・`live<2` ガードは不変。
- **合計モードのグロスには `round1` を掛けない**（現行は素の整数。数学的には恒等だが「1ビットも動かさない」を機械的に自明にするため）。
- **ネットは合計モードでも従来どおり `round1`**（現行と同じ位置・同じ式）。

### 4.2 決定 B：丸めと表示・同点

| 論点 | 決定 | 根拠 |
|---|---|---|
| 判定に使う値と表示する値を分けるか | **分けない（1値）**。`teamGrossVal/teamNetVal` の戻り値が唯一の正で、カードもそれを表示する | ①投影前提（§11.14）で「画面の数字から勝者が検算できる」こと ②値の二重管理事故（#157）の防止 |
| 桁 | **小数第1位（0.1 丸め）** | `netScore`/`teamNet`/`periaHdcp` の既存規律と同一。`Math.round(v*10)/10` の既存イディオムをそのまま使う |
| `uvStanding` の4桁丸め方式を採らない理由 | `uvStanding` は**4成分辞書式タイブレーク**が本体で、4桁丸めは「浮動小数ノイズ除去」の役。チーム対抗はタイブレークを持たず**同点=山分け**が正規の決着なので、表示と判定を一致させる方が良い | §4.3 |
| 浮動小数の同点誤判定 | **起きない**。`Σ` の誤差は 1e-13 オーダーで 0.1 丸めに影響しない。`IEEE-754` の除算は正確丸めなので、数学的に等しい平均（例 `226/3` と `452/6`）は**同一の double** になる（実測 `true`） | — |
| 同点発生率 | **合計モードより上がる**（グロス合計は整数＝完全一致のみ同点だったが、平均は 0.1 粒度で丸め同点が起きる）。例: 同人数 n=20 で合計 301 と 302 → ともに 15.1（同点）。n=4 なら 75.3 と 75.5（非同点）。**既存 `add()` の山分け（`w/同点チーム数`）にそのまま乗る**＝新しい分岐は要らない | §8 の新ケースで山分けを機械的に固定する |
| 負値 | `Math.round(-0.5)=-0`（半数切り上げ）。`netScore` の既存丸めと同一イディオムなので新しい非対称は生まない | — |

### 4.3 ★総合タブの「種目別勝ち点表」は表示変更なし（PM 前提の訂正）

`events[].vals` は**表示されていない**。`js/results-team.js:108` で `ev.vals[i]==null` の判定にしか使っておらず、セルに出るのは `tpShare(ev.w, winners.length)`（獲得勝ち点）。
→ **種目別勝ち点表の桁・書式は決める必要がない**（変更点ゼロ）。平均値が画面に出るのは §6.3 のカードだけ。

### 4.4 `null` の扱い（★新しく起きる状態）

平均モードでは「メンバーは居るが誰も入力していないチーム」で `null` を返す。

| 呼び出し元 | `null` は起きるか | 対応 |
|---|---|---|
| `teamWinPoints` | **起きない**。`teams` を `m.some(entered)` で先に絞っているので必ず `|M|≥1` | 不要（`add` の `live` 判定は従来どおり） |
| `renderTeams`（`js/roulette.js`） | **起きる**。`teamsOf(g)` はメンバー1人以上だけが条件 | ★必須対応: 値セルは `—`、**並べ替えで `null` を必ず末尾**に置く（現状の `a.v-b.v` は `null`→0 扱いで最上位に来てしまう） |
| `renderScorecard` の並べ替え（`js/results.js`） | 同上 | 同じく `null` 末尾 |

---

## 5. 決定 C：データモデル

### 5.1 フィールド（§4 追補）

```jsonc
// game オブジェクト
"teamScoreMode": "sum" | "avg"   // グロス対抗・ネット対抗の集計方法。既定（newGame）= "avg"
```

**`boolean teamAvg` ではなく文字列 enum を採る理由**
1. **将来「上位N名平均」を足す余地**（`'topNavg'` を追加するだけ。boolean だと `teamAvg` + `teamTopN` の2フラグになり、不可能な組み合わせ（`teamAvg:false` かつ `teamTopN:3`）が表現できてしまう）。
2. **バックアップ JSON が自己記述的**になる（`"teamScoreMode":"sum"` は読めば分かる。`"teamAvg":false` は「何の逆か」が分からない）。
3. **アプリ内の先例が文字列 enum**: `g.vegas.cap:'doublePar'|'none'`、`g.kanjiRanks.*.dir:'down'|'up'`。boolean 先例（`periaDblPar` 等）は「ON/OFF が本質で第3の値が想像できない」ものだけ。
4. 未知値（他アプリ由来・手編集）は **`'avg'` 以外すべて `sum` 扱い**＝保守的（過去を勝手に言い直さない）。

**localStorage キーは5つのまま**（`g` の中のフィールドなので増えない。表示状態ではないので `golfCompe_v1` に入るのが正しい）。

### 5.2 `migrate()`（`js/state.js`）

`g.announced===undefined` の補完行の**直前**に1行追加:

```js
if(g.teamScoreMode===undefined) g.teamScoreMode='sum';   // ★既存コンペは合計のまま（結果を後から書き換えない・設計 §0）
```

- `migrate` はアプリ起動時（`state.js:8`）と**バックアップ JSON インポート時**（`js/backup.js:6`）の両方で走る＝古い JSON を入れても過去の結果は合計のまま再現される。
- `newGame()` 以外のゲーム生成経路は `dupGame()`（深いコピー＝引き継ぎ・Q2）と `sdBuild()`（テストデータ＝`newGame()` ベースなので `'avg'`）のみ。両方とも意図どおり。

### 5.3 `newGame()`（`js/state.js`）

```js
periaCoef:0.8, periaCap:null, periaDblPar:false, periaAllowNeg:false,
teamScoreMode:'avg',   // チーム対抗グロス/ネットは平均で勝負（設計 2026-09-12-team-score-average.md §0）
```

### 5.4 ★seam：「過去コンペも平均で言い直す」への切替（1関数＋1行）

```js
// 現行（確定・過去は合計）
function teamAvgOn(g){ return (g&&g.teamScoreMode)==='avg'; }
// ↓ 「過去コンペも平均にする」場合の全変更（この2箇所だけ）
function teamAvgOn(g){ return ((g&&g.teamScoreMode)||'avg')!=='sum'; }   // 未設定＝平均
// かつ migrate の backfill 行を削除（'sum' を書き込まない）
```
`teamAvgOn()` を**唯一の判定点**にすること（`g.teamScoreMode==='avg'` を他のファイルに直接書かない）。これが seam の条件。

---

## 6. 決定 D：UI

### 6.1 設定の置き場所

**コンペ設定タブ（`gameSettingsHtml`）の S3「集計する競技」の直後**に折りたたみセクションを1枚追加する（`2026-09-12-settings-consolidation.md` §3.2 の S4 より前。既存 S4–S11 の番号は動かさないので本設計では **S3b** と呼ぶ）。

| 項目 | 値 |
|---|---|
| 形 | `gsSec('teamScore', t('game.teamScoreCard'), inner)` ＝ `<details class="gsec">`（既定 閉・`gsOpen` の揮発トグル） |
| 表示条件 | `F.teamGross \|\| F.teamNet`（どちらも OFF なら出さない＝S4/S5/S6 の「採用したら直下に出る」規律と同型。`setFmt` → `renderBasic` 再描画で出没） |
| 位置の根拠 | 「何を競うか（S3）→ その競技の詳細（S4–S6）」の並びに沿う。チーム対抗の判定方法は S3 の直接の帰結なので S4 より前 |
| 中身 | ラジオ2択（平均／合計）＋ `.muted` 説明 ＋（条件付き）警告 |

```
┌─ コンペ設定（#view-basic）──────────────────────────┐
│ [card] ゲーム（コンペ）                    S1        │
│ [card] 大会情報                            S2        │
│ [card] 集計する競技                        S3        │
│   個人戦  ☑グロス ☑ネット ☑ニアドラ …               │
│   チーム戦 ☑ニアドラ ☑グロス対抗 ☑ネット対抗 …      │
│ ▼ チーム対抗の集計（合計／平均）  [!人数不揃い] S3b  │← 新規
│   ┌──────────────────────────────────────────────┐  │
│   │ ( ) 合計（人数で割らない）                    │  │
│   │ (•) 平均（メンバーの人数で割る）              │  │
│   │ グロス対抗・ネット対抗の勝敗をどちらで…       │  │  .muted 12px
│   │ ⚠ 人数が揃っていません（レッド4名／ブルー3名）│  │  条件付き・danger tag
│   │   「合計」では人数の少ないチームが有利に…     │  │
│   └──────────────────────────────────────────────┘  │
│ ▶ ルーレット対抗                            S4       │
│ ▶ ダブルペリア設定                          S7       │
└──────────────────────────────────────────────────────┘
```

**寸法**（既存セクションの実測に合わせる・新規 CSS は書かない）

| 要素 | 値 |
|---|---|
| `<summary>` 行高 | 既存 `details.gsec>summary` と同一（44px・タップ領域） |
| ラジオ行 | `font-size:13px` / 行間 6px（既存 `game.periaCut` チェック行と同じ inline style を流用） |
| 説明 `.muted` | 12px・上マージン 6px（`mt6`） |
| 警告 | `<span class="tag" style="background:var(--danger-bg);color:var(--red)">`（`js/players.js:83` の既存パターン）＋ `.muted` 本文。**`styles.css` は触らない** |
| 閉じた状態の高さ | 44px（1行）＝S3 と S4 の間に1行増えるだけ |

**ラジオの実装**: `<label><input type="radio" name="tsm" value="sum" …onchange="setTeamScoreMode('sum')">` の2つ。`name` は同一ページに1組しか出ないので固定文字列で可。ハンドラは inline `onchange` 前提のグローバル関数（ESM 化しない）。

```js
function setTeamScoreMode(v){ const g=curGame(); if(!g)return;
  g.teamScoreMode = (v==='avg')?'avg':'sum'; save(); renderBasic(); }   // 再描画で警告の出没を追従
```

### 6.2 ★人数不揃いの警告（幹事が気づけること）

| 項目 | 決定 |
|---|---|
| 出す条件 | `(F.teamGross \|\| F.teamNet)` かつ **`teamScoreMode==='sum'`** かつ 対象チーム2以上 かつ **登録メンバー数が不揃い** |
| 判定に使う人数 | **`teamMembers(g,T).length`（登録＝参加中メンバー数）**。`teamScoreMembers`（入力済み）ではない |
| なぜ登録人数か | 経過ラウンド中は「先に上がった組だけ入力済み」で入力済み人数が揃わないのが普通＝**入力済みで判定すると毎回誤警告が出る**。幹事が制御できるのは登録人数であり、警告はその是正を促すもの |
| 平均モードでは出さない | 平均は人数差を吸収するのが目的なので警告不要（＝警告が消えることが「直った」のサインになる） |
| 出す場所① | **コンペ設定 S3b の中**（本文）＋ **`<summary>` に danger タグ**（畳んだままでも気づける） |
| 出す場所② | **結果発表 → チーム戦 → グロス対抗／ネット対抗カードの注記行**（`renderTeams` の `note` の下に1行）。幹事が結果を見る瞬間に気づけるのが実務上いちばん効く |
| 文言（ja） | 「人数が揃っていません（レッド4名／ブルー3名）。「合計」では人数の少ないチームが有利になります。」 |
| キー | `game.teamScoreWarn`（`{v}` にチーム名＋人数の羅列）。**①②で同じキーを使う**（文言の二重管理を作らない） |

判定ヘルパー（`js/calc.js`・純関数）:

```js
function teamMemberCounts(g){ return teamsOf(g).map(T=>({T,n:teamMembers(g,T).length})); }
function teamSizeUneven(g){ const c=teamMemberCounts(g).map(x=>x.n);
  return c.length>=2 && Math.min(...c)!==Math.max(...c); }
```

### 6.3 結果発表側のラベル（値が合計か平均か読み取れるか）

`renderTeams`（`js/roulette.js`）の `teamGross`/`teamNet` カードのみ変更（`best2ball`/`holeByHole`/`vegas` カードは不変）。

```
平均モード（4名 / 4名 / 3名）                    合計モード（＝既存コンペ・見た目は現行のまま）
┌─ グロス対抗 ────────────────────┐         ┌─ グロス対抗 ────────────────────┐
│ 1人あたりの平均が少ない方が勝ち  │ .muted  │ 合計が少ない方が勝ち             │
│ ┌──┬──┬────────────┬──────┐      │         │ ⚠ 人数が揃っていません（…）      │← 条件付き
│ │👁 │順│チーム       │ 平均 │      │←ヘッダ  │ ┌──┬──┬────────────┬──────┐      │
│ ├──┼──┼────────────┼──────┤      │  変更   │ │👁 │順│チーム       │  計  │      │
│ │👁 │🥇│グリーン 4名 │ 66.5 │      │         │ │👁 │🥇│レッド       │  238 │      │
│ │👁 │2 │ブルー   4名 │ 75.5 │      │         │ │👁 │2 │グリーン     │  266 │      │
│ │👁 │3 │レッド   3名 │ 79.3 │      │         │ │👁 │3 │ブルー       │  302 │      │
│ └──┴──┴────────────┴──────┘      │         │ └──┴──┴────────────┴──────┘      │
│ [全表示] [発表]                  │         │ [全表示] [発表]                  │
└──────────────────────────────────┘         └──────────────────────────────────┘
```

| 変更点 | 前 | 後（平均モードのみ） |
|---|---|---|
| 値列ヘッダ | `col.total`「計」 | `col.avg`「平均」 |
| 注記行 | `team.noteLow`「合計が少ない方が勝ち」 | `team.noteAvg`「1人あたりの平均が少ない方が勝ち」 |
| チーム名セル | 名前のみ | 名前＋`<span class="muted">4名</span>`（`team.memN`）＝**投影先の観客が平均を検算できる**（§11.14「色だけに頼らず文字併記」と同じ思想） |
| 値セル | `Math.round(r.v*10)/10` | 同じ（値は既に丸め済み。`null` は `—`） |
| 警告行 | — | 合計モード×人数不揃いのときだけ1行（§6.2） |

- 目隠し（`tgMasked`）・発表ボタン（`tpAnnounceUI`）・並べ替え・`posBadge` は不変。
- 大型表示（投影）トークンは本カードでは未使用のまま（既存踏襲）。

### 6.4 スコア表（`renderScorecard`）は表示を変えない — ただし並びは合わせる

| 要素 | 決定 | 根拠 |
|---|---|---|
| チーム「計」行（ホール別・OUT/IN・グロス・ネット） | **合計のまま**（変更なし） | 行ラベルが `col.total`「計」で、ホール別セルの足し算の延長。ここを平均にすると1ホールずつのセルと矛盾する |
| 平均値の併記 | **しない** | 平均の出所は順位カード1箇所に限る（#157 の二重管理事故の再発防止）。狭い列に括弧書きを足すと投影レイアウトが崩れる |
| チームの並べ替え（`scSortTeam==='gross'\|'net'`） | **`teamGrossVal`/`teamNetVal` に置換**（＝モード準拠・`null` 末尾） | 順位カードと並びが食い違うと「1位のチームが表の2番目にいる」状態になる |

---

## 7. 実装点の全列挙（ファイル別・実装者はこれを上から潰す）

### 7.1 `js/calc.js`（★§3 load-bearing）

**追加**（`holesWon` の直後・`function best2` の直前に置く。**この位置はプロトタイプで `tools/verify.mjs` の `grab('teamMembers')` 正規表現走査と `tools/regress.mjs` の両方を PASS 済み**）:

```js
/* ---- チーム対抗グロス／ネットの集計方法（§3.5 追補・docs/handoff/2026-09-12-team-score-average.md）----
   g.teamScoreMode: 'sum'（既存ゲーム＝migrate で backfill・従来と完全に同一）/ 'avg'（newGame の既定）。
   判定点はこの teamAvgOn() ただ1つ（他ファイルで g.teamScoreMode を直接見ない＝§5.4 の seam）。
   ★平均の母数（§3）: teamMembers ∩ 1H以上入力済み（uvMembers / teamWinPoints の entered と同型）。
     未入力メンバーは effGross=0・netScore=0（実測）＝母数に入れると平均が実在しない値まで下がる。
   ★合計モードの分子は teamMembers 全員のまま（フィルタしない）＝hidden 全false＋periaAllowNeg ON の
     病的ケースで未入力者の netScore が 0 でなくなるため（§3.4）。既存値の不変を無条件に保証する。 */
function teamAvgOn(g){ return (g&&g.teamScoreMode)==='avg'; }
function teamScoreMembers(g,T){ return teamMembers(g,T).filter(pid=>(g.scores[pid]||[]).some(v=>v!=null&&v!=='')); }
function teamAggr(g,T,valFn){
  if(teamAvgOn(g)){ const m=teamScoreMembers(g,T); if(!m.length) return null;   // 入力済み0人＝値なし（teamWinPoints では起きない・§4.4）
    return m.reduce((a,pid)=>a+valFn(pid),0)/m.length; }
  return teamMembers(g,T).reduce((a,pid)=>a+valFn(pid),0);   // ★従来式そのまま
}
function teamGrossVal(g,T){ const v=teamAggr(g,T,pid=>effGross(g,pid)); return v==null?null:(teamAvgOn(g)?Math.round(v*10)/10:v); }
function teamNetVal(g,T){ const v=teamAggr(g,T,pid=>netScore(g,pid)); return v==null?null:Math.round(v*10)/10; }
/* 人数不揃い警告の判定（§6.2）: 登録（参加中）メンバー数で見る＝経過ラウンド中の偽陽性を出さない */
function teamMemberCounts(g){ return teamsOf(g).map(T=>({T,n:teamMembers(g,T).length})); }
function teamSizeUneven(g){ const c=teamMemberCounts(g).map(x=>x.n);
  return c.length>=2 && Math.min(...c)!==Math.max(...c); }
```

**置換**（`teamWinPoints` 内・267–268 行）:

```js
if(F.teamGross) add('teamGross', teams.map(t=>teamGrossVal(g,t)),'asc');
if(F.teamNet) add('teamNet', teams.map(t=>teamNetVal(g,t)),'asc');
```

`add`／`teams` の絞り込み／`anyTeamEventFmt`／他の種目行は**一切触らない**。

### 7.2 `js/state.js`

- `migrate()`: `teamScoreMode` の backfill 1行（§5.2）。
- `newGame()`: `teamScoreMode:'avg'`（§5.3）。
- `defaultPoints()` は**触らない**（`teamEventPts` のキー集合は不変＝種目は増えない）。

### 7.3 `js/roulette.js`（`renderTeams`）

1. `const teamGross=…` / `const teamNet=…` のローカル式を**削除**し、`card('teamGross', T=>teamGrossVal(g,T), 'asc', …)` / `card('teamNet', T=>teamNetVal(g,T), 'asc', …)` に置換。
2. `card()` の中で**`null` 対応**:
   - 並べ替え: `rows.sort((a,b)=>{ const an=a.v==null, bn=b.v==null; if(an||bn) return an&&bn?0:(an?1:-1); return dir==='desc'? b.v-a.v : a.v-b.v; })`（**`null` を必ず末尾**）。
   - 値セル: `r.v==null ? '<span class="muted">—</span>' : <b>…</b>`。
3. 値列ヘッダ: `teamGross`/`teamNet` かつ平均モードのとき `col.avg`、それ以外は現状のまま（`dir==='desc'?'H':t('col.total')`）。
4. 注記: `teamGross`/`teamNet` の `note` を `teamAvgOn(g)? t('team.noteAvg') : t('team.noteLow')` に。
5. チーム名セル: 平均モードかつ `teamGross`/`teamNet` カードのとき `esc(r.t.name)+' <span class="muted">'+t('team.memN',{n:teamScoreMembers(g,r.t).length})+'</span>'`（目隠し時は名前ごとマスクなので人数も出さない）。
6. 警告行（§6.2 出す場所②）: `teamGross`/`teamNet` カードで条件成立時に `note` の直後へ1行。
   > `card()` は5種目で共用されているので、**`key==='teamGross'||key==='teamNet'` のときだけ**効く形にする（`best2ball`/`holeByHole`/`vegas` の見た目を1pxも変えない）。引数を増やす（`note` を配列/HTML にする）か、呼び出し側で `note` 文字列を組み立てて渡すのが素直。

### 7.4 `js/results.js`（`renderScorecard`）

- `tGrossOf`/`tNetOf` を `teamGrossVal`/`teamNetVal` に置換（**並べ替え専用**）。`null` は末尾（`(v==null?Infinity:v)` で十分）。
- 299–302 行の「計」行の値（`tGross`/`tNet`/`tOut`/`tIn`）は**変更しない**（§6.4）。

### 7.5 `js/game.js`（`gameSettingsHtml`）

- S3 の直後に S3b セクション（§6.1）。`setTeamScoreMode` は `js/game.js` の `setG` 群の隣に置く（`setWE`/`setUniv` と同型）。

### 7.6 `js/testdata.js`（任意・小）

- `sdBuild` に1行 `if(p.teamScore) g.teamScoreMode=p.teamScore;`、パターン `p6`（小規模・エッジ）に `teamScore:'sum'` を付与。
  → **アプリ内テストデータで両モードが再現できる**（他パターンは `newGame` 既定の平均）。既存6パターンの**チーム人数は全て揃っている**ので、平均に変わっても**勝者は変わらない**（§9 実測）。ロスター・スコア生成は1文字も触らない。

### 7.7 `index.html`

- `?v=` を PR 番号に一括更新（`js/**` を変更する PR の規律）。**それ以外は触らない**（`<script>` 読込順・inline 属性依存は不変）。

### 7.8 `styles.css`

- **触らない**（新規クラスを作らず、既存 `.tag` + `var(--danger-bg)/var(--red)` のインラインパターンを流用）。

---

## 8. 決定 E：i18n（ja / zh / en 同時・8キー追加・削除0）

`js/i18n.js` の既存の並び位置に合わせて追加（`game.*` は `game.fmtCard` の近く、`col.avg` は `col.total` の行、`team.*` は `team.noteLow` の行）。

| キー | ja | zh | en |
|---|---|---|---|
| `game.teamScoreCard` | チーム対抗の集計（合計／平均） | 团队对抗的计分（合计／平均） | Team score basis (total / average) |
| `game.teamScoreSum` | 合計（人数で割らない） | 合计（不除以人数） | Total (no division) |
| `game.teamScoreAvg` | 平均（メンバーの人数で割る） | 平均（除以队员人数） | Average (divide by players) |
| `game.teamScoreNote` | グロス対抗・ネット対抗の勝敗をどちらで決めるか。人数が違うチームがあるときは平均が公平です。ベスト2ボール・ホールバイホール・大学対抗は影響を受けません。 | 决定总杆对抗・净杆对抗胜负的方式。队员人数不同时，平均更公平。最佳两球・逐洞比洞・大学对抗不受影响。 | Sets how team gross / team net are decided. Average is fair when teams differ in size. Best 2 Ball, hole-by-hole and the university match are unaffected. |
| `game.teamScoreWarn` | 人数が揃っていません（{v}）。「合計」では人数の少ないチームが有利になります。 | 队员人数不一致（{v}）。采用「合计」时人数少的队伍更有利。 | Team sizes differ ({v}). With "Total", a smaller team is favoured. |
| `col.avg` | 平均 | 平均 | Avg |
| `team.noteAvg` | 1人あたりの平均が少ない方が勝ち | 每人平均少者胜 | Lower average per player wins |
| `team.memN` | {n}名 | {n}人 | {n} players |

- `{v}` はチーム名＋人数の羅列（`esc(name)+t('team.memN',{n})` を `／` で連結）。**ユーザー入力なので `esc()` 必須**。
- `t()` の `{}` 置換は `js/i18n.js:667` の既存実装をそのまま使う。
- 8キーすべて実際に参照される＝`verify.mjs` の未使用キー検査／未定義参照検査を通る（キー数 417 → 425）。en に日本語文字を含めない（`verify.mjs` の「en日本語残存」検査）。

---

## 9. 数値例（★前後比較・すべて実測値）

### 9.1 Issue #171 の実データ相当（ネット対抗）

| チーム | 人数 | 合計ネット | **合計での順位** | 平均ネット | **平均での順位** |
|---|---|---|---|---|---|
| A | **3名** | 230.8 | **1位 🏆** | 230.8÷3 = 76.933… → **76.9** | **2位** |
| B | 4名 | 301.4 | 2位 | 301.4÷4 = 75.35 → **75.4** | **1位 🏆** |
| C | 4名 | 344.4 | 3位 | 344.4÷4 = **86.1** | 3位 |

**優勝が A → B に入れ替わる**（＝#171 の実害がこの変更で解消する）。

### 9.2 回帰ハーネス `ghostMember` フィクスチャ（3名／4名／4名・実測）

| 種目 | 合計（現行・不変） | 平均（新規ゲーム） |
|---|---|---|
| `teamGross` vals | `[238, 302, 266]` winners `[0]`（T1=3名） | `[79.3, 75.5, 66.5]` winners `[2]`（T3） |
| `teamNet` vals | `[197.6, 262.8, 249.6]` winners `[0]` | `[65.9, 65.7, 62.4]` winners `[2]` |
| 勝ち点 `wins` | `[3, 1, 1]` | `[1, 1, 3]` |
| `computePoints`（`teamRankPts` 配分） | p01:10 p02:12 p03:10 / p09:7 p10:15 p11:5 p12:5 | p01:5 p02:7 p03:5 / p09:12 p10:20 p11:10 p12:10 |

### 9.3 人数が揃っているとき（4／4／4・実測）＝順位は変わらない

| 種目 | 合計 | 平均 | 勝者 |
|---|---|---|---|
| `teamGross` | `[326, 302, 266]` | `[81.5, 75.5, 66.5]` | どちらも `[2]` |
| `teamNet` | `[268.4, 262.8, 249.6]` | `[67.1, 65.7, 62.4]` | どちらも `[2]` |
| `wins` | `[1.5, 1.5, 2]` | `[1.5, 1.5, 2]` | 同一 |

**数学的保証**: 同人数 n なら `avg = sum/n` は**厳密な単調変換**＝順位は絶対に反転しない。0.1 丸めで**新たな同点が生まれる**ことだけがあり得る（§4.2）。それは `add()` の山分けで正しく処理される。

### 9.4 未入力メンバーがいるとき（母数の正しさ・実測）

| 種目 | 合計 | 平均（母数=登録4名・**誤実装**） | 平均（母数=入力済3名・**正**） |
|---|---|---|---|
| `teamGross` | `[238, 302]` w`[0]` | `[59.5, 75.5]` w`[0]` | `[79.3, 75.5]` w`[1]` |
| `teamNet` | `[197.6, 262.8]` w`[0]` | `[49.4, 65.7]` w`[0]` | `[65.9, 65.7]` w`[1]` |

### 9.5 平均で丸め同点になる例（山分けの確認・実測）

3名／4名／4名 の別フィクスチャ（`participants` を11名にしてスコア生成）で
`teamGross` 平均 = `[79.3, 72.5, 72.5]` → **winners `[1,2]`**（`w/2` ずつ山分け）／`teamNet` 平均 = `[65.9, 66.3, 60.9]` → winners `[2]`。

### 9.6 アプリ内テストデータ（`sdBuild`）の前後（実測・全パターン）

| パターン | チーム人数 | 合計グロス | 平均グロス | 勝者 |
|---|---|---|---|---|
| ② チーム戦フル | 4/4/4 | 366 / 362 / 367 | 91.5 / 90.5 / 91.8 | **不変**（ブルー） |
| ③ 大学対抗 | 14/7/5/5 | — | — | `teamGross`/`teamNet` **OFF** のため影響なし |
| ④ 1on1 | 5/5 | 461 / 463 | 92.2 / 92.6 | **不変**（レッド） |
| ⑤ β種目一式 | 2/2/2/2 | 182/211/168/156 | 91/105.5/84/78 | **不変**（イエロー） |
| ⑥ 小規模・エッジ | 2/2 | 180 / 149 | 90 / 74.5 | **不変**（ブルー） |

→ **既存テストデータで勝者は1つも変わらない**（値の表示だけ変わる）。`2026-08-31-testdata-patterns.md` はチーム対抗の合計値を期待値表に載せていないので**同ドキュメントは陳腐化しない**。

---

## 10. 検証計画（★「既存が1つも動かない」の機械的証明）

### 10.1 既存15ケースの不変性（★プロトタイプで既に実証済み）

本設計の実装案（§7.1 のヘルパー＋`migrate` backfill＋`newGame` 既定）を**作業ツリー外のコピーに実装して実測済み**:

```
$ node tools/regress.mjs      # 15ケース
✅ 計算回帰 全PASS             # ← teamScoreMode を migrate で 'sum' backfill した状態
$ node tools/verify.mjs
✅ 検証 全PASS                 # 構文 / i18n / 未使用キー / CSS / #3・Vegas 回帰
```

さらに `migrate` の backfill を `'avg'` に変えて全ケースを平均にすると **6ケースが差分**（`team3`/`team2Vegas`/`niadora2Sets`/`ghostMember`/`ghostBest2`/`niadoraIndOff`）、残り9ケースは不変（チーム対抗 OFF のケース）。
→ **`'sum'` backfill さえ正しければ既存の期待値 JSON は1バイトも動かない**ことが示されている。

**受け入れの必須条件**: 実装 PR では `tools/regress-expected.json` の**既存15ケースの差分が0行**であること（新ケース追加ぶんの追記のみ）。`--update` で上書きした場合も `git diff` で既存ブロックに変更が無いことをレビューで確認する。

### 10.2 平均モードの新ケース（3件・`tools/regress.mjs` に追加）

既存ケースは**1文字も変えない**。`baseGame({... teamScoreMode:'avg'})` で新規に3件足す。

| # | 名前 | 構成 | 何を固定するか | 期待値（実測済み） |
|---|---|---|---|---|
| P | `teamAvgEven` | `team3` と**完全に同じ**構成＋`teamScoreMode:'avg'`（4/4/4） | 人数が揃っていれば**勝者・勝ち点・配分が合計と同一** | `teamGross` `[81.5,75.5,66.5]` w`[2]` / `teamNet` `[67.1,65.7,62.4]` w`[2]` / `wins` `[1.5,1.5,2]`（`team3` と同じ） |
| Q | `teamAvgUneven` | `ghostMember` と**完全に同じ**構成＋`avg`（T1 は p04 がゴーストで実質3名） | **人数差で勝者が入れ替わる**／ゴースト除外（#151）と平均の併用 | `teamGross` `[79.3,75.5,66.5]` w`[2]` / `teamNet` `[65.9,65.7,62.4]` w`[2]` / `wins` `[1,1,3]` |
| R | `teamAvgUnentered` | 新規（8名・T1=`[p01..p04]` で **p04 が1打も未入力**・T2=`[p05..p08]` 全員入力・`avg`） | **母数＝入力済みメンバー**。登録人数を母数にした誤実装なら必ず落ちる | `teamGross` `[79.3,75.5]` w`[1]` / `teamNet` `[65.9,65.7]` w`[1]`（誤実装なら `[59.5,75.5]`/`[49.4,65.7]` で w`[0]`） |

ケース R のフィクスチャ定義（`tools/regress.mjs` の既存ヘルパーで書ける）:

```js
  teamAvgUnentered: { channel: 'a', game: baseGame({
    teamScoreMode: 'avg',
    teams: [ { id:'T1', name:'レッド', memberIds:['p01','p02','p03','p04'] },
             { id:'T2', name:'ブルー', memberIds:['p05','p06','p07','p08'] } ],
    participants: ALL.slice(0, 8),
    // ★p04（pi===3）は全ホール未入力＝effGross 0 / netScore 0（設計 §3.1）。他は team3 と同じ式
    scores: mkScores(ALL.slice(0, 8), (pi, h) => pi === 3 ? null : ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),
    announced: { teamGross: true, teamNet: true },
    formats: { gross: true, net: true, teamGross: true, teamNet: true, holeByHole: false, roulette: false,
      niadoraInd: false, niadoraTeam: false, stableford: false, olympic: false, callaway: false,
      nassau: false, best2ball: false, vegas: false, match1v1: false, univMatch: false, customMatch: false },
  }) },
```

> P/Q は既存ケースと**スコア生成式まで同一**にして、差分の出どころを `teamScoreMode` だけに限定する（`niadora2Sets` が `team3` を流用しているのと同じ規律）。

### 10.3 手動確認（reviewer・実ブラウザ）

1. **既存コンペの不変**: テストデータ②を作り（`p6` 以外は平均既定になるので）**先に現 main で値をメモ** → PR 版でバックアップ JSON をインポート → `teamScoreMode` が `'sum'` に backfill され**値が完全一致**。
2. 新規コンペ作成 → コンペ設定に「チーム対抗の集計」セクションが出る／**平均が選択済み**。
3. チーム人数を 4/3 にする → **設定と結果カードの両方**に警告が出る（合計モード時）。平均に切り替えると警告が消える。
4. 平均モードで `teamGross`/`teamNet` カードのヘッダが「平均」、注記が「1人あたりの平均…」、チーム名に人数。
5. 1人も入力していないチームを作る → カードの値が `—` で**末尾**に並ぶ（先頭に来ない）。
6. スコア表のチームの並びが順位カードと一致する。
7. `ja/zh/en` × `light/dark` × 幅 375/768/1024 で崩れなし。目隠し・発表ボタン・ベスト2/HBH/ベガスのカードが現状と同一。

---

## 11. 触らない範囲（load-bearing・変更したら差し戻し）

### 11.1 触らない

- **§3 の個人計算**: `gross`/`effGross`/`periaHdcp`（§11.12 H・§11.22 オプション込み）/`netScore`/`adjHole`/`stablefordPts`/`olympicPts`/`callawayHdcp`/`net9`/`nassauTotalNet`/`tieBreak`/`ranked`。
- **他のチーム種目**: `holesWon`（ホール別のチーム合計打数＝ホール単位の勝敗なので人数で割る意味がない）／`best2`（ユーザー確定③：上位2名の合計＝人数に影響されない）／`vegas*`（2人固定）／`m1*`／`niadoraTeamCount`（本数）／`customPts`／`uvStanding`（独自の平均＋上位N）。
- `teamMembers` のゴースト対策（#151/#171）＝`.filter` を**後ろに足すだけ**で中身を変えない。
- `add()` のシグネチャ・同点山分け・`live<2` ガード／`teamWinPoints` の `teams` 絞り込み（`m.some(entered)`）／`anyTeamEventFmt` の9項／`announced` ゲート／`teamEventPts` のキー集合。
- localStorage キー5つ（`golfCompe_v1`・`_lang`・`_theme`・`_channel`・`_seenTop`）／`formats` のキー集合（**新しい競技トグルは作らない**）。
- 非 ESM・inline `onclick/onchange` 依存・`index.html` の `<script>` 読込順／機能色の意味／`styles.css`（1行も足さない）。
- **`tools/regress.mjs` の既存15ケース定義**と `regress-expected.json` の既存ブロック。

### 11.2 ★実測で見つけた別バグ（本件では直さない・別Issue 候補）

`best2(g,T)` は `teamMembers` 全員の `netScore` を昇順に並べて上位2つを採るので、**1打も入力していないメンバーの `netScore=0` が「ベストボール」として採用される**（実測: メンバー net `[61, 68.8, 67.8, 0]` → `best2 = 0+61 = 61`）。
本 Issue のスコープ外（ユーザー確定③で `best2` は現状維持）。修正は §7.1 で作る `teamScoreMembers` に差し替える**1語**で済むが、**値が動く＝§3 の変更**なので別設計・別 Issue にする。

### 11.3 やらないこと（明示的にスコープ外）

- 「上位N名の平均／合計」（母数の足切り）。`teamScoreMode` を文字列にしたのは将来これを `'topNavg'` として足せるようにするため（§5.1）。
- 過去コンペの言い直し（§5.4 の seam を用意するだけ）。
- `holesWon`/`best2`/`vegas`/`univ` の方式変更。
- スコア表への平均併記（§6.4）。
- 大型表示（投影トークン）化：本カードは既存のまま（`2026-08-20-results-regroup.md` の範囲で別途）。

---

## 12. 正本への追補文（★PM が `2026-07-12-golf-compe-web.md` に貼る）

> 本設計は §3（計算）／§4（データモデル）に触れるので、**正本にも追補が必要**（CLAUDE.md の規律）。architect は正本を編集しない指示のため、貼り付け用テキストをここに置く。

**§3.5 チーム対抗** の「グロス対抗」「ネット対抗」の2行を次で置き換え（＋末尾に1行追加）:

```markdown
- **グロス対抗** = `g.teamScoreMode==='avg'` なら **Σ effGross（メンバー）÷ 母数**、`'sum'` なら **Σ effGross（メンバー）**。小さいほど良い。
- **ネット対抗** = `g.teamScoreMode==='avg'` なら **Σ net（メンバー）÷ 母数**、`'sum'` なら **Σ net（メンバー）**。小さいほど良い。
- **★2026-09-12 追補【確定・load-bearing】（`docs/handoff/2026-09-12-team-score-average.md` が正）**: グロス対抗／ネット対抗を**合計と平均で切り替え可能**にした（`g.teamScoreMode:'sum'|'avg'`）。**既存ゲームは `migrate()` が `'sum'` を backfill ＝過去コンペの値・勝者・配分は1打も変わらない**（回帰15ケース完全一致で実証）。**`newGame()` の既定は `'avg'`**（人数が違うチームがあるとき合計では人数の少ないチームが自動的に有利になるため・Issue #171）。平均の**母数は `teamScoreMembers(g,T)` ＝ `teamMembers(g,T)` かつ 1H以上入力済み**（未入力メンバーは `effGross=0`/`netScore=0` なので母数に入れると平均が実在しない値まで下がる。`uvMembers` と同型）。**分子も平均モードでは同じ集合**で取る。合計モードの式は従来どおり `teamMembers` 全員の `reduce`（フィルタしない）。丸めは**小数第1位**で、判定値と表示値は同一（同点は既存 `add()` の山分け）。**ベスト2ボール・ホールバイホール・ラスベガス・1on1・ニアドラ・任意対決・大学対抗は非接触**。
```

**§4 データモデル**（`game` のフィールド一覧）に追加:

```markdown
- `game.teamScoreMode`: `'sum' | 'avg'` … グロス対抗／ネット対抗を合計で判定するか1人あたり平均で判定するか。**既定（`newGame`）= `'avg'`／既存ゲームは `migrate` が `'sum'` を backfill**（過去コンペの結果不変）。判定は `teamAvgOn(g)` 1関数に集約（`2026-09-12-team-score-average.md` §5）。将来「上位N名平均」を足せるよう boolean ではなく文字列 enum にしてある。
```

---

## 13. 推奨 PR 分割

| PR | 内容 | 触るファイル | 検証 |
|---|---|---|---|
| **PR1** 計算＋データ＋表示追随 | §7.1 `calc.js` ヘッダ＋2行置換 / §7.2 `state.js`（migrate/newGame）/ §7.3 `roulette.js` `renderTeams`（値・ヘッダ・注記・人数・`null`）/ §7.4 `results.js` 並べ替え / §8 の `col.avg`・`team.noteAvg`・`team.memN` / §10.2 の新3ケース＋期待値 / `index.html` `?v=` | `js/calc.js`・`js/state.js`・`js/roulette.js`・`js/results.js`・`js/i18n.js`・`tools/regress.mjs`・`tools/regress-expected.json`・`index.html` | `verify.mjs` / `regress.mjs`（**既存15ケース差分0**） |
| **PR2** 設定UI＋人数不揃い警告 | §6.1 コンペ設定 S3b（ラジオ＋説明）/ §6.2 警告（設定＋結果カード）/ §8 の `game.teamScore*` 5キー / §7.6 `testdata` の `teamScore` フラグ | `js/game.js`・`js/roulette.js`（警告行のみ）・`js/i18n.js`・`js/testdata.js`・`index.html` | `verify.mjs` / `regress.mjs`（差分0）＋実ブラウザ §10.3 |

**分ける理由**: PR1 は計算・回帰スナップショットのレビューに集中（§3 load-bearing）。PR2 は目視レビュー主体で性質が違う。
**★同日・連続マージ前提**: PR1 だけが main に乗っている間は「新規ゲームは平均なのに合計へ戻す UI が無い」状態になる。PR1 を単独で放置しないこと。差分が小さい（合計 ≒120行）ので **PM 判断で1本にまとめても良い**。

**並走の注意**: 本設計の PR1/PR2 はどちらも `js/roulette.js` を触る。**同ファイルを触る他の作業（現在進行中）が main に入った後にリベースして着手すること**（直列）。`js/basic.js`・`js/course.js`・`js/i18n.js`・`styles.css` を触る他タスクとは、`js/i18n.js` だけが衝突しうる（キー追加行のみ・衝突は行単位で容易に解消）。

---

## 14. 受け入れ条件（★PM が Issue にそのまま貼れるチェックリスト）

### 機械検証
- [ ] `node tools/verify.mjs` が全 PASS（構文／i18n ja=zh=en 完全一致／未定義参照なし／**未使用キーなし**／CSS 孤立 `var()` なし／#3・Vegas 回帰）
- [ ] `node tools/regress.mjs` が全 PASS
- [ ] **`tools/regress-expected.json` の既存15ケース（`indBasic`/`team3`/`team2Vegas`/`univOff`/`univOn`/`customTie`/`customNone`/`periaOpts`/`niadora2Sets`/`ghostMember`/`ghostBest2`/`niadoraIndOff`/`niadoraCustomOnly`/`niadoraRouletteOnly`/`niadoraUnivOnly`）の期待値が不変**（`git diff` で既存ブロックの変更行が0＝追加のみ）
- [ ] 新ケース3件が追加されている（`teamAvgEven` / `teamAvgUneven` / `teamAvgUnentered`）
- [ ] `teamAvgEven` の `wins` が `team3` と同一（`[1.5,1.5,2]`）＝**同人数なら平均でも勝ち点が変わらない**
- [ ] `teamAvgUneven` の `teamGross` が `[79.3,75.5,66.5]`・winners `[2]`、`wins` が `[1,1,3]`＝**人数差で勝者が入れ替わる**
- [ ] `teamAvgUnentered` の `teamGross` が `[79.3,75.5]`・winners `[1]`（`[59.5,75.5]` になっていない＝**母数が入力済みメンバー**）
- [ ] i18n キーが ja/zh/en で8キー追加・削除0（`game.teamScoreCard`/`game.teamScoreSum`/`game.teamScoreAvg`/`game.teamScoreNote`/`game.teamScoreWarn`/`col.avg`/`team.noteAvg`/`team.memN`）
- [ ] `index.html` の `?v=` が PR 番号に一括更新されている

### 計算・データ（§3/§4）
- [ ] `js/calc.js` の変更が「§7.1 のヘルパー追加」と「`teamWinPoints` 内2行の置換」のみ（`add`/`teams` 絞り込み/他種目行は無変更）
- [ ] 合計モードの分子が `teamMembers(g,T)` 全員の `reduce`（**入力済みフィルタを掛けていない**）
- [ ] 合計モードの `teamGross` に `Math.round(v*10)/10` を掛けていない（現行の素の整数のまま）
- [ ] `g.teamScoreMode` を直接見ているのは `teamAvgOn()` だけ（他ファイルに `==='avg'` を書いていない）
- [ ] `migrate()` が既存ゲームに `'sum'` を backfill／`newGame()` が `'avg'`
- [ ] localStorage キーは5つのまま・`formats` と `points.teamEventPts` のキー集合が不変
- [ ] `best2`/`holesWon`/`vegas*`/`m1*`/`niadoraTeamCount`/`customPts`/`uvStanding` に変更なし

### 表示（結果発表）
- [ ] 平均モードで `teamGross`/`teamNet` カードの値列ヘッダが「平均」、注記が `team.noteAvg`、チーム名に人数（`team.memN`）
- [ ] 合計モードのカードは**現行と完全に同じ見た目**（ヘッダ「計」・注記「合計が少ない方が勝ち」・人数表記なし）
- [ ] `best2ball`/`holeByHole`/`vegas` のカードが1pxも変わっていない
- [ ] 誰も入力していないチームの値が `—` で**並びの末尾**（先頭に来ない）
- [ ] スコア表のチームの並びが順位カードの順位と一致（`scSortTeam` グロス／ネット）
- [ ] スコア表の「計」行の値は合計のまま（ホール別・OUT/IN・グロス・ネット）
- [ ] 総合タブの種目別勝ち点表・目隠し（`tgMasked`）・発表ボタン（`tpAnnounceUI`）が現行どおり

### 設定と警告
- [ ] コンペ設定タブの「集計する競技」直後に「チーム対抗の集計（合計／平均）」セクションがある（`F.teamGross||F.teamNet` のときだけ出る・既定は閉）
- [ ] ラジオで合計／平均を切り替えると即保存され、結果発表の値・順位が追従する
- [ ] チーム人数が不揃い＋合計モードのとき、**設定セクション（`<summary>` のタグ含む）と結果カードの両方**に警告が出る
- [ ] 平均モードに切り替えると警告が消える／人数を揃えても消える
- [ ] 経過ラウンド（一部メンバーが未入力）で**誤警告が出ない**（判定は登録人数）
- [ ] チーム名が HTML を含んでも壊れない（`esc()` 済み）

### 互換（★最重要）
- [ ] 現 main で作ったコンペのバックアップ JSON をインポート → チーム対抗グロス／ネットの値・順位・勝ち点・配分額が**完全一致**
- [ ] 既存コンペを複製（`複製` ボタン）すると合計モードを引き継ぐ
- [ ] テストデータ②④⑤⑥（人数が揃っている）で**勝者が変わらない**／⑥は合計モードで生成される
- [ ] `ja/zh/en` × `light/dark` × 幅 375/768/1024 で崩れなし
- [ ] `styles.css` に変更がない
