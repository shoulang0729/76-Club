# 設計書: テストデータ生成の刷新（パターン化・決定性シード）

- 区分: **確定（実装可）**。ユーザー要件「これまでのゲームやルールを踏まえてテスト可能な人数やスコアで生成／パターンがいくつかあっても良い」に対する設計。
- 種別: **M/L**（i18n キー追加・UI 追加・データ生成ロジック全面書き換え。ただし **§3 計算・§4 データモデルは非接触**）。
- 本ファイルが正。正本 `2026-07-12-golf-compe-web.md` への追記は **不要**（§3 計算式・§4 データモデルを一切変更しないため。`newGame()` の既存フィールドに既定以外の値を入れるだけ）。
- 関連: `2026-08-20-team-points.md`（種目別勝ち点）・`2026-08-30-winpoints-reveal.md`（announced／重み）・`2026-08-30-univ-match.md`（大学対抗）・`2026-08-20-1on1-match.md`・`2026-08-20-npdc-par.md`・`2026-08-20-hidden12-balance.md`・正本 §3 / §11.2 / §11.12 H / §11.14。

---

## 1. 現状と課題（コード実測・2026-08-31 / main = PR #110 マージ済み）

`js/testdata.js` は 34 行・単一パターンのみ。

| 項目 | 現状 | 課題 |
|---|---|---|
| 呼び出し | `js/basic.js` の `hostMenuCard()`（基本設定タブの `<details>` 幹事メニュー内）→ `onclick="seedTestData()"` | 単一ボタンのため複数パターンを選べない |
| 選手 | 固定12名（同名があれば再利用して属性上書き） | 追加パターンで名前が混ざる恐れ |
| コース | par 72 固定・`pickHidden12(g.par)`（`Math.random` 内蔵） | 隠しHが毎回変わる＝ネット／HDCP が再現不能 |
| スコア | `Math.random()` の一発生成 | 再現性ゼロ。同点・タイブレーク・境界が「たまたま」でしか出ない |
| formats | `newGame()` の既定のまま | **大学対抗・1on1・ルーレット設定・β種目・種目別勝ち点の重み・次回幹事オプション・announced が一切セットされない**＝実装済み機能の大半が未検証のまま |
| チーム | 3チーム自動割当（`color` 未設定＝名前導出） | 大学名などでは全チーム gray になる |
| ニアドラ | par から導出したホールに勝者をランダム設定 | チーム別本数が偏らず種目が成立しないことがある |

つまり **「全ゲーム・全ルールを実際に動かして検証できる状態」には遠い**。本設計はこれを 6 パターン＋決定性シードで作り直す。

---

## 2. 網羅表 A: `newGame()` の全フィールドと「意味を持たせる条件」

`js/state.js` `newGame()` / `defaultPoints()` / `newRoulette()` の全キー。**この表の「意味を持つ条件」を満たさないフィールドは、テストデータでは死んでいる**＝今回の設計はここを全部埋めるのが目的。

| # | フィールド | 型・既定 | 意味を持つ条件（`js/calc.js` 実測） | 担当パターン |
|---|---|---|---|---|
| 1 | `id` | uid() | — | 全 |
| 2 | `name` | "新しいコンペ" | 表示のみ | 全（パターン名入り） |
| 3 | `date` | 今日 | 表示のみ。**決定性のためパターン固定日付**にする | 全 |
| 4 | `course` | "" | 表示のみ | 全 |
| 5 | `par[18]` | 4/3/5 混在 | `parTotal` / `niapinHolesOf`(par3) / `draconHolesOf`(par5) / `vAdj`（2×par）/ `uvHdcpA`（2×par）/ ステーブル・オリンピックの d 基準 | 全（§5.1 の固定 par） |
| 6 | `hidden[18]` | 全 false | **12個 true でないとペリアHDCPが無意味**（`periaHdcp` / `uvHdcpA`） | 全（§5.1 の固定 hidden・`pickHidden12` は使わない） |
| 7 | `periaCoef` | 0.8 | HDCP 係数（大学対抗は非連動・0.8 固定） | 全（既定 0.8） |
| 8 | `periaCap` | null | 上限クリップ。**null 以外にしないと `periaCap` 分岐が未検証** | P3 のみ null 以外は使わない（§12 参照）／全パターン null＝規定どおり |
| 9 | `womenEvery.enabled` | false | true でないと `evPer`＝0＝エブリ全機能が死ぬ（`adjHole` / `netScore` / `holesWon` / `rlHoleScore` / Vegas 数字） | P1 P2 P5 P6 = ON／P3 P4 = OFF（手計算容易化） |
| 10 | `kanjiBadge` | false | true で `nextKanji` のバッジ表示 | P1 P2 P6 = ON |
| 11 | `kanjiRanks.{r1,r2,booby}.{enabled,dir}` | r1 OFF / r2 ON down / booby ON up | 免除（`player.kanjiExempt`）と組み合わせて `resolve` のスキップ方向を検証 | P1（r1 も ON にして 3 対象）／P2 P6 は既定 |
| 12 | `teams[]`（`{id,name,memberIds,color?}`） | [] | 全チーム種目の前提。`color` 未設定は名前導出（`tmKeyByName` は レッド/ブルー/グリーン/イエロー のみ判定＝**大学名は全部 gray**）→ **パターンでは `color` を明示** | P2〜P6 |
| 13 | `participants[]` | [] | `computePoints` の母数。`m1MemberIds` / `uvMembers` / `vegasPair` も参加中で絞る | 全 |
| 14 | `scores{pid:[18]}` | {} | 全計算の入力。`null`/`''` は未入力＝ランキング対象外 | 全 |
| 15 | `prizes.niapinWinner{h:pid}` | {} | 対象ホールは **par3 から導出**。個人 `P.niapin` 加点／`niadoraTeamCount` | P1 P2 P4 P6 |
| 16 | `prizes.draconWinner{h:pid}` | {} | 同上（par5） | P1 P2 P4 P6 |
| 17 | `prizes.niapinHoles` / `draconHoles` | [] | **廃止フィールド・非参照**（`2026-08-20-npdc-par.md`）→ 触らない | — |
| 18 | `points.net/gross/stableford/olympic/callaway/nassauTotal` | [5,3,1] | 個人配点。`awardInd` は対応 formats が ON のときのみ | 全（既定）／P1 は `net:[10,6,3]` で非既定も検証 |
| 19 | `points.teamRankPts` | [10,5] | チーム総合順位→各員配分。**3位以降は 0** | P2（[10,6,3] で 3チーム全員に配分） |
| 20 | `points.niapin` / `dracon` | 2 / 2 | NP/DC 個人加点 | P1 P2 |
| 21 | `points.m1win` / `m1draw` | 2 / 1 | 1on1 個人加点 | P4 |
| 22 | `points.teamEventPts.{niadora,teamGross,teamNet,univMatch,holeByHole,best2ball,vegas,match1v1,roulette}` | 全 1 | 種目別勝ち点の重み（0以上の整数）。`tpShare(w,n)` の分数表記も | **P2 で重み違い**（2/1/1/3/1）を検証 |
| 23 | `prizePool` | 0 | `computePayout` は `pool>0 && total>0` のときだけ配分 | P1 24000／P2 30000／P6 **0（配分ゼロ表示の確認）** |
| 24 | `roulette.changeN` / `challengeM` | 2 / 2 | ハーフ9Hあたりの回数 | P2（3/1 に変更）・P6（既定） |
| 25 | `roulette.reps{h:{tid:pid}}` / `pool` / `remChange` / `remChallenge` / `cur` | {} … 0 | `rlStandings` は **`h < cur` かつ `reps[h]` がある**ホールだけ集計。`cur=0` では順位が付かない | **P2 で前半9H分を投入（`cur=9`）** |
| 26 | `vegas.flip` / `cap` | true / 'doublePar' | `vegasHoleNet` のフリップ発動（相手チームに**生スコア**バーディ）と数字の上限 | P5 |
| 27 | `univ.every` | false | 大学対抗のエブリ適用（`g.womenEvery` とは非連動） | P3 は **OFF**（規定準拠・手計算容易）。ON 検証は UI トグルで |
| 28 | `match1v1.teamA/teamB/pairs[[a,b]]` | null/null/[] | `m1Valid` は「現在の2チーム」と一致が条件。`m1ValidPairs` で無効組を除外 | P4 |
| 29 | `announced{key:bool}` | {} | **種目別勝ち点の確定ゲート**（成立∧on）。キー＝`TP_EV_ORDER`＝`niadora/teamGross/teamNet/univMatch/holeByHole/best2ball/vegas/match1v1/roulette` | **P2 で一部だけ true**（段階表示）／他は {} |
| 30 | `formats.gross/net/niadoraInd` | true | 個人系 | 全 |
| 31 | `formats.stableford/nassau/olympic` | true | **β**（`BETA_FMT`）＝α表示では `chFormats` が false 化 | P5（β） |
| 32 | `formats.callaway/best2ball/vegas` | false | **β** | P5（β） |
| 33 | `formats.teamGross/teamNet/holeByHole/niadoraTeam/roulette` | true | チーム種目（α） | P2 P4 P6 |
| 34 | `formats.univMatch` | false | 大学対抗（2026-08-30 α昇格） | P3 |
| 35 | `formats.match1v1` | false | 1on1（α昇格済み） | P4 |
| 36 | 選手側 `player.{gender,birth,everyType,kanjiExempt}` | M/null/none/false | `tieBreak`（女性→年長）・`evPer`・`uvHdcpA` の cap（男36/女40）・`nextKanji` の免除 | 全 |

---

## 3. 網羅表 B: 各ゲーム／ルールが「意味のある結果」を出す前提条件

`js/calc.js` の実測に基づく成立条件と、テストデータで作り込むべき性質。

| ゲーム／ルール | 関数 | 成立条件（これを満たさないと空・0・不成立） | 「意味のある結果」にする条件 | 担当 |
|---|---|---|---|---|
| グロス | `effGross` | 1H以上入力（`iv()`） | 順位が割れる打数分布 | P1 P2 P5 P6 |
| ネット（ダブルペリア） | `periaHdcp`→`netScore` | `hidden` が12個 true・`periaCoef` | **隠し12合計が `adjHole` 基準**（§11.12 H）。エブリ選手で HDCP が 0 クリップされる例を含める | P1（佐藤＝HDCP 0.0 の実例） |
| 同ネットのタイブレーク | `tieBreak`／`ranked` | 値が完全一致 | ①女性が上位 ②生年月日が早い方が上位 ③同性＋同一生年月日＝**同順位** | P1（①②）／P6（③） |
| エブリ1/2 | `evPer`/`everyStrokes` | `womenEvery.enabled=true` かつ `everyType!=='none'` | E1/E2 を各2名以上・**エブリ後 HDCP** が効く | P1 P2 |
| ステーブルフォード | `stablefordPts` | β／1H以上入力 | イーグル(−2)〜ボギー(+1) が混在（0点ホールも） | P5 |
| オリンピック | `olympicPts` | β／同上 | −3以下=10点が出る選手を1名以上 | P5 |
| キャロウェイ | `callawayHdcp` | β／`enteredCount>0`。控除対象は **index<16（17・18番は対象外）** | グロスが 71以下／80台／95〜100／110超 と**帯を跨る**こと（`units` と `adj` の分岐網羅） | P5 |
| 握り（ナッソー） | `net9`/`nassauTotalNet` | β／OUT・IN 双方入力 | OUT と IN で勝者が入れ替わる | P5 |
| ベスト2ボール | `best2` | β／`t.memberIds.length>=1`（1名なら同値2重） | **各チーム2名以上** | P5 |
| ラスベガス | `vegasPair`/`vegasHoleNet` | β／**参加メンバーちょうど2名**のチームが2以上 | フリップ発動には**相手チームに生スコアのバーディ**が必要。cap='doublePar' で 2×par クリップも踏む | P5 |
| チームグロス／ネット | `teamWinPoints` | 対象チーム2以上（メンバー1人以上かつ1H以上入力） | 合計が割れる人数構成 | P2 P4 P6 |
| ホールバイホール | `holesWon` | 同上。全チーム未入力のホールはスキップ | 引分ホール（1/n 山分け）を含む | P2 P6 |
| ニアドラ（チーム） | `niadoraTeamCount` | par3/par5 が存在・勝者がチーム所属・**他のチーム種目が1つ以上採用**・本数合計≥1 | チーム別本数が **同数にならない**割当（例 3/3/2） | P2 |
| ルーレット対抗 | `rlStandings` | `formats.roulette=true`・`h<cur` の `reps[h]` が全チーム分ある | **`cur>0`**（既定 0 だと順位表が全 0） | P2（cur=9） |
| 1on1 | `m1Result`/`m1ValidPairs` | **`m1Teams(g).length===2`**・`pairs` 登録・`teamA/teamB` が現2チーム | 勝ち・負け・引分（AS）が混在 | P4 |
| 大学対抗 | `uvStanding` | `formats.univMatch`・`uvMembers≥1` の学校が2以上・`hidden` 12個 | `uvTargetN` の丸め（14→10 / 7→6 / 5→5）・**①同点→②平均グロスで決着**・HDCP上限（男36/女40）・ダブルパーカット | P3 |
| 種目別勝ち点 | `teamWinPoints` | 対象チーム2以上・種目ごと `live>=2` | **`announced[key]=true`** の種目だけ `wins` に算入（重み `w` 倍・同点は `w/n` 山分け） | P2 |
| チーム総合→個人配分 | `computePoints` | `events.some(e=>e.on&&e.w>0)` | `teamRankPts` が 3位まであること | P2 |
| 賞金配分 | `computePayout` | `pool>0 && total>0` | 端数丸めが出る配点 | P1 P2／P6 は pool=0 で 0 表示 |
| 次回幹事 | `nextKanji` | `kanjiBadge=true`・`gross>0` の参加者 | 免除者（`kanjiExempt`）を含み、方向スキップを手動で試せる | P1 P2 P6 |
| 段階開封 | `viewGameN` | 表示状態（`revealHoles`・揮発） | 未入力ホールがあるパターンで「経過」表示も確認 | P6 |

---

## 4. 決定事項（判断と根拠）

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| D1 | スコアの決定性 | **採用: シード付き擬似乱数（mulberry32）をローカル関数で実装**。パターンごとに固定シード＝毎回同じスコア。`Math.random()` はスコア生成から排除 | タイブレーク・境界・順位の検証は「同じ結果が再現できる」ことが前提。再現しないとバグ報告も再現できない。実装は5行・依存なし |
| D2 | 隠しホール | **固定 `hidden` 配列**をパターンに持たせる（`pickHidden12` は呼ばない） | `pickHidden12` は `Math.random` 内蔵。`js/course.js` は**変更しない**（触らない範囲）。固定配列は前後半×パー帯の均等配分（`2026-08-20-hidden12-balance.md` §2）に沿った形にする |
| D3 | `uid()` | **シード化しない**（`Math.random` のまま） | ID は毎回変わってよい。計算結果は ID に依存しない（`ranked` の同値は `tieBreak`、`uvStanding` の完全同値は `memberIds` 登録順＝安定ソート）。シード化すると再生成時に ID 衝突の恐れ |
| D4 | 既存パターンの扱い | **置き換え**。既存の12名名簿・属性・par・コース名は **パターン1が継承**し、スコア生成と formats を刷新 | 選手マスターの二重登録を避ける（同名再利用ロジックは維持）。既存ゲームのデータは一切書き換えないので壊れない |
| D5 | 選手名の重複 | **パターンごとに互いに素な名簿**（姓リストのオフセット固定割当）。接頭辞は付けない | 接頭辞（「P2 田中」等）は投影デモの見栄えを損なう。オフセット固定なら衝突は構造的に起きない。同名再利用ロジックは維持＝同じパターンを何度作っても選手は増えない |
| D6 | UI | 幹事メニュー（既存 `<details>`）内に **`<select>`＋説明文＋生成ボタン**。ボタン列にはしない | 投影原則 §11.14「幹事の操作UIは控えめ配置」。6個のボタンを並べるより1行で済む。`<details>` 折りたたみ・`sm` ボタンは現状維持 |
| D7 | 選択状態の保持 | testdata.js のモジュールスコープ変数 `sdPat`（揮発）。**localStorage キーは増やさない** | CLAUDE.md の load-bearing 制約。再描画で選択が戻らないよう `<option selected>` に反映 |
| D8 | i18n とデータ文字列 | **UI 文字列（パターン名・説明・ボタン・確認・トースト）だけ辞書化**。選手名・チーム名・コンペ名・コース名は **辞書に入れない**（js のデータリテラル） | ①データは `golfCompe_v1` に保存され言語切替で変化しない前提（辞書化すると「保存済みデータが言語で変わる」矛盾）②76名分×3言語は辞書を数百行肥大させる ③既存慣例（`addTeam` の `'チームレッド'`・現行 `seedTestData` の `'テストコンペ'`）と一致 |
| D9 | 未使用キーゼロ | パターン表に **i18n キーを文字列リテラルで持たせる**（`{label:'seed.p1', desc:'seed.p1d'}`）→ `t(p.label)` は動的呼び出しだが、`tools/verify.mjs` の未使用検査は「引用符で囲まれた完全一致」を js 全体から探すので **PASS**。`DYN_PREFIX` への追加は不要＝`tools/verify.mjs` は無変更 | verify.mjs 実測（`new RegExp("['\"`]"+key+"['\"`]").test(scan)`） |
| D10 | ファイル構成 | **`js/testdata.js` 1ファイルのまま**（約 300〜400 行）。「データ表（`SD_PATTERNS`）＋共通ビルダ（`sdBuild`）＋小さなヘルパ群」に構造化。**新規 JS ファイルは作らない**＝`index.html` の読込順は無変更 | 読込順・非ESM・inline onclick 方式は不変。testdata.js は calc.js より**前**に読まれるが、トップレベルでは純データの `const` しか評価しない（関数はすべて宣言＝巻き上げ、実行はクリック時）ので依存問題は起きない |
| D11 | β種目パターンのチャネル | パターン表に `ch:'a'|'b'` を持たせ、生成の最後に **既存の `setChannel(p.ch)` を呼ぶ**（`setChannel` が `render()` する） | β種目は α表示では `chFormats` が全 false 化＝作っても何も見えない。`golfCompe_channel` は既存キー＝キー集合は増えない |
| D12 | 生成の粒度 | 1回の生成で **1つの新規ゲームを追加**（既存ゲームは削除しない）。`state.currentGameId` を新ゲームへ | 現行と同じ挙動。複数パターンを並べて比較できる |

---

## 5. パターン仕様

### 5.1 全パターン共通のコース（決定性の土台）

```
par    = [4,4,3,5,4,4,3,4,5,  4,4,3,4,5,4,4,3,5]   (OUT 36 / IN 36 = 72)   ※現行 seedTestData と同一
index    0 1 2 3 4 5 6 7 8   9 …           17
hidden = [T,F,T,T,T,F,T,F,T,  T,F,T,T,T,F,F,T,T]   (12個)
```

- 隠しホール index = **{0,2,3,4,6,8, 9,11,12,13,16,17}**（前半6・後半6／各半で par3×2・par4×2・par5×2＝`hidden12-balance` §2 の均等配分と同型）。
- 非隠しホール index = {1,5,7,10,14,15}（6個）。
- par3（＝ニアピン対象）= index 2,6,11,16／par5（＝ドラコン対象）= index 3,8,13,17。**各4ホール**。
- 隠し12ホールの par 合計 = 4+3+5+4+3+5+4+3+4+5+3+5 = **48**。→ 全ホール par で回れば H=48・HDCP=(72−72)×0.8=**0**。

パターン6のみ **par を変えない**（同じ par を使う）。全パターンで `periaCoef=0.8` / `periaCap=null`。

### 5.2 スコア生成器（決定性）

```js
// mulberry32（5行・依存なし）。パターンごとに固定シードで new する
function sdRnd(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0;
  let t=Math.imul(a^(a>>>15), 1|a); t=(t+Math.imul(t^(t>>>7), 61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; }; }
```

**打数分布（skill = 0上級 / 1中級 / 2初級 / 3大叩き）**。累積しきい値・`r=rnd()` 1回で決定（`+3`枝のみ `rnd()` を追加1回消費）:

| skill | −2(イーグル) | −1(バーディ) | 0(パー) | +1 | +2 | それ以外 |
|---|---|---|---|---|---|---|
| 0 | r<0.02 | <0.12 | <0.50 | <0.80 | <0.94 | `+3+floor(rnd()*3)` |
| 1 | — | <0.06 | <0.34 | <0.70 | <0.90 | 同上 |
| 2 | — | <0.02 | <0.18 | <0.50 | <0.80 | 同上 |
| 3 | — | — | <0.06 | <0.28 | <0.60 | 同上 |

- 返り値 `Math.max(2, par + d)`（現行と同じ下限クリップ）。
- **生成順は固定**: パターンの選手配列順 → ホール 0..17 の順に 1 本の乱数ストリームを消費する（順序を変えると結果が変わるので実装で守ること）。
- 目安グロス: skill0 ≈ 76〜84 / skill1 ≈ 86〜94 / skill2 ≈ 96〜106 / skill3 ≈ 112〜126（キャロウェイの帯跨ぎ用）。

**固定スコア（override）**: パターン表は `fix:{ playerIndex: {holeIndex: score} | 'par+1' | 'par+2' | 'par+4' }` を持てる。固定は乱数生成の**後**に上書きする（乱数ストリームの位置は固定＝他選手に影響しない）。

### 5.3 パターン1 — 個人戦フル（12名・チームなし）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p1` / `20260901` / `a` |
| コンペ名・日付・コース | 「テストコンペ1 個人戦フル」/ 2026-09-01 / 「テスト国際CC」 |
| 選手 | **現行 `seedTestData` の12名をそのまま**（田中太郎 M/none/1975-04-12、佐藤花子 F/every2/1982-09-03、鈴木一郎 M/none/1968-01-25、高橋美咲 F/every1/1990-11-18、渡辺健 M/none/1979-06-30、伊藤由美 F/none/1985-03-14、山本大輔 M/none/**免除**/1972-12-05、中村彩 F/every2/1988-07-22、小林誠 M/none/1965-02-09、加藤香織 F/every1/1993-05-17、吉田隆 M/none/1981-08-28、松本恵 F/none/1977-10-11） |
| teams | **なし（`[]`）** |
| formats | `gross,net,niadoraInd` = ON／`teamGross,teamNet,holeByHole,niadoraTeam,roulette,univMatch,match1v1` = **OFF**／β全 OFF |
| womenEvery | **ON** |
| kanji | `kanjiBadge=ON`・`r1{ON,down} / r2{ON,down} / booby{ON,up}`（3対象＋免除者1名） |
| points | `net=[10,6,3]`（非既定の検証）・他は既定・`niapin/dracon=2` |
| prizePool | 24000 |
| prizes | NP 4ホール・DC 4ホール **すべてに勝者**。割当＝参加者 index を `[0,3,6,9]`（NP: hole 2,6,11,16）と `[1,4,7,10]`（DC: hole 3,8,13,17） |
| announced | `{}`（チーム種目なし） |
| スコア | 5名を固定・7名を seeded（skill = 田中1・高橋2・山本1・中村2・小林1・加藤2・松本3） |

**固定スコア（検証の核）**

| 選手 | 固定 | 期待値（手計算） |
|---|---|---|
| 佐藤 花子（F・every2） | 全ホール **par+2** | グロス 108 → エブリ −36 → effGross 72／`adjHole`= par → 隠し12合計 48 → **HDCP 0.0**／**ネット 72.0**（正本 §11.12 H・`verify.mjs` の #3 と同じシナリオを UI で再現） |
| 伊藤 由美（F・none） | 全ホール **par+1** | グロス 90／隠し12合計 60 →（90−72)×0.8＝**HDCP 14.4**／**ネット 75.6** |
| 鈴木 一郎（M・none・1968） | 同上 | ネット 75.6 |
| 渡辺 健（M・none・1979） | 同上 | ネット 75.6 |
| 吉田 隆（M・none・1981） | 同上 | ネット 75.6 |

→ **ネット 75.6 の4名が連続して並び、順位は 伊藤（女性）→ 鈴木（1968）→ 渡辺（1979）→ 吉田（1981）**。`tieBreak` の ①性別 ②生年月日 が同時に検証できる（4名とも別順位になる＝`ranked` の `eq` 判定も検証）。

### 5.4 パターン2 — チーム戦フル（12名・3チーム）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p2` / `20260902` / `a` |
| コンペ名・日付 | 「テストコンペ2 チーム戦フル」/ 2026-09-02 |
| 選手 | 姓リスト offset 0 から12名（男8・女4／女4名は E1×2・E2×2）。生年月日は 1965〜1995 の固定値 |
| teams | 3チーム×4名（`チームレッド`/`チームブルー`/`チームグリーン`、`color` は `red`/`blue`/`green` を明示）。割当は index の `i%3` |
| formats | `gross,net,niadoraInd,niadoraTeam,teamGross,teamNet,holeByHole,roulette` = ON／`univMatch,match1v1` = OFF／β全 OFF |
| womenEvery | ON |
| points | `teamRankPts=[10,6,3]`（**3位まで配分**）・`teamEventPts = { teamGross:2, teamNet:1, holeByHole:1, niadora:3, roulette:1, univMatch:1, best2ball:1, vegas:1, match1v1:1 }`（**重み違い**・`tpShare` の分数表記も出る） |
| prizePool | 30000 |
| prizes | NP/DC 計8本を **レッド3・ブルー3・グリーン2** になるよう固定割当（`niadoraTeamCount` が 3/3/2 → 順位が付く） |
| announced | **`{ teamGross:true, niadora:true }` のみ true**（残り3種目は未発表＝「発表 2/5」＋？マスクの段階表示） |
| roulette | `changeN=3, challengeM=1`（既定 2/2 と違う値）。**前半9H を投入済み**: `cur=9`／`reps[0..8]` に各チームの代表を1名ずつ（チームのメンバー配列を h ごとに巡回＝重複なし）／`pool[tid]` = 使用済み9名（＝各チーム4名なので巡回で2周＋1）／`remChange[tid]=3`・`remChallenge[tid]=1`（後半分を再付与済みの状態） |
| スコア | 全員 seeded（skill = チーム内で 0,1,2,3 を1名ずつ＝チーム力が拮抗） |

**期待される検証ポイント**: ①チーム総合カードが「発表 2/5」で、未発表3種目が？表示 ②`teamGross`（重み2）と `niadora`（重み3）だけが勝ち点に算入 ③発表ボタンで残り3種目を順に連携すると勝ち点・総合順位・個人配分が段階的に変わる ④ルーレット順位表が最初から埋まっており、後半9Hは実際に回して試せる ⑤`teamRankPts=[10,6,3]` で3チーム全員に配分が付く。

### 5.5 パターン3 — 大学対抗（31名・4校）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p3` / `20260903` / `a` |
| コンペ名・日付 | 「テストコンペ3 大学対抗」/ 2026-09-03 |
| 選手 | 姓リスト offset 12 から31名。**女性を各校に1名以上** |
| teams（＝学校） | 東都大学 **14名**（`red`）／南山大学 **7名**（`blue`）／北稜大学 **5名**（`green`）／西京大学 **5名**（`yellow`） |
| formats | `gross,net,univMatch` = ON／`teamGross,teamNet,holeByHole,niadoraTeam,niadoraInd,roulette,match1v1` = **OFF**（種目別勝ち点が univMatch 単独＝順位と勝ち点の対応が一目で分かる）／β全 OFF |
| womenEvery / univ.every | **両方 OFF**（規定準拠・手計算容易。ON の挙動は UI トグルで試す） |
| prizePool | 20000 |
| announced | `{}`（未発表スタート → 連携ボタンで確定を確認） |
| スコア | 東都14名・南山7名は seeded（skill を散らす）＋固定2名（下記）。北稜5名は seeded、**西京5名は北稜のコピー＋1名だけ改変**（下記） |

**検証ポイント①: 集計対象人数 `uvTargetN`**

| 学校 | P | N | 内訳 |
|---|---|---|---|
| 東都大学 | 14 | **10** = min(14, round(5+9×0.5)=round(9.5)=10) | 規定の例そのもの・足切り4名 |
| 南山大学 | 7 | **6** = round(6.0) | 足切り1名 |
| 北稜大学 | 5 | **5** = min(5, round(5.0)) | 全員 |
| 西京大学 | 5 | **5** | 全員 |

**検証ポイント②: HDCP上限（男36/女40）＋ダブルパーカット**（東都大学に固定で2名配置）

- 「東都の初級男子」「東都の初級女子」の2名に **全ホール par+4** を固定する。

| 値 | 計算 | 結果 |
|---|---|---|
| グロス（`uvGrossA`＝カットなし） | 72 + 4×18 | **144** |
| 隠し12合計（`uvHdcpA`＝ダブルパーカット） | par3: min(7,6)=6 ×4 ＋ par4: min(8,8)=8 ×4 ＋ par5: min(9,10)=9 ×4 = 24+32+36 | **92**（カット無しなら 96） |
| HDCP 素値 | (92×1.5 − 72)×0.8 = (138−72)×0.8 | 52.8 → **男 36.0 / 女 40.0 にクリップ** |
| 大学対抗ネット `uvNetA` | 144−36 / 144−40 | **男 108.0 / 女 104.0** |
| （比較）通常のペリア | 隠し12＝96（カットなし・上限なし）→ (144−72)×0.8 = 57.6 | **ネット 86.4** |

→ 同じ選手で「大学対抗の独立計算（規定準拠）」と「アプリのネット」が **108.0 / 104.0 vs 86.4** と明確に食い違うことを画面で確認できる（`2026-08-30-univ-match.md` §4.4 の案A採用の可視化）。この2名は当然 **足切り対象外4名**に入る（グレーアウト表示の検証も兼ねる）。

**検証ポイント③: 学校の同点タイブレーク（①平均ネット同点 → ②平均グロスで決着）**

西京大学は北稜大学の5名を **スコアごとコピー**し、うち1名（`d1`）だけ次を固定する:

| ホール | 北稜 `c1` | 西京 `d1` | 差 |
|---|---|---|---|
| index 3（par5・**隠し**） | **5** | **10**（=2×par ちょうど＝カットに触れない） | +5 |
| index 1（par4・**非隠し**） | **5** | **6** | +1 |
| その他16ホール | seeded | 同一（コピー） | 0 |

数値例（`c1` の隠し12合計 H=66・グロス95 の場合）:

| | `c1`（北稜） | `d1`（西京） |
|---|---|---|
| `uvGrossA` | 95 | 95+6 = **101** |
| 隠し12合計 H | 66 | 66+5 = **71** |
| `uvHdcpA` | (99−72)×0.8 = **21.6** | (106.5−72)×0.8 = **27.6** |
| `uvNetA` | 95−21.6 = **73.4** | 101−27.6 = **73.4**（同値） |

→ 5名のネット多重集合が完全一致＝**①平均ネットが厳密に同値**。②平均グロスは 6/5 = **1.2 打だけ西京が悪い** → **北稜が上位**（4成分完全一致ではないので同順位にはならない）。`uvStanding` の `cmp` が ①→② で決着することを実データで確認できる。
※ 実装注: `c1` の他16ホールは seeded なので H は上表と一致しない可能性があるが、**差分（+5 / +6 / HDCP +6.0 / ネット ±0）は H の値によらず成立する**（HDCP が 0 クリップも 36/40 cap も踏まない範囲であること＝skill 1 or 2 を割り当てる）。

### 5.6 パターン4 — 1 on 1 マッチプレー（10名・2チーム）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p4` / `20260904` / `a` |
| コンペ名・日付 | 「テストコンペ4 1on1 マッチプレー」/ 2026-09-04 |
| 選手 | 姓リスト offset 43 から10名（男6・女4） |
| teams | 2チーム×5名（`チームレッド`=`red` / `チームブルー`=`blue`） |
| formats | `gross,net,niadoraInd,niadoraTeam,teamGross,teamNet,holeByHole,match1v1` = ON／`roulette,univMatch` = OFF／β全 OFF |
| womenEvery | **OFF**（`adjHole` = 生スコア＝マッチの勝敗が目視で検算できる） |
| points | `m1win=2, m1draw=1`（既定）・`teamRankPts=[10,5]` |
| prizePool | 15000 |
| announced | `{}`（未発表スタート） |
| match1v1 | `teamA`=レッド、`teamB`=ブルー、`pairs` = 5組（A側 index i × B側 index i、i=0..4） |

**スコア構成（勝敗を確定させる）**: A側5名は **ホール0〜5 を `par+1` に固定**＋ホール6〜17 は seeded。B側5名は **A側の同 index の配列をコピー**し、ホール0〜5 にだけ下表の差分を足す（クリップの心配がない＝ `par+1` ベースなので `−1` しても par 以上）。

| 組 | B側の差分（ホール0..5） | 勝ちホール | 結果 |
|---|---|---|---|
| #1 | +1,+1,+1,0,0,0 | A×3 | **A の 3UP 勝ち** |
| #2 | −1,−1,−1,−1,+1,0 | B×4 / A×1 | **B の 3UP 勝ち** |
| #3 | +1,+1,−1,−1,0,0 | A×2 / B×2 | **AS（引分）** |
| #4 | +1,0,0,0,0,0 | A×1 | **A の 1UP 勝ち** |
| #5 | 0,0,0,0,0,+1 | A×1 | **A の 1UP 勝ち** |

→ ホール6〜17 は A/B が完全同一（コピー）＝すべてハーフ。**チームサマリ「レッド 3 – 1 ブルー・AS 1」**、個人配点は A側 +2/+2/+1/+2/+2（=9pt 相当の内訳）、B側 +0/+2/+1/+0/+0。`teamWinPoints` の `match1v1` はマッチ勝利数 3 vs 1 でレッド勝ち。

### 5.7 パターン5 — β種目一式（8名・4チーム×2名）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p5` / `20260905` / **`b`（生成後に自動でβへ切替）** |
| コンペ名・日付 | 「テストコンペ5 β種目一式」/ 2026-09-05 |
| 選手 | 姓リスト offset 53 から8名（男5・女3／女は E1×1・E2×1・none×1） |
| teams | 4チーム×**ちょうど2名**（レッド/ブルー/グリーン/イエロー・`color` 明示）＝**ラスベガスの資格条件**（`vegasPair`） |
| formats | `gross,net,niadoraInd,teamGross,teamNet,holeByHole,niadoraTeam` = ON ＋ **β: `stableford,olympic,callaway,nassau,best2ball,vegas` を全 ON**／`roulette,univMatch,match1v1` = OFF |
| womenEvery | ON |
| vegas | `flip=true, cap='doublePar'`（既定） |
| prizePool | 16000 |
| announced | `{}` |
| スコア | skill 割当 = 各チームの1人目/2人目 = レッド(0,2)・ブルー(1,3)・グリーン(0,3)・イエロー(2,1) → **グロスが 76〜126 に散る**（キャロウェイの `units`／`adj` の帯を跨ぐ） |

**固定（ホール0＝par4）でラスベガスのフリップを確実に発動**:

| チーム | 1人目 | 2人目 | 基本数字 | フリップ |
|---|---|---|---|---|
| レッド | **3（バーディ）** | 5 | 35 | 53 |
| ブルー | 5 | 6 | 56 | 65 |
| グリーン | 5 | 5 | 55 | 55 |
| イエロー | 6 | 6 | 66 | 66 |

前後比較（レッド vs ブルー・ホール0）: レッドにバーディがあるのでブルーの数字が反転 → `netA = nB − nA = 65 − 35 = **+30**（レッド有利）。フリップ無効時は `56 − 35 = +21`。**差 9 がフリップの効果**として画面で確認できる。

### 5.8 パターン6 — 小規模・エッジ（4名・2チーム）

| 項目 | 値 |
|---|---|
| key / seed / ch | `p6` / `20260906` / `a` |
| コンペ名・日付 | 「テストコンペ6 小規模・エッジ」/ 2026-09-06 |
| 選手 | 姓リスト offset 61 から4名。**E1（男・1970-05-05・none）／E2（男・1970-05-05・none）** ＝ 同性・**同一生年月日**／**E3（女・1985-01-01・every1）／E4（男・1990-01-01・none）** |
| teams | 2チーム×2名（`チームレッド`=E1,E3 / `チームブルー`=E2,E4） |
| formats | `gross,net,niadoraInd,niadoraTeam,teamGross,teamNet,holeByHole,roulette` = ON／β・`univMatch`・`match1v1` OFF |
| womenEvery | ON |
| kanji | `kanjiBadge=ON`（既定 ranks。N=4 なので booby = index 2） |
| prizePool | **0**（配分ゼロの表示確認） |
| roulette | 既定（`cur=0`＝未進行。ルーレット演出を最初から試せる） |
| announced | `{}` |
| prizes | **NP 4ホール中2ホールだけ勝者設定・DC 4ホール中1ホールだけ**（残りは未設定の表示確認） |
| スコア（全員固定） | E1・E2 = 全ホール **par+1**（グロス90）／E3 = 全ホール **par+2**（グロス108・E1 で adj は par+1 相当）／E4 = **ホール0〜11 のみ par+1・12〜17 は未入力（null）** |

**検証ポイント**: ①E1 と E2 はネット完全同値かつ `tieBreak`=0（同性・同一生年月日）→ **同順位**（`ranked` の `eq` 分岐）②E4 は未入力あり → `complete=false`・`allComplete=false`（暫定バッジ）・段階開封の途中状態と同じ見え方 ③HBH でブルーは 12H 以降 E2 のみの合計になる（`holesWon` の `cnt` ガード）④賞金プール 0 → 配分すべて 0 ⑤NP/DC の未設定ホールが「—」表示。

---

## 6. データ構造と実装の形（`js/testdata.js`）

```js
/* ============================ TEST DATA ============================ */
// 1) 定数データ（トップレベルは純データのみ＝読込順に非依存・D10）
const SD_SEI = [ /* 姓 68個。現行12名の姓（田中/佐藤/鈴木/高橋/渡辺/伊藤/山本/中村/小林/加藤/吉田/松本）とは重複させない */ ];
const SD_MEI_M = [ /* 男性名 10 */ ], SD_MEI_F = [ /* 女性名 10 */ ];
const SD_PAR    = [4,4,3,5,4,4,3,4,5, 4,4,3,4,5,4,4,3,5];
const SD_HIDDEN = [true,false,true,true,true,false,true,false,true, true,false,true,true,true,false,false,true,true];
const SD_PATTERNS = [ { key:'p1', label:'seed.p1', desc:'seed.p1d', seed:20260901, ch:'a', … }, … ];
let sdPat = 'p1';                       // 選択中パターン（揮発・localStorage 非保存・D7）

// 2) ヘルパ（すべて関数宣言＝巻き上げ）
function sdRnd(seed){ … }               // mulberry32（§5.2）
function sdHole(rnd, par, skill){ … }   // 打数分布（§5.2）
function sdName(i, gender){ return SD_SEI[i] + ' ' + (gender==='F'?SD_MEI_F:SD_MEI_M)[i%10]; }
function sdPlayer(spec){ … }            // 既存同名を再利用して属性上書き（現行ロジックを踏襲）→ pid
function sdTeams(g, defs, ids){ … }     // {name,color,members:[idx…]} → g.teams
function sdScores(g, p, ids){ … }       // seeded → fix override → コピー派生（P3 西京 / P4 B側）
function sdRoulette(g, spec){ … }       // P2 の前半9H投入
function sdPrizes(g, ids, spec){ … }    // NP/DC 勝者の固定割当

// 3) 共通ビルダ＋エントリポイント（関数名は据え置き＝basic.js の inline onclick 互換）
function sdSetPat(v){ sdPat=v; const el=document.getElementById('sdDesc');
  if(el) el.textContent = t((SD_PATTERNS.find(p=>p.key===v)||SD_PATTERNS[0]).desc); }   // ★再描画しない（details が閉じるため）
function sdBuild(p){ … return g; }
function seedTestData(){
  const p = SD_PATTERNS.find(x=>x.key===sdPat) || SD_PATTERNS[0];
  if(!confirm(t('confirm.seedTest',{v:t(p.label)}))) return;
  const g = sdBuild(p);
  state.games.push(g); state.currentGameId = g.id; save();
  if(p.ch) setChannel(p.ch); else render();     // setChannel は render() を内包（D11）
  toast(t('toast.testCreated',{v:t(p.label)}));
}
```

想定行数: 約 350 行（データ表 ≒ 200・ロジック ≒ 150）。分割が必要になった場合でも **新規ファイルは作らない**（作るなら `index.html` の読込順で `testdata.js` の直後・`calc.js` の直前に置くこと。ただし本設計では不要）。

---

## 7. UI 設計（基本設定タブ・幹事メニュー／`js/basic.js` `hostMenuCard()`）

UI テーマ（画面構成・ナビの再編）ではなく、**既存の `<details>` 内に select を1行足すだけ**なのでモック承認は省略可。レイアウトは下図で確定。

```
基本設定タブ（既存カードの下）
┌──────────────────────────────────────────────┐
│ ▸ 幹事メニュー（動作確認・上級者向け）        │  ← 既存 <details>（既定は閉）
└──────────────────────────────────────────────┘
   ▼ 展開時
┌──────────────────────────────────────────────┐
│ 動作確認用の機能です。…（host.note・muted）   │
│                                              │
│ パターン                      ← host.seedPattern (label.fl)
│ ┌──────────────────────────────────────────┐ │
│ │ ① 個人戦フル（12名）              ▼      │ │ ← <select onchange="sdSetPat(this.value)">
│ └──────────────────────────────────────────┘ │    幅 100%（既存 select の既定スタイル）
│ グロス／ネット／ニアピン・ドラコン／…（muted）│ ← <div class="muted" id="sdDesc">（選択で即差し替え）
│                                              │
│ [ このパターンでテストデータを作成 ]          │ ← class="btn gold sm"（既存と同じ）
│ 選んだパターンの選手・コース・…（muted）      │ ← host.seedNote
└──────────────────────────────────────────────┘
```

- `<select>` の `<option>` は `SD_PATTERNS` を map（`value=p.key` / ラベル `t(p.label)` / `sdPat` と一致する option に `selected`）。
- **`sdSetPat` は `renderBasic()` を呼ばない**（`<details>` に `open` 属性が無いため再描画で折りたたまれてしまう）。説明文は `getElementById('sdDesc').textContent` の直接更新のみ。
- 生成後の `render()`（`setChannel` 経由）で details は閉じるが、`sdPat` は保持されるので次回展開時に選択が残る。
- 投影原則 §11.14 準拠: 折りたたみ・`sm` ボタン・`muted` 注記＝幹事操作は控えめのまま。新しい CSS クラスは追加しない（`styles.css` 無変更）。

---

## 8. i18n（`js/i18n.js`・ja/zh/en 同時・キー集合完全一致）

### 8.1 変更する既存キー（4件・値のみ変更／キーは維持）

| キー | ja | zh | en |
|---|---|---|---|
| `host.seedBtn` | このパターンでテストデータを作成 | 按此模板生成测试数据 | Create test data with this pattern |
| `host.seedNote` | 選んだパターンの選手・コース・チーム・ゲーム設定・スコアを一括投入し、新しいゲームとして開きます。同じパターンは何度作っても同じスコアになります。 | 一键生成所选模板的选手·球场·队伍·比赛设置·成绩，并作为新比赛打开。同一模板每次生成的成绩相同。 | Seeds players, course, teams, game settings and scores for the selected pattern and opens it as a new game. The same pattern always gives the same scores. |
| `confirm.seedTest` | 「{v}」のテストデータを新しいゲームとして作成します。よろしいですか？ | 将创建「{v}」的测试数据作为新比赛，确定吗？ | Create test data "{v}" as a new game? |
| `toast.testCreated` | テストデータを作成しました（{v}） | 已生成测试数据（{v}） | Test data created ({v}) |

### 8.2 追加キー（13件）

| キー | ja | zh | en |
|---|---|---|---|
| `host.seedPattern` | パターン | 模板 | Pattern |
| `seed.p1` | ① 個人戦フル（12名） | ① 个人赛全项（12人） | 1. Individual, full (12 players) |
| `seed.p1d` | グロス／ネット／ニアピン・ドラコン／女性エブリ／次回幹事バッジ／賞金配分。チームなし。同ネットのタイブレーク（性別→年齢）も確認できます。 | 总杆／净杆／近旗·远打／女子每洞让杆／下次干事徽章／奖金分配。无队伍。也可确认同净杆时的排序（性别→年龄）。 | Gross / Net / NP and LD / women Every / next-host badge / prize split. No teams. Includes a net tie to check the tiebreak (gender, then age). |
| `seed.p2` | ② チーム戦フル（12名・3チーム） | ② 团体赛全项（12人·3队） | 2. Team, full (12 players, 3 teams) |
| `seed.p2d` | チームグロス／ネット／HBH／ニアドラ／ルーレット（前半9H進行済み）。種目別勝ち点は重み違いで、一部の種目だけ発表済みです。 | 团队总杆／净杆／逐洞／近旗远打／轮盘（前9洞已进行）。各项目胜分权重不同，且仅部分项目已同步。 | Team gross / net / hole-by-hole / NP-LD / roulette (front 9 already played). Event points use mixed weights and only some events are synced. |
| `seed.p3` | ③ 大学対抗（31名・4校） | ③ 大学对抗（31人·4校） | 3. University match (31 players, 4 schools) |
| `seed.p3d` | 集計人数 14→10・7→6・5→5、同点時の平均グロス決着、ハンディキャップ上限（男36／女40）とダブルパーカットを確認できます。 | 可确认计分人数 14→10・7→6・5→5、并列时以平均总杆决胜、差点上限（男36／女40）与双帕封顶。 | Checks scoring counts 14 to 10, 7 to 6, 5 to 5, ties broken by average gross, handicap caps (36 men / 40 women) and the double-par cut. |
| `seed.p4` | ④ 1 on 1 マッチプレー（10名・2チーム） | ④ 1 on 1 比洞赛（10人·2队） | 4. 1-on-1 match play (10 players, 2 teams) |
| `seed.p4d` | 5組の組合せを設定済み。3勝1敗1引分で、チームの勝敗と個人の勝ち点（勝ち+2／引分+1）を確認できます。 | 已设定5组对阵。3胜1负1平，可确认队伍胜负与个人胜分（胜+2／平+1）。 | Five pairings preset: 3 wins, 1 loss, 1 halved, to check team results and individual points (win +2 / halve +1). |
| `seed.p5` | ⑤ β種目一式（8名・4チーム） | ⑤ β项目全套（8人·4队） | 5. Beta events (8 players, 4 teams) |
| `seed.p5d` | ステーブルフォード／オリンピック／キャロウェイ／握り／ベスト2／ラスベガス。各チーム2名でラスベガスが成立します。生成後は自動でβ版に切り替わります。 | 斯特伯福／奥林匹克／卡拉威／握手赛／最佳2球／拉斯维加斯。每队2人以满足拉斯维加斯条件。生成后自动切换到β版。 | Stableford / Olympic / Callaway / Nassau / Best 2 / Vegas. Each team has exactly 2 players so Vegas is valid. Switches to the beta channel after creation. |
| `seed.p6` | ⑥ 小規模・エッジ（4名・2チーム） | ⑥ 小规模·边界（4人·2队） | 6. Small / edge cases (4 players, 2 teams) |
| `seed.p6d` | 同順位・未入力ホール・賞金プール0・ニアピン/ドラコン勝者の一部未設定など、境界の表示を確認できます。 | 可确认并列名次、未输入洞、奖金池为0、近旗/远打获奖者部分未设定等边界显示。 | Tied ranks, unfilled holes, a zero prize pool and partly unset NP/LD winners for boundary checks. |

### 8.3 未使用キー検査（`tools/verify.mjs`）を通す条件

- `seed.*` は `t('seed.p1')` の形では呼ばれない（`t(p.label)`）が、**`SD_PATTERNS` に文字列リテラル `'seed.p1'` / `'seed.p1d'` として現れる**ので、`verify.mjs` の「引用符で囲まれた完全一致」検査を通る。
- したがって **`tools/verify.mjs` の `DYN_PREFIX` / `KNOWN_UNUSED` は変更しない**（変更したら設計違反として reviewer が差し戻す）。
- en 値に**ひらがなを含めない**（`verify.mjs` の en 日本語残存チェック）。上表の en はすべて条件を満たす。

---

## 9. 触る範囲 / 触らない範囲

**触る（4ファイル）**

| ファイル | 変更内容 |
|---|---|
| `js/testdata.js` | 全面書き換え（§6） |
| `js/basic.js` | `hostMenuCard()` に select＋説明＋（既存ボタン）を追加（§7）。他の関数は不変 |
| `js/i18n.js` | 8.1 の値変更4件＋8.2 の追加13件（ja/zh/en 同時） |
| `index.html` | `?v=` を PR 番号へ**一括更新**（css/js 全行） |

**触らない（★load-bearing）**

- `js/calc.js` … **1行も変更しない**（テストデータは既存計算を「動かす」だけ・§3 計算式は正本）。
- `js/state.js` … `newGame()` / `defaultPoints()` / `newRoulette()` / `migrate()` / `LS_KEY` すべて不変。**localStorage キーを増やさない**（`golfCompe_v1` 内で完結。`golfCompe_channel` は既存キーを既存関数 `setChannel` 経由で使うだけ）。
- `js/course.js` … `pickHidden12` は呼ばない・変更しない。
- `js/results*.js` / `js/roulette.js` / `js/players.js` / `js/game.js` / `js/score.js` / `js/nav.js` … 不変。
- `styles.css` … 不変（新規クラス無し）。
- `tools/verify.mjs` / `tools/regress.mjs` … 不変（`regress` の期待値は計算不変なので変わらない）。
- ESM 化しない／inline `onclick`・`onchange` のグローバル関数依存を維持。`seedTestData()` の**関数名は据え置き**。

---

## 10. 受け入れ条件

**共通**

1. `node tools/verify.mjs` 全 PASS（i18n 3言語キー完全一致・未使用キー0・未定義参照0・計算回帰）。
2. `node tools/regress.mjs` が **期待値更新なしで PASS**（計算不変）。
3. `git diff origin/main -- js/calc.js js/state.js js/course.js styles.css tools/` が**空**。
4. DevTools > Application > Local Storage のキーが `golfCompe_v1` / `golfCompe_lang` / `golfCompe_theme` / `golfCompe_channel` / `golfCompe_seenTop` **のみ**（増えていない）。
5. `index.html` の `?v=` が全行 PR 番号に更新されている。
6. 6パターンすべてを生成でき、生成直後にコンソールエラー 0・結果発表タブの全サブタブが描画される。
7. **決定性**: 同じパターンを2回生成 → 2つのゲームで、選手名をキーにしたスコア配列が**完全一致**（`hidden` / `par` / NP・DC 勝者も一致）。
8. **名前衝突なし**: 6パターンすべてを1回ずつ生成 → 選手マスターに同名が2件以上存在しない。さらに同じパターンをもう1回生成しても**選手数が増えない**（同名再利用）。
9. 既存の（刷新前の）テストデータで作ったゲームを開いても表示・計算が壊れない（データ非改変）。
10. 言語を zh / en に切り替えても幹事メニューの select・説明・ボタン・確認ダイアログ・トーストがすべて訳文になる。

**パターン別（数値検証）**

11. **P1**: 佐藤花子の HDCP **0.0** / ネット **72.0**。ネット **75.6** が4名並び、順位が 伊藤 → 鈴木 → 渡辺 → 吉田 の順。次回幹事バッジが1件以上表示され、賞金配分の合計が 24000（丸め誤差 ±人数）。
12. **P2**: チーム総合カードのヘッダが「発表 2/5」。`teamGross` の勝ちチームに **×2**、`niadora` に **×3** の重み表記。ニアドラ本数が 3/3/2。ルーレット順位表が 9ホール分埋まっており（合計勝ち数 = 9）、後半 10H 目から回せる。未発表3種目を連携すると総合順位と個人配分が変わる。
13. **P3**: 大学対抗タブで 東都 **10/14**・南山 **6/7**・北稜 **5/5**・西京 **5/5**。北稜と西京の **①平均ネットが同値**で、**②平均グロスで北稜が上位**（同順位ではない）。東都の初級男子/女子の HDCP が **36.0 / 40.0**、大学対抗ネットが **108.0 / 104.0**、同じ選手の個人ネットは **86.4**。
14. **P4**: 1on1 サマリが「レッド **3 – 1** ブルー」＋「AS 1」。各カードの UP 数が §5.6 の表と一致。個人ポイントに `m1win`(+2)／`m1draw`(+1) が反映。
15. **P5**: 生成後に **β版へ自動で切り替わる**（ヘッダのバッジが β）。ホール1（index 0）のラスベガス ネット差が **レッド +30**（フリップ ON）／`vegas.flip` を OFF にすると **+21** になる。キャロウェイのグロスが 3帯以上に散る。
16. **P6**: E1 と E2 が**同順位**（順位バッジが同じ数字）。E4 が未入力で「暫定」表示。賞金配分がすべて 0。NP/DC の未設定ホールが「—」。

---

## 11. 推奨PR分割（3PR・**順序あり／同一ファイルを触るため並列不可**）

| PR | 内容 | 受け入れ条件 |
|---|---|---|
| **PR-1（基盤＋P1・P2）** | `sdRnd`／`sdHole`／`SD_PATTERNS` 骨組み／`sdBuild`／姓名リスト／`js/basic.js` の select UI／i18n（変更4＋追加 `host.seedPattern`・`seed.p1`〜`p2d` の5＝計9キー分。**P3〜P6 のキーはこの PR では追加しない**＝未使用キー検査に引っかからないため） | 共通1〜10（P3〜P6 を除く）＋11・12 |
| **PR-2（P3・P4）** | 大学対抗パターン（コピー派生・cap 検証の固定2名）＋1on1 パターン（差分テーブル）／i18n 4キー追加 | 共通1〜8＋13・14 |
| **PR-3（P5・P6）** | β種目パターン（`setChannel` 連携・Vegas 固定ホール）＋エッジパターン／i18n 4キー追加 | 共通1〜8＋15・16 |

- 3PR とも `js/testdata.js` / `js/i18n.js` を触るので**直列**（前PRのマージ後に main からブランチを切る）。
- 1PR にまとめる選択も可（レビュー負荷とのトレードオフ）。**まとめる場合も §10 の受け入れ条件は全項目**が対象。

---

## 12. PM 確認事項（実装をブロックしない・既定で進める）

| # | 論点 | 本設計の既定（この前提で実装可） | 変更したい場合の影響 |
|---|---|---|---|
| 1 | パターン数 6 の是非 | 6パターン（§5）。P5 のみβ | 減らすなら PR-3 を落とす／増やすなら `SD_PATTERNS` に追加＋i18n 2キー |
| 2 | 大学対抗の 31名 | 規定例（14名→10）を再現するため 4校31名。選手マスターは全パターン生成で計 **77名**（P1 12＋P2 12＋P3 31＋P4 10＋P5 8＋P6 4） | 減らすと `uvTargetN` の 14→10 が検証できない |
| 3 | テスト選手の一括削除 | **本設計のスコープ外**（既存の選手削除UI・バックアップ書き出し/読み込みで代替） | 必要なら別 Issue（「テストデータ一括削除」）で。localStorage キーは増やさない前提 |
| 4 | β自動切替（P5） | 生成時に `setChannel('b')` を実行（α系パターンは `setChannel('a')`）。確認ダイアログ文言には明記せず、パターン説明（`seed.p5d`）に記載 | 「勝手にチャネルが変わるのは驚く」なら `ch` を `null` にして手動切替を促す注記へ変更（実装1行） |
| 5 | `periaCap` の検証 | 全パターンで `null`（規定どおり）。上限クリップは大学対抗（36/40）で検証済み | ペリア上限の検証も要るなら P1 に `periaCap:36` のバリアントを追加 |
| 6 | 幹事メニューの置き場所 | 現状どおり基本設定タブの `<details>` 内 | 「結果発表からも呼びたい」等があれば別 Issue |
| 7 | パターン1の名簿継承 | 現行12名の名前・性別・生年月日・免除をそのまま継承（D4） | 名簿を刷新すると既存マスターに旧12名が残る（実害なし・重複表示のみ） |
