# 設計書：任意対決（customMatch）チーム種目（2026-08-31）

- 区分: **確定（実装可）**。ユーザー要件＋PM確認済みQ&A（§2）を反映。未確定の判断は §12「既定で進める事項」に明示（実装ゲートではない）。
- 種別: **M**（チーム種目1件の新設＝データモデル追記・`teamWinPoints` への event 追加・下段タブ追加・i18n 追加）。
- 本ファイルが詳細設計の正。正本 `2026-07-12-golf-compe-web.md` への **§11.21 追記案文は §5**（追記は実装/PM が行う。architect は正本を編集しない）。
- 関連正本: §11.14（投影原則）・§11.15（種目別勝ち点）・§11.18（発表後反映）・§11.19（重み）・§11.20（大学対抗＝直近の同型前例）。
  関連設計: `2026-08-20-team-points.md` / `2026-08-30-winpoints-reveal.md` / `2026-08-30-univ-match.md`（**本設計は univ-match の構造を踏襲**）。
- **モック**: 必要（§6.2 がモック用レイアウト材料。/feature 手順1.5）。新規の閲覧系タブを1枚追加するため。

---

## 1. 要件（ユーザー原文）

> チーム戦の一番最後に任意の対決を入れたい
> チームにポイントを入れて勝ち負けを決めるだけで良い

**設計の一言まとめ**: スコアから一切計算しない「幹事入力ポイント」だけで勝敗が決まるチーム種目を1つ追加する。最大ポイントのチームが勝ち、同点は山分け。既存の勝ち点機構（重み・連携・総合順位）にそのまま乗せる。

## 2. 確定Q&A（PM がユーザーに確認済み・2026-08-31）

| # | 質問 | 回答 | 状態 |
|---|------|------|------|
| Q1 | 種目数 | **1つだけ**。チーム戦下段タブの**最後**に「任意対決」タブを1つ。**種目名はユーザーが自由入力可**（既定＝i18n の既定文言）。複数追加のUIは作らない | 確定 |
| Q2 | 勝ち点連動 | **連動する**（他種目と同じ）。`teamWinPoints` の1種目として参加＝種目別勝ち点表に行が増え、重み `points.teamEventPts.customMatch` と「結果を連携する」（`announced.customMatch`）も他種目と同扱い。総合順位に効く | 確定 |
| Q3 | 勝敗 | ポイント**最大が勝ち**（大きいほど良い・`dir='desc'`）。同点は**引き分け＝勝ち点 w/n 山分け**（既存 tie 機構をそのまま使用） | 確定（要件から自明） |
| Q4 | 既定 | `formats.customMatch` **既定 OFF**＝現行と完全一致（regress 差分ゼロ） | 確定 |

## 3. 用語・キー命名（既存慣例に整合）

| 用途 | 値 | 根拠（前例） |
|------|-----|------|
| フォーマット／種目キー | **`customMatch`** | `match1v1` / `univMatch` と同型（種目キーは formats / announced / teamEventPts / TP_EV_ORDER で全域共通） |
| ゲーム内データ | **`g.custom = { name:'', pts:{} }`** | `g.vegas` / `g.univ` / `g.match1v1` と同型（種目名を短縮したオブジェクト1個） |
| チーム戦下段タブのキー | **`'custom'`** | `'univ'` / `'m1'`（タブキーは短縮形） |
| i18n の既定種目名 | **`term.custom`** | `term.univ` / `term.match1v1` |
| チャネル | **α**（`BETA_FMT` に追加しない） | 計算リスクがゼロ（スコア非依存）で運用も単純。α で出す |

- **新規 JS ファイルは作らない**。追加先は既存モジュールのみ（`state.js` / `calc.js` / `game.js` / `results.js` / `results-team.js` / `nav.js`(ALPHA一覧は home.js) / `i18n.js`）。`index.html` の読込順は変更なし。
- **新規 CSS も原則ゼロ**（既存 `.rl-standing/.rl-st/.tp-nd/.tp-ovh/.tp-ovh-wrap/.rl-st-h/.tp-nd-sub/.tp-nd-tagrow/.ptsrow/.ptsedit/.tag/.tagwin/.tagtie/details` を流用）。新規トークンなし＝`verify.mjs` の孤立 var() チェックに影響しない。

---

## 4. データモデルと計算仕様

### 4.1 データモデル（§4 追補）

```
game.formats.customMatch : boolean            // 既定 false（＝現行と完全一致）
game.custom : {
  name : string,                              // 種目名。既定 ''（空＝i18n の term.custom にフォールバック）
  pts  : { [teamId:string]: number }          // チームIDごとのポイント。キーが無い＝未入力＝集計対象外
}
points.teamEventPts.customMatch : number      // 既定 1（migrate の per-key バックフィルで自動補完）
announced.customMatch : boolean               // 連携フラグ（object のキー追加のみ・スキーマ変更なし）
```

**`pts` のキーは `team.id`（`uid()` 生成の不変ID）**。配列 index ではないので**チームの並べ替えでは壊れない**。

| 操作 | 挙動 | 方針 |
|------|------|------|
| チーム**削除**（`delTeam`） | `pts` に孤児エントリが残る | **掃除しない**（読む側が常に現存 `teams` から `t.id` で引くため無害。`uid()` はID再利用しないので誤爆もない。前例＝`prizes.niapinHoles` の廃止フィールド残置・`announced` も掃除していない）。JSON 増分は数十バイト |
| チーム**追加** | 新IDは `pts` に無い＝**未入力**扱い | 仕様どおり（ヒーローに「—／未入力」で出る＝幹事が入れ忘れに気づける） |
| チーム**並べ替え**／改名／色変更 | 影響なし（IDが不変） | — |
| `autoTeams(2/3)`（チーム再生成） | 全チームIDが新規＝**全ポイントが未入力に戻る** | 仕様として明記（メンバー構成を作り直したら入力し直し）。§6.4 の空表示で誘導 |

**未入力（空欄）と 0点 の区別**:
- 空欄 → `pts[teamId]` を **`delete`**（キーを作らない）→ 計算側 `vals` は **`null`** → `add()` の `live` から除外＝そのチームは対象外（種目別勝ち点表は `—`）。
- `0` → 正規の入力値。他チームが全員マイナスなら 0 で勝てる。
- **全チーム未入力／入力1チームのみ → `live.length < 2` で種目不成立**（既存 `add()` のガードがそのまま効く）＝「対決なし」。勝ち点も表の行も出ない。**新しい分岐を書かない**のが要点。

**数値の型**: `Number`。小数第1位に丸めて保存（`Math.round(n*10)/10`）＝浮動小数ノイズ除去。負値も許可（減点系の対決を許容）。非数（`NaN`/`Infinity`）は保存しない（入力を無視）。

### 4.2 migrate / newGame / dupGame / backup

```js
// state.js migrate() の games ループ内（univMatch の直後に追加）
if(g.formats && g.formats.customMatch===undefined) g.formats.customMatch=false;   // 任意対決（§11.21）
if(!g.custom) g.custom={name:'',pts:{}};
else { if(typeof g.custom.name!=='string') g.custom.name='';
       if(!g.custom.pts || typeof g.custom.pts!=='object') g.custom.pts={}; }
```

```js
// state.js newGame()
custom:{ name:'', pts:{} },                       // 任意対決（§11.21・幹事入力ポイントのみで勝敗）
formats:{ …, univMatch:false, customMatch:false }  // 既定 OFF
// state.js defaultPoints().teamEventPts に customMatch:1 を追加（既存ゲームは per-key バックフィルで自動補完）
```

- **`dupGame()`**: `JSON.parse(JSON.stringify(g))` の深いコピーなので `custom.name` も `custom.pts` も**そのまま複製される**（scores も複製される現行仕様と同じ扱い）。**特別扱いはしない**（複製後に幹事が上書き入力する運用）。
- **backup 書出/取込**: `exportData` は `state` 全体、`importData` は `migrate(s)` を通す。**コード変更なし**で復元される（古いバックアップは migrate が `custom` を補完）。
- **localStorage キーは増やさない**（すべて `golfCompe_v1` 内）。UIの折りたたみ開閉状態だけは揮発の JS 変数（§6.3）。

### 4.3 計算（`js/calc.js`・追加は純関数1つと `teamWinPoints` 1行）

```js
/* ---- 任意対決（customMatch・§11.21・docs/handoff/2026-08-31-custom-match.md §4）----
   幹事が入力したチーム別ポイントだけで勝敗を決める（スコアからは一切計算しない＝§3 の計算式に非接触）。
   未入力（キー無し・空文字・非数）は null＝対象外。0 は正規の入力値（未入力とは区別する）。 */
function customPts(g,T){ const c=g&&g.custom; if(!c||!c.pts) return null;
  const v=c.pts[T.id]; if(v==null||v==='') return null;
  const n=Number(v); return isFinite(n)? n : null; }
```

`teamWinPoints(g)` への追加は **niadora の直後・`return` の直前に1行**（＝ `events` 配列の末尾に append）:

```js
  // 任意対決（§11.21）：幹事入力ポイントの最大が勝ち（同点は山分け）。全未入力/入力1チームは add の live<2 で不成立
  if(F.customMatch) add('customMatch', teams.map(t=>customPts(g,t)),'desc');
  return {teams,wins,events};
```

**既存種目への非影響（実装者はここを確認してからコミット）**:
- `teams` / `wins` の**構築順・index 対応は不変**（`teams` は関数冒頭で確定済み。`add` は `wins[i]` に加算するだけ）。
- `events` は**末尾に1要素 append されるだけ**で、既存要素の `key/winners/vals/on/w` は一切変わらない。
- `evOn`（`announced`）・`wOf`（`teamEventPts`）・`tpShare` の実装には触れない（新キーが増えるだけ）。
- `computePoints` の gate `events.some(e=>e.on && e.w>0)` は変更なし。**任意対決だけを連携した場合もチーム配分が始まる**（Q2「他種目と同じ」の帰結・意図どおり）。
- `F.customMatch` 既定 false → 既存ゲーム・既存フィクスチャでは `add` すら呼ばれない＝**regress 差分ゼロ**。

**開封演出（revealHoles）との関係**: 任意対決の値はスコア非依存なので `viewGame` のマスクの影響を受けない（`Object.assign` の浅いコピーで `g.custom` は素通し）。ただし `teamWinPoints` 冒頭の対象チーム判定は「メンバーが1H以上入力済み」なので、**スコアが1打も入っていない段階では種目自体が成立しない**（`teams.length<2` の早期 return）。これは全チーム種目共通の前提であり変更しない（§10）。表示側は §6.1 のとおり **`g0`（生ゲーム）** を渡してこの副作用を回避する。

### 4.4 数値例（前後比較・すべて `teamRankPts=[10,5]`／3チーム T1レッド・T2ブルー・T3グリーン／全員スコア入力済み）

**共通の前提**: 採用中の他種目は `teamGross`（連携済み・1位=T2）のみ。

**(a) 現行＝customMatch OFF（before）**

| | teamGross(w=1) | 勝ち点合計 | 総合 | 配分/人 |
|---|---|---|---|---|
| T1 | — | 0 | 2位 | +5 |
| T2 | **1** | 1 | 1位 | +10 |
| T3 | — | 0 | 2位 | +5 |

**(b) customMatch ON・`pts={T1:10,T2:0,T3:5}`・連携済み・w=1（after）**

| | teamGross(w=1) | 任意対決(w=1) | 勝ち点合計 | 総合 | 配分/人 |
|---|---|---|---|---|---|
| T1 | — | **1** (10pt) | 1 | **1位** | **+10** |
| T2 | **1** | — (0pt) | 1 | **1位** | **+10** |
| T3 | — | — (5pt) | 0 | 3位 | +0（`teamRankPts[2]` 未定義＝0） |

→ 総合順位が変わる（T1 が 2位→1位）。**「同点は同順位・満額」は既存仕様のまま**（1,1,3 方式）。

**(c) 同点（引き分け）: `pts={T1:5,T2:3,T3:5}`・w=1**

- `vals=[5,3,5]` → `best=5` → `winners=[0,2]` → 各チーム **`w/n = 1/2 = 0.5`**（表示は `tpShare(1,2)='0.5'`）。
- 勝ち点合計 T1=0.5 / T2=1 / T3=0.5 → 総合 T2 1位、T1・T3 同2位。
- 表示: T1・T3 のセルは **橙（`rtie`）＋ `0.5`**、ヒーローのタグは `引分 / 勝ち点 +0.5`。

**(d) 重み変更: (c) と同じ入力で `teamEventPts.customMatch=3`**

- `winners=[0,2]` は不変。各 **`3/2 = 1.5`**（`tpShare(3,2)='1.5'`）。勝ち点合計 T1=1.5 / T2=1 / T3=1.5 → **T1・T3 が同1位**、T2 3位。
- 種目ラベルに `×3` の muted 併記（既存 `ev.w!==1` の分岐がそのまま効く）。

**(e) 一部未入力: `pts={T1:10,T2:0}`（T3 は空欄）・w=1**

- `vals=[10,0,null]` → `live=[0,1]`（2以上なので成立）→ `winners=[0]` → T1 に +1。
- T3 のセルは `—`（対象外）。ヒーローの T3 は `—` ＋ サブ行「未入力」。

**(f) 全未入力（または入力1チームのみ）**

- `live.length<2` → `add` が return → **`events` に行が増えない**＝ (a) と**完全一致**（勝ち点・配分・総合すべて不変）。
- タブは出るが中身は空表示（§6.4）。

**(g) 全チーム 0点（明示入力）**

- `vals=[0,0,0]` → 全員 winners → 各 `w/3`。全チーム同値加算のため**相対順位は変わらない**（他種目があればそちらで決まる）。他種目が無い場合は全チーム同点1位＝全員 `teamRankPts[0]` になる（既存の全同点ケースと同じ挙動・仕様として許容）。

---

## 5. 正本 `2026-07-12-golf-compe-web.md` への追記案文（§11.21・そのまま転記）

> ### §11.21 任意対決（customMatch）【確定・2026-08-31・§3/§4 追補】
> **詳細設計の正**: `docs/handoff/2026-08-31-custom-match.md`。
> **§3 追補（新規純関数1つのみ・既存計算は不変）**: 幹事がチームごとに入力したポイント（`g.custom.pts[teamId]`）だけで勝敗を決めるチーム種目。スコア・ハンデからは一切計算しない。`customPts(g,T)` は未入力（キー無し／空文字／非数）を `null`（対象外）として返し、`0` は正規の値として扱う。`teamWinPoints` に `add('customMatch', teams.map(customPts), 'desc')` を**末尾に1件追加**（最大が勝ち・同点は既存どおり `w/n` 山分け・入力が1チーム以下なら `live<2` で種目不成立）。既存種目の判定値・`events` の既存要素・`wins` の index 対応は不変。
> **§4 追補（後方互換・migrate 補完）**: `formats.customMatch`: bool（既定 false・α＝`BETA_FMT` には入れない）／`game.custom`: `{ name:'', pts:{} }`（`name`=種目名の自由入力・空なら i18n `term.custom` にフォールバック／`pts`= **teamId → number** のマップ。チーム削除時の孤児キーは掃除せず非参照で放置。チーム並べ替えはIDキーのため無影響）／`points.teamEventPts.customMatch`: 1（per-key バックフィルで自動補完）／`announced.customMatch`（object キー追加のみ）。localStorage キー・既存フィールドは不変。入力UIは結果発表＞チーム戦＞任意対決タブ内の折りたたみ（§11.14「幹事の操作UIは控えめ配置」）。

---

## 6. 表示・UI設計（投影原則 §11.14 準拠）

### 6.1 タブ位置とディスパッチ

チーム戦下段タブ（`resGameTabs` の `grp==='team'`）の**最後**に追加:

```
総合 → ニアドラ → グロス → ネット → 大学対抗 → HBH → ベスト2(β) → ベガス(β) → 1on1 → ルーレット → 【任意対決('custom')】
```

```js
// js/results.js resGameTabs（roulette の push の直後＝配列末尾）
if(F.customMatch) T.push(['custom', tpEvLabel(g,'customMatch')]);   // 任意対決（§11.21・種目名はユーザー入力を反映）
```

```js
// js/results-team.js renderTeamGame（'vegas' の分岐の後・return '' の前）
if(key==='custom') return renderTeamCustom(g0) + ruleBox('rule.custom');
```

- **`g0`（生ゲーム）を渡す**。理由は総合タブ `renderTeamOverall(g0)`（#98 バグ修正）と同じ: 本タブには開封バーが無く、`revealHoles=0` のリロード直後に `viewGame` マスク後の `g` を渡すと `teamWinPoints` の対象チームが全滅し、勝敗タグが復旧不能に消える。任意対決の値はそもそもスコア非依存なので**マスクを通す意味がない**。ネタバレ保護は `announced.customMatch` ゲート（順位バッジ・勝ち点タグは連携後のみ表示）で担保する。
- `TP_EV_ORDER`（種目別勝ち点表の行順＝タブ順に同期）を更新:
  `['niadora','teamGross','teamNet','univMatch','holeByHole','best2ball','vegas','match1v1','roulette','customMatch']`
- `TP_EV_LABEL` に `customMatch:'term.custom'` を追加（空名フォールバック用）。
- **種目ラベルは動的**（ユーザー入力名）なので、`results-team.js` にヘルパーを1つ足し、既存の `t(TP_EV_LABEL[…])` 呼び出し2箇所（種目別勝ち点表の行ラベル・重み設定 details の行ラベル）を差し替える:

```js
/* 種目ラベル（任意対決だけユーザー入力名を優先・§11.21）。名前が空なら i18n 既定（term.custom）にフォールバック。
   ユーザー入力は esc() 必須（辞書文字列と違い HTML が混ざり得る） */
function tpEvLabel(g,key){ const nm=(key==='customMatch')?(((g&&g.custom&&g.custom.name)||'').trim()):'';
  return nm? esc(nm) : t(TP_EV_LABEL[key]||key); }
```

- 言語切替時の挙動: `name` が空なら3言語それぞれの既定文言（任意対決／自由对决／Custom Match）に追従。**幹事が名前を入力した後は言語を切り替えても入力名のまま**（多言語名は持たない）。これを `custom.namePh`／ルール解説で暗黙に示す（多言語名を持たせるのは過剰・§12-3）。

### 6.2 任意対決タブのレイアウト（★モック材料・/feature 手順1.5）

`renderTeamCustom(g)`。既存クラスのみで構成（新規CSSなし）。**大型ヒーローが主役・幹事の入力UIは最下部の `<details>`**。

```
┌ .card ─────────────────────────────────────────────────────┐
│ h2  {種目名}                          [結果を連携する (btn gold sm)] │  ← h2 は flex/wrap。tpAnnounceUI(g,'customMatch') は margin-left:auto で右寄せ
│ ┌ .rl-standing.tp-ovh-wrap（横並び・左右均等・狭幅は折返し）──────┐ │
│ │  .rl-st.tp-nd.tp-ovh （チームごと・縦積み中央寄せ・flex:1 1 100px）│ │
│ │    ① チーム名   … tmColor(t.name) ・ --f-rl-name (30/40/44/48px)  │ │
│ │    ② ポイント   … .rl-st-h ・ --f-rl-score (44/64/68/76px) 太字＝主役 │ │
│ │                   未入力は「—」を var(--sub) 色で                  │ │
│ │    ③ サブ行13px … 未入力のみ「未入力」(custom.unset)。入力済は空    │ │
│ │    ④ タグ行     … 連携済みのときだけ:                              │ │
│ │                   [順位バッジ posBadge(rank, rank===1)]            │ │
│ │                   [tag tagwin「勝ち」] or [tag tagtie「引分」]       │ │
│ │                   [tag「勝ち点 +1」/「+0.5」= tpShare(w,n)]         │ │
│ └────────────────────────────────────────────────┘ │
│ .muted mt6 : 成立していないときだけ custom.needTeams（2チーム以上で…）│
│ ┌ <details class="prize-edit mt10">（幹事操作・既定=閉）──────────┐ │
│ │ summary: ポイント入力 (custom.ptsTitle)                          │ │
│ │  label.fl 種目名 (custom.name)                                   │ │
│ │  input[text maxlength=20] value={name} placeholder={custom.namePh}│ │
│ │  .muted custom.ptsNote（空欄＝未入力＝対象外／最多が勝ち・同点山分け）│ │
│ │  .ptsrow  ● チーム名(チームカラー)      [ input number 78px ]      │ │  ← メンバーのいるチームぶん繰り返し
│ │  .ptsrow  ● チーム名                    [ input number 78px ]      │ │
│ └────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
┌ <details> ルール解説（ruleBox('rule.custom')・既存パターン）───────┐
```

**表示ルール（実装者向けの確定事項）**:
1. ヒーローの対象 = `g.teams.filter(t=>t.memberIds.length)`（**スコア未入力チームも出す**＝幹事が入力漏れに気づける）。
2. 並び = ポイント降順。**未入力チームは末尾**（入力済みの後）。同値は `g.teams` の登録順（安定ソート）。
3. 順位（`posBadge`）= 入力済みチームのみで算出。**同値は同順位**（1,1,3）。未入力チームにはバッジを出さない。
4. **勝敗タグの正は `teamWinPoints(g).events` の `customMatch`**（表示側で勝者を再計算しない＝univ/ニアドラと同じ規律）。`ev` が無い（不成立）ときはタグ・バッジを一切出さない。
5. タグは `ev.on`（連携済み）のときだけ表示（未連携はネタバレ防止＝総合タブの `？` マスクと整合）。
6. **色だけに頼らない**: 勝ち＝緑タグ＋「勝ち」の文字、引分＝橙タグ＋「引分」の文字、勝ち点は数値併記（`勝ち点 +0.5`）。
7. 数値表示 = `Math.round(v*10)/10` の文字列（`5` / `2.5` / `-3`）。`.rl-st-h` は `tabular-nums`。

**セッター（グローバル関数・inline `onchange` 前提／ESM化しない）**:

```js
function setCustomName(v){ const g=curGame(); if(!g)return;
  (g.custom=g.custom||{name:'',pts:{}}).name=String(v||'').slice(0,20); save(); renderResult(); }
function setCustomPts(tid,v){ const g=curGame(); if(!g)return;
  const c=(g.custom=g.custom||{name:'',pts:{}}); c.pts=c.pts||{};
  const s=String(v==null?'':v).trim();
  if(s===''){ delete c.pts[tid]; }                       // 空欄＝未入力に戻す（0 とは区別する）
  else { const n=Number(s); if(!isFinite(n))return; c.pts[tid]=Math.round(n*10)/10; }
  save(); renderResult(); }
```
- 入力欄は `<input type="number" step="any" value="…" onchange="setCustomPts('<id>',this.value)">`（`.ptsedit` 内＝幅78px・既存の配点欄と同じ見た目）。`onchange` は blur 時なので再描画による入力中断はない（既存 `setTeamEventPts` と同じUX）。
- 種目名は `<input maxlength="20" value="${esc(name)}" onchange="setCustomName(this.value)">`（タブ幅の破綻防止に20文字制限。タブ列は既存の横スクロールで吸収）。

### 6.3 折りたたみの開閉状態（揮発・localStorage 非保存）

```js
let cmCfgOpen=false;                       // 任意対決の入力パネル開閉（pzCfgOpen / tpEvPtsOpen と同方式）
function cmCfgToggle(open){ cmCfgOpen=open; }
```
`<details class="prize-edit mt10"${cmCfgOpen?' open':''} ontoggle="cmCfgToggle(this.open)">`。既定=閉（結果が主役）。ポイント入力のたびに `renderResult()` が走っても開いたままになる。**localStorage には保存しない**（§11.14）。

### 6.4 空表示（`.empty`）

| 状態 | 表示 |
|------|------|
| チームが1つも無い | `renderTeamGame` 冒頭の既存分岐（`team.emptyTeams`）でカード表示＝**変更不要** |
| チームはあるが**全チーム未入力** | カードは出す（h2＋連携ボタン）。ヒーローの代わりに `<div class="empty">custom.emptyPts</div>`（「まだポイントが入力されていません。下の『ポイント入力』から各チームのポイントを入力してください」）。**入力 details は必ず出す**（入力導線を殺さない） |
| 入力が1チームだけ | ヒーローは表示。その下に `.muted` で `custom.needTeams`（「2チーム以上のポイントを入力すると勝敗（勝ち点）が決まります」） |
| 種目が不成立（上記2ケース） | 連携ボタンは**常時活性**のまま（既存仕様＝不成立種目の連携フラグは休眠。`teamWinPoints` 側で 成立∧on の AND） |

### 6.5 ゲーム設定タブ（`js/game.js`）

- 「集計する競技」チーム戦グループの最後に **1行だけ**追加（タブ順と一致）:
  `${fchk('customMatch',t('fmt.customMatch'))}` （`fchk('roulette',…)` の直後）
- **専用の設定カードは作らない**。種目名・ポイントの入力は §6.2 の details に集約する（根拠＝`team.evPtsTitle`〔重み設定〕をゲーム設定に置かず総合タブに置いた前例と同じ「重複配置の回避」＋投影運用中に画面を離れずに入力できること）。
- `js/home.js` の `ALPHA_GAMES` に `'fmt.customMatch'` を追加（`'fmt.match1v1'` の後）。`BETA_FMT`（nav.js）には**追加しない**（α）。

---

## 7. i18n（ja/zh/en 同時追加・キー集合完全一致・未使用キーゼロ）

追加は **12キー ×3言語 = 36 エントリ**。全キーの参照箇所を併記（`verify.mjs` の未使用キー検出をパスすること）。

| キー | ja | zh | en | 参照箇所 |
|---|---|---|---|---|
| `fmt.customMatch` | 任意対決 | 自由对决 | Custom Match | game.js `fchk` / home.js ALPHA_GAMES |
| `term.custom` | 任意対決 | 自由对决 | Custom Match | TP_EV_LABEL 経由（`tpEvLabel` のフォールバック） |
| `custom.name` | 種目名 | 项目名称 | Event name | 入力 details の `label.fl` |
| `custom.namePh` | 例）ビンゴ大会（空欄なら「任意対決」） | 例：宾果大赛（留空则显示「自由对决」） | e.g. Bingo (blank = "Custom Match") | 名前入力の placeholder |
| `custom.ptsTitle` | ポイント入力 | 输入积分 | Enter points | details の summary |
| `custom.ptsNote` | 各チームのポイントを入力（空欄＝未入力＝集計対象外）。最も多いチームが勝ち・同点は山分け | 输入各队积分（留空＝未输入＝不计入）。最多者胜・平局平分 | Enter each team's points (blank = not counted). Highest wins; ties split | details 内 `.muted` |
| `custom.emptyPts` | まだポイントが入力されていません。下の「ポイント入力」から各チームのポイントを入力してください | 尚未输入积分。请从下方「输入积分」为各队输入积分 | No points entered yet — use "Enter points" below | 全未入力時の `.empty` |
| `custom.needTeams` | 2チーム以上のポイントを入力すると勝敗（勝ち点）が決まります | 输入2支以上队伍的积分后才会产生胜负（胜点） | Win points are decided once two or more teams have points | 不成立時の `.muted` |
| `custom.win` | 勝ち | 获胜 | Win | ヒーローの勝ちタグ（`tagwin`） |
| `custom.tie` | 引分 | 平局 | Tie | ヒーローの引分タグ（`tagtie`） |
| `custom.unset` | 未入力 | 未输入 | Not entered | ヒーローのサブ行 |
| `rule.custom` | `<b>任意対決</b>：幹事が自由に決めた対決の結果をチームごとのポイントで入力し、最も多いチームが勝ちとなる種目です。同点は勝ち点を山分けします。ポイント未入力のチームは集計対象外、入力が1チーム以下のときは種目不成立（勝ち点なし）です。ゴルフのスコアとは無関係に集計します。` | `<b>自由对决</b>：由干事自定对决内容，按队输入积分，积分最多的队伍获胜。平局时平分胜点。未输入积分的队伍不计入；输入不足2队时该项目不成立（无胜点）。与高尔夫成绩无关。` | `<b>Custom Match</b>: the host enters a point total per team for any contest they like; the highest total wins. Ties split the win points. Teams with no entry are excluded, and the event does not count if fewer than two teams have points. Independent of golf scores.` | `ruleBox('rule.custom')` |

- 既存キーの流用（追加しない）: `team.winpt`（勝ち点）・`team.announce/announced/unannounce`・`team.emptyTeams`・`col.team`・`term.*`。
- **`fmt.customMatch` と `term.custom` は同じ文言だが両方定義する**（既存の `fmt.univMatch`／`term.univ` と同じ二重定義の慣例。用途が「設定の競技名」と「種目ラベル既定値」で異なる）。

---

## 8. 実装差分（ファイル別・見積り）

| ファイル | 追加/変更 | 行数目安 |
|---|---|---|
| `js/state.js` | migrate 4行・newGame 2行・defaultPoints 1キー | +7 |
| `js/calc.js` | `customPts()` ＋ `teamWinPoints` に1行（＋コメント） | +7 |
| `js/results.js` | `resGameTabs` に1行 | +1 |
| `js/results-team.js` | `TP_EV_ORDER`/`TP_EV_LABEL` 更新・`tpEvLabel()` 新設＋呼び出し2箇所差替・`renderTeamCustom()`・`setCustomName/setCustomPts/cmCfgToggle` | +60〜75 |
| `js/game.js` | fmtgrid に1項目 | +1 |
| `js/home.js` | ALPHA_GAMES に1要素 | +1 |
| `js/i18n.js` | 12キー ×3言語 | +36エントリ |
| `styles.css` | **変更なし**（既存クラス流用） | 0 |
| `index.html` | `?v=` を PR 番号に一括更新のみ | 1行×17 |
| `tools/regress.mjs` | 新規フィクスチャ2件（§9-6） | +25 |

## 9. 受け入れ条件

1. **既定 OFF で現行と完全一致**: 新規ゲーム・既存ゲームとも `formats.customMatch=false`。`node tools/verify.mjs` 全PASS。
2. **`node tools/regress.mjs`（フィクスチャ追加前）が差分ゼロ**。実装者は「calc 変更後・フィクスチャ追加前」に1回走らせて差分ゼロを確認し、PR 本文にその旨を書く。
3. `node tools/regress.mjs --update` 後の `tools/regress-expected.json` の差分が **既存5ケース（indBasic/team3/team2Vegas/univOff/univOn）についてバイト単位で不変**（＝新ケースの追加のみ）。reviewer は `git diff` でこれを確認する。
4. **i18n パリティ**: ja/zh/en のキー集合完全一致・空値なし・en にひらがな残存なし・**未使用キーゼロ**（`verify.mjs` の 3b がFAILしないこと）。
5. **localStorage キー集合が増えていない**（`golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop` のみ）。折りたたみ開閉は揮発変数。
6. **regress 新フィクスチャ**（`teamWinPoints` の値で仕様を固定する）:
   - `customTie`: 3チーム（T1/T2/T3）・`custom.pts={T1:5,T2:5}`（T3 未入力）・`teamEventPts.customMatch=2`・`announced.customMatch=true`・`formats.customMatch=true`（他チーム種目 OFF）
     → `events` に `{key:'customMatch',winners:[0,1],vals:[5,5,null],on:true,w:2}`、`wins=[1,1,0]`（`w/n=2/2=1`）。
   - `customNone`: 同構成で `custom={name:'',pts:{}}`
     → `events` に `customMatch` の要素が**存在しない**（不成立）・`wins=[0,0,0]`・`computePoints` はチーム配分ゼロ。
7. **UI 受け入れ**（手動・投影確認）:
   - チーム戦下段タブの**最後**に種目名タブが出る（`formats.customMatch` ON 時のみ）。名前未入力なら言語ごとの既定名、入力済みなら入力名がタブ・カード見出し・種目別勝ち点表の行ラベル・重み設定の行ラベルの**4箇所すべて**に反映される。
   - ヒーローはチーム名（チームカラー・`--f-rl-name`）＋ポイント（`--f-rl-score`）。1024px 以上でトークンが自動拡大する（新規 @media を足さない）。
   - 「結果を連携する」→ 種目別勝ち点表に行が増え、勝ちセルが緑（同点は橙・値は `tpShare`）。取り消しで元に戻る（可逆）。
   - 勝ち＝緑タグ＋「勝ち」、引分＝橙タグ＋「引分」の**文字が併記**されている（色のみに依存しない）。
   - ポイント欄を空にすると「未入力」に戻り、`0` は 0 として扱われる（両者が区別される）。
   - チームを削除しても他チームのポイント表示・勝敗が壊れない。チームを追加すると新チームは「未入力」で出る。
   - リロード直後（`revealHoles=0`）でも任意対決タブの勝敗タグが正しく出る（`g0` 渡しの確認）。
8. **`index.html` の `?v=` を PR 番号に一括更新**（`styles.css` 未変更でも js を変えるため全17箇所を揃える）。
9. 設計書（本ファイル）と正本 §11.21（§5 の案文）が実装と一致していること。

## 10. 触らない範囲（load-bearing）

- **§3 の既存計算式**（`periaHdcp`/`netScore`/`effGross`/`adjHole`/`adjArr`/`stablefordPts`/`olympicPts`/`callawayHdcp`/`net9`/`nassauTotalNet`/`best2`/`holesWon`/`vegas*`/`m1*`/`uv*`/`niadoraTeamCount`/`nextKanji`）— 一切変更しない。
- **`teamWinPoints` の既存部分**（`teams` の抽出条件・`add()` の本体・`evOn`/`wOf`/`byId`・既存9種目の呼び出し順と条件）。追加は末尾の1行のみ。
- `computePoints` / `computePayout` の本体（gate 条件式を含む）。
- `tpShare` / `tpFmtWin` / `tpAnnounce` / `tpAnnounceUI` / `renderTeamOverall` の**表構造**（行ラベルの取得だけ `tpEvLabel` 経由に差し替える。それ以外の HTML は不変）。
- `renderScorecard` / `renderTeams` / `renderTeamUniv` / `renderTeamNiadora` / `renderMatch1v1Parts` / `renderRouletteParts`。
- localStorage キー集合・`viewGame`/`viewGameN`/`revealHoles` の意味論・`BETA_FMT`。
- `styles.css` のトークンと既存クラス（新規クラスを足さない前提。どうしても必要なら Issue にコメントして設計を先に更新）。
- `docs/handoff/2026-08-31-testdata-patterns.md`（別 architect が並走中・**触らない**）。

## 11. 推奨PR分割

1つの機能で依存が直列のため **2PR（または小さいので1PR）** を推奨。

- **PR-A（データ＋計算＋回帰）**: `js/state.js`・`js/calc.js`・`tools/regress.mjs`＋`tools/regress-expected.json`。
  - 受け入れ: §9-1〜6。UI からは到達不能（`formats.customMatch` は false のまま・トグルUIも未実装）＝**マージしても挙動ゼロ変化**。
- **PR-B（UI＋i18n）**: `js/results.js`・`js/results-team.js`・`js/game.js`・`js/home.js`・`js/i18n.js`・`index.html`(`?v=`)。
  - 受け入れ: §9-4, 7, 8。**モック承認後に着手**（§6.2 がモック材料）。
- 1PR にまとめる場合も、コミットは A/B に分けて reviewer が計算差分だけを追えるようにする。
- 並走可否: 本タスクは `js/state.js`・`js/calc.js`・`js/results*.js`・`js/i18n.js` を触るため、同じファイル群を触る他タスク（テストデータ生成＝`js/testdata.js` 中心なら衝突は `js/state.js` 程度）とは**直列**を推奨。`docs/handoff/**` は機能別ファイルなので衝突しない。

## 12. 既定で進める事項（実装ゲートではない・異議があれば Issue にコメント）

1. **α チャネルで提供**（`BETA_FMT` に入れない）。スコア計算に触れず事故りにくいため。
2. **種目は1つのみ**（Q1 確定）。将来複数化するなら `g.custom` を配列化する移行が要るので、**今回は配列化しない**（YAGNI。migrate 1本で配列化できる形＝`{name,pts}` は維持）。
3. **種目名は多言語を持たない**（1つの文字列）。言語切替で入力名は変わらない。空欄なら言語ごとの既定名。
4. **ポイントは小数第1位まで・負値可**。整数限定にはしない（減点・タイム計測などの汎用性）。
5. **孤児 `pts` キーは掃除しない**（§4.1）。`delTeam` には触れない。
6. **ゲーム設定タブに専用カードを作らない**（入力は結果発表タブの details に集約）。
7. **ポイントに単位表記を付けない**（「pt」等を出さない）。任意の指標（点・秒・本）を入れられるようにするため。

## 13. PM 確認事項（設計は上記の既定で確定済み・変更希望があれば起票前に）

1. **タブの既定名**「任意対決 / 自由对决 / Custom Match」で良いか（§7）。
2. **入力UIの置き場所** = 任意対決タブ内の折りたたみ（ゲーム設定タブには置かない）で良いか（§6.5 の根拠つき）。
3. **勝ち点の連動範囲**: 任意対決「だけ」を連携した場合でもチーム総合の配分（`teamRankPts`）が始まる（他種目と同じ扱い＝Q2 の帰結）。これで良いか（§4.3）。
4. **スコアが1打も入っていない段階では種目が成立しない**（`teamWinPoints` 共通の前提）。表彰式より前に任意対決だけを先に発表したい運用があるなら別途要相談（今回は共通前提のまま・§4.3）。
5. 実装前に**モック1枚（§6.2 のレイアウト）をユーザーへ提示**する運用で良いか。
