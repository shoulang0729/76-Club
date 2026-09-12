# 設計：ニアドラの開封をセット別（OUT組 / IN組）にする — 2026-09-12

- 作成: 2026-09-12 / architect
- **区分: 確定**（§12 に未決2件＝いずれも既定案つき・既定案のまま実装してよい）
- **サイズ判定: M**（§3 計算・§4 データモデル・localStorage・i18n キー集合には**非接触**だが、グローバル関数のシグネチャ変更＋load-bearing な不変条件「全開封時の表示本数＝`niadoraTeamCount`」の**再定義**を伴うため S ではない。新規モジュール・タブ構成変更なしなので L でもない）
- **load-bearing 該当: 表示側のみ**。`js/calc.js` は **1行も触らない**（§11 の受け入れ条件で機械確認）。触るのは `js/results.js` / `js/results-team.js` / `styles.css` / `index.html`(`?v=`) の4ファイルだけ。
- 前提設計（先に読むこと）:
  - `docs/handoff/2026-09-12-niadora-2sets.md` **§8.2 / §8.3 / §8.4 / §15-C** … 本書は §15-C（未決事項C）を「セット別開封にする」側へ倒した解決設計。2セット本体は PR #146 / #147 でマージ済み
  - 正本 `2026-07-12-golf-compe-web.md` **§11.14**（投影原則。特に原則2「色だけに頼らず文字併記」・原則3「幹事の操作UIは控えめ配置」・原則4「演出状態はデータに混ぜない」）
  - `docs/handoff/2026-08-30-winpoints-reveal.md` §5.2 … 勝ち点タグと開封状態の整合規則

---

## 0. 結論サマリ

| 論点 | 決定 | 節 |
|---|---|---|
| 要件 | 2セット運用時、**同じホールでも OUT の旗と IN の旗を別タップで発表**できる。チーム別本数の「まとめて表示」（ヒーロー）は現行のまま | §1 |
| `pzExcept` のキー | **`` `${h}:${s}` `` 文字列に統一**（S=1 でも `"2:1"`）。混在キー空間は作らない | §3.2 |
| `pzMode` との意味論 | **変更なし**。`pzExcept` は「基準モードからの反転集合」（XOR差分）という現行の意味をそのまま旗単位へ持ち上げる | §3.1・§3.3 |
| シグネチャ | **`pzMasked(h,s)` / `togglePzCell(h,s)` の第2引数を省略可（既定 s=1）**。新しいグローバル関数は `togglePzSet(s)` の1本だけ追加 | §4 |
| S=1 の後方互換 | **`renderPrizeHero` / `renderTeamNiadora` の出力文字列が main と1バイト差なし**（`onclick="togglePzCell(2)"` の形も維持） | §4.3・§11.2 |
| タップ対象 | 2セット時は**行（`.npdc-row`）が唯一のタップ対象**。ホール番号・セル余白のタップは**無効**（誤タップでの両開き＝ネタバレ防止）。1セット時は**セル全体タップのまま** | §5.2 |
| タップ領域 | 行の実高 **54px（375px・チーム名なし）／72px（チーム名あり）／70px（@1024 投影）** ＝ 44px 目安を満たす。CSS の追加パディングは不要 | §5.3 |
| 一括操作 | **`OUT 全表示` / `IN 全表示` のチップを2個追加（twoSets:true のときだけ）**。既存の master チップ（全表示/全非表示）は不変。i18n キーは既存 `ns.allShow`/`ns.allHide` を再利用＝**新規キー0** | §6 |
| 不変条件 | 「全開封時の表示本数＝`niadoraTeamCount`」を**旗集合 F 上で再定義**（§7.2）。機械確認スニペットを §11.3 に用意 | §7 |
| 勝ち点タグ | 「**全開封時のみ**」の規則を維持。`allOpen` を旗単位に再定義＝**OUT と IN の両方が全部開くまでタグは出ない** | §7.3 |
| 片側だけ開封中の見せ方 | 同一セル内で OUT=氏名 / IN=`？？？`。`OUT`/`IN` は文字・`？？？` は文字＝**色に依存しない**。`.npdc-set` を 13px 固定 → `var(--f-title)` に引き上げ（投影で「どちらの旗が未開封か」が読めるように） | §8 |
| localStorage | **5つのまま**・開封状態は**揮発のまま**（§11.14 原則4） | §11.1 |
| PR 分割 | **1本**（4ファイル・約40行）。ただし `docs/handoff/2026-09-12-nonparticipant-ghost.md` の実装と**同じ `js/results.js` を触るので直列** | §10 |

---

## 1. 要件

### 1.1 ユーザー原文

> ドラニアチーム戦はまとめて表示するのは良いがオープンは個別にしたいね

### 1.2 PM 確認済みの解釈（2026-09-12）

| 質問 | 回答 |
|---|---|
| 「個別」の粒度 | **「OUT組 / IN組 を別々に開けたい」**＝2セット運用のとき、同じホールでも OUT の旗と IN の旗を別のタップで発表する |
| チーム別本数の「まとめて表示」 | **現行のままでよい**（`renderTeamNiadora` の縦積みヒーロー＝チーム別に NP/DC 合算1数値。ここは変えない） |
| 個人戦タブとチーム戦タブで開封状態を共有する現行仕様 | **変えない**（ユーザーは分離の選択肢を選ばなかった） |

### 1.3 位置づけ

`docs/handoff/2026-09-12-niadora-2sets.md` §15-C（未決事項C「開封をセット別にしたいか」）は既定案「**ホール単位のまま**」を採用し、PR #146/#147 でマージ済み。本件はその決定を**逆に倒す**。同 §8.4 が解決案として書いていた

> 「セット別に開封したい」要望が将来出たら `pzExcept` のキーを `` `${h}:${s}` `` へ拡張する。そのとき `allOpen` の定義も旗単位に直す必要がある

を、そのまま実装可能な粒度まで具体化したのが本書である。**§8.4 の方針は妥当だったので採用する**（代替案の検討は §3.2）。

---

## 2. 現状の正確な読み取り（実装前に必ず一致確認すること）

### 2.1 開封状態（`js/results.js:5-13`）

```js
/* ニアドラヒーローの伏せ演出（§5.1.1 D18・nsMode/nsExcept と同型の揮発状態。キー=ホールindex・NP/DC は対象ホールが素で排他） */
let pzMode='show'; let pzExcept=new Set();
function pzMasked(h){ return (pzMode==='hide') !== pzExcept.has(h); }
function togglePzAll(){ pzMode = pzMode==='show'?'hide':'show'; pzExcept.clear(); renderResult(); }
function togglePzCell(h){ if(pzExcept.has(h)) pzExcept.delete(h); else pzExcept.add(h); renderResult(); }
```

- **`pzExcept` は「hide リスト」でも「show リスト」でもない**。`pzMode` が決める**基準状態からの反転集合（XOR 差分）**である。`!==` が boolean の XOR として使われている点が本質。
- **キーに kind（np/dc）を含めていない**。これが成り立つのは、`niapinHolesOf`(Par3) と `draconHolesOf`(Par5) が**素で排他**だから（同コメント「NP/DC は対象ホールが素で排他」）。par は 3 か 5 のどちらか一方なので、同じ h が両方に現れることは構造的にない。→ **本件でも kind をキーに含めない**（§3.2）。
- `pzExcept` の要素は現在**数値**（`togglePzCell(h)` の h は inline onclick から数値リテラルで渡る）。

### 2.2 呼び出し箇所（全部で6箇所。これが全て）

| 場所 | 現行 |
|---|---|
| `js/results.js:11` | `pzMasked` 定義 |
| `js/results.js:12` | `togglePzAll` 定義 |
| `js/results.js:13` | `togglePzCell` 定義 |
| `js/results.js:179` | S=1 セル: `<div class="npdc-cell ${kind}" onclick="togglePzCell(${h})">${top}${body(p,pzMasked(h))}</div>` |
| `js/results.js:182,185` | S=2 セル: `const m=pzMasked(h);` … `onclick="togglePzCell(${h})"`（**セル全体が1タップ対象**） |
| `js/results-team.js:149` | `const opened=h=>!pzMasked(h);` |

`js/roulette.js` の `nsMode/nsExcept`・`toggleTgAll` は**同型だが別系統**。本件は一切触らない。

### 2.3 チーム戦側の現行（`js/results-team.js:149-158`）

```js
const opened=h=>!pzMasked(h);
const S=prizeSetCount(g);
const cnt=(kind,holes,T)=>holes.reduce((n,h)=>{ if(!opened(h)) return n;
  let c=0; for(let s=1;s<=S;s++){ const pid=prizeWinnerOf(g,kind,h,s); if(pid&&T.memberIds.includes(pid))c++; }
  return n+c; },0);
const anyWinner=(kind,h)=>{ for(let s=1;s<=S;s++) if(prizeWinnerOf(g,kind,h,s)) return true; return false; };
const allOpen=[...niapinHolesOf(g).filter(h=>anyWinner('np',h)),
               ...draconHolesOf(g).filter(h=>anyWinner('dc',h))].every(opened);
```

→ **`opened(h)` がホール単位のゲートとして `for s` ループの外にある**。これを中へ移すのが §7 の本質。

### 2.4 参照 helper（`js/state.js:92-95`・**触らない**）

```js
function prizeSetCount(g){ return (g.prizes && g.prizes.twoSets) ? 2 : 1; }
function prizeField(kind,s){ return (kind==='np'?'niapinWinner':'draconWinner') + (s===2?'2':''); }
function prizeWinnerOf(g,kind,h,s){ return ((g.prizes||{})[prizeField(kind,s)]||{})[h] || ''; }
function prizeSetLabel(s){ return s===2?'IN':'OUT'; }
```

---

## 3. `pzExcept` のキー設計と `pzMode` との意味論

### 3.1 意味論（★現行の読み取り → 旗単位への持ち上げ）

`pzMasked` は XOR。旗単位にしても**式は1文字も変えない**。変わるのは `has()` に渡すキーだけ。

```
masked(h,s) = (pzMode==='hide') XOR pzExcept.has(key(h,s))
```

**全パターン（旗単位・書き下し）**:

| # | `pzMode` | `pzExcept.has("h:s")` | `pzMasked(h,s)` | この状態になる操作の例 |
|---|---|---|---|---|
| 1 | `'show'` | false | **false（開）** | **初期状態**。アプリ起動直後は全旗が見えている |
| 2 | `'show'` | true | **true（伏）** | 全表示のまま、その旗だけ個別に伏せた（行タップ1回）／`IN 全非表示` チップで IN 側だけ伏せた |
| 3 | `'hide'` | false | **true（伏）** | master チップ `全非表示` を押した直後（`pzExcept` が clear されるので全旗がここに来る） |
| 4 | `'hide'` | true | **false（開）** | 全伏せ状態から、その旗だけ個別に発表した（行タップ1回）／`OUT 全表示` チップで OUT 側だけ開けた |

- `pzMode` は**全旗に一様にかかる基準**であり、セットの概念を持たない。→ **`togglePzAll()` は無改造**（`pzExcept.clear()` は文字列キーでもそのまま動く）。
- セット単位の一括（§6）は **`pzMode` を触らず、`pzExcept` の所属だけを書き換える**。したがって上表4状態の外に出る状態は存在しない。

**状態遷移の例（1ホール2旗・12H NP・OUT=田中 / IN=鈴木）**:

| 手順 | 操作 | `pzMode` | `pzExcept` | 12H の見え方 |
|---|---|---|---|---|
| 0 | （起動直後） | show | {} | OUT 田中 / IN 鈴木 |
| 1 | master チップ `全非表示` | **hide** | {} | OUT ？？？ / IN ？？？ |
| 2 | OUT 行をタップ | hide | {`"11:1"`} | **OUT 田中** / IN ？？？ |
| 3 | IN 行をタップ | hide | {`"11:1"`,`"11:2"`} | OUT 田中 / **IN 鈴木** |
| 4 | OUT 行をもう一度タップ | hide | {`"11:2"`} | OUT ？？？ / IN 鈴木（伏せ直し＝可逆） |
| 5 | master チップ `全表示` | **show** | **{}** | OUT 田中 / IN 鈴木（clear で状態リセット） |

### 3.2 キー形式の案比較

| | **案K1（採用）文字列 `` `${h}:${s}` `` に統一** | 案K2 S=1 は数値 h・S=2 は `h:s` の混在 | 案K3 Set を2本に分ける（`pzExceptHole` / `pzExceptFlag`） | 案K4 `h*10+s` の数値キー |
|---|---|---|---|---|
| S=1 の DOM 一致 | ○（`togglePzCell(11)` の形を維持＝§4.3） | ○ | ○ | ○ |
| twoSets を**同一セッション中に** ON⇄OFF したとき | ○ 旧キーは非参照で無害（§9-③） | **×** 混在キーが残り、`has(11)` と `has("11:1")` が別物として残留＝幽霊マスク | △ 2本の同期規則が要る | ○ |
| デバッグ時の可読性 | ○ `"11:2"` を見れば分かる | × | △ | × `112` が 11H-set2 か 112H か判別不能（h は 0..17 なので実害はないが読めない） |
| コード量 | helper 1本（`pzKey`） | 分岐が全箇所に散る | 状態が2本＝`togglePzAll` も2本 clear | helper 1本 |
| 将来セット3以上 | ○ そのまま | × | △ | △ 桁あふれ規則が要る |

**決定：案K1**。決め手は「同一セッション中の twoSets 切替」で幽霊マスクが出ないこと（§9-③）。

```js
/* 旗キー（2026-09-12-niadora-reveal-per-set.md §3.2）。s 省略時=1（1セット運用＝従来の「ホール1つ＝旗1本」）。
   kind を含めないのは NP 対象ホール(Par3)と DC 対象ホール(Par5)が素で排他だから（js/results.js:5 の既存前提）。 */
function pzKey(h,s){ return h+':'+(s||1); }
```

### 3.3 「show 基準で except が伏せる対象」か「hide 基準で except が開ける対象」か（★親からの明示質問への回答）

**どちらでもない。`pzExcept` は基準モードからの反転集合である。**

- `pzMode==='show'` のときは「except ∈ **伏せる対象**」として振る舞う（表の#2）。
- `pzMode==='hide'` のときは「except ∈ **開ける対象**」として振る舞う（表の#4）。
- つまり **except の意味は `pzMode` によって反転する**。この設計は `js/roulette.js` の `nsMode/nsExcept` と同型で、アプリ全体の演出トグルの共通イディオム。**本件はこのイディオムを変えない**（変えると roulette 側と設計が分岐して読みづらくなる）。

実装者への注意: セット一括（§6）を書くとき、`pzExcept.add()` を直書きすると `pzMode==='hide'` のときに意味が反転して**逆の結果**になる。必ず次の「目標状態を指定する」helper を経由すること。

```js
/* 旗 (h,s) の伏せ状態を m に**設定**する（トグルではない）。pzMode の基準に応じて except の所属を反転して持つ。
   masked = (pzMode==='hide') XOR except.has(k)  ⇒  except.has(k) = (pzMode==='hide') XOR m */
function pzSetMasked(h,s,m){ const k=pzKey(h,s);
  if((pzMode==='hide')!==m) pzExcept.add(k); else pzExcept.delete(k); }
```

検算: `pzMode='hide'`（B=true）で `m=true`（伏せたい）→ `(true!==true)=false` → delete → `masked = true XOR false = true` ✓／`pzMode='show'`（B=false）で `m=true` → `(false!==true)=true` → add → `masked = false XOR true = true` ✓。

---

## 4. シグネチャ（★S=1 完全互換）

### 4.1 決定：第2引数を省略可にする（新規グローバルは1本だけ）

```js
/* ★2026-09-12 セット別開封（2026-09-12-niadora-reveal-per-set.md §4）。
   s 省略時=1＝1セット運用（twoSets:false）では従来と完全に同一の挙動・同一の DOM 文字列。
   関数名は togglePzCell のまま（改名すると S=1 の inline onclick 文字列が main と変わるため・§4.3）。
   実際の単位は「セル」ではなく「旗1本」になった点に注意。 */
function pzMasked(h,s){ return (pzMode==='hide') !== pzExcept.has(pzKey(h,s)); }
function togglePzAll(){ pzMode = pzMode==='show'?'hide':'show'; pzExcept.clear(); renderResult(); }   // ★無改造
function togglePzCell(h,s){ const k=pzKey(h,s); if(pzExcept.has(k)) pzExcept.delete(k); else pzExcept.add(k); renderResult(); }
```

| 案 | 評価 |
|---|---|
| **採用: `pzMasked(h,s)` / `togglePzCell(h,s)`（s 省略可）** | 呼び出し側の既存5箇所が**無改造で正しい**（`pzMasked(h)`→`h:1`）。グローバル関数が増えない（inline onclick はグローバル依存＝名前空間を汚さないほうがよい・CLAUDE.md load-bearing）。「セル＝旗1本」だった旧世界が S=1 の特殊ケースとして自然に埋まる |
| 別関数 `togglePzFlag(h,s)` を足し `togglePzCell` は据え置き | グローバルが1本増える。かつ `togglePzCell` が「S=1 専用」という暗黙の前提を持つ関数になり、将来の読み手が罠にかかる。却下 |
| `togglePzCell(h)` を「ホール一括（両旗）」に再定義＋`togglePzFlag` 追加 | §5.2 で「ホール一括タップは提供しない」と決めたので**呼び出し元が存在しない**デッドコードになる。却下 |

### 4.2 `s` 省略時の後方互換（機械的な論証）

- `pzKey(h,undefined)` → `h+':'+1` → `"11:1"`。`s=1` 明示と同一文字列。`s` に `0` や `null` が渡ることはない（呼び出し元は §2.2 の6箇所と §5.2 の新 DOM のみ、いずれも `undefined` / `1` / `2`）。
- `pzExcept` の要素型が数値 → 文字列に変わるが、**`pzExcept` は揮発のモジュール内変数で外部参照がない**（`grep -n "pzExcept" js/` の結果が `js/results.js` の4行だけであることを実装時に確認すること）。
- `togglePzAll()` の `pzExcept.clear()` は型非依存。

### 4.3 S=1 で main と DOM 文字列が1バイトも変わらないこと

`renderPrizeHero` の S=1 分岐は**1文字も編集しない**:

```js
if(S===1){ const p=plOf(1);
  if(!p) return noWinner;
  return `<div class="npdc-cell ${kind}" onclick="togglePzCell(${h})">${top}${body(p,pzMasked(h))}</div>`; }
```

- `onclick="togglePzCell(11)"` のまま（`togglePzCell(11,1)` に**書き換えない**）。省略可引数にした理由がこれ。
- `pzMasked(h)` のまま。
- tools バーも S=1 では master チップ1個のまま（§6.3 で `S===2` ガード）。
- `.npdc-set` / `.npdc-row` は S=2 でしか出力されないので、§8.3 の CSS 変更は S=1 の見た目に**到達しない**。

---

## 5. タップ対象（UI）

### 5.1 決定一覧

| 論点 | 決定 | 根拠 |
|---|---|---|
| 1セット時 | **セル全体タップのまま**（現行不変） | §4.3。旗が1本しかないので分割する意味がない |
| 2セット時 | **行（`.npdc-row`）だけがタップ対象** | ユーザー要件が「個別に開けたい」。誤タップで両方開くと**取り返しがつかない**（ネタバレ）。伏せ直しはできるが、見てしまった人には戻せない |
| ホール番号（`.npdc-top`）のタップ | **無効（no-op）** | 上と同じ。両方開けたいなら行を2回タップすればよい（追加タップ1回のコスト＜ネタバレのリスク） |
| セル余白のタップ | **無効**。`.npdc-cell` から `cursor:pointer` を外す（2セット時のみ・§8.3） | 押せそうで押せない領域を作らない |
| 片側だけ未登録のホール | **登録済みの行だけタップ可**。`—` の行はタップ無効（既存の「未登録は伏せ対象外・タップ無効」規則の踏襲） | §9-① |
| 両セットとも未登録 | **現行どおりセルごとタップ無効**（`noWinner` 分岐・`cursor:default`） | §9-② |

### 5.2 DOM（twoSets:true。差分は `onclick` と `.npdc-cell` のクラスだけ）

```js
const ps=[plOf(1),plOf(2)];
if(!ps[0]&&!ps[1]) return noWinner;
const rows=ps.map((p,i)=>{ const s=i+1;
  const inner=`<div class="npdc-set">${prizeSetLabel(s)}</div>${p?body(p,pzMasked(h,s)):'<div class="npdc-name empty">—</div>'}`;
  return p ? `<div class="npdc-row" onclick="togglePzCell(${h},${s})">${inner}</div>`   // ★旗ごとに開封
           : `<div class="npdc-row">${inner}</div>`; }).join('');                        // 未登録行はタップ無効
return `<div class="npdc-cell ${kind} split">${top}${rows}</div>`;                       // ★セル全体の onclick を外す
```

**`pzMasked(h)` → `pzMasked(h,s)` に移り、`const m=pzMasked(h);` の1行は消える**（旗ごとに評価する）。

出力例（12H・OUT 開封済み / IN 未開封・チーム戦タブ）:

```html
<div class="npdc-cell np split">
  <div class="npdc-top"><span class="npdc-hole">12<small>H</small></span><span class="npdc-kind">ニアピン</span></div>
  <div class="npdc-row" onclick="togglePzCell(11,1)"><div class="npdc-set">OUT</div><div class="npdc-name">田中 太郎</div><div class="npdc-team" style="color:#c0392b">赤チーム</div></div>
  <div class="npdc-row" onclick="togglePzCell(11,2)"><div class="npdc-set">IN</div><div class="npdc-name"><span class="mask">？？？</span></div></div>
</div>
```

### 5.3 タップ領域の寸法検証（★44px 目安）

`.npdc-row` は追加の padding なしで既に 44px を超える。**CSS でのタップ領域拡大は不要**（＝レイアウトが #147 から動かない）。

**375px（iPhone SE。`--f-rl-name:30px` / `.npdc-set` を `var(--f-title)`=15px に変更後）**

| 部品 | 計算 | 高さ |
|---|---|---|
| `.npdc-set` | 15px × line-height 1.2 | 18.0px |
| `.npdc-name` | min-height 1.15em of 30px ＋ margin-top 4px | 38.5px |
| `.npdc-team`（withTeam かつ開封時のみ） | 13px × 1.2 ＋ margin-top 2px | 17.6px |
| **行の実高（チーム名なし）** | 18.0 + 38.5 | **56.5px** ✓ |
| **行の実高（チーム名あり）** | 18.0 + 38.5 + 17.6 | **74.1px** ✓ |
| 2行目はさらに `.npdc-row+.npdc-row` の padding-top 6px がヒット領域に加算 | | +6px |

**≥1024px（投影 1280px。`--f-rl-name:44px` / `--f-title:16px`）**

| 部品 | 高さ |
|---|---|
| `.npdc-set` | 16 × 1.2 = 19.2px |
| `.npdc-name` | 44 × 1.15 + 4 = 54.6px |
| **行の実高（チーム名なし）** | **73.8px** ✓ |

→ **最小でも 56px**。44px 目安を全レイアウトで満たす。マージンは 12px 以上あるので「隣の行を誤爆する」余地も小さい。

### 5.4 レイアウト図

**375px・2列グリッド（`.npdc-hero` は `repeat(2,1fr)` / gap 10px。個人戦タブ＝チーム名なし）**

```
  ┌────────────────────────┐   ┌────────────────────────┐
  │      12H  ニアピン      │   │       5H  ドラコン      │  ← .npdc-top（タップ無効）
  │ ╭────────────────────╮ │   │ ╭────────────────────╮ │
  │ │ · · · OUT · · · ·  │15│   │ │ · · · OUT · · · ·  │ │  ← .npdc-row = タップ対象
  │ │     田中 太郎      │30│   │ │    佐藤 花子       │ │     実高 56.5px
  │ ╰────────────────────╯ │   │ ╰────────────────────╯ │
  │  ──────────────────────│   │  ──────────────────────│  ← .npdc-row+.npdc-row 罫線
  │ ╭────────────────────╮ │   │ ╭────────────────────╮ │
  │ │ · · · IN  · · · ·  │15│   │ │ · · · IN  · · · ·  │ │  ← 2行目 タップ対象 実高 62.5px
  │ │      ？？？        │30│   │ │        —           │ │     （未登録の — 行はタップ無効）
  │ ╰────────────────────╯ │   │ ╰────────────────────╯ │
  └────────────────────────┘   └────────────────────────┘
   セル外寸 ≒ 156 × 200px         枠色: np=--info-line / dc=--danger-line（不変）

  ── カード下の tools バー（幹事操作・控えめ＝§11.14 原則3）──
  [ 全表示 ] [ OUT 全非表示 ] [ IN 全表示 ]        ← twoSets:true のときだけ3個（§6）
    ^master(state,on/off色)  ^action(neutral)  ^action(neutral)
  3チップ合計 ≒ 257px ＜ 351px（375 − 本文左右余白24）→ 1行に収まり折返しなし
```

**1280px（投影・`.npdc-hero` は `repeat(4,1fr)`・main max-width:1200px。チーム戦タブ＝チーム名あり）**

```
  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
  │   3H  ニアピン   │ │   5H  ドラコン   │ │   8H  ニアピン   │ │  12H  ニアピン   │
  │ ···· OUT ·····  │ │ ···· OUT ·····  │ │ ···· OUT ·····  │ │ ···· OUT ·····  │
  │   田中 太郎     │ │   佐藤 花子     │ │    ？？？       │ │   山田 次郎     │  ← 44px
  │    赤チーム     │ │    青チーム     │ │                 │ │    赤チーム     │
  │ ─────────────── │ │ ─────────────── │ │ ─────────────── │ │ ─────────────── │
  │ ···· IN  ·····  │ │ ···· IN  ·····  │ │ ···· IN  ·····  │ │ ···· IN  ·····  │
  │    ？？？       │ │    ？？？       │ │    ？？？       │ │    ？？？       │
  └─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
   セル内寸 ≒ 284px幅              「OUT組は発表済み・IN組はこれから」が一目で分かる状態
                                    （= 幹事の実運用そのもの。§8.1）
```

---

## 6. 一括操作（`togglePzAll` の意味論とセット単位一括）

### 6.1 `togglePzAll()` は**無改造**

- `pzMode` は全旗に一様にかかる基準（§3.1）なので、セットの概念を持ち込む必要がない。
- `pzExcept.clear()` で全ての個別状態がリセットされる＝「全部開ける／全部伏せる」の意味は旗単位に自動的に持ち上がる。
- **master チップの DOM・ラベル・on/off クラスも不変**（S=1 の DOM 一致条件に効く）。

### 6.2 セット単位の一括：**採用**（既定案・§12-A で要確認）

**運用上の必要性**（採用理由）:

1. OUT 組が先に上がり、IN 組はまだコース上 — このとき幹事は「**IN 側だけ全部伏せておく**」をしたい。行タップだと **par72 で最大8タップ**（Par3×4＋Par5×4）。チップ1個で済む。
2. 表彰式で「まず OUT 組の結果を発表します」→ `OUT 全表示` 1タップで OUT だけ6〜8本を一気に開ける。その後 IN 組を1本ずつ演出しながら開ける、という**セット内は演出・セット間は一括**の運用が自然にできる。
3. **これは行タップだけでは代替が重い**（8タップ）。逆に §5.2 で「ホール一括タップ」を落としたのは、代替が **2タップ**と軽かったから。この非対称が採否を分ける根拠。

**投影原則 §11.14 原則3（控えめ配置）との整合**:

- チップは**既存の tools バー（カード群の**下**）に追加**＝主役の邪魔をしない位置は現行のまま。
- **`twoSets:true` のときだけ**出す（既定 OFF のコンペでは 1個のまま＝現状不変）。
- 増やすのは**2個まで**。3個以上に増やさない（セット3以上は要件外・`2sets.md` §3.1）。
- 対象セットに勝者が1人もいない場合は**そのチップを出さない**（押しても何も起きないボタンを置かない）。

### 6.3 実装

```js
/* セット一括開封（§6.2）。対象＝そのセットの「勝者が登録済みの旗」すべて。
   1本でも伏せがあれば全開、全部開いていれば全伏せ（＝開封方向を優先。演出は「開ける」が主） */
function pzFlags(g,s){ const out=[];
  [['np',niapinHolesOf(g)],['dc',draconHolesOf(g)]].forEach(([kind,hs])=>hs.forEach(h=>{
    for(let ss=1;ss<=prizeSetCount(g);ss++){ if(s&&ss!==s) continue;
      if(prizeWinnerOf(g,kind,h,ss)) out.push([h,ss]); } }));
  return out; }
function togglePzSet(s){ const g=curGame(); if(!g||prizeSetCount(g)<s) return;   // 防御: OFF 時に呼ばれても無害
  const F=pzFlags(g,s); if(!F.length) return;
  const toOpen=F.some(([h,ss])=>pzMasked(h,ss));                  // 1本でも伏せ → 全開ける
  F.forEach(([h,ss])=>pzSetMasked(h,ss,!toOpen)); renderResult(); }
```

- `curGame()` を使う根拠: `prizes` は `viewGame` 非依存（`js/results.js:126` の既存コメント「prizes は viewGame 非依存＝g で同値」）。開封状態の計算に開封済みホール数マスクは無関係。
- **`pzMode` を触らない**。§3.3 の `pzSetMasked` を必ず経由すること（直接 `add/delete` すると `pzMode==='hide'` で逆になる）。

### 6.4 チップの DOM（`renderPrizeHero` の tools）

```js
const on = pzMode==='show';
let tools=`<span class="tgl ${on?'on':'off'}" onclick="togglePzAll()">${on?t('ns.allShow'):t('ns.allHide')}</span>`;
if(S===2) tools += [1,2].map(s=>{ const F=pzFlags(g,s); if(!F.length) return '';
  const anyMasked=F.some(([h,ss])=>pzMasked(h,ss));              // 押したら起きること＝ラベル（action ラベル）
  return `<span class="tgl" onclick="togglePzSet(${s})">${prizeSetLabel(s)} ${anyMasked?t('ns.allShow'):t('ns.allHide')}</span>`; }).join('');
return `<div class="card"><div class="npdc-hero">${cells.map(cell).join('')}</div><div class="cardtools mt8">${tools}</div></div>`;
```

| 論点 | 決定 | 根拠 |
|---|---|---|
| ラベル | `OUT` ＋ 既存 `ns.allShow`/`ns.allHide` の連結（例: `OUT 全表示` / `IN 全非表示`）。**新規 i18n キーなし** | `OUT`/`IN` はリテラル（`2sets.md` §4.2 の決定を踏襲）。既存キーの再利用なので verify.mjs の未使用キー0・3言語パリティに影響ゼロ |
| ラベルの意味 | **アクション**（押したら何が起きるか）。`anyMasked` なら「全表示」 | master チップは状態ラベル（on/off 色つき）、セットチップは**色なしの `.tgl`**＝視覚的に別物として区別できる。tri-state（全開/全伏/混在）を色で表そうとすると新クラスが要るので避けた |
| 色 | `.tgl` の素（枠＋card 背景）。`on`/`off` を付けない | 上記。新規 CSS ゼロ |
| S=1 | **出力しない**（`if(S===2)`） | §4.3 の DOM 一致 |
| チップ高さ | 現行 `.tgl` と同寸（375px で ≒27px・@1024 で 44px）。**本件では変えない** | 全画面の `.tgl` に波及するため。44px 化が要るなら別 S レーンの全画面一括で（本件のスコープ外） |

---

## 7. `renderTeamNiadora` の再定義と★不変条件

### 7.1 変更（`js/results-team.js:149-158`）

```js
/* ★2026-09-12 セット別開封（2026-09-12-niadora-reveal-per-set.md §7）: 開封は旗単位（h,s）。
   S===1（既定 twoSets:false）は opened(h,1)===従来の opened(h) で、加算列・順序とも従来と完全に同一。 */
const opened=(h,s)=>!pzMasked(h,s);
const S=prizeSetCount(g);
const cnt=(kind,holes,T)=>holes.reduce((n,h)=>{ let c=0;
  for(let s=1;s<=S;s++){ const pid=prizeWinnerOf(g,kind,h,s);
    if(pid&&T.memberIds.includes(pid)&&opened(h,s))c++; }               // ★ゲートを for の中へ
  return n+c; },0);
const npOf=T=>cnt('np',niapinHolesOf(g),T);
const dcOf=T=>cnt('dc',draconHolesOf(g),T);
/* 勝者が登録済みの旗（h,s）の列挙。allOpen は「全ての旗が開封済み」＝OUT と IN の両方が出揃うまで false */
const flags=(kind,holes)=>{ const out=[]; holes.forEach(h=>{ for(let s=1;s<=S;s++) if(prizeWinnerOf(g,kind,h,s)) out.push([h,s]); }); return out; };
const allOpen=[...flags('np',niapinHolesOf(g)),...flags('dc',draconHolesOf(g))].every(([h,s])=>opened(h,s));
```

`anyWinner` は不要になるので**削除**（`flags` が置き換える）。

**S===1 等価性の論証**:

| 旧 | 新 | 一致理由 |
|---|---|---|
| `if(!opened(h)) return n;` の後に `s=1` の1周 | `s=1` の1周の中で `&& opened(h,1)` | `opened(h)` ≡ `opened(h,1)`（`pzKey(h,undefined)==='h:1'`・§4.2）。`A ? (B?1:0) : 0` と `(A&&B)?1:0` は同値。加算順序も同一 |
| `anyWinner('np',h)` = `s=1` に勝者あり | `flags('np',…)` = `[[h,1]]`（勝者ありのホールのみ） | 同じホール集合を同じ順で列挙 |
| `.every(opened)` | `.every(([h,s])=>opened(h,s))` | 同上 |

→ **`npOf`/`dcOf`/`allOpen` の値が S=1 で完全一致 → 出力 HTML 文字列も完全一致**（§11.2）。

### 7.2 ★不変条件の再定義（**最重要**）

**旧（ホール単位マスク時代）**: 全開封時に `npOf(T)+dcOf(T) === niadoraTeamCount(g,T)`。`opened(h)` が `for s` の**外**にあったので、フィルタは「ホール単位で一様」＝自明に成立していた。

**新（旗単位マスク）**: フィルタは旗単位になるので、**旗の集合の上で定義し直す**。

> **旗集合 F(g) を定義する**:
> ```
> F(g) = { (kind, h, s) | kind ∈ {np, dc},
>                          h ∈ (kind==='np' ? niapinHolesOf(g) : draconHolesOf(g)),
>                          1 ≤ s ≤ prizeSetCount(g),
>                          prizeWinnerOf(g,kind,h,s) が truthy }
> ```
> **不変条件（再定義）**:
> - 計算側 `niadoraTeamCount(g,T)` ＝ F(g) のうち勝者が T のメンバーである要素の個数（**開封フィルタなし**）
> - 表示側 `npOf(T)+dcOf(T)` ＝ 同じ集合を `opened(h,s)` で絞った個数
> - `allOpen` ＝ `∀(kind,h,s) ∈ F(g): opened(h,s)`
>
> ⇒ **`allOpen` が true のとき `opened` は F(g) 上で恒真 ⇒ 両者は同一の加算列 ⇒ 値が一致する。** S=1 / S=2 のどちらでも成立。

**系（実装者が自己チェックに使える性質）**:

1. **単調性**: 任意の開封状態で `npOf(T)+dcOf(T) ≤ niadoraTeamCount(g,T)`。等号成立 ⟺ T のメンバーが勝者である旗が全て開封済み。
2. **1タップ1増減**: 行タップ1回で、表示合計は **0 または 1** だけ動く（勝者が無所属なら 0・チームに属するなら 1）。これがセット別開封の設計意図そのもの（旧仕様は最大2動いた）。
3. `niadoraTeamCount` は `opened` を一切参照しない ⇒ **`js/calc.js` は無変更で不変条件が閉じる**。

**数値例（`2sets.md` §6.2 のデータを使用）**: チームA={a1,a2,a3} / B={b1,b2,b3}、`niadoraTeamCount` は A=5 / B=5。

| 開封状態 | A の表示本数 | B の表示本数 | 勝ち点タグ |
|---|---|---|---|
| 全伏せ（master `全非表示` 直後） | 0 | 0 | 出ない（allOpen=false） |
| `OUT 全表示` のみ（OUT 5本開・IN 5本伏）※3H/8H/12H NP＋5H/14H DC の OUT 側 | NP2＋DC1 = **3** | NP1＋DC1 = **2** | 出ない |
| 上に加えて 3H の IN（b3）だけ開けた | 3 | **3** | 出ない |
| 全開封 | **5** | **5** | **出る（同数＝山分け +0.5 ずつ）** |
| （参考）旧仕様で同じ「3H だけ開けた」状態 | 3H の旗2本が同時に開く＝A・B とも +1 | | |

### 7.3 勝ち点タグ（`allOpen`）の旗単位解釈 — **厳格側を維持**

現行規則（`js/results-team.js` の既存コメント・`winpoints-reveal.md` §5.2）: 勝ち点タグは「**発表済み(`ev.on`)かつ全開封**」でのみ表示。

**決定：`allOpen` は「OUT・IN の両方の全旗が開封済み」とする**（＝片側だけ全開ではタグを出さない）。

| 案 | 評価 |
|---|---|
| **採用: 全旗（両セット）が開いたときのみ** | タグの値（`+1` / `+0.5`）は**両セット合算の本数**で決まる（`teamWinPoints`＝`niadoraTeamCount`）。IN が伏せている段階でタグを出すと、**まだ発表していない IN の旗の行方が推測できてしまう**（例: OUT だけで A3-B2 なのにタグが B に付いたら「IN で B が3本以上取った」と割れる）。ネタバレ防止という規則の目的に照らして厳格側が正しい |
| セット別にタグを出す | 勝ち点はセットで分かれていない（`2sets.md` §2 解釈A＝種目は「ニアドラ」1つ）。セット別のタグは**存在しない値**を表示することになる。却下 |
| 部分開封でも暫定タグを出す | 上記のネタバレ。かつ値が途中で入れ替わり、投影で誤読を招く。却下 |

---

## 8. 片側だけ開封中の見せ方（投影で伝わるか）

### 8.1 その状態は何を意味するか

「OUT 組は発表済み・IN 組はこれから」＝**幹事の実運用そのもの**。この状態が画面上でそのまま読めることが本機能の価値。

### 8.2 §11.14 との突き合わせ

| 原則 | 本件での担保 |
|---|---|
| 1. 1画面1主役 | 主役は勝者名（`--f-rl-name` 30/44px）。**未開封側があっても主役のフォントを下げない**（`2sets.md` §8.1-1 の約束を継続） |
| 2. 色だけに頼らず文字併記 | セットの区別 = **`OUT` / `IN` の文字**（＋行間罫線）。開封状態の区別 = **`？？？` の文字**（`.mask` は色＋opacity だが、**文字そのものが意味を担う**ので色に依存しない）。未登録は `—` |
| 3. 幹事の操作UIは控えめ | 一括チップはカード群の**下**・`.tgl`（sm 相当）・twoSets ON のときだけ2個追加（§6.2） |
| 4. 演出状態はデータに混ぜない | `pzMode`/`pzExcept` は揮発のまま。localStorage キーは5つのまま（§11.1） |

### 8.3 唯一の CSS 変更：`.npdc-set` を投影で読める大きさに

**問題**: `.npdc-set` は現在 **13px 固定**（`styles.css:255`）。1セット時代は「どのセットか」を読む必要がなかったが、**片側だけ開封中は `？？？` がどちらの旗かを読めないと状態の意味が伝わらない**（§11.14 原則2）。1280px 投影で 13px は後方席から判読不能。

**変更**（1行・新規トークンなし・新規プロパティなし）:

```css
/* ★2026-09-12 セット別開封（2026-09-12-niadora-reveal-per-set.md §8.3）:
   片側だけ開封中は OUT/IN のラベルが「どちらの旗が未開封か」の意味を担うため、
   投影で読める大きさへ（13px 固定 → --f-title=15px/16px@1024/@1194 とスケールする） */
  .npdc-set{font-size:var(--f-title);font-weight:var(--w-bold);letter-spacing:.08em;color:var(--sub);line-height:1.2}
/* 2セット時はセル全体ではなく行がタップ対象（§5.2）。押せない領域に pointer カーソルを出さない */
  .npdc-cell.split{cursor:default}
  .npdc-row{cursor:pointer}
  .npdc-row:has(.npdc-name.empty){cursor:default}
```

- `--f-title` は既存トークン（15px / 16px@1024 / 16px@1194）。**新規トークンを定義しない**制約を満たす。
- `.npdc-set` は **S=2 でしか出力されない** ⇒ S=1 の見た目に到達しない ⇒ DOM 一致条件と無関係。
- `:has()` が未対応の環境では `.npdc-name.empty{cursor:default}`（既存・`styles.css:250`）が名前部分だけカバーする。**機能には影響しない**（未登録行には onclick を付けないので押しても何も起きない）。`:has()` を避けたい場合は `renderPrizeHero` 側で `<div class="npdc-row empty-row">` を出して `.npdc-row.empty-row{cursor:default}` にしてよい（実装者判断・どちらでも受け入れ条件を満たす）。

### 8.4 見た目の副作用（既知・許容）

- 未開封の行は `.npdc-team` を出さない（伏せ中はチーム名も隠す＝既存規則）ので、**IN を開封した瞬間にセルが約18px 伸び、同じグリッド行の他セルの位置が動く**。これは #147 の時点で既にある挙動（セル丸ごと開封でも同じ）で、本件で悪化はしない。高さ予約（プレースホルダ）は**行わない**（空行が常時見えると投影で「何かが抜けている」誤読を招くため）。

---

## 9. 端ケース

| # | ケース | 挙動（決定） |
|---|---|---|
| ① | **片方のセットだけ勝者未登録のホールをタップ** | 登録済みの行 → その旗だけトグル。`—` の行 → **onclick なし＝何も起きない**（未登録は伏せ対象外という既存規則の踏襲）。`flags()`／`pzFlags()` にも入らないので `allOpen` と一括操作の対象外 |
| ② | **両セットとも未登録** | 現行どおり `noWinner` セル（`cursor:default`・onclick なし）。`.split` クラスも付かない（`noWinner` 分岐は S 非依存で共通・無改造） |
| ③ | **twoSets を同一セッション中に ON → OFF** | `pzExcept` に残る `"h:2"` は**非参照で無害**（`pzMasked(h,1)` は `"h:1"` しか見ず、描画も `s=1..S=1` しか回らない）。**掃除しない**＝`g.prizes` 側の「セット2データは残置・非参照」（`2sets.md` §3.2）と同じ規則。再度 ON すると**伏せ状態がそのまま復活する**＝幹事にとって望ましい連続性。リロードで揮発（localStorage 非保存） |
| ④ | **twoSets OFF → ON**（セット2の勝者が既にある） | `pzMode` の基準がそのまま IN 側にも適用される（表#1/#3）。例: `全非表示` 中に ON すると IN 側も伏せ状態で現れる＝直感どおり |
| ⑤ | **par 変更で対象外になったホールの旗** | `niapinHolesOf`/`draconHolesOf` が返さない ⇒ 描画も `flags()` も `pzFlags()` も触れない。`pzExcept` の残キーは非参照（③と同じ） |
| ⑥ | **同一人物が両セットで勝つ**（`2sets.md` §10-①） | 表示は同じ名前が2行。開封は**別々**。片方だけ開けると同じ名前が1回だけ出る。表示本数は開封済みの旗数ぶん（1）＝§7.2 の系2どおり |
| ⑦ | **セット一括チップを押したあと master チップ** | `togglePzAll()` が `pzExcept.clear()` するので、セット単位の個別状態は**全て消えて**一様な全開／全伏になる（§3.1 の手順5）。仕様どおり・意図的 |
| ⑧ | **勝者が1人もいないセット**（例: IN 側を誰も登録していない） | `pzFlags(g,2).length===0` ⇒ **`IN` チップを出力しない**（§6.4）。押せない/効かないボタンを置かない |
| ⑨ | **個人戦タブとチーム戦タブの共有** | `pzMode`/`pzExcept` はモジュールスコープの1組＝**どちらのタブで開けても両方に反映**（現行仕様のまま・変更しない）。個人戦タブは `withTeam` なしで同じ行タップが効く |
| ⑩ | **対象ホールが0本**（Par3/Par5 なし） | 現行どおり `prize.emptyCfg` / 併設カード省略。tools バーごと出ない |

---

## 10. サイズ判定・モック・PR 分割

### 10.1 サイズ判定：**M**

- S ではない理由: グローバル関数2本のシグネチャ変更＋グローバル1本追加、load-bearing な不変条件（表示本数＝`niadoraTeamCount`）の**定義変更**、操作モデル（タップ粒度）の変更。CLAUDE.md の S 定義「文言・余白・要素の削除/移動」に収まらない。
- L ではない理由: §3 計算・§4 データモデル・localStorage・i18n キー集合・タブ/モジュール構成に**非接触**。新規ファイルなし。触るのは4ファイル・約40行。

### 10.2 モック：**不要**

- レイアウト（見た目）は PR #147 でユーザー承認済みの形から**ほぼ動かない**。変わるのは (a) `.npdc-set` のフォントサイズ（13px→15/16px）、(b) tools バーのチップ2個増（twoSets ON 時のみ）、(c) **ヒットエリア**（見えない）の3点。
- `/feature` 手順 1.5 のモック承認は「見た目の方向違い」を1枚で検出するためのもの。本件は**操作モデルの変更**で、静止画では差が出ない（タップ領域は写らない）。
- 代わりに §5.4 の 375px / 1280px レイアウト図と §6.4 のチップ文言を Issue に転記し、**文言（`OUT 全表示`）とチップ2個追加の可否だけ**をユーザーに確認する（§12-A）。

### 10.3 PR 分割：**1本**

| PR | 内容 | 触るファイル |
|---|---|---|
| **単独PR** | §3（`pzKey`/`pzSetMasked`）／§4（`pzMasked`/`togglePzCell` の第2引数）／§5.2（行タップ DOM）／§6.3-6.4（`pzFlags`/`togglePzSet`＋チップ2個）／§7.1（`renderTeamNiadora` 再定義）／§8.3（CSS 3〜4行） | `js/results.js` `js/results-team.js` `styles.css` `index.html`(`?v=`) |

- 分割しない理由: `renderPrizeHero`（開封の書き手）と `renderTeamNiadora`（開封の読み手）を**別PRにすると、その間の状態で §7.2 の不変条件が壊れる**（片方だけ旗単位になる）。不変条件を割らないために1本にする。
- §12-A で「セット一括チップ不要」と判断された場合のみ、§6 の全部（`pzFlags`/`togglePzSet`/チップ）を落とす。**その場合も1本のまま**（残りの依存関係は変わらない）。

### 10.4 ★並走中タスクとの関係（実装は直列）

| | 本件 | `docs/handoff/2026-09-12-nonparticipant-ghost.md`（別 architect が設計中） |
|---|---|---|
| `js/calc.js` | **触らない** | チーム集計群を触る |
| `js/results.js` | **`renderPrizeHero` と冒頭の `pz*` 群**（5〜13行目・160〜186行目） | **`renderScorecard`**（約200行目以降） |
| `js/results-team.js` | `renderTeamNiadora` | （未定・触る可能性あり） |
| `styles.css` | `.npdc-*` | （未定） |
| `index.html` | `?v=` 一括更新 | `?v=` 一括更新 |

**設計は並走してよいが、実装は直列にすること。** 理由:

1. 同じ `js/results.js` を触る（別関数だが同一ファイル＝マージ時に手動解決が必要になる）。
2. 両PRとも `index.html` の `?v=` を**全行一括更新**するため、必ず衝突する（本文全18行が競合）。
3. 先にマージされた側の `?v=` を、後発はリベース後に**自分のPR番号へ再度一括更新**すること（CLAUDE.md「js/**・styles.css を変更する PR は `?v=` を PR 番号に一括更新」）。

どちらを先にするかは PM 判断。ghost バグは**データの正しさ**に関わるので先行を推奨（本件は表示演出＝緊急度が低い）。

---

## 11. 受け入れ条件（機械検証できる形）

### 11.1 非接触の証明（★最優先）

1. **`git diff --stat origin/main` に `js/calc.js` が現れない**。
   ```bash
   git diff --stat origin/main -- js/calc.js | wc -l     # → 0
   ```
2. **触るファイルが4つだけ**である。
   ```bash
   git diff --name-only origin/main
   # → js/results.js / js/results-team.js / styles.css / index.html  の4行のみ
   #   （docs/handoff/2026-09-12-niadora-reveal-per-set.md は先行の docs 単独コミット）
   ```
3. **`node tools/regress.mjs` が無差分 PASS**（`--update` 禁止）。
   - 根拠: `tools/regress.mjs` が vm に読み込むのは `js/state.js` + `js/nav.js` + `js/score.js` + `js/roulette.js` + `js/calc.js` の5本のみで、**`js/results.js` / `js/results-team.js` を読み込まない**。本PRはその5本を1行も触らない ⇒ **差分が出たらそれ自体が実装ミス**。
   - `tools/regress-expected.json` を**変更しないこと**（`git diff --name-only` に現れない＝条件2で担保）。
4. **`node tools/verify.mjs` が全 PASS**（JS 構文／i18n ja=zh=en 完全一致／使用キー未定義参照なし／**未使用キー0**／CSS 孤立 `var()` なし／計算回帰）。
   - i18n は**追加も削除もしない**（`OUT`/`IN` はリテラル・一括チップは既存 `ns.allShow`/`ns.allHide` を再利用）。`git diff --name-only` に `js/i18n.js` が現れないことで機械確認できる（条件2に含まれる）。
5. **localStorage キーが5つのまま**。
   ```bash
   grep -n "localStorage\." js/*.js    # golfCompe_v1 / _lang / _theme / _channel / _seenTop の5種のみ
   ```
   開封状態（`pzMode`/`pzExcept`）は**揮発**のまま（§11.14 原則4）。リロードで `pzMode='show'` / `pzExcept` 空に戻ることを実機確認。
6. `index.html` の `?v=` を**当該 PR 番号に一括更新**（`link` 1行＋`script` 17行＝全18行）。
7. 新規 JS ファイルなし・`<script>` 読込順に変更なし・ESM 化なし（inline `onclick` 方式維持）。

### 11.2 2セットOFF（既定）で main と完全一致

8. **DOM 文字列一致**。`twoSets` を持たない（または `false` の）ゲームで、以下の3状態 × 2関数の出力が **main と1バイト差なく一致**する。

   | 状態 | 作り方（DevTools コンソール） |
   |---|---|
   | 全開封 | `pzMode='show'; pzExcept.clear(); renderResult();` |
   | 全伏せ | `pzMode='hide'; pzExcept.clear(); renderResult();` |
   | 部分開封 | 全伏せにしてから NP ホール1つ・DC ホール1つのセルをタップ |

   ```js
   // 各状態で実行し、main 側の同手順の出力と diff する（空であること）
   copy(renderPrizeHero(curGame()) + '\n----\n' + renderPrizeHero(curGame(), true) + '\n----\n' + renderTeamNiadora(curGame()));
   ```
   - 特に `onclick="togglePzCell(11)"`（引数1個）の形が**保たれている**こと（`togglePzCell(11,1)` になっていたら FAIL）。
   - tools バーが **master チップ1個のまま**（`OUT`/`IN` チップが出ていない）こと。
   - `.npdc-set` / `.npdc-row` / `.split` が出力に**現れない**こと。

9. 既定OFF のコンペで、**開封演出の操作感が現行と同じ**（セル全体タップで開閉・master チップで一括）。

### 11.3 2セット ON の機能条件

10. **セット別に開けられる**: `twoSets:true` で、12H の OUT 行をタップ → OUT だけ氏名が出て IN は `？？？` のまま。IN 行をタップ → IN も出る。**ホール番号部分をタップしても何も起きない**（§5.2）。
11. **★不変条件（全開封時の一致）**。S=1 と S=2 の**両方**で下記が PASS すること。
    ```js
    // チーム戦 > ニアドラ タブを開いた状態で実行
    pzMode='show'; pzExcept.clear(); renderResult();
    const g=curGame();
    [...document.querySelectorAll('.rl-standing .tp-nd')].forEach(e=>{
      const name=e.querySelector('.rl-st-team').textContent;
      const shown=+e.querySelector('.rl-st-h').textContent;
      const T=g.teams.find(t=>t.name===name);
      console.assert(shown===niadoraTeamCount(g,T), 'MISMATCH', name, shown, niadoraTeamCount(g,T));
    });
    console.log('OK');   // assert が1つも出なければ PASS
    ```
12. **単調性（§7.2 系1・系2）**: 全伏せから旗を1本ずつ開けていくと、当該チームの表示本数が**毎回ちょうど 0 か 1 だけ増える**（旧仕様のように一度に2増えない）。最終的に §11.3-11 の値に到達する。
13. **勝ち点タグ**: OUT 側を全部開けただけではタグが出ない。IN 側も全部開けた瞬間に出る（`ev.on`＝発表済みが前提）。
14. **セット一括**（§12-A で採用の場合）: `IN 全非表示` を1タップ → IN 側の旗が全部伏せ・OUT は変化なし。`master 全非表示` → `OUT 全表示` の順で押すと OUT だけ全開になる。勝者が0本のセットのチップは**出ない**。
15. **375px（DevTools iPhone SE）**: 横スクロールが発生しない。行のタップ領域が **56px 以上**（DevTools の要素インスペクタで `.npdc-row` の高さを確認）。tools バーのチップ3個が1行に収まる（折返しても可）。
16. **1280px（投影相当）**: 4列グリッド・勝者名 44px・`OUT`/`IN` ラベルが 16px で判読できる。片側開封状態で「どちらの組が未発表か」が後方席から分かる。

### 11.4 揮発性・端ケース

17. 開封途中でページをリロードすると**全開封（`pzMode='show'`）に戻る**（localStorage 非保存）。
18. `twoSets` を ON → IN 側だけ伏せる → OFF → ON と操作しても、**幽霊マスク・例外が出ない**（§9-③）。
19. 片側だけ勝者登録のホールで `—` の行をタップしても**何も起きない**（§9-①）。両セット未登録のセルは従来どおりタップ無効（§9-②）。
20. 個人戦 > ニアドラ タブで開けた旗が、チーム戦 > ニアドラ タブでも開いている（開封状態の共有＝現行仕様の維持）。

---

## 12. 未決事項（ユーザー確認・既定案つき）

### A.（★要確認）セット単位の一括操作チップを入れるか

- **既定案: 入れる**（§6.2）。`twoSets:true` のときだけ tools バーに `OUT 全表示` / `IN 全非表示` の2チップを追加。
- **理由**: 「IN 組はまだコース上なので IN 側だけ伏せておく」が **1タップ vs 最大8タップ**になる。逆に「ホール単位の一括タップ」は 2タップで代替できるので採用しなかった（§5.2）。この非対称が採否の根拠。
- **投影原則との整合**: カード群の下・`.tgl`（控えめ）・ON 時のみ・最大2個・勝者0本のセットは非表示。
- **代替案**: (i) チップを入れない（行タップのみ・最大8タップ）。(ii) `IN` 側だけチップを1個入れる（運用上「IN を伏せておく」が主用途なので）。
- **文言の確認点**: ラベルは `OUT 全表示` のように **`OUT`/`IN`（リテラル）＋既存 i18n（全表示/全非表示）** の連結で、**押したら起きること**を表す。master チップ（現在の状態を表す）と意味の向きが逆なので、`OUT を全表示` のような助詞入りにしたい場合は i18n キーが2×3言語ぶん必要になる（既定案は新規キー0）。

### B.（軽微）ホール番号のタップを「両方まとめて開く」ショートカットにするか

- **既定案: しない（no-op）**（§5.2）。ユーザー要件が「個別に開けたい」であり、誤タップでの両開き＝**取り返しのつかないネタバレ**を避ける。両方開けたいなら行を2回タップ。
- **代替案**: ホール番号タップ＝「**開ける方向にだけ**効く」（両方 reveal・伏せ直しはしない）。タップ数は減るが、誤タップ時の被害が最大化する方向なので既定案では採らなかった。
- 実装コストはどちらもほぼ同じ（`togglePzCell(h)` を hole 一括に再定義すれば済む）。**後から足すのも容易**なので、まず既定案で運用してみて不便なら追加するのが安全。
