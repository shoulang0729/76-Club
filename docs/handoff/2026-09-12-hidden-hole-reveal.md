# 設計：隠しホールを1ホールずつ開示する演出（暫定ハンデ・暫定ネット順位が連動して動く） — 2026-09-12

- 作成: 2026-09-12 / architect（GitHub Issue #161）
- **区分: 確定**（§16 に PM 確認事項5件＝すべて既定案つき。既定案のまま実装してよい）
- **サイズ判定: L**（新しい結果タブ1枚・新しい揮発状態・`js/calc.js` への新規純関数追加・i18n キー追加・β 配信ゲート。PR 3本）
- **load-bearing 該当**:
  - §3 の既存計算式（`periaHdcp` / `netScore` / `effGross` / `adjHole` ほか）は **1行も変更しない**（§4.1 で機械確認の手順を定義）
  - localStorage キーは **5つのまま**（演出の進行状態は揮発・§11.14 原則4）
  - i18n は ja/zh/en 同時追加（§10）
  - 非 ESM・inline `onclick`・`index.html` の読込順は不変（新規 JS ファイルを作らない・§9.6）
- 前提設計（先に読むこと）:
  - 正本 `2026-07-12-golf-compe-web.md` **§3（計算仕様）** / **§4（データモデル）** / **§11.12 H**（ペリア HDCP はエブリ適用後 `adjHole` 基準） / **§11.14**（投影原則） / **§11.22**（ペリア任意オプション2つ）
  - `docs/handoff/2026-08-20-hidden12-balance.md` … 隠し12の層化抽選（`pickHidden12`）。**抽選順は保存されていない**（§6.1 の根拠）
  - `docs/handoff/2026-08-30-winpoints-reveal.md` / `2026-09-12-niadora-reveal-per-set.md` … 既存の「開封演出は揮発」の前例

---

## 0. 結論サマリ

| # | 論点 | 決定 | 節 |
|---|---|---|---|
| 1 | 開示状態の持ち方 | **揮発のモジュール変数 `hrState`**（`{gid, sig, order[], count, seq, prevRank}`）。開示済み集合＝`order.slice(0,count)`。localStorage 非保存 | §5 |
| 2 | 開示順 | **既定＝ホール番号昇順**。`seq='shuffle'` でシャッフル（モード開始時に Fisher–Yates で1回だけ確定・揮発）。**抽選順は復元不可能**（`g.hidden` は boolean 配列で順序を持たない） | §6 |
| 3 | 計算との連動 | **暫定 HDCP＝開示済み k ホールの実測＋未開示 (N−k) ホールを「その選手の入力済み全ホール平均」で仮置き**した見込み値。`js/calc.js` に**新規純関数2つだけ追加**（既存関数は不変）。**k≧N は `return periaHdcp(g,pid)` の早期リターン＝現行と構造的に完全一致** | §3・§4 |
| 4 | 表示 | **結果発表＞個人戦グループの末尾に専用タブ「隠しホール開示」を新設**。ヒーロー（直近開示ホール＋12マスの進捗）／大型の暫定ネット順位（順位変動矢印）／18ホール帯／操作は `<details>` 折りたたみ | §9 |
| 5 | **`revealHoles` との関係** | **計算は直交・UI は排他**。(a) 数学的には `revealHoles`＝スコア側マスク、本件＝隠しホール側マスクで独立に合成可能（`renderResult` の `viewGame(g0)` を通るので合成は自動）。(b) UI では本タブに**スコア開封バーを出さない**（スコアカード自体を出さない）。`revealHoles<18` のときは**警告バー＋「スコアを全部開く」ボタン1個**を出し、**自動では書き換えない** | §7 |
| 6 | 投影原則 | 主役＝暫定ネット順位（`--f-rl-score`）＋直近開示ホール（`--f-rl-hole`）。幹事操作は `<details>`＋`sm` ボタン。順位変動は**色だけに頼らず ▲2 / ▼1 / − の文字併記** | §9 |
| 7 | チャネル | **β**。`BETA_FMT` はフォーマット（`g.formats` のキー）の配列なので**演出は入れられない** → `resGameTabs` で `CHANNEL==='b'` を直接ゲートにする | §11 |
| 8 | 回帰の証明 | ① `node tools/regress.mjs`（`--update` なし）が **PASS＝既存スナップショット無差分**。② 同PRで `hiddenReveal` セクションを追加し `--update` → **差分が「追加のみ・既存キーの値変更ゼロ」**をレビューで確認。③ 追加セクションに `identity: hrHdcpAt(g,pid,全開示)===periaHdcp(g,pid)` を全選手 AND で含める | §12 |
| 9 | PR 分割 | **3本**（PR1 計算＋最小UI／PR2 投影演出＋CSS／PR3 開示順オプション＋`revealHoles` ガード＋ルール文） | §13 |

---

## 1. 要件

### 1.1 Issue #161 の狙い（原文要約）

> ダブルペリアの**隠しホール（12ホール）を1つずつ開示していく演出**を作る。開示するたびに **暫定ハンデと暫定ネット順位が再計算されて動く**ので、表彰式のクライマックスに使える。「隠しホールが1つ開くたびに順位がひっくり返る」体験そのものが価値。

### 1.2 価値の中核（これを満たさない実装は不合格）

**「1回開示するたびに数値と順位が動く」**こと。動かないステップが続く実装は、たとえ数学的に正しくても**要件を満たさない**。§3 はこの一点を実測で検証して案を選んでいる。

---

## 2. 現状（実装を読んで確認した事実）

| 事実 | 場所 | 本件への含意 |
|---|---|---|
| 隠しホールは `g.hidden`（**boolean × 18**）。抽選は `pickHidden12(par)` で前半/後半 × Par帯の層化 | `js/course.js:39-50` | **抽選順は保存されていない**＝「抽選順に開示」は実装不可能（§6.1） |
| 隠しホールは幹事が手でも増減できる（`toggleHidden` / `clearHidden`） | `js/course.js:32,52` | 本数 N は **12 とは限らない**。表示・計算とも `N=g.hidden.filter(Boolean).length` を使う |
| `periaHdcp` は `g.hidden` と `adjHole`（エブリ適用後）を読む。`periaDblPar` で `min(v,2*par)`、`hd<0` は 0 クリップ（`periaAllowNeg` で解除可・ただし隠しホール全入力時のみ）、`periaCap` で上限、0.1 丸め | `js/calc.js:12-20` | **`g.hidden` を差し替えるだけで「開示済みのみで計算」は作れる**（§3.2 変種A）。ただし `periaAllowNeg` は経過中に暴走する（§3.5） |
| `netScore = effGross − periaHdcp`。`effGross` は `g.hidden` に**非依存** | `js/calc.js:26,31` | 暫定ネット＝`effGross`（不変）−暫定HDCP で作れる |
| 既存の開封演出 `revealHoles`（0〜18・揮発）は `viewGameN(g,n)` で **先頭 n ホールだけ残したスコア**のビューゲームを作る。`n>=18` は `return g`（同一参照） | `js/nav.js:4` / `js/results.js:76-87` | 本件は `hidden` 側、`revealHoles` は `scores` 側 ＝ **直交**（§7） |
| `renderResult` は `const g=viewGame(g0)` を作り、`renderIndGame(g, parts, key)` に渡す | `js/results.js:105` | 本タブの関数に `g` が渡る時点で**スコア側マスクは適用済み**＝合成は自動（§7.2） |
| `BETA_FMT` は `g.formats` のキー名配列。`chFormats(g)` が α で `F[k]=false` にする | `js/nav.js:31-38` | **演出（フォーマットでないもの）は `BETA_FMT` に入れられない**（§11） |

---

## 3. ★中核：暫定 HDCP をどう定義するか（4案を実測比較して決めた）

### 3.1 問題の所在

ダブルペリアの式は

```
HDCP = ( Σ(隠し12ホールのエブリ後スコア) × 1.5 − 規定打数 ) × 係数     ※ hd<0 は 0 クリップ
```

で、**規定打数（72）が定数で引かれる**。開示済み k ホールぶんの Σ しか入れないと、k が小さいうちは括弧の中が必ず負になり、0 クリップで**全員 HDCP=0** になる。

> 素朴に計算すると、`Σ×1.5 > 72` すなわち **1ホール平均5打なら k>9.6** まで誰の HDCP も動かない。

### 3.2 検討した4変種

| 変種 | 定義 | ステップ数 | §3 への接触 |
|---|---|---|---|
| **A** 素のビュー | 未開示の隠しホールを `hidden=false` にしたビューゲームを既存 `periaHdcp` に流す（Issue 本文の指定案） | 12 | **なし**（ビューのみ） |
| **B** k本換算 | `Σ_k × (N/k)` に引き伸ばして12ホール相当にする | 12 | 新規関数（式の末尾を再実装） |
| **B'** 平均仮置き ★採用 | `Σ_k + (N−k) × その選手の入力済み全ホール平均` | 12 | 新規関数（式の末尾を再実装） |
| **C** 18ステップ判定 | 「1H から順に隠しか否かを判定」。未判定ホールは暫定的に**隠し扱い**（`hidden[i]=true`） | 18 | **なし**（ビューのみ） |

### 3.3 実測（8名・par72・係数0.8・上限36・エブリ3名・決定的フィクスチャ）

`js/{state,nav,score,roulette,calc}.js` を `vm` に読み込み、4変種を同一データで走らせた実測値：

| 変種 | 数値が動いたステップ | 順位変動（のべ人数） | 全開示＝現行一致 | 判定 |
|---|---|---|---|---|
| A 素のビュー | **5 / 12**（k=0〜7 は**完全に無反応**・全員 HDCP 0） | 13 | ✅ | ❌ 演出の前半6割が死ぬ |
| B k本換算 | 12 / 12 | 56 | ✅ | △ 動くが暴れる（k=1 で 30.4 → k=3 で 16 → k=4 で 19.6） |
| **B' 平均仮置き** | **12 / 12** | **52** | ✅ | ✅ **採用** |
| C 18ステップ | 5 / 18 | 15 | ✅ | ❌ **隠しホールを開示しても数値が動かない**（動くのは「非隠し」を判定した時だけ＝演出意図の逆）。かつ末尾3ステップが全部隠しで完全に無反応 |

変種 A の実測（先頭8ステップ・全員 HDCP 0 / ネット＝グロスのまま）:

```
k= 0  明 0/84#3  蓮 0/104#7  桜 0/92#4  健 0/83#2  美咲 0/83#1  豪 0/105#8 …
k= 7  明 0/84#3  蓮 0/104#7  桜 0/92#4  健 0/83#2  美咲 0/83#1  豪 0/105#8 …   ← 7回開示して1つも動かない
k= 8  明 0/84#3  蓮 5.2/98.8#5 …                                              ← ようやく動き出す
```

変種 B'（採用案）の実測（抜粋・`HDCP/ネット#順位`）:

```
k= 0  明 11.2/72.8#3  蓮 27.2/76.8#7  桜 17.6/74.4#4  健 10.4/72.6#2  美咲 10.4/72.6#1  豪 28/77#8
k= 6  明 13.6/70.4#2  蓮 33.6/70.4#3  桜 16.8/75.2#7  健 10.8/72.2#4  美咲 14.4/68.6#1  豪 29.2/75.8#8
k=11  明 14.4/69.6#3  蓮 31.3/72.7#5  桜 20.9/71.1#4  健 14.3/68.7#2  美咲 15.5/67.5#1  豪 30.2/74.8#7
k=12  明 16/68  #2   蓮 31.6/72.4#5  桜 22/70  #4   健 14.8/68.2#3  美咲 16/67  #1   豪 31.6/73.4#7
現行  明 16/68       蓮 31.6/72.4    桜 22/70       健 14.8/68.2    美咲 16/67       豪 31.6/73.4   ← k=12 と完全一致
```

B' が演出として優れている理由（実測から読めること）:
1. **k=0 でも意味のある値が出る**（全員のネットが 72.6〜77.0 に密集＝「スタート時点は横一線」）。B は k=0 が未定義、A は k=0 で全員グロス並び。
2. 開示が進むほど**ばらける**（最終 67〜74.4）。「1つ開くたびに差がつく」という体験そのもの。
3. **12/12 のステップで数値が動き、12/12 のステップで順位も入れ替わった**（のべ52人ぶんの順位変動）。

### 3.4 採用案の定義（★確定）

```
N  = 隠しホール本数 = g.hidden.filter(Boolean).length
R  = 開示済み隠しホールの index 集合（|R∩隠し| = k）
c(i) = g.periaDblPar ? min(adjHole(g,pid,i), 2*g.par[i]) : adjHole(g,pid,i)     ← periaHdcp と同一規則（§11.12 H・§11.22）
avg  = Σ_{i=0..17, 入力済み} c(i) / 入力済みホール数                            ← その選手の「平均的なホール」
Σ_est = Σ_{i∈R かつ hidden かつ 入力済み} c(i) + (N − k) × avg
HDCP_est = round1( clamp( (Σ_est × 1.5 − parTotal(g)) × g.periaCoef ) )         ← 0クリップ・periaCap は現行と同じ
NET_est  = round1( effGross(g,pid) − HDCP_est )
```

**ただし k ≧ N（全開示）のときは `periaHdcp(g,pid)` / `netScore(g,pid)` をそのまま返す（早期リターン）。**

### 3.5 暫定中は `periaAllowNeg` を必ず無効にする（★実装必須・バグ源）

`periaAllowNeg`（§11.22 ②）は「隠しホールが全て入力済みなら 0 クリップを外す」。開示途中のビューではこの条件が**少ない隠しホールで成立してしまい**、実測で以下が起きた：

```
隠しホールを1本だけ開示した状態で periaAllowNeg=true → HDCP = −53.6 / ネット = 138.6
```

採用案 B' では `clamp` に**常に 0 クリップを適用**することで構造的に回避する（k≧N の早期リターン側は現行 `periaHdcp` に委ねる＝オプションの意味は最終値で正しく効く）。

> **既知の非連続点（意図的）**: `periaAllowNeg=true`（既定 OFF）かつ HDCP が負になる選手では、k=N−1（0クリップ＝0）と k=N（負値）で値が飛ぶ。§11.22 が定めた「経過中は 0 クリップ」の規律と同じ扱いにするため、これを正とする。

### 3.6 不採用案を後で選び直せるようにする（seam）

表示層は **`hrHdcpAt(g,pid,R)` / `hrNetAt(g,pid,R)` の2関数しか呼ばない**。暫定値の定義を変種 A に戻したくなった場合、`hrHdcpAt` の k<N 分岐を

```js
return periaHdcp(Object.assign({},g,{hidden:g.hidden.map((h,i)=>h&&R.has(i)), periaAllowNeg:false}), pid);
```

の1行に置き換えるだけで済む（表示・状態・i18n は無変更）。§16-Q1 で PM が A を選んだ場合はこの形にする。

---

## 4. 計算仕様（★§3 追補・load-bearing）

### 4.1 既存関数は1行も変えない

`js/calc.js` に**追加するのは以下の2関数だけ**。既存の `periaHdcp` / `netScore` / `effGross` / `adjHole` / `parTotal` ほかは**読むだけ**。

```js
/* ---- 隠しホール開示演出（§11.25・docs/handoff/2026-09-12-hidden-hole-reveal.md §3.4）----
   表示専用の暫定値。既存 §3 計算には一切触れない（関数プレフィックス hr で分離）。
   R = 開示済みホール index の Set。k>=N（全開示）は既存関数をそのまま返す＝現行と完全一致。 */
function hrHdcpAt(g,pid,R){
  const cap=(v,i)=> g.periaDblPar? Math.min(v,2*g.par[i]) : v;
  let N=0,k=0,sum=0;
  g.hidden.forEach((hid,i)=>{ if(!hid)return; N++;
    if(R.has(i)){ const v=adjHole(g,pid,i); if(v!=null){ sum+=cap(v,i); k++; } } });
  if(N===0) return null;                       // 隠しホール未設定＝演出対象外
  if(k>=N)  return periaHdcp(g,pid);           // ★全開示＝既存関数そのもの（早期リターン）
  let tot=0,cnt=0;
  for(let i=0;i<18;i++){ const v=adjHole(g,pid,i); if(v!=null){ tot+=cap(v,i); cnt++; } }
  if(!cnt) return null;                        // 1ホールも入力なし＝順位対象外（ranked が落とす）
  const est=sum+(N-k)*(tot/cnt);
  let hd=(est*1.5 - parTotal(g))*g.periaCoef;
  if(hd<0)hd=0;                                // ★暫定中は periaAllowNeg を必ず無効（§3.5）
  if(g.periaCap!=null && hd>g.periaCap)hd=g.periaCap;
  return Math.round(hd*10)/10;
}
function hrNetAt(g,pid,R){ const hd=hrHdcpAt(g,pid,R); if(hd==null)return null;
  return Math.round((effGross(g,pid)-hd)*10)/10; }
```

- `adjHole` を経由するので **§11.12 H（エブリ適用後基準）を自動的に満たす**。
- `periaDblPar` のカットは**仮置きの平均側にも適用**する（`cap()` を両方で使う）＝ §11.22 ①の規律と同順。
- 返り値 `null` は「順位対象外」。既存 `ranked()` が `r.v!=null` で落とす（`js/calc.js:70`）。

### 4.2 変えないもの（明示）

- `periaHdcp` / `netScore` / `net9` / `nassauTotalNet` / `best2` / `teamWinPoints` / `computePoints` / `computePayout` / `nextKanji` / `uvHdcpA` — **すべて非接触**。
- 既存タブ（グロス／ネット／ステーブル／…／チーム戦／ポイント配分）の表示値は**本機能の状態に一切依存しない**（§7.3）。
- `g.hidden` を**書き換えない**（演出は読むだけ。コースタブの抽選・手動編集には触らない）。

### 4.3 数値例（手計算で追える前後比較）

前提: par72 / `periaCoef=0.8` / `periaCap=36` / `periaDblPar=false` / 隠し N=12 / 選手A のエブリ後グロス（`effGross`）＝**96**（18ホール入力済み・平均 96/18 = 5.3333…）

| 段階 | 開示済み隠しホールの合計 | Σ_est | 暫定 HDCP | 暫定ネット |
|---|---|---|---|---|
| k=0 | — | `12 × 5.3333 = 64` | `(64×1.5 − 72)×0.8 = 19.2` | `96 − 19.2 = 76.8` |
| k=6（6ホール合計 36＝平均6・悪い） | 36 | `36 + 6×5.3333 = 68` | `(68×1.5 − 72)×0.8 = 24.0` | `96 − 24.0 = 72.0` |
| k=6（6ホール合計 24＝平均4・良い） | 24 | `24 + 6×5.3333 = 56` | `(56×1.5 − 72)×0.8 = 9.6` | `96 − 9.6 = 86.4` |
| **k=12（全開示・隠し12H合計 70）** | 70 | — | **`(70×1.5 − 72)×0.8 = 26.4`** | **`96 − 26.4 = 69.6`** |
| **現行（`periaHdcp`）** | 70 | — | **`(70×1.5 − 72)×0.8 = 26.4`** | **`69.6`** |

- **k=12 の行と「現行」の行が同値**＝早期リターンにより構造的に保証（丸め誤差も発生しない。同じ関数を呼ぶため）。
- 同じ k=6 でも「良いホールが開いた／悪いホールが開いた」で HDCP 9.6 ⇔ 24.0（ネット 86.4 ⇔ 72.0）と大きく振れる＝**順位がひっくり返る**。
- 比較（不採用の変種A）: k=6・合計36 のとき `(36×1.5 − 72)×0.8 = −14.4 → 0 クリップ` ＝ **HDCP 0・ネット 96**。以降 k=9 あたりまで全員 0 のまま。

---

## 5. 開示状態のモデル（★揮発・localStorage 非保存）

### 5.1 状態（`js/results.js` の先頭・既存の `pzMode`/`scOpen` と同じ場所）

```js
/* 隠しホール開示演出の進行状態（§11.14 原則4＝揮発・localStorage 非保存）。
   order＝開示順に並べた「隠しホールの index」／count＝開示済み本数／
   sig＝紐づけ中のデータ署名（ゲーム切替・隠しホール変更で自動リセット・clibSync と同型） */
let hrState={ gid:null, sig:'', order:[], count:0, seq:'hole', prevRank:null };
```

| フィールド | 型 | 意味 |
|---|---|---|
| `gid` | string\|null | 紐づけ中のゲームID |
| `sig` | string | `g.hidden.map(h=>h?1:0).join('')` ＝隠しホール構成の署名 |
| `order` | number[] | **隠しホールの index だけ**を開示順に並べた配列（長さ N） |
| `count` | number | 開示済み本数（0〜N） |
| `seq` | `'hole'`\|`'shuffle'` | 開示順モード |
| `prevRank` | `{pid:rank}`\|null | 直前ステップの順位（変動矢印用）。`null`＝矢印を出さない |

**「何ホール開示済みか（count）」と「順序（order）」の両方を持つ**（＝集合ではなく列）。理由:
- 「1つ戻す」が `count--` の1行で済み、必ず直前と同じ状態に戻る（集合だと戻す対象が曖昧）。
- シャッフル順でも再描画のたびに順序が変わらない（`order` に固定される）。

開示済み集合は導出する: `function hrRevealed(){ return new Set(hrState.order.slice(0,hrState.count)); }`

### 5.2 同期（`clibSync` と同型・データ変更への追従）

```js
function hrSync(g){
  const sig=g.hidden.map(h=>h?1:0).join('');
  if(g.id!==hrState.gid || sig!==hrState.sig){         // ゲーム切替 or 隠しホールの構成変更 → 進行をリセット
    hrState.gid=g.id; hrState.sig=sig; hrState.count=0; hrState.prevRank=null;
    hrState.order=hrBuildOrder(g);
  }
}
```

- **コースタブで隠しホールを引き直す／手で増減すると進行はリセットされる**（幽霊状態を作らない）。
- ページ再読込でも当然リセット（揮発）。演出の途中でリロードしたら最初からやり直し＝§11.14 原則4 の帰結として受け入れる（`revealHoles` と同じ挙動）。

### 5.3 操作（すべてグローバル関数・inline `onclick` から呼ぶ）

| 関数 | 動作 |
|---|---|
| `hrNext()` | `prevRank` に**現在の順位**を退避 → `count=min(N,count+1)` → `renderResult()` |
| `hrBack()` | `prevRank=null` → `count=max(0,count-1)` → `renderResult()` |
| `hrAll()` | `prevRank` に現在の順位を退避 → `count=N` → `renderResult()` |
| `hrReset()` | `prevRank=null`・`count=0` → `renderResult()` |
| `hrSetSeq(v)` | `seq=v` → `order=hrBuildOrder(g)` → `count=0`・`prevRank=null` → `renderResult()` |

> `prevRank` を退避するのは**前進時だけ**。戻る／リセットで矢印を出すと「順位が戻った」ように見えて誤読を招くため。

---

## 6. 開示順

### 6.1 抽選順は使えない（実装を読んだ結論）

`pickHidden12(par)` は `Array(18).fill(false)` に `true` を立てた**boolean 配列だけ**を返し、選ばれた順序は捨てている（`js/course.js:41-50`）。`g.hidden` にも順序情報はない。したがって**「抽選順に開示」は現行データでは実装不可能**。順序を保存するには `g` にフィールドを足す必要があり（§4 データモデル変更・手動編集との整合も必要）、演出のために計算データを汚すのは §11.14 原則4 に反するので**採らない**。

### 6.2 採用する2モード

```js
function hrBuildOrder(g){
  const H=g.hidden.map((h,i)=>h?i:-1).filter(i=>i>=0);     // ホール番号昇順
  if(hrState.seq!=='shuffle') return H;
  const a=H.slice();                                        // Fisher–Yates（一様）。
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;                                                 // ★sort(()=>Math.random()-0.5) は非一様なので使わない
}
```

| モード | 既定 | 想定運用 |
|---|---|---|
| `hole` ホール番号順 | ★既定 | 幹事が「1番…隠しホールです」とコースを順に辿って読み上げる。観客が追える |
| `shuffle` シャッフル | | どのホールが来るか分からないランダム演出。モード切替時に1回だけ確定し、以後は再描画しても変わらない |

> **`hidden12-balance.md` rev.2 §R2 の指摘（`sort(()=>Math.random()-0.5)` は非一様）を本件でも守る**こと。

---

## 7. ★`revealHoles` との関係（Issue が「一番難しい」とした論点の結論）

### 7.1 結論（2行）

- **計算上は完全に直交＝合成して構わない**（`revealHoles`＝`g.scores` 側のマスク／本件＝`g.hidden` 側のマスク）。
- **UI 上は排他的に運用する**。本タブには**スコア開封バーを置かず**、`revealHoles<18` なら**警告と1タップの是正手段**を出す。**自動では書き換えない**。

### 7.2 計算上の合成規則（実測で検証済み）

`renderResult` は `const g=viewGame(g0)`（＝`viewGameN(g0,revealHoles)`）を作って `renderIndGame(g,…)` に渡す（`js/results.js:105`）。本タブの描画関数も同じ `g` を受け取るので、**`hrHdcpAt(g,pid,R)` に渡る時点でスコア側マスクは適用済み**。追加のコードは不要。

意味論は「**開封済みスコアの範囲内で、開示済み隠しホールを使う**」＝二重の暫定になる：

| `revealHoles` | 隠し開示 k | 暫定 HDCP の中身 |
|---|---|---|
| 18（全開） | k<N | 全18ホールの平均で仮置き（§3.4 そのもの） |
| 9 | k<N | **前半9ホールだけ**の平均で仮置き。後半の隠しホールは開示しても `adjHole=null` で実測に入らず、仮置き扱いのまま |
| 18 | k=N | **`periaHdcp(g,pid)`＝現行の確定値** |
| 9 | k=N | **`periaHdcp(viewGameN(g0,9),pid)`＝現行の `revealHoles=9` 時と完全に同じ値**（＝本機能ONで既存挙動は一切変わらない） |

実測: `revealHoles=9` のまま全開示にしたとき、`hrHdcpAt`/`hrNetAt` は `periaHdcp`/`netScore`（同じ `viewGameN(g,9)` ゲーム上）と**一致**し、`computePoints` も一致した（§12 の検証スクリプトで確認）。

### 7.3 UI 上の規則（★確定）

1. **本タブにはスコアカード（`renderScorecard`）を出さない**。したがって開封バー（リセット/前へ/次のホール/全部）はそもそも画面に出ない。**2つの演出操作が同じ画面に並ぶことはない**。
2. **`revealHoles < 18` のときだけ**、タブ冒頭に**注意バー1本**を出す:
   - 文言（`hr.warnScore`）: 「スコアが {n}/18H しか開封されていません。暫定ハンデは開封済みホールだけで計算されます。」
   - **`sm` ボタン1個**（`hr.openScores`「スコアを全部開く」）→ 既存 `openAllHoles()` を呼ぶだけ。
3. **自動で `revealHoles=18` にはしない**。理由: `revealHoles` は**他タブ（スコア表・ポイント配分・チーム戦）の見え方も変えるグローバルな演出状態**であり、タブを開いただけで書き換えると、幹事が仕込んだ別の演出（#97 の既定＝未開封）を壊す。**破壊的な副作用をワンタップの明示操作に限定する**。
4. 逆方向の干渉は**存在しない**。`hrState` は本タブの描画関数からしか読まれないので、他タブの表示値は本機能の進行状態に**一切依存しない**（§4.2）。

### 7.4 想定する式次第（幹事向けの運用手順・ヘルプ文言に反映）

```
① スコア開封演出（既存 revealHoles）… 全ホール開封して「グロス確定」まで見せる
② 隠しホール開示演出（本件）        … タブを切り替え、隠しホールを1本ずつ開けてネットを確定させる
③ ポイント配分タブ                   … 最終結果
```

---

## 8. データフロー図

```
  ┌─ データ（golfCompe_v1・書き換えない）──────────────────────────┐
  │  g.scores[pid][0..17]      g.hidden[0..17]      g.par / periaCoef / periaCap /       │
  │                                                  periaDblPar / periaAllowNeg          │
  └───────┬───────────────────────┬──────────────────────────┘
          │                                   │
          │  ┌─ 揮発の表示状態（localStorage 非保存）─────────────────┐
          │  │  revealHoles (0..18)            hrState{order,count,seq,prevRank}  │
          │  └──────┬──────────────────────┬───────────────┘
          │         │                                  │
          ▼         ▼                                  ▼
   ┌────────────────────┐            ┌──────────────────────┐
   │ viewGameN(g0, revealHoles)      │            │ hrRevealed()                      │
   │  = Object.assign({},g,{scores}) │            │  = Set(order.slice(0,count))      │
   │  ※ n>=18 は g をそのまま返す     │            │  ※ count>=N は「全開示」          │
   └──────────┬─────────┘            └───────────┬──────────┘
              │  g（スコア側マスク済み）                          │  R
              └───────────────┬───────────────┘
                                      ▼
                    ┌──────────────────────────────┐
                    │ hrHdcpAt(g,pid,R)  ← calc.js（新規純関数）  │
                    │   k>=N ─────► periaHdcp(g,pid)  ★§3 そのまま│
                    │   k< N ─────► Σ_k + (N−k)×avg で見込み      │
                    └──────────────┬───────────────┘
                                      ▼
                    hrNetAt = effGross(g,pid) − hrHdcpAt(g,pid,R)
                                      ▼
                    ranked(parts, pid=>hrNetAt(...), 'asc')   ← 既存の順位関数・タイブレークを流用
                                      ▼
     ┌──────────────────────────────────────────────┐
     │ renderHiddenReveal(g, parts)                                     │
     │   ヒーロー（直近開示ホール・k/N）／暫定ネット順位（▲▼）／18H帯／操作 │
     └──────────────────────────────────────────────┘

  ※ 他タブ（ネット・ポイント配分・チーム戦）は hrState を読まない＝表示値は一切変わらない
```

---

## 9. 表示設計（§11.14 投影原則／PM のモック用）

### 9.1 置き場所

**結果発表 ＞ 個人戦グループ ＞ 下段ゲームタブの末尾**に「隠しホール開示」を新設（`resGameTabs` の `grp==='ind'` 末尾）。

```js
if(CHANNEL==='b' && F.net && g.hidden.some(Boolean)) T.push(['reveal', t('result.sub.reveal')]);
```

- `F.net`（ダブルペリア＝ネット採用中）を条件にする理由: 隠しホールはネット（ペリア HDCP）のためだけに存在する。
- `g.hidden.some(Boolean)` を条件にする理由: 隠しホール未設定のコンペで**押せないタブを出さない**（`niadora-reveal-per-set.md` §9-⑧ と同じ規律）。
- 見出し `<h2>` は置かない（タイトルはゲームタブ名が兼ねる＝`result-heading-unify.md` §3.2）。

### 9.2 レイアウト（投影 1024px 想定・上から順）

```
┌ result-sticky（既存）────────────────────────────────────┐
│ [ 個人戦 ][ チーム戦 ][ ポイント ]                                        │
│ [ニアピン／ドラコン][グロス][ネット]…[ 隠しホール開示 ]                     │
└──────────────────────────────────────────────────┘

  ※ revealHoles<18 のときだけ →  ⚠ スコアが 9/18H しか開封されていません…  [スコアを全部開く]  ← .warnbar・sm ボタン

┌ カード① ヒーロー（.hr-hero）── height 約 150px ──────────────┐
│                                                                        │
│        7 H                                    隠しホール  5 / 12          │   7H: --f-rl-hole（48 / @1024:66 / @1194:70 / @1366:76px）太字
│        ↑直近に開示したホール                   ↑ --f-rl-name（30/40/44/48px）│   "5/12": --f-rl-name・tabular-nums
│                                                                        │
│   ● ● ● ● ● ○ ○ ○ ○ ○ ○ ○        ← 12マスの進捗ドット              │   1マス 28×28px（@1024 36px）・gap 10px・角丸 8px
│     開示済み=塗り(--strong)   未開示=枠のみ(--line)                        │   色に加えて塗り/枠の形で区別（色弱対応）
└──────────────────────────────────────────────────┘

┌ カード② 暫定ネット順位（.hr-rank）★この画面の主役 ──────────┐
│  順位   選手            暫定ネット       暫定HDCP      変動                  │  ヘッダは .muted 14px
│  ①     美咲             67.5           15.5         ▲2                  │  順位バッジ=既存 .rankno（1位は .r1）
│  ②     健               68.7           14.3         ▼1                  │  選手名 --f-rl-name / ネット --f-rl-score（44/64/68/76px）太字
│  ③     明               69.6           14.4          −                   │  HDCP は --f-title 級（小さく・従）
│  …（既定は上位10名。11位以降は <details>「11位以降を表示」に格納）           │  行高 @1024 で約 84px
└──────────────────────────────────────────────────┘
       ▲/▼ は「色だけに頼らない」= 記号＋変動幅の数字を必ず併記（§11.14 原則2）
       上昇=var(--win)（緑＝勝ちの意味と整合） / 下降=var(--ink) 通常色 / 変化なし= − を .muted
       ★ 赤（--danger＝危険の意味に予約済み）は順位下降に使わない

┌ カード③ 18ホール帯（.hr-holes）── height 約 90px ───────────┐
│  1  2  3  4  5  6  7  8  9 │10 11 12 13 14 15 16 17 18                 │  1セル 44×44px（@1024 56px）
│  ■  ？ ■  ？ ？ ■  ■  ？ ？ │ ？ ？ ？ ？ ？ ？ ？ ？ ？               │  ■=開示済み隠し（.hh と同じ地・太枠）
│                                                                        │  ？=未開示（隠しかどうか不明）
└──────────────────────────────────────────────────┘
   ★ 未開示セルは「隠しでない」ではなく「不明」。全開示後は ？ が消え、隠し=■/非隠し=無地 になる

▸ 開示の操作  ← <details class="hr-ctl">（既定=閉・幹事操作は控えめ配置＝§11.14 原則3）
    [ リセット ][ 1つ戻す ][ 次を開く ][ 全部開く ]      ← すべて .btn sm（「次を開く」だけ .gold）
    開示順:  ( ホール順 )( シャッフル )                  ← 既存 .scsw と同じ2択スイッチ

▸ ルール（既存 ruleBox('rule.hiddenReveal')）
```

### 9.3 空状態

| 条件 | 表示 |
|---|---|
| `g.hidden` が全 false | タブ自体を出さない（§9.1） |
| 参加者の入力が全員0ホール | `<div class="empty">` ＋ `hr.emptyScore` |
| `count===0` | ヒーローのホール番号欄は `—`、進捗は `0 / N`。順位表は「全ホール平均で仮置きした暫定」として**通常どおり出す**（＝横一線のスタート地点を見せる） |

### 9.4 モバイル（<1024px）

- ヒーローは1列（ホール番号の下に `k/N`）。進捗ドットは折り返し可（`flex-wrap`）。
- 順位表は「順位・名前・ネット・変動」の4列にし、**暫定HDCP 列を落とす**（`@media (max-width:640px)` で `display:none`）。
- 18ホール帯は既存の狭幅規律に合わせ **OUT(1-9)/IN(10-18) の2段**に折り返す（`scNarrow()` を流用）。

### 9.5 CSS

`styles.css` に `.hr-*` の新規クラスのみ追加。**新しい色トークンは作らない**（`--strong`/`--line`/`--win`/`--ink`/`--muted` と `--f-rl-*` を使う）。面の濃色ベタ塗りは使わない。

### 9.6 ファイル配置（読込順を変えない）

- 計算: `js/calc.js` 末尾に §4.1 の2関数
- 状態＋描画: `js/results.js`（先頭に `hrState`、末尾に `hrSync`/`hrBuildOrder`/`hrRevealed`/`hr*` 操作/`renderHiddenReveal`）、`renderIndGame` に `if(key==='reveal') return renderHiddenReveal(g,parts);` を1行
- タブ: `js/results.js` の `resGameTabs`
- **新規 JS ファイルは作らない**（`index.html` の `<script>` 並びを変えない＝CLAUDE.md の load-bearing）

---

## 10. i18n（ja / zh / en 同時・新規14キー）

既存キーを最大限流用する（`btn.reset` / `btn.all` / `sc.prev` / `col.rank` / `col.player` / `col.hd` / `col.net` / `term.net` は再利用）。

| キー | ja | zh | en |
|---|---|---|---|
| `result.sub.reveal` | 隠しホール開示 | 隐藏洞揭晓 | Hidden Holes |
| `hr.progress` | 隠しホール {k} / {n} | 隐藏洞 {k} / {n} | Hidden {k} / {n} |
| `hr.next` | 次を開く | 揭晓下一个 | Reveal next |
| `hr.back` | 1つ戻す | 返回一个 | Undo |
| `hr.seq` | 開示順 | 揭晓顺序 | Order |
| `hr.seqHole` | ホール順 | 按洞号 | By hole |
| `hr.seqShuffle` | シャッフル | 随机 | Shuffle |
| `hr.provHdcp` | 暫定HDCP | 临时差点 | Prov. HDCP |
| `hr.provNet` | 暫定ネット | 临时净杆 | Prov. net |
| `hr.final` | 確定 | 已确定 | Final |
| `hr.note` | 未開示の隠しホールは、その選手の平均的なホールと仮定した見込み値です。全部開くと確定値になります。 | 未揭晓的隐藏洞按该选手的平均成绩估算，全部揭晓后即为最终值。 | Unrevealed hidden holes are estimated from the player's average hole. Values become final once all are revealed. |
| `hr.warnScore` | スコアが {n}/18H しか開封されていません。暫定ハンデは開封済みホールだけで計算されます。 | 成绩仅揭晓了 {n}/18 洞，临时差点仅按已揭晓的洞计算。 | Only {n}/18 holes are revealed. The provisional handicap uses revealed holes only. |
| `hr.openScores` | スコアを全部開く | 揭晓全部成绩 | Reveal all scores |
| `hr.emptyScore` | スコアが1ホールも入力されていません | 尚未输入任何成绩 | No scores entered yet |
| `rule.hiddenReveal` | **隠しホール開示**：ダブルペリアの隠しホールを1つずつ発表します。開くたびに暫定ハンデとネット順位が計算し直され、全部開くと確定順位になります。 | **隐藏洞揭晓**：逐个公布双派利亚的隐藏洞。每揭晓一个都会重新计算临时差点与净杆排名，全部揭晓后即为最终排名。 | **Hidden Hole Reveal**: reveals the Double Peria hidden holes one at a time. Each reveal recomputes the provisional handicap and net ranking; the last one gives the final standings. |

- `hr.up` / `hr.down` は作らない（▲2 / ▼1 / − の記号＋数字で表現＝言語非依存）。
- `node tools/verify.mjs` の「未使用キー」検査に落ちないよう、**追加キーは必ず全部参照する**（`hr.final` は k=N のときヒーローに出すタグ）。

---

## 11. チャネル（β で出す・★根拠）

- `BETA_FMT`（`js/nav.js:31`）は **`g.formats` のキー名の配列**で、`chFormats(g)` が α のときそれらを `false` に落とす仕組み。本件は**フォーマット（集計種目）ではない演出**なので、`BETA_FMT` に入れる手段は無い（入れると `g.formats.reveal` という存在しないキーを前提にすることになり、`migrate`/`teamEventPts`/`announced` の整合も崩れる）。
- したがって **`resGameTabs` で `CHANNEL==='b'` を直接ゲートにする**（§9.1）。前例: `chFormats` を通さない表示判断は既に `renderResult`/`nav.js` に存在する（`CHANNEL` はグローバルの表示状態）。
- α 昇格は**別 Issue**（本設計のスコープ外）。昇格時の変更は `CHANNEL==='b' &&` を消す1箇所のみ。

---

## 12. 回帰の証明手順（★reviewer 必須）

### 12.1 既存スナップショット無差分（主証明その1）

```bash
node tools/regress.mjs       # --update なしで PASS すること
node tools/verify.mjs        # 構文 / i18n パリティ / 未定義参照 / 未使用キー / CSS 孤立 var() / 計算回帰
```

`hrHdcpAt`/`hrNetAt` は既存のどの関数からも呼ばれないので、`teamWinPoints`/`computePoints`/`computePayout`/`nextKanji` の出力は**1バイトも変わらないはず**。ここが落ちたら「既存関数を触ってしまった」ことの証明。

### 12.2 全開示＝現行完全一致（主証明その2）

`tools/regress.mjs` の driver に**新セクション `hiddenReveal` を追加**する（既存の出力キーには手を入れない）:

```js
// 全ケース共通: 全開示は periaHdcp/netScore と完全一致すること＋段階値のスナップショット
const HH = g.hidden.map((h,i)=>h?i:-1).filter(i=>i>=0);
const R = k => new Set(HH.slice(0,k));
const pids = g.participants;
globalThis.__RESULTS[name].hiddenReveal = {
  identityHdcp: pids.every(pid => hrHdcpAt(g,pid,R(HH.length)) === periaHdcp(g,pid)),
  identityNet:  pids.every(pid => hrNetAt (g,pid,R(HH.length)) === netScore (g,pid)),
  steps: [0, Math.floor(HH.length/2), HH.length].map(k =>
    Object.fromEntries(pids.map(pid => [pid, [hrHdcpAt(g,pid,R(k)), hrNetAt(g,pid,R(k))]]))),
};
```

レビュー手順:
1. `node tools/regress.mjs --update` を実行。
2. `git diff tools/regress-expected.json` が **`hiddenReveal` キーの追加のみ**で、**既存キーの値が1つも変わっていない**ことを確認する。
3. 追加された全ケースで **`identityHdcp: true` / `identityNet: true`** であることを確認する（1つでも false ならマージ不可）。

### 12.3 手動確認（PR2 以降）

- 隠しホール12本を最後まで開く → **ネットタブ／ポイント配分タブの値と、本タブの最終値が一致する**（同じ画面内で突き合わせられる）。
- 開示途中で**コースタブに行って隠しホールを引き直す** → 本タブに戻ると `0/12` にリセットされている（§5.2）。
- `revealHoles=9` のまま全開示 → 本タブの値が、ネットタブ（同じ `revealHoles=9`）の HDCP/ネットと一致する。
- リロードすると `0/12` に戻る（localStorage に何も増えていないこと＝DevTools で5キーのみを確認）。

---

## 13. PR 分割案（各 PR 単独でマージ可能）

| PR | 内容 | 触るファイル | 単独でマージ可能な理由 |
|---|---|---|---|
| **PR1: 計算と最小UI** | `hrHdcpAt`/`hrNetAt`（§4.1）／`hrState`＋`hrSync`＋操作関数（§5）／`resGameTabs` にβゲートのタブ追加（§9.1）／**素朴な表**での暫定ネット順位表示と4ボタン／i18n 最低限（`result.sub.reveal`・`hr.progress`・`hr.next`・`hr.back`・`hr.provHdcp`・`hr.provNet`・`hr.note`・`hr.emptyScore`）／regress 新セクション（§12.2） | `js/calc.js` `js/results.js` `js/i18n.js` `tools/regress.mjs` `tools/regress-expected.json` `index.html`(`?v=`) | これだけで**演出として機能する**（見た目が素朴なだけ）。回帰証明もこの PR で完結する |
| **PR2: 投影演出** | ヒーローカード（ホール番号・進捗ドット）／大型順位表（`--f-rl-*`）／順位変動矢印（`prevRank`）／18ホール帯／`<details>` 操作バー化／狭幅対応／i18n 追加（`hr.final`） | `js/results.js` `styles.css` `js/i18n.js` `index.html`(`?v=`) | PR1 の表示を置き換えるだけ。計算・状態は不変 |
| **PR3: 仕上げ** | 開示順スイッチ（`hr.seq*`・§6.2）／`revealHoles<18` の警告バー＋「スコアを全部開く」（§7.3）／`ruleBox('rule.hiddenReveal')` | `js/results.js` `js/i18n.js` `styles.css` `index.html`(`?v=`) | 既定（ホール順・警告なし）で PR2 は完成しているため、無くても壊れない |

**直列/並列**: 3本とも `js/results.js` を触るので**直列**。他 Issue（`js/players.js`/`js/roulette.js` 系）とは並列可。`js/i18n.js`・`styles.css` は他タスクと競合しやすいので、着手前に `origin/main` へリベースすること。

---

## 14. 受け入れ条件（PM が Issue #161 にそのまま貼れるチェックリスト）

```markdown
### 受け入れ条件（設計: docs/handoff/2026-09-12-hidden-hole-reveal.md）

**計算の不変（★最重要・load-bearing）**
- [ ] `js/calc.js` の既存関数（`periaHdcp`/`netScore`/`effGross`/`adjHole`/`parTotal`/`teamWinPoints`/`computePoints`/`computePayout`/`nextKanji`/`uv*`）に**差分が1行もない**（追加は `hrHdcpAt`/`hrNetAt` の2関数のみ）
- [ ] **全開示＝現行と完全一致**: 全ケースで `hrHdcpAt(g,pid,全開示)===periaHdcp(g,pid)` かつ `hrNetAt(g,pid,全開示)===netScore(g,pid)`（regress の `identityHdcp`/`identityNet` が全ケース `true`）
- [ ] `node tools/regress.mjs` が **`--update` なしで PASS**（既存スナップショット無差分）
- [ ] `tools/regress-expected.json` の差分が **`hiddenReveal` キーの追加のみ**（既存キーの値の変更がゼロ）
- [ ] `node tools/verify.mjs` が PASS
- [ ] `g.hidden` を書き換えるコードが無い（演出は読むだけ）

**状態とデータ**
- [ ] localStorage キーは **5つのまま**（`golfCompe_v1`/`_lang`/`_theme`/`_channel`/`_seenTop`）。開示状態は**リロードで 0 に戻る**
- [ ] ゲームを切り替える／コースタブで隠しホールを引き直す・手で増減すると、開示進行が **0 にリセット**される
- [ ] 隠しホール本数が 12 以外（例: 10本・0本）でも破綻しない（0本のときタブが出ない）

**演出（要件の中核）**
- [ ] **1回開示するたびに暫定HDCP・暫定ネットの数値が動く**（開示直後に全員の値が前ステップと同じになるステップが無い）
- [ ] 「次を開く／1つ戻す／全部開く／リセット」が期待どおり動き、「1つ戻す」は必ず直前の状態に戻る
- [ ] 順位変動の矢印は**前進時のみ**表示され、戻す・リセットでは出ない。▲2/▼1/− と**数字を併記**している
- [ ] 開示順は既定が**ホール番号昇順**。シャッフル選択時は再描画しても順序が変わらない

**`revealHoles` との関係**
- [ ] 本タブに**スコア開封バー（リセット/前へ/次のホール/全部）が出ない**
- [ ] `revealHoles<18` のとき**警告バーと「スコアを全部開く」ボタン**が出る。タブを開いただけでは `revealHoles` が**書き換わらない**
- [ ] `revealHoles=9` のまま全開示したとき、本タブの HDCP/ネットが**ネットタブの表示値と一致**する
- [ ] 本タブの開示進行を進めても、**他タブ（ネット/グロス/ポイント配分/チーム戦）の表示値が一切変わらない**

**表示（§11.14 投影原則）**
- [ ] 主役（暫定ネット・直近開示ホール）が `--f-rl-score`/`--f-rl-hole` で大型表示されている
- [ ] 幹事の操作UIは `<details>` 折りたたみ＋`sm` ボタン（既定=閉）
- [ ] 順位変動・開示済み/未開示が**色だけに頼らず**記号・文字で判別できる。順位下降に赤（`--danger`）を使っていない
- [ ] 面の濃色ベタ塗りを新設していない。新規の色トークンを追加していない
- [ ] 375px 幅と 1024px 幅の両方でレイアウトが破綻しない

**その他**
- [ ] i18n は **ja/zh/en のキー集合が完全一致**。追加キーはすべて参照されている（未使用キー検査が PASS）
- [ ] β チャネルでのみタブが出る（α では出ない）
- [ ] 新規 JS ファイルを作っていない（`index.html` の `<script>` 読込順が不変）。inline `onclick` 依存のまま
- [ ] `js/**`/`styles.css` を変更した PR で `index.html` の `?v=` を PR 番号に一括更新している
```

---

## 15. やらないこと（スコープ外・先に切る）

| 項目 | 理由 |
|---|---|
| **他タブへの暫定 HDCP の波及**（ネットタブ・ポイント配分・チーム戦ネット・ベスト2 などを暫定値で描く） | 影響範囲が `computePayout` まで届き、回帰の証明コストが跳ね上がる。本タブ内で完結させれば「他タブは常に現行どおり」が機械確認できる。必要なら別 Issue |
| **開示状態の localStorage 保存** | §11.14 原則4（演出状態はデータに混ぜない）。`revealHoles` と同じ扱い |
| **隠しホールの抽選順の保存**（`g` へのフィールド追加） | §6.1。演出のために §4 データモデルを変えない |
| **自動再生・アニメーション・効果音・カウントダウン** | 初版は幹事のタップ駆動に限定。演出の良し悪しは実運用で評価してから |
| **「まだ1位の可能性がある人」レンジ表示**（未開示ホールの最良/最悪ケースから暫定順位の上下界を出す） | 面白いが計算・表示とも別物の複雑さ。将来案として記録のみ |
| **隠しホールの編集 UI の移設** | コースタブの現行機能のまま。本タブからは触らせない（演出中の誤操作防止） |
| **α 昇格** | 別 Issue（§11） |
| **印刷・共有画像への反映** | `2026-09-12-result-share.md` の範囲。暫定値は共有物に載せない |
| **チーム戦での隠しホール開示演出** | 個人戦ネットで価値を検証してから |

---

## 16. PM への確認事項（すべて既定案つき・既定のまま実装可）

| # | 論点 | 既定案（これで進める） | 代替 |
|---|---|---|---|
| **Q1** | 暫定 HDCP の定義 | **B' 平均仮置き**（§3.4）。Issue 本文が指定した「素のビュー」は**実測で12ステップ中7ステップが完全に無反応**（§3.3）＝要件「1つ開くたびに動く」を満たせないため不採用にした | 変種 A（素のビュー・§3.6 の1行差し替えで切替可）。演出性を捨てて §3 完全非接触を最優先する場合 |
| **Q2** | 開示順の既定 | **ホール番号昇順**（幹事が読み上げやすい） | シャッフルを既定にする |
| **Q3** | 置き場所 | **個人戦グループの末尾タブ** | 専用の第4グループ（`resGrp` に追加）にする＝タブ構成変更のため影響大 |
| **Q4** | `revealHoles<18` の扱い | **警告＋ワンタップの是正ボタン。自動では書き換えない**（§7.3） | タブを開いたら自動で `revealHoles=18` にする |
| **Q5** | 配信チャネル | **β**（新演出のため） | α で出す（`CHANNEL==='b' &&` を外すだけ） |

---

## 17. 参照

- 実装: `js/calc.js`（`periaHdcp` 12-20 / `netScore` 31 / `ranked` 69-74）・`js/results.js`（`viewGameN` 76-87 / `renderIndGame` 157-181 / `renderScorecard` 248-）・`js/nav.js`（`revealHoles` 4 / `BETA_FMT` 31 / `chFormats` 36）・`js/course.js`（`pickHidden12` 41-50）
- 検証スクリプト（scratchpad・PR1 で `tools/regress.mjs` に取り込む）: 4変種の比較と恒等性確認を `vm` 上で実施済み（§3.3 / §7.2 の数値はその実測）
