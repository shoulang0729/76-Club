# 設計：ニアピン / ドラコン対象ホールの手動追加・除外（par 自動導出＋上書き） — 2026-09-12

- 作成: 2026-09-12 / architect
- **区分: 確定**（§15 に未決3件＝いずれも既定案つき。**既定案のまま実装してよい**）
- **サイズ判定: M**（§4 データモデルに**新フィールド1つ**を追加・i18n キー集合を追加・§3.6 の「対象ホールの決まり方」を改訂。計算式そのものは不変。新規タブ／モジュール／localStorage キーはなし＝L ではない）
- **モック: 不要**（画面構成・ナビの再編ではなく、既存カード内に折りたたみの編集パネルを1つ足すだけ。ただし §9 にレイアウト図と 375px の実寸計算を置く）
- 先に読むこと:
  - `docs/handoff/2026-08-20-npdc-par.md` … **本書が改訂する直前の設計**（手動指定を廃止し par 導出にした回）。§2 の決定表・§5 の移行ケース表・§7 の参照切替表
  - 正本 `docs/handoff/2026-07-12-golf-compe-web.md` **§3.6**（ニアピン/ドラコン）・**§4**（データモデル prizes）・**§11.14**（投影前提の表示原則）
  - `docs/handoff/2026-09-12-niadora-2sets.md` §3.3/§3.4 … `prizes` への非破壊なフィールド追加＋migrate backfill の直近の前例（**マージ済み**）
  - `docs/handoff/2026-09-12-niadora-reveal-per-set.md`（#148・未実装）§3.2 … `pzExcept` のキー設計が「NP/DC は同一ホールに同居しない」に依存している箇所（本書 §7 で保証する）
- 基準コミット: main（2026-09-12 時点。`js/state.js:85-88` に `niapinHolesOf`/`draconHolesOf` がある版）

---

## 0. 結論サマリ

| 論点 | 決定 | 節 |
|---|---|---|
| 方式 | **par 自動導出 ＋ ホール単位の上書き（override）**。完全手動リストにはしない（既存データ＝上書き0件が自動と完全一致するため、移行ゼロ） | §4 |
| 置き場所 | **新フィールド `g.prizes.npdcOverride`**（`{ "<hole>": "np"｜"dc"｜"none" }`）。**廃止フィールド `niapinHoles`/`draconHoles` には一切触れない**（読まない・書かない・消さない） | §3・§4 |
| 追加と除外 | **両方持つ**（`"np"`/`"dc"` が追加・振替、`"none"` が除外）。3値＋「キー無し＝自動」の4状態 | §4.2 |
| ニアピン側も手動対応するか | **する（両方対応）**。1つの override マップで NP/DC を同時に扱うので実装量は同じ。片方だけ手動は UI・データとも非対称になり説明もできない | §6 |
| NP と DC の同一ホール同居 | **許さない**（1ホール＝1値のデータ構造で**構造的に不可能**）。#148 の `pzExcept` 設計は無傷 | §7 |
| par を後から変えたとき | **上書きはホール番号で固定**（par 追従しない）。上書きの無いホールだけが par に追従 | §5.2 |
| 関数シグネチャ | `niapinHolesOf(g)` / `draconHolesOf(g)` は**シグネチャも戻り値の形（昇順 index 配列）も不変**＝**呼び出し6ファイルは1行も変更しない** | §5.3 |
| 計算式 | **§3 は1行も変えない**。`js/calc.js` は**触らない** | §12 |
| バリデーション | Par3 をドラコン・Par5 をニアピンに**できる**（禁止しない）。個数制限なし（全18ホールDCも可）。確認ダイアログなし | §8 |
| UI | コースタブ NPDC カード内に **`<details>`（既定=閉）の手動調整パネル**。1ホール1行×18行の `<select>`（自動/ニアピン/ドラコン/対象外）＋「すべて自動に戻す」 | §9 |
| i18n | **新規6キー×3言語**＋既存3キーの文言更新（キー集合の増減は +6 のみ・未使用キー0） | §10 |
| testdata | **変更なし**（`sdPrizes` は導出配列のインデックス基準のまま。override を作らないので生成物は前後同一） | §11 |
| localStorage | **5つのまま**（`npdcOverride` は `golfCompe_v1` 内） | §12 |
| PR 分割 | **1本**（`js/state.js`/`js/course.js`/`js/i18n.js`/`styles.css`/`index.html`/`tools/regress.mjs`＋期待値。約 70 行） | §14 |

---

## 1. 要件

### 1.1 ユーザー原文（2026-09-12）

> コース設定のドラニアはデフォルトPar3、Par5だけでは不足だった。時々Par4ドラコンのケースがあった。

### 1.2 解釈

- 実運用で **Par4 のホールにドラコンを置く**コンペがあった。現行（`2026-08-20-npdc-par.md`）は par 導出のみなので**設定する手段が無い**。
- 逆（Par5 だがドラコンにしない＝対象から外す）も同じ理屈で起こりうる（例: ドラコンは1本だけにする、危険なホールを外す）。**追加だけでなく除外も必要**と判断する（§4.2）。
- 2026-08-20 の決定「自動導出」は**間違いではなく既定として正しい**（大多数のコンペで手入力ゼロになる）。本件はそれを**上書きできるようにする**改訂であって、手動指定への出戻りではない。

---

## 2. 現状の正確な読み取り（実装前に一致を確認すること）

### 2.1 導出（`js/state.js:85-88`）

```js
/* NPDC 対象ホールはパーから導出（Par3=ニアピン / Par5=ドラコン・2026-08-20-npdc-par.md）。
   g.prizes.niapinHoles/draconHoles は廃止フィールド（後方互換のため残置・非参照） */
function niapinHolesOf(g){ return g.par.map((p,i)=>p===3?i:-1).filter(i=>i>=0); }
function draconHolesOf(g){ return g.par.map((p,i)=>p===5?i:-1).filter(i=>i>=0); }
```

### 2.2 参照箇所（全件・grep 実測）

| ファイル:行 | 用途 |
|---|---|
| `js/calc.js:201-202` | `niadoraTeamCount`（チーム種目「ニアドラ」の本数） |
| `js/calc.js:301-302` | `computePoints` の NP/DC 個人配点 |
| `js/results.js:127` | `renderIndGame('prize')` の empty 判定（`prize.emptyCfg`） |
| `js/results.js:161` | `renderPrizeHero` のセル生成 |
| `js/results-team.js:154-158,166` | `renderTeamNiadora`（チーム別本数・`allOpen`・empty 判定） |
| `js/roulette.js:209` | `renderPrizes`（勝者登録 select） |
| `js/course.js:19` | コースタブ NPDC カードの読み取り専用一覧 |
| `js/testdata.js:213` | `sdPrizes`（テストデータの勝者割当） |

**本設計はこの8箇所すべてを1行も変更しない**（§5.3）。

### 2.3 廃止フィールドの現況

- `js/state.js:39`（migrate）・`:110`（newGame）に `niapinHoles:[]` / `draconHoles:[]` が**残置**。2026-08-20 以降**どこからも読まれていない**（grep 上、参照は state.js の定義2箇所とコメントのみ）。
- migrate は既存ゲームに対して `niapinHoles`/`draconHoles` を**補完も削除もしない**（`if(!g.prizes)` の中でしか触れない）＝**2026-08-20 以前のコンペには当時の値がそのまま残っている**。

---

## 3. 「廃止フィールドを再利用してよいか」の検討（★最重要の罠）

再利用は **却下**。3案を比較する。

| 案 | 内容 | 判定 |
|---|---|---|
| **A（採用）** | **新フィールド `prizes.npdcOverride`** を追加し、廃止フィールドには読み書きしない | ◎ 既存データの挙動が**定義上**変わらない（新フィールドは既存データに存在しない＝`{}` 相当＝純粋な par 導出）。廃止フィールドの値は今後も無視され続ける（2026-08-20 以降の状態を継続） |
| B | 廃止フィールドを再利用し、migrate で「2026-08-20 以降に作られた／新方式で保存された」ゲームを判別して無効化 | ✗ **判別不能**（下記）。却下 |
| C | migrate で廃止フィールドを明示的に空にしてから再利用 | ✗ 非可逆（旧データの情報を破壊）。かつ**旧バックアップ JSON をインポートするたび**に破壊が起きる。得るものが「フィールド名の節約」だけなので割に合わない。却下 |

### 3.1 B 案が不可能であることの確認（実測）

判別に使えそうな材料を全部当たったが、**いずれも使えない**。

| 候補 | 結果 |
|---|---|
| スキーマ版フィールド | **存在しない**（`state.js` に `schemaVersion` 等なし） |
| 作成日時 | **存在しない**。`g.date` は**コンペ開催日でユーザーが自由編集できる**（過去日付の新規コンペも作れる）＝判別に使えない |
| 「新しいフィールドの有無」を代理指標にする（例: `g.announced` があれば 2026-08-30 以降） | **不可**。`migrate()` は**全ゲームに無条件で backfill する**（`js/state.js:27-65`）。アプリを一度でも開いた時点で**全ゲームが最新スキーマに揃う**ため、新旧が区別できない |
| `niapinHoles` の中身が par 導出と一致するかで判定 | **不可**。「一致＝旧データの偶然」と「一致＝新方式の手動指定」を区別できない。逆に不一致を「旧データ」と決めつけると、**新方式の Par4 ドラコン指定が消える**（本機能そのものが壊れる） |

→ **B は原理的に成立しない**。よって A（新フィールド）で確定。

### 3.2 A 案で「既存コンペの対象ホールが1つも変わらない」ことの根拠

1. 既存データに `npdcOverride` は**存在しない** → `(g.prizes.npdcOverride||{})[h]` は常に `undefined` → §5.1 の導出は `par===3/5` の厳密一致に**完全に退化**する（現行実装と同じ式）。
2. migrate は `npdcOverride` を **`{}` で backfill するだけ**（値を作らない）。
3. 廃止フィールドは**読まない**ので、古い値が何であっても影響しない。
4. 機械確認は §13.2 のスニペット（廃止フィールドに古い値が入った `g` を含めて旧実装と全一致を照合）＋ §13.1 の回帰スナップショット無差分。

---

## 4. データモデル（★§4 に触れる＝正本へ最小追補）

### 4.1 形

```jsonc
"prizes": {
  "niapinHoles":[2], "draconHoles":[4],     // ★2026-08-20 廃止フィールド（非参照・残置）。本機能でも一切触らない
  "npdcOverride": { "3":"dc", "2":"none" }, // ★2026-09-12 追加。キー=ホールindex(0始まりの文字列) / 値= "np" | "dc" | "none"
                                            //   キーが無いホール＝"自動"（par 導出）。既定 {} ＝従来と完全に同一
  "niapinWinner": { "2":"xxx" }, "draconWinner": { "4":"yyy" },
  "twoSets": false, "niapinWinner2": {}, "draconWinner2": {}
}
```

- **キーはホール index の文字列**（`niapinWinner` と同じ規約）。JS の `obj[3]` と `obj["3"]` は同一なので、書き込みは数値 index のままでよい。
- **値は3リテラルのみ**。列挙外の値（旧版・手編集・破損）は**自動として扱う**（§5.1 の防御ガード）。
- **"自動" は「キーの不在」で表現する**（`"auto"` という値は保存しない）。これにより「上書きが1件もない＝`{}`＝2026-08-20 と完全に同一」が構造で保証され、バックアップ JSON の差分も最小になる。

### 4.2 なぜ「追加」だけでなく「除外」も持つのか

- Par5 が3つあるコースで**ドラコンは1本だけ**にする運用は珍しくない（残り2つは対象外にしたい）。par を偽って 4 に書き換える回避策はスコア計算（ペリア・ステーブルフォード・オリンピック）を壊すので**絶対に避けさせる**必要がある。
- 除外を持たないと「Par4 に足せるが Par5 を外せない」非対称になり、UI の説明もできない。
- 3値＋不在＝4状態は `<select>` の4選択肢に素直に対応する（§9）。

### 4.3 migrate（`js/state.js`・`twoSets` の直後に追加）

```js
// NPDC 対象ホールの手動上書き（2026-09-12-npdc-manual-holes.md §4）。既定 {} ＝ par 自動導出のみ＝従来と完全に同一。
// 読み出しは ||{} で守れるが setNpdc() が P.npdcOverride[h]=v と直接代入するため backfill は必須（twoSets 系と同じ理由）
if(!g.prizes.npdcOverride || typeof g.prizes.npdcOverride!=='object') g.prizes.npdcOverride={};
```

`newGame()` の `prizes` にも `npdcOverride:{}` を追加する（`twoSets` と同じ行に並べる）。**`niapinHoles:[]`/`draconHoles:[]` は現状のまま残す**（削除しない）。

### 4.4 バックアップ互換（`js/backup.js` は無改修）

- `exportData` は `JSON.stringify(state)` の丸ごと出力、`importData` は `JSON.parse`→`migrate(s)`。**フィールドのホワイトリストが無い**ので新フィールドは自動で往復する。
- **旧バックアップ**（`npdcOverride` なし）→ migrate が `{}` を補完 → **従来と同一挙動**。
- **新バックアップを旧版アプリで読む**場合 → 未知フィールドは無視され par 導出に戻る（データは壊れない・非破壊）。

---

## 5. 導出ロジック（`js/state.js` のみ変更）

### 5.1 新実装（既存2関数の**中身だけ**差し替え＋ヘルパー2本追加）

```js
/* NPDC 対象ホールは par から自動導出（Par3=ニアピン / Par5=ドラコン・2026-08-20-npdc-par.md）し、
   prizes.npdcOverride のあるホールだけ手動で上書きする（2026-09-12-npdc-manual-holes.md §5）。
   g.prizes.niapinHoles/draconHoles は廃止フィールド（後方互換のため残置・**本機能でも非参照**） */
function npdcOv(g){ const v=(g.prizes||{}).npdcOverride; return (v&&typeof v==='object')?v:{}; }
function npdcManual(g,h){ const v=npdcOv(g)[h]; return v==='np'||v==='dc'||v==='none'; }   // 手動指定されているか
function npdcKindOf(g,h){                      // '' | 'np' | 'dc'（1ホールにつき必ず1値＝NP/DC は排他）
  const v=npdcOv(g)[h];
  if(v==='np'||v==='dc') return v;
  if(v==='none') return '';
  const p=g.par[h];
  return p===3?'np':p===5?'dc':'';
}
function niapinHolesOf(g){ return g.par.map((p,i)=>npdcKindOf(g,i)==='np'?i:-1).filter(i=>i>=0); }
function draconHolesOf(g){ return g.par.map((p,i)=>npdcKindOf(g,i)==='dc'?i:-1).filter(i=>i>=0); }
```

不変条件（実装者・reviewer が確認すること）:

1. **昇順**: `g.par.map(...)` を土台にしているので index 昇順は現行どおり保証される（`js/roulette.js:209` が `sort` 無しで列挙している前提を維持）。
2. **長さ18**: `g.par` は migrate/コースライブラリ側のガードで常に18要素（`js/state.js:18-26`）。override のキーが 18 以上でも `g.par.map` の外なので**無視される**（範囲外ホールは作れない）。
3. **排他**: `npdcKindOf` は1ホールにつき1値しか返さない → `niapinHolesOf(g) ∩ draconHolesOf(g) = ∅` が**常に真**（§7）。
4. **退化**: `npdcOverride` が `{}` のとき、返り値は旧実装と**完全一致**（§3.2・§13.2 で機械確認）。

### 5.2 par を後から変更したときの挙動（★事故りやすい箇所）

**規則: 上書きはホール番号に貼り付く。par には追従しない。上書きの無いホールだけが par に追従する。**

| 状態 | 操作 | 結果 |
|---|---|---|
| 4H=Par4・`npdcOverride["3"]="dc"` | 4H の par を 5 に変更 | **DC のまま**（上書きが一致するだけ。表示の ＊ マークは残る） |
| 4H=Par4・`npdcOverride["3"]="dc"` | 4H の par を 3 に変更 | **DC のまま**（手動が勝つ）。自動（＝NP）に戻したいなら select で「自動」を選ぶ |
| 12H=Par3・上書き無し | 12H の par を 4 に変更 | 対象から外れる（現行どおり） |
| 12H=Par3・`npdcOverride["11"]="none"` | 12H の par を 5 に変更 | **対象外のまま**（除外が勝つ） |
| 任意 | 「すべて自動に戻す」ボタン | `npdcOverride={}` ＝ 2026-08-20 と完全に同じ状態に戻る（**この操作だけが上書きを破棄する**・§9.3） |

**コースライブラリ読込（`js/course.js:199` `g.par=clibExpand(o,i)`）**: par を丸ごと差し替えても `npdcOverride` は**保持**する（非破壊・可逆が本アプリの一貫方針）。別コースを読み込んだのに上書きが残って気づかない事故は、§9.1 の **＊マーク＋凡例**で可視化して防ぐ（消すのはワンタップ）。→ 未決 §15-C（既定案＝保持）。

### 5.3 参照箇所の置換表（＝**全件「変更なし」**）

| ファイル:行 | 変更 |
|---|---|
| `js/calc.js:201-202`（`niadoraTeamCount`） | **なし**（`niapinHolesOf(g)`/`draconHolesOf(g)` の呼び方が同じ） |
| `js/calc.js:301-302`（`computePoints`） | **なし**（★calc.js は1行も触らない） |
| `js/results.js:127,161` | **なし** |
| `js/results-team.js:154-158,166` | **なし** |
| `js/roulette.js:209`（`renderPrizes`） | **なし**（昇順保証を維持） |
| `js/testdata.js:213`（`sdPrizes`） | **なし**（§11） |
| `js/course.js:19`（NPDC カード） | **UI 追加のため変更**（§9） |
| `js/state.js:85-88` | **導出を差し替え＋ヘルパー2本追加**（§5.1）、`migrate`/`newGame` に `npdcOverride` 追加（§4.3） |

シグネチャを変えない設計にしたのは、**#148 / #152 / #150 と衝突するファイルを最小化する**ため（§14.2）。

### 5.4 数値例（★前後比較）

前提: par は `newGame()` 既定 `[4,4,3,4,5,4,4,3,4, 4,4,3,4,5,4,4,3,4]`（Par3=3H,8H,12H,17H / Par5=5H,14H）。`points.niapin=2`・`points.dracon=2`。勝者は `niapinWinner={2:A,7:B,11:C,16:D}`・`draconWinner={4:E,13:F}`。

| # | `npdcOverride` | 前（現行 main） | 後（本設計） |
|---|---|---|---|
| 0 | `{}`（＝既存の全コンペ） | NP=[2,7,11,16] / DC=[4,13]。A〜D **+2**・E,F **+2** | **完全に同一**（配点・表示・チーム本数とも1文字も変わらない） |
| 1 | `{"3":"dc"}` ＋ `draconWinner[3]=G` | 4H は Par4 → 対象外 → G **+0**、チーム本数に不算入 | 4H=DC → G **+2**、G の所属チームのニアドラ本数 **+1** |
| 2 | `{"2":"none"}` | 3H は Par3 → NP 対象 → A **+2** | 3H は対象外 → A **+0**。`niapinWinner[2]=A` は**残置**（「自動」に戻せば +2 が復活＝非破壊・可逆） |
| 3 | `{"13":"np"}` | 14H は DC 対象 → F **+2**（dracon） | 14H は **NP 対象**。`draconWinner[13]=F` は無視され、NP 側の勝者は未登録 → **誰も加点されない**。幹事が結果タブで「14H ニアピン」に F を選ぶと F **+2**（niapin 側）。DC のエントリは保持＝「自動」に戻せば元の +2 が復活 |
| 4 | `{"0":"dc","1":"dc",…,"17":"dc"}`（全18DC） | — | 18ホールすべて DC。登録された勝者1人につき `points.dracon` 加算（式は不変）。UI も既存の18セル表示で破綻しない（§8.2） |

**重要**: ケース3 が示すとおり、**種別を振り替えても勝者レコードは自動で引っ越さない**（`niapinWinner` と `draconWinner` は別マップ）。これは 2026-08-20 §4 が確立した「非破壊・可逆」規則と同じで、自動コピーはしない（コピーすると元に戻せなくなる）。

---

## 6. ニアピン側も手動対応にするか → **する（両方対応）**

| 案 | 内容 | 評価 |
|---|---|---|
| **6-A（採用）** | NP/DC の**両方**を手動で追加・除外できる。1つの `npdcOverride` マップで扱う | 実装量は DC だけの案と**ほぼ同じ**（値の enum に `np` が増えるだけ）。UI も1つの select に4択で収まる。排他が構造で保証される（§7）。「Par3 だがニアピンにしない（グリーン手前が崖なので）」も同じ仕組みで解決 |
| 6-B | ドラコンだけ手動対応（NP は par 導出のみ） | 値は `dc`/`none` だが、`none` は NP 側にも効く（Par3 を除外する）ので**結局 NP に手を出す**か、`none` を DC 限定にする不自然な仕様になる。UI の説明文が破綻し（「ドラコンだけ手で足せます」「でも Par3 は外せません」）、次に必ず「ニアピンも足したい」が来る。**却下** |

**推奨: 6-A**。ユーザー要件（Par4 ドラコン）は 6-A に完全に含まれる。

---

## 7. NP と DC の同一ホール同居 → **許さない（排他を維持）**

### 7.1 根拠（実測）

- `js/results.js:5` のコメント: 「キー=ホールindex・**NP/DC は対象ホールが素で排他**」。伏せ演出の `pzExcept` は**ホール index だけ**をキーにしている。
- #148（`2026-09-12-niadora-reveal-per-set.md` §3.2）は `pzExcept` のキーを `` `${h}:${s}` ``（ホール:セット）に拡張する設計で、**kind をキーに含めない**。もし同一ホールに NP と DC が同居すると、`togglePzCell(h)` が2枚のセルを同時に開いてしまい、#148 の設計もそのまま破綻する。
- `renderPrizeHero`（`js/results.js:161-163`）は NP と DC を連結してホール番号昇順に並べる。同居すると**同じホール番号のセルが2枚並ぶ**（投影時に紛らわしい）。

### 7.2 本設計での保証

`npdcOverride` は **1ホール＝1値**なので、同居は**データ構造上表現できない**（par 由来の排他より強い保証）。`npdcKindOf` は `'' | 'np' | 'dc'` のいずれか1つだけを返す。

→ **#148 の設計は本件の影響を受けない**（`pzExcept` に kind を足す必要はない）。#148 を先に実装しても後に実装しても矛盾しない。

### 7.3 将来「1ホールに NP と DC の両方」を求められたら

値を配列（`["np","dc"]`）にする拡張は可能だが、そのときは **`pzExcept` のキーに kind を含める改修（#148 の再設計）が必須**になる。本書の時点では**要件が無いので採らない**（YAGNI）。→ 未決 §15-B（既定案＝許さない）。

---

## 8. バリデーション

### 8.1 par と種別の組み合わせ → **制限しない**

| 指定 | 可否 | 理由 |
|---|---|---|
| Par4 をドラコン | **可**（本件の主目的） | 実運用の報告あり |
| Par4 をニアピン | **可** | 短い Par4 のニアピンはローカルルールとして存在する |
| **Par3 をドラコン** | **可**（警告もしない） | 通常は無意味だが、禁止すると「短い Par4 を par3 として登録しているコース」等の現場運用を殺す。アプリは勝者を記録するだけで打数計算に無関係（`game.npdcLocal` の思想）。**幹事が明示的に選んだ操作を否定しない**のが本アプリの方針（隠しホール選択・任意対決と同じ） |
| Par5 をニアピン | **可** | 同上 |
| Par0/未設定を NP/DC | **可** | par 未入力でも対象ホールを先に決められる（当日運用で par を後入力するケース） |

確認ダイアログ・トーストは**出さない**（`setPar` と同じく即時反映・取り消しは select で自動に戻すだけ）。

### 8.2 極端な指定

- **個数制限なし**（2026-08-20 §1-3 の「Par3/Par5 が何個あっても全部対象」を踏襲）。全18ホールを DC にしてもよい。
- 表示上の破綻はない: ヒーローは `.npdc-hero` の2列グリッド（18セル＝9行）、勝者登録は18行の select。**Par3 が18個のコースを登録した場合と同じ状態**＝現行でも到達可能な形なので新たなリスクはない。
- 計算量も O(18)。

### 8.3 不正値の防御

`npdcKindOf` は列挙外の値を**自動として扱う**（§5.1）。手編集されたバックアップ JSON（`"x"`・数値・null 等）を読んでも例外にならず、par 導出に落ちる。

---

## 9. UI（`js/course.js` の NPDC カード）

### 9.1 カード全体のレイアウト（375px 幅）

```
┌─ card（padding 18px 16px）──────────────────────────┐
│ ニアピン / ドラコン ホール                    ← h2   │
│ パー設定から自動判定します（Par 3=ニアピン /         │
│ Par 5=ドラコン）。必要なホールは下で手動調整。← muted│
│                                                      │
│ [ニアピン] 3H・8H・12H・17H                  ← pill  │
│ [ドラコン] 4H＊・5H・14H                     ← pill  │
│ ＊は手動で指定したホールです        ← muted・手動が  │
│                                        1件以上の時のみ│
│ ┌─ details（既定=閉じ）────────────────────────┐   │
│ │ › 対象ホールを手動で調整                      │   │
│ └───────────────────────────────────────────────┘   │
│ 2打目計測などのローカルルールは当日運用で。  ← muted │
└──────────────────────────────────────────────────────┘
```

- **上段の読み取り専用一覧は主役のまま**（2026-08-20 §6 の形を維持）。変更点は**手動指定ホールに `＊` を付ける**ことと凡例1行だけ。
- 幹事の操作UI（手動調整）は **`<details>` で折りたたみ**＝投影原則 §11.14 原則3（コースタブは設定タブだが、原則を崩さない）。
- 空状態（NP も DC も 0 件）でも **details は必ず出す**（手動で足す唯一の入口なので隠さない）。`game.npdcNone` の文言も「手動でも追加できる」に更新する（§10）。

### 9.2 details を開いたとき

```
┌─ details[open] ─ .in（padding 0 12px 12px）─────────┐
│ ⌄ 対象ホールを手動で調整                             │
│ 既定は自動（Par 3=ニアピン / Par 5=ドラコン）。      │
│ ここで変えたホールだけが手動になります。      ← muted│
│                                                      │
│  1H  [ 自動（—）            ▾ ]   ← .pz2-row 流用   │
│  2H  [ 自動（—）            ▾ ]                     │
│  3H  [ 自動（ニアピン）     ▾ ]                     │
│  4H  [ ドラコン             ▾ ]   ← 手動            │
│  …（18行）                                           │
│ 18H  [ 自動（—）            ▾ ]                     │
│                                                      │
│ [ すべて自動に戻す ]              ← btn gray sm      │
└──────────────────────────────────────────────────────┘
```

**寸法（375px）**: `main` padding 12×2 → 351 → `.card` padding 16×2 → 319 → details border 1×2 → 317 → `.in` padding 12×2 → **293px**。
1行は既存の `.pz2-row`（flex・gap 8）＋ `.pz-set`（固定 34px）→ **select 幅 = 293 − 34 − 8 = 251px**。
最長ラベル「自動（ニアピン）」＝全角8字相当 ≒ 110px、英語 `Auto (Nearest the Pin)` ≒ 150px（13px フォント）→ **251px に余裕で収まる＝横スクロール・省略なし**。

**列数**（新規 CSS は `.npdc-edit` の3行のみ・既存 `@media` ブロック内に追記＝新規 `@media` を作らない）:

```css
/* NPDC 手動調整グリッド（2026-09-12-npdc-manual-holes.md §9）。行の中身は .pz2-row/.pz-set/select を共用＝新規トークンなし */
.npdc-edit{display:grid;grid-template-columns:1fr;gap:6px}
@media(min-width:768px){ .npdc-edit{grid-template-columns:repeat(2,1fr);gap:6px 12px} }   /* 既存 .npdc-hero のブロックに1行追加 */
@media(min-width:1024px){ .npdc-edit{grid-template-columns:repeat(3,1fr)} }               /* 既存ブロックに1行追加 */
```

- 375px は**1列**（select を最大幅にして i18n の長い語も切らない）。18行 ≒ 760px は details 内なので既定では見えない。
- `select` のタップ高は既存の `input,select{min-height:44px}`（@1024）＋モバイル既定 36px 前後。コースタブの par 入力と同水準。

### 9.3 追加する関数（`js/course.js`・inline onclick/onchange 方式・非 ESM）

```js
let npdcEditOpen=false;                                  // 揮発（clibOpen と同型・localStorage 非保存）
function npdcEditToggle(open){ npdcEditOpen=open; }
function setNpdc(h,v){ const P=curGame().prizes;
  if(!P.npdcOverride)P.npdcOverride={};                  // 防御（migrate 前相当のデータでも落ちない）
  if(v==='auto') delete P.npdcOverride[h]; else P.npdcOverride[h]=v;
  save(); renderCourse(); }
function resetNpdc(){ curGame().prizes.npdcOverride={}; save(); renderCourse(); }
```

- `renderCourse()` は `el.innerHTML=html` で作り直すため、**`<details>` の開閉は揮発変数で維持する**（`clibOpen`・`pzCfgOpen` と同じ方式。これを忘れると select を触るたびにパネルが閉じる）。
- 自動選択時は**キーを削除**する（§4.1）。

描画（既存 `js/course.js:18-26` の置き換え・骨子）:

```js
const NP=niapinHolesOf(g), DC=draconHolesOf(g);
const mk=h=>`${h+1}H${npdcManual(g,h)?'＊':''}`;                          // ＊＝手動指定
const anyMan=g.par.some((p,h)=>npdcManual(g,h));
const autoLabel=h=>{ const p=g.par[h]; return p===3?t('term.niapin'):p===5?t('term.dracon'):'—'; };
const cur=h=>((g.prizes.npdcOverride||{})[h])||'auto';
const opt=(h,v,label)=>`<option value="${v}" ${cur(h)===v?'selected':''}>${label}</option>`;
const rows=g.par.map((p,h)=>`<div class="pz2-row"><span class="pz-set">${h+1}H</span>
  <select onchange="setNpdc(${h},this.value)">
    ${opt(h,'auto',t('npdc.optAuto',{x:autoLabel(h)}))}${opt(h,'np',t('term.niapin'))}
    ${opt(h,'dc',t('term.dracon'))}${opt(h,'none',t('npdc.optOff'))}</select></div>`).join('');
```

（ピル行・空状態・`game.npdcLocal` の位置は現行のまま。`NP.map(h=>...)` の中身が `mk(h)` になるだけ。）

---

## 10. i18n（ja/zh/en 同時・キー集合完全一致・未使用キー0）

### 10.1 新規（6キー × 3言語）

| キー | ja | zh | en |
|---|---|---|---|
| `npdc.editTitle` | 対象ホールを手動で調整 | 手动调整对象洞 | Adjust target holes manually |
| `npdc.editNote` | 既定は自動（Par 3=ニアピン / Par 5=ドラコン）。ここで変えたホールだけが手動になります。パーを後から変えても手動指定は残ります。 | 默认自动判定（Par 3=近旗奖 / Par 5=远打奖）。只有在此处更改过的洞才会变为手动。之后修改标准杆时，手动指定仍会保留。 | Targets default to Auto (Par 3 = Nearest the Pin / Par 5 = Longest Drive). Only the holes you change here become manual, and manual picks stay put even if you edit the pars later. |
| `npdc.optAuto` | 自動（{x}） | 自动（{x}） | Auto ({x}) |
| `npdc.optOff` | 対象外 | 不设为对象洞 | Not a target |
| `npdc.resetAuto` | すべて自動に戻す | 全部恢复为自动 | Reset all to Auto |
| `npdc.manualMark` | ＊は手動で指定したホールです。 | ＊为手动指定的洞。 | ＊ marks holes you set manually. |

- `{x}` には `t('term.niapin')` / `t('term.dracon')` / `'—'` が入る（§9.3）。
- `＊` は記号リテラル（キー化しない・`prizeSetLabel` の OUT/IN と同じ扱い）。

### 10.2 既存キーの**文言だけ**更新（キー集合は不変）

| キー | 新 ja | 新 zh | 新 en |
|---|---|---|---|
| `game.npdcNote` | パー設定から自動判定します（Par 3=ニアピン / Par 5=ドラコン）。必要なホールは下で手動調整できます。勝者は結果タブで登録。 | 根据标准杆自动判定（Par 3=近旗奖 / Par 5=远打奖）。可在下方手动调整。获奖者在结果页登记。 | Target holes are set automatically from pars (Par 3 = Nearest the Pin / Par 5 = Longest Drive) and can be adjusted by hand below. Record winners on the Results tab. |
| `game.npdcNone` | 対象ホールがありません。上のコース設定で Par 3 / Par 5 を入力するか、下の「対象ホールを手動で調整」で追加してください。 | 没有对象洞。请在上方球场设置中输入 Par 3 / Par 5，或在下方「手动调整对象洞」中添加。 | No target holes yet. Enter Par-3 / Par-5 holes in the course settings above, or add them under “Adjust target holes manually”. |
| `prize.emptyCfg` | ニアピン/ドラコンの対象ホールがありません（「コース」画面のパー設定、または同画面の「対象ホールを手動で調整」で指定してください）。 | 没有近旗奖/远打奖对象洞（请在「球场」页的标准杆设置，或同页的「手动调整对象洞」中指定）。 | No NP/LD target holes yet — set them from the pars on the Course screen, or under “Adjust target holes manually” there. |

`game.npdcCard` / `game.npdcLocal` / `term.niapin` / `term.dracon` は**不変**。

---

## 11. `js/testdata.js` への影響 → **変更なし**

```js
function sdPrizes(g, p, ids){
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  (p.np||[]).forEach((idx,k)=>{ if(idx!=null && NP[k]!=null) g.prizes.niapinWinner[NP[k]]=ids[idx]; });
  (p.dc||[]).forEach((idx,k)=>{ if(idx!=null && DC[k]!=null) g.prizes.draconWinner[DC[k]]=ids[idx]; });
}
```

- `NP[k]` / `DC[k]` は**導出配列の k 番目**という相対インデックス。テストデータのパターンは `npdcOverride` を作らないので、導出配列は**現行とバイト単位で同一**＝生成される勝者割当も同一。
- 将来パターンに `npdcOverride` を入れる場合の注意（実装者向けメモとしてコメント1行を追加してもよいが必須ではない）: **override を設定してから `sdPrizes` を呼ぶ**こと（`sdPrizes` は呼び出し時点の導出結果を読む）。`np`/`dc` 配列の長さは導出ホール数に合わせる。
- テストデータへの手動ケース追加は**行わない**（既存パターンのスナップショット安定を優先）。→ 未決 §15-A（既定案＝追加しない）。

---

## 12. 触らない範囲（load-bearing）

- **`js/calc.js` は1行も変更しない**（§3 の計算式・`periaHdcp`・`pickHidden12` を含む全式が不変）。変わるのは「どのホールが対象か」だけ。
- **`js/results.js` / `js/results-team.js` / `js/roulette.js` / `js/testdata.js` も変更しない**（§5.3）。
- `prizes.niapinHoles` / `draconHoles`（廃止フィールド）に**読み書きしない・削除しない**。
- `niapinWinner` / `draconWinner` / `〜2` の形式・`setPrize` のシグネチャ・`prizeWinnerOf` 等の helper 群は不変。
- **localStorage キーは5つのまま**（`golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop`）。details の開閉は揮発変数。
- `index.html` の script 読込順・inline onclick 方式・非 ESM。
- **新規 CSS トークン（`:root` の変数）を作らない**・新規 `@media` を作らない（§9.2）。
- 隠し12ホール抽選（`pickHidden12`）とは**無関係**（par 帯で層化抽選するだけで NPDC を参照していない）。

---

## 13. 受け入れ条件（機械検証できる形）

### 13.1 ★既存の全コンペで対象ホールが1つも変わらない（筆頭条件）

1. `node tools/regress.mjs --update` 実行後の `git diff tools/regress-expected.json` が **新規ケース `npdcManual` のブロック追加のみ**であること（既存11ケースの行に1文字の変更もない）。
2. `--update` 前に `node tools/regress.mjs` を実行し、**既存ケースが1件も FAIL しない**こと（新規ケースのみ「期待に無いキー」で落ちる）。

### 13.2 廃止フィールドに古い値があっても不変（スニペット・reviewer が実行）

```bash
node -e '
const fs=require("fs"),vm=require("vm");
const sb={console,Math,JSON,localStorage:{getItem:()=>null,setItem:()=>{}},document:{getElementById:()=>null}};
vm.runInContext(fs.readFileSync("js/state.js","utf8"),vm.createContext(sb));
const old=(par,k)=>par.map((p,i)=>p===k?i:-1).filter(i=>i>=0);
let ng=0;
for(let n=0;n<5000;n++){
  const par=Array.from({length:18},()=>[0,3,4,5,6][Math.floor(Math.random()*5)]);
  const g={par,prizes:{niapinHoles:[0,1,2,3],draconHoles:[5,6,7]}};   // ★2026-08-20 以前の古い値が残っているデータ
  if(JSON.stringify(sb.niapinHolesOf(g))!==JSON.stringify(old(par,3)))ng++;
  if(JSON.stringify(sb.draconHolesOf(g))!==JSON.stringify(old(par,5)))ng++;
}
console.log(ng===0?"OK: 上書き無しなら旧実装と完全一致（廃止フィールドは無視）":"NG "+ng);'
```

期待出力: `OK: ...`。（`npdcOverride` を持たない `g` でも例外にならないこと＝防御ガードの確認も兼ねる。）

### 13.3 回帰ハーネスへの新規ケース追加（`tools/regress.mjs` の `CASES` 末尾に追加）

```js
  // L) NPDC 手動上書き（α・2026-09-12-npdc-manual-holes.md §5.4）: par は既定のまま・override だけで
  //    ①4H(index3・Par4)を DC に追加 ②3H(index2・Par3)を除外 ③14H(index13・Par5)を NP に振替。
  //    points は niapin=3 / dracon=2 にして「種別の振替」が金額差として検出できるようにする。
  //    draconWinner[13]=p10 は振替後に無視され（NP 側は p11 を登録）、niapinWinner[2]=p03 は残置のまま +0。
  //    チーム構成・スコアは team3 と同一＝差分の出どころを prizes/points だけに限定する。
  npdcManual: { channel: 'a', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03', 'p04'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06', 'p07', 'p08'] },
      { id: 'T3', name: 'グリーン', memberIds: ['p09', 'p10', 'p11', 'p12'] },
    ],
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),
    prizePool: 30000,
    prizes: {
      npdcOverride: { 3: 'dc', 2: 'none', 13: 'np' },
      niapinWinner: { 2: 'p03', 7: 'p08', 11: 'p01', 13: 'p11', 16: 'p05' },
      draconWinner: { 3: 'p02', 4: 'p06', 13: 'p10' } },
    points: { niapin: 3, dracon: 2 },            // 残りは migrate が既定補完
    announced: { teamGross: true, niadora: true },
    formats: { gross: true, net: true, niadoraInd: true, niadoraTeam: true, teamGross: true, teamNet: false,
      holeByHole: false, roulette: false, stableford: false, olympic: false, callaway: false,
      nassau: false, best2ball: false, vegas: false, match1v1: false, univMatch: false, customMatch: false },
  }) },
```

このケースが検出する内容（reviewer は `regress-expected.json` の差分でこれらを目視確認する）:

| 期待 | 理由 |
|---|---|
| `computePoints` で **p02 に +2**（4H・Par4 の DC） | 上書きによる追加が配点に効く |
| **p03 に 3H 分の +3 が付かない**（`niapinWinner[2]` は残っている） | 除外が効く・レコードは非破壊 |
| **p11 に +3**（14H が NP 扱い＝`points.niapin`）／ **p10 に 14H 分の +2 が付かない** | 種別の振替が効く・旧 DC レコードは無視 |
| `teamWinPoints` の `niadora` 本数が上記に連動して変わる | `niadoraTeamCount` が同じ導出関数を見ている |

### 13.4 その他

1. `node tools/verify.mjs` **全PASS**（i18n 3言語パリティ・未定義キー参照なし・**未使用キー0**・CSS 孤立 var なし・構文・計算回帰）。
2. **旧バックアップ JSON**（`npdcOverride` なし・`niapinHoles` に古い値あり）をインポート → 対象ホール・配点が**インポート前と同一**。エクスポート → インポートで往復し、`npdcOverride` が保存・復元される（`js/backup.js` は**無改修**）。
3. コースタブ: 既定パーの新規ゲームで「ニアピン: 3H・8H・12H・17H ／ ドラコン: 5H・14H」＝**現行と同じ表示**（＊なし・凡例行なし）。
4. 4H を「ドラコン」にすると、①コースタブの一覧が「ドラコン: 4H＊・5H・14H」＋凡例行、②結果タブ ニアドラの勝者登録に「4H」が現れ、③ヒーローに 4H の DC セルが出る（ホール番号昇順の位置）。
5. 12H を「対象外」にすると一覧・登録・ヒーローから消え、「自動」に戻すと**登録済み勝者ごと復活**する。
6. 「すべて自動に戻す」で `npdcOverride` が空になり、3 の状態に戻る。
7. パーを変更しても手動指定ホールは変わらない（§5.2 の表の全行）。
8. `<details>` を開いたまま select を操作してもパネルが閉じない（揮発フラグ）。
9. **375px（iPhone SE 相当）で横スクロールが出ない**・select のラベルが省略されない（ja/zh/en の3言語で確認）。
10. **localStorage キーが5つのまま**（DevTools で確認）。
11. `index.html` の `?v=` を PR 番号に一括更新（js/**・styles.css を触るため）。
12. 新旧の grep 確認: `grep -rn "niapinHoles\|draconHoles" js/` の結果が **state.js の残置3行（newGame/migrate/コメント）だけ**であること（本機能が廃止フィールドを読み書きしていない証明）。

---

## 14. サイズ判定・PR 分割・並走

### 14.1 PR 分割 → **1本**

| PR | 触るファイル | 内容 | 目安 |
|---|---|---|---|
| **単独 PR** | `js/state.js`・`js/course.js`・`js/i18n.js`・`styles.css`・`index.html`(`?v=`)・`tools/regress.mjs`＋`tools/regress-expected.json` | §4（データモデル・migrate）＋§5（導出）＋§9（UI）＋§10（i18n）＋§13.3（回帰ケース） | 約 70 行 |

分割案（PR1=データ/導出/回帰、PR2=UI/i18n）も成立するが、PR1 単体では**ユーザーから見た変化がゼロ**（override を作る手段が無い）で、Issue/PR/デプロイ確認の固定費が2倍になるだけ。**1本を推奨**（CLAUDE.md「関連する小変更は1 Issue＋1PR」）。

### 14.2 並走状況

| 相手 | 触るファイルの重なり | 判定 |
|---|---|---|
| **#152**（`computePoints` に `F.niadoraInd` ゲート） | `js/calc.js`（本件は非接触）だが、**`tools/regress-expected.json` を両方が書き換える**（#152 は既存ケースの値が動く／本件は新規ケースを足す）。`index.html` の `?v=` も競合 | **直列**。先にマージされた方に合わせ、後発は main にリベース → `node tools/regress.mjs --update` を**取り直して**差分をレビューに出す。本件の新規ケースは `formats.niadoraInd:true` を明示しているので、#152 が先でも後でも期待値は同じ |
| **#148**（ニアドラのセット別開封） | `js/results.js`・`js/results-team.js`（本件は非接触）。`index.html` の `?v=` のみ競合 | **並走可**。論点（NP/DC 排他）は §7 で保証済み＝どちらが先でも矛盾しない |
| **#150**（`js/results-m1.js` ほか） | なし | **並走可** |
| 結果の共有・画像化（`renderTeamOverall`） | なし | **並走可** |

※ `index.html` の `?v=` は全 PR が触る1行なので、コンフリクトは自分の PR 番号で上書きして解消する（既存の運用どおり）。

### 14.3 正本への追補（architect が docs コミットで実施済み）

- 正本 `2026-07-12-golf-compe-web.md` **§3.6** に1行追補（対象ホールは par 自動導出＋`prizes.npdcOverride` による手動上書き）。
- 同 **§4** の `prizes` に `npdcOverride` の行を追加。
- 詳細・前後比較・受け入れ条件は**本ファイルが正**。

---

## 15. 未決事項（ユーザー確認用・既定案つき。**確認が取れなければ既定案で実装してよい**）

| # | 論点 | 既定案 | 理由 / 変える場合の影響 |
|---|---|---|---|
| **A** | ニアピン側も手動対応にするか（要件はドラコンのみ） | **両方対応**（§6） | 1つの select で4択にすれば実装量は同じ。片方だけだと「Par3 を外せない」非対称が残り、説明も破綻する。ドラコン限定にするなら §4 の値 enum を `dc`/`none` に絞り、`none` の意味を DC 限定に狭める必要があり**むしろ複雑になる** |
| **B** | 同一ホールに NP と DC を**同居**させるか | **させない**（§7） | `js/results.js:5` のコメントと #148 の `pzExcept` キー設計が排他性に依存。同居させるなら #148 を再設計（キーに kind を追加）する必要がある。現場要件も未報告 |
| **C** | Par3 をドラコン / Par5 をニアピンにできてよいか | **できてよい**（禁止も警告もしない・§8.1） | 幹事が明示的に選んだ操作を否定しないのが本アプリの方針。禁止する場合は select の選択肢を par で出し分けることになり、「par を後から変えたら不正な組み合わせが残る」状態の後始末（自動解除＝破壊的）が必要になる |
| D | コースライブラリから別コースを読み込んだとき、手動上書きを消すか | **消さない（保持）**（§5.2） | 非破壊・可逆の一貫方針。＊マーク＋凡例で気づける。消す仕様にするなら `clibLoad` で `npdcOverride={}`（＝ユーザーが直前に設定した内容を黙って捨てる）になる |
| E | テストデータに手動上書きのパターンを追加するか | **追加しない**（§11） | 既存パターンの生成物を不変に保つのが最優先。手動ケースの検証は回帰ハーネス（§13.3）で行う |
