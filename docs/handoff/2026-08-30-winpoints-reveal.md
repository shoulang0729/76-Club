# 設計書: チーム勝ち点の「発表後反映」＋総合タブ整理＋ルーレット対抗トグル

- **日付**: 2026-08-30（バッチ91-C 設計）／同日ユーザー回答（Q3/Q4）反映で最終化
- **区分**: 【**確定**】要件A〜D＋確認事項 Q1〜Q5 すべてユーザー回答済み（§10 が回答記録。**Q3 は既定案と逆＝旧データ救済なし**で確定）。
- **★load-bearing**: `teamWinPoints`/`computePoints` のチームブロック（§3系・正本 §11.15＝`2026-08-20-team-points.md` の上書き追補）・`formats` キー集合・データモデル §4 追補（`g.announced` 新設・`formats.roulette` 追加）。**要前後比較**（§3.4）。
- **正本との関係**: 正本 `2026-07-12-golf-compe-web.md` §4 への追記が必要（本ファイル §4.3 に「正本追記案」を用意。**本タスクでは正本ファイルは編集しない**＝PM が反映）。計算の詳細は `2026-08-20-team-points.md` §3 を本ファイル §3 が部分上書きする。
- **前提コード**: js/calc.js `teamWinPoints`(156-192)・`computePoints`(219-228)／js/results.js `resGameTabs`(24-47)・`renderTeamGame`(275-288)・`renderTeamOverall`(306-337)・`renderTeamNiadora`(345-369)・`renderMatch1v1Parts`／js/roulette.js `renderTeams`(227-258)・`rlStandings`／js/state.js `migrate`・`newGame`／js/nav.js `tgMode/tgExcept`(17-18)／js/game.js 集計する競技カード(41-48)・ルーレット設定カード(50-55)。

---

## 1. ユーザー要件（2026-08-30 確定・原文要約）

- **A. チーム戦＞総合タブの整理**: 表示は「チーム総合順位カード（ヒーロー）＋種目別勝ち点表」の2つのみ。チーム別スコア表は総合タブから削除。目隠し（`tgMode`/`tgExcept` の `'overall'` キー系マスク）は廃止。
- **B. 勝敗が確定していない種目には勝ち点を入れない**: 途中経過の同点山分け 0.5 等を入れない。未確定種目は勝ち点0（表では伏せ表示）。
- **C. グロス対抗/ネット対抗/HBH の勝ち点は「各種目の順位発表後」に反映**: スコアが揃っただけでは算入しない。順位発表（開封）が済んでから算入。
- **D. 「集計する競技」にルーレット対抗の ON/OFF チェックボックスを追加**: OFF 時はチーム戦ルーレットタブ・ルーレット設定カード・種目別勝ち点の「ルーレット対抗」行も非表示。

## 2. 決定事項（要約）

| # | 論点 | 決定（既定） | 根拠 |
|---|------|------|------|
| D1 | 発表済みの永続化（論点1） | **(c) 明示「発表」ボタン＋データ保存**。`g.announced[key]=true` を `golfCompe_v1` に保存 | (b)揮発はリロードで勝ち点・配分が消え記録性ゼロ＝B/C の趣旨に反する。(a)既存開封状態からの自動推定は不可: `revealHoles` は既定18（全開）＝起動即「発表済み」になる・`pzMode`/`m1Opened`/`tgMode` は揮発かつ複数画面共有で判定が不安定。**「開封・めくりの演出進行」は従来どおり揮発（§11.14 原則維持）。「順位発表を行った」という運営上の事実は演出でなく幹事の記録**＝データに保存、と整理して原則と両立させる |
| D2 | 種目ごとの確定条件（論点2） | §3.2 の表のとおり。**ルーレットのみ自動**（`g.roulette.cur>=18`＝進行自体が既にデータ保存済み）、**他7種目は発表ボタン** | 開封の概念がある種目（ニアドラ/1on1）も開封状態は揮発なので確定条件に使えない（D1と同理由）。統一ルール＝発表ボタン、例外はデータで完結するルーレットのみ |
| D3 | `teamWinPoints` の変更方式（論点3） | **calc 側で一元化**: 各種目に確定フラグ `on` を付与し、`wins` への加算は `on` の種目のみ。`events` は未確定種目も含めて返す（表示の「未確定」行用）。表示側フィルタはしない（総合カード・種目別勝ち点表・computePoints の正は引き続き `teamWinPoints` 1関数） | team-points §5 の「表示と計算で同じ1関数を正とする」設計の維持。表示側フィルタだと配分（computePoints）と表がズレる事故の温床 |
| D4 | 配分（`teamRankPts`→個人pt）の暫定反映（論点3波及） | **発表済み種目が1つ以上あれば、その時点の勝ち点合計で暫定配分**（発表が進むたび更新）。発表0種目なら配分なし（現行の「成立種目0なら配分しない」と同型） | 表彰式で発表のたびに配分タブが積み上がる＝演出として自然。全0勝ち点で「全チーム同点1位＝全員に teamRankPts[0]」となる事故は「発表≥1」ゲートで防ぐ。★Q4 ユーザー回答で確定（2026-08-30） |
| D5 | 総合カードの暫定表示（論点4） | ヘッダの `statusBadge(g)` を**発表進捗タグ「発表 n/N」**（橙）に置換。全採用種目発表済み（n=N≥1）で「確定」（緑・`status.fixed` 流用）。順位バッジ・配分タグは n≥1 のときのみ表示 | 18H入力済みか（statusBadge）より「何種目発表済みか」が総合順位の確度そのもの |
| D6 | 未確定種目の表示 | 種目別勝ち点表に**行は出す**が、ラベルに「未確定」タグ＋値セルは全チーム `？` マスク（勝者のネタバレ防止）。廃止する目隠し（A）の代替は**この発表状態連動マスク** | 要件B「表では—等」＋手動目隠しの役割を発表フラグが吸収（操作が1系統減る） |
| D7 | `formats.roulette` | **新規キー・既定 `true`**・α扱い（`BETA_FMT` に入れない）・migrate は既存 vegas/match1v1 と同じ per-key 補完 | 現状「常時有効」だったため既定 ON が後方互換（既存ゲームの挙動不変） |
| D8 | 発表の取り消し | **可逆**（「発表を取り消す」ボタン・confirm なし）。発表後のスコア修正は**常に最新値で勝者を再計算**（フラグは記録・値は計算が正） | 誤操作復旧。値をスナップショットすると §3 の「計算が正」原則が崩れる |
| D9 | 不成立種目の発表フラグ | 発表済みでも種目が不成立（対象2チーム未満・値なし）なら勝ち点に**算入されない（フラグは休眠）**。成立すれば自動で効き出す | ボタン活性制御を作り込まず、算入条件を `成立 かつ on` の AND に一本化 |
| D10 | 旧データ救済（★Q3・ユーザー回答で既定案から変更） | **migrate 補完は行わない**。既存ゲーム（全員18H入力済みの終了済みコンペ含む）も `announced={}`＝**全種目未発表スタート＝チーム勝ち点0**。過去コンペを表示したいときは幹事が各種目の発表ボタンを押し直す運用 | ユーザー回答（2026-08-30）。**既存ゲームは改修後にチーム由来の勝ち点・配分ポイントが0に戻る挙動変化があり、ユーザー了承済み**。ヒューリスティック補完（18H判定）は「更新中のコンペ」との誤判別リスクもあり不採用 |

---

## 3. 計算仕様（★load-bearing・`2026-08-20-team-points.md` §3 の部分上書き）

### 3.1 変わらないもの

- 各種目の**勝敗値の計算式**（Σ effGross・Σ net・holesWon・best2・rlStandings・m1Result・vegasHoleWins・niadoraTeamCount）— 一切不変。
- 勝ち点規則そのもの（各成立種目の総合1位に勝ち点1・同点は 1/同点チーム数 山分け）— 不変。**変わるのは「いつ算入するか」だけ**。
- 総合順位（同点同順位・1,1,3方式）・`teamRankPts` 各員満額配分・`computePayout` 按分・個人配点全ブロック — 不変。

### 3.2 種目の「確定」条件（新設）

```
種目の勝ち点算入 = 従来の成立条件（team-points §3.1） かつ 確定（下表）
```

| key | 種目 | 確定条件 | 備考 |
|-----|------|---------|------|
| `teamGross` | グロス対抗 | 発表ボタン `announced.teamGross` | 要件C |
| `teamNet` | ネット対抗 | 発表ボタン `announced.teamNet` | 要件C |
| `holeByHole` | ホールバイホール | 発表ボタン `announced.holeByHole` | 要件C |
| `best2ball` | ベスト2ボール（β） | 発表ボタン `announced.best2ball` | |
| `vegas` | ラスベガス（β） | 発表ボタン `announced.vegas` | 点差の独立集計・ベガス表は従来どおり非干渉 |
| `match1v1` | 1 on 1 | 発表ボタン `announced.match1v1` | 開封演出 `m1Opened` は従来どおり揮発・確定条件に使わない |
| `niadora` | ニアドラ | 発表ボタン `announced.niadora` | 開封演出 `pzMode/pzExcept` は従来どおり揮発・確定条件に使わない |
| `roulette` | ルーレット対抗 | **自動: `roulette.cur>=18`（18H終了）** ＋ 採用条件に **`F.roulette`（要件D）** を追加 | 進行は既にデータ保存済み＝ボタン不要。18H終了前は決着ホールがあっても勝ち点0 |

### 3.3 `teamWinPoints(g)` の変更（js/calc.js）

```js
function teamWinPoints(g){
  ...（teams 抽出・teams.length<2 ガードは現行のまま）
  const A=g.announced||{};                       // ★新設（viewGame の Object.assign コピーを素通し）
  const evOn=key=> key==='roulette' ? ((curGame()||g).roulette.cur>=18) : !!A[key];
  const add=(key,vals,dir)=>{
    ...（live/best/winners の算出は現行のまま）
    const on=evOn(key);                          // ★確定判定
    if(on) winners.forEach(i=>wins[i]+=1/winners.length);   // ★on の種目だけ wins に加算
    events.push({key,winners,vals,on});          // ★on を追加（未確定種目も events には載る＝表示用）
  };
  ...
  // ルーレット: F.roulette ゲートを追加（要件D）。OFF なら st を評価しない
  const st=(chFormats(g).roulette)? rlStandings(curGame()||g) : {teams:[],won:[]};
  if(st.won.some(w=>w>0)) add('roulette', byId(st.teams,j=>st.won[j]),'desc');
  // ニアドラの採用条件 anyTeamEvent は現行式のまま（st が空になれば roulette 項は自動で false）
  ...
}
```

- 返り値の形は `events[].on` の追加のみ（`{teams, wins, events}` は同じ）。`wins` は**確定種目のみの合計**になる。
- 未確定種目の `winners/vals` は従来どおり計算して返す（表示はマスクするが、発表ボタン押下の瞬間に正が既にある状態を保つ）。

### 3.4 `computePoints` の変更（js/calc.js・1行）

```js
if(events.length){          // 旧: 成立種目があれば配分
if(events.some(e=>e.on)){   // 新: 確定（発表済み）種目が1つ以上あれば配分（D4）
```

配分ロジック本体（順位付け・満額加算）は不変。

### 3.5 前後比較（★受け入れ条件・team-points §3.5 例Aを継続使用）

**例A**: 3チーム R/B/G・α5種目・全18H入力済み・ルーレット18H終了。値: グロス対抗 R勝ち／ネット対抗 R勝ち／HBH B勝ち／ルーレット B勝ち／ニアドラ R勝ち。`teamRankPts=[10,5]`。

| 発表状態 | 前（現行） | 後（本設計） |
|---|---|---|
| 発表操作なし | **R3 / B2 / G0** → R各員+10・B各員+5・G+0（値が出た瞬間に全種目算入） | ルーレットのみ自動確定: **R0 / B1 / G0** → B 1位 各員+10・R,G 同点2位 各員+5。総合カードは「発表 1/5」 |
| ＋グロス対抗を発表 | 同上（変化なし） | **R1 / B1 / G0** → R,B 同点1位 各員+10・G 3位+0 |
| ＋ネット・HBH・ニアドラを発表（全5種目確定） | R3 / B2 / G0 → +10/+5/+0 | **R3 / B2 / G0 → +10/+5/+0（前と完全一致）**。総合カードは「確定」 |

**例B（要件Bの核・途中経過の山分け抑止）**: HBH で1ホールだけ決着し2チーム同点（各0.5H取得）→ 前: `holeByHole` 種目が成立し各0.5勝ち点 → 後: 未発表なので**勝ち点0**・種目別勝ち点表は「未確定」行（？マスク）。

**例C（要件D）**: ルーレット18H終了済みのゲームで `formats.roulette=false` にすると、前: 「進行実績があれば自動で1種目」→ 後: **種目に入らない**（タブ・設定カード・勝ち点行も消える）。migrate で既存ゲームは `roulette:true` 補完＝**トグルの既定挙動は不変**。

**例D（旧データ・D10/Q3）**: 改修前に終了した既存ゲーム（例Aと同値・全員18H済み）を改修後に開くと、`announced={}` のため **R0 / B1 / G0**（ルーレットのみ自動確定）＝改修前の R3/B2/G0 から**変わる（挙動変化・ユーザー了承済み）**。幹事が5種目の発表ボタンを押し直せば改修前と同値（R3/B2/G0 → +10/+5/+0）に復元される。

**個人配点は全例で前後1ptも変わらない**（net/gross/niapin/dracon/m1win/m1draw 等はチーム確定と無関係）。

---

## 4. データモデル（§4 追補・migrate 後方互換）

### 4.1 新規フィールド

```jsonc
// game 直下（golfCompe_v1）
"announced": {              // ★新設: 種目別の発表済みフラグ（幹事の運営記録＝データ。演出の開封状態〔揮発〕とは別物）
  "teamGross": true, "teamNet": false, "holeByHole": false,
  "best2ball": false, "vegas": false, "match1v1": false, "niadora": false
  // 値が無いキーは false 扱い。roulette キーは持たない（cur>=18 で自動判定）
},
"formats": { ..., "roulette": true }   // ★新設: ルーレット対抗の採用トグル（α・既定 true）
```

### 4.2 state.js の変更

```js
// newGame(): formats に roulette:true を追加。announced:{} を追加
// migrate(): 既存 vegas/match1v1 と同じ per-key 慣例で
if(g.formats && g.formats.roulette===undefined) g.formats.roulette=true;   // 現状=常時有効の後方互換
if(g.announced===undefined) g.announced={};   // ★救済補完はしない（D10・Q3 ユーザー回答）＝既存ゲームは全種目未発表スタート
```

- **挙動変化（★ユーザー了承済み 2026-08-30・Q3）**: `announced` を持たない既存ゲームは改修後、**チーム由来の勝ち点・配分ポイントが0に戻る**（ルーレットのみ `cur>=18` なら自動確定で残る）。過去コンペの表示を復元したい場合は、幹事が当該ゲームの各種目タブで発表ボタンを押し直す（個人配点は無影響）。18H完了ゲームへの自動補完は**行わない**。
- localStorage キー（`golfCompe_v1` 他）は不変。バックアップ（全 state 素通し）も無変更で `announced` が入出力される。
- **表示状態との分離原則は維持**: `revealHoles`/`pzMode`/`m1Opened`/`tgMode` 等の演出状態は従来どおり揮発。`announced` は「演出」ではなく「発表を行った事実の記録」（D1）。

### 4.3 正本追記案（`2026-07-12-golf-compe-web.md` §4 末尾へ・PM が反映）

> **§4 追補（2026-08-30・winpoints-reveal）**: game に `announced`（種目別の発表済みフラグ・object）と `formats.roulette`（boolean・既定 true）を追加。チーム種目の勝ち点は「成立かつ確定（発表済み。ルーレットのみ 18H 終了で自動）」の種目のみ算入する（詳細 `docs/handoff/2026-08-30-winpoints-reveal.md` §3）。`announced` はデータ（幹事の記録）であり、開封・めくり等の演出状態（揮発・§11.14）とは別物。

---

## 5. UI 設計

### 5.1 チーム戦＞総合タブ（js/results.js・要件A）

- `renderTeamGame` の `if(key==='overall') return renderTeamOverall(g) + sc();` → **`return renderTeamOverall(g);`**（チーム別スコア表の削除。gross/net/hbh タブのスコア表は従来どおり）。
- `renderTeamOverall`:
  - ヘッダ: `statusBadge(g)` を撤去し、**発表進捗タグ**に置換。`N`=events 総数（成立種目）・`n`=on の種目数。`n<N` → `<span class="tag tagtie">${t('team.annProg',{n,N})}</span>`／`n===N && N>=1` → 緑タグ `status.fixed`（既存キー流用）。
  - ヒーロー行: 現行のまま（勝ち点は wins＝確定分のみになるので自動で「発表済みだけの積み上げ」表示になる）。ただし**順位バッジ＋配分タグ（`team.rankTag`）は `n>=1` のときのみ**描画（n=0 は勝ち点0のチーム名と「0」だけ・順位/配分なし＝computePoints のゲートと一致）。
  - 種目別勝ち点表: `ev.on` の行は現行表示（緑/橙/空欄/—）。**`!ev.on` の行**はラベルセルに `<span class="tag tagtie">${t('team.pending')}</span>` を併記し、値セルは全チーム `<span class="mask">？</span>`（対象外 null 含め一律マスク＝勝者ネタバレ防止・D6）。
  - **`tgMasked('overall',…)` の参照（mxHead/mxRows の2箇所）を削除**（要件A）。
  - 注記: 既存 `team.noteOverall` の下に `team.noteAnnounce` を1行追加。
- js/nav.js: `tgMode`/`tgExcept` から **`overall` キーを削除**（参照が無くなるため。他キーは現行のまま）。

### 5.2 発表ボタン（各種目タブ・投影原則 §11.14「幹事操作は控えめ配置」）

共通ヘルパー（js/results.js に新設・グローバル関数＝inline onclick 前提）:

```js
function tpAnnounce(key,on){ const g=curGame(); if(!g)return;
  (g.announced=g.announced||{})[key]=!!on; save(); renderResult(); }
function tpAnnounceUI(g,key){ const on=!!(g.announced||{})[key];
  return on
    ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('team.announced')}</span>
       <button class="btn gray sm" onclick="tpAnnounce('${key}',false)">${t('team.unannounce')}</button>`
    : `<button class="btn gold sm" onclick="tpAnnounce('${key}',true)">${t('team.announce')}</button>`; }
```

設置場所（すべてカード下部の `cardtools` 行＝master 目隠しトグルの並び。ボタンは常時活性・不成立中の発表は休眠＝D9）:

| タブ | 関数 | key |
|------|------|-----|
| グロス/ネット/HBH/ベスト2 | js/roulette.js `renderTeams` の `card()` tools 行に `tpAnnounceUI(g,key)` を追加（card の key と種目 key は一致） | `teamGross`/`teamNet`/`holeByHole`/`best2ball` |
| ベガス | 同 `renderTeams` のベガスカード tools 行 | `vegas` |
| 1 on 1 | js/results.js `renderMatch1v1Parts` の共通開封バーカード末尾 | `match1v1` |
| ニアドラ | js/results.js `renderTeamNiadora` の注記下に cardtools 行を新設 | `niadora` |
| ルーレット | **設置しない**（18H終了で自動確定） | — |

- `renderTeamNiadora` の勝ち点タグ表示条件: 現行 `allOpen && winIds.includes(...)` → **`ev.on && allOpen && winIds.includes(...)`**（発表前はタグを出さない＝種目別勝ち点表のマスクと整合。`ev` が undefined の場合は従来どおりタグなし）。
- 運用フロー（想定）: 各種目タブで目隠し解除・開封の演出 → その場で「結果を発表する」→ 総合タブの勝ち点・配分タブに反映、の繰り返し。

### 5.3 ルーレット対抗トグル（要件D）

- **js/game.js**: 「集計する競技」グリッドの `holeByHole` の直後に `${fchk('roulette',t('fmt.roulette'))}` を追加（チーム系の並び: teamGross→teamNet→holeByHole→roulette）。**ルーレット設定カード（`game.rlCard`・チェンジ/チャレンジ回数）を `if(F.roulette){...}` でゲート**（β Vegas 設定カードと同型・setFmt→renderGame 再描画で出没）。
- **js/results.js `resGameTabs`**: `T.push(['roulette',…])` を `if(F.roulette)` でゲート。選択中に OFF になった場合は既存のタブ消失フォールバック（`tabs[0]` へ）で自動処理＝追加コード不要。
- **js/calc.js**: §3.3 のとおり `teamWinPoints` の roulette 種目に `F.roulette` ゲート。
- **js/nav.js**: `BETA_FMT` には**入れない**（α扱い）。
- ルーレットタブ内部（js/roulette.js の進行・抽選・スコア表）は無変更。

### 5.4 styles.css

**変更なし想定**（既存の `.tag`/`.tagtie`/`.mask`/`.btn gold sm`/`.cardtools` のみで構成。新トークン・新クラスなし）。

## 6. i18n（js/i18n.js・ja/zh/en 3言語同時・キー集合完全一致）

**追加 7キー**（削除なし）:

| key | ja | zh | en |
|-----|----|----|----|
| `fmt.roulette` | ルーレット対抗 | 轮盘对抗 | Roulette |
| `team.announce` | 結果を発表する | 公布结果 | Announce result |
| `team.announced` | 発表済み | 已公布 | Announced |
| `team.unannounce` | 発表を取り消す | 取消公布 | Undo announce |
| `team.pending` | 未確定 | 未确定 | Pending |
| `team.annProg` | 発表 {n}/{N} | 已公布 {n}/{N} | Announced {n}/{N} |
| `team.noteAnnounce` | 各種目は「発表」後に勝ち点へ算入（ルーレットは18H終了で自動確定） | 各项目在「公布」后才计入胜点（轮盘在18洞结束后自动确定） | Events count toward win points after being announced (roulette locks automatically after 18 holes) |

## 7. 触る範囲 / 触らない範囲

- **触る**: js/state.js（newGame/migrate: `announced`・`formats.roulette`）／js/calc.js（`teamWinPoints` の on 付与＋roulette ゲート・`computePoints` のゲート1行）／js/results.js（renderTeamGame 'overall'・renderTeamOverall・renderTeamNiadora タグ条件・renderMatch1v1Parts 発表UI・resGameTabs・tpAnnounce/tpAnnounceUI 新設）／js/roulette.js（renderTeams の tools 行）／js/game.js（fmtgrid＋rlCard ゲート）／js/nav.js（tgMode/tgExcept の overall 削除）／js/i18n.js（+7×3言語）／tools/verify.mjs（任意: §3.5 例Aの回帰1件）／index.html（`?v=` 一括更新のみ）。
- **触らない**: §3 の各計算関数（peria/every/net/vegas 系・holesWon/best2/rlStandings/m1Result/niadoraTeamCount/vegasHoleWins の**式**）・computePayout・個人配点ブロック・localStorage キー・backup.js（素通し）・ルーレット進行/抽選ロジック・演出状態の揮発モデル（revealHoles/pzMode/m1Opened/tgMode の他キー）・スコア表 `renderScorecard` 本体（総合タブから呼ばなくするだけ）・個人戦タブ全般・styles.css。

## 8. 受け入れ条件

1. `node tools/verify.mjs` 全PASS（i18n 3言語パリティ +7キー・既存計算回帰 #3/Vegas 不変）。
2. **§3.5 例A**を再現: 発表なし＝ルーレットのみ算入（R0/B1/G0・B各員+10・R,G各員+5）→ 段階発表で積み上がり → **全種目発表後は現行と完全一致**（R3/B2/G0 → +10/+5/+0）。個人配点は全段階で前後1ptも変わらない。
3. **例B**: HBH 途中経過（同点含む）は未発表なら勝ち点0・種目別勝ち点表は「未確定」タグ＋全セル？マスク。発表ボタンで即算入・「発表を取り消す」で戻る。**リロードしても発表状態と勝ち点が保持される**（`golfCompe_v1` に保存）。
4. **総合タブ**: 表示が「総合順位ヒーロー＋種目別勝ち点表」の2つのみ（チーム別スコア表なし）。目隠しボタン/マスク（'overall' 系）が存在しない。ヘッダに「発表 n/N」（全発表で「確定」緑タグ）。発表0種目では順位バッジ・配分タグが出ず、配分タブにチーム由来 pt が入らない。
5. **ルーレット**: 18H終了（cur>=18）で自動的に勝ち点算入（ボタンなし）・17H以前は決着ホールがあっても算入なし。
6. **formats.roulette（例C）**: OFF でチーム戦ルーレットタブ・ゲーム設定のルーレット設定カード・種目別勝ち点の行が消え、勝ち点にも入らない。ON に戻すと進行データ（reps/pool/cur）はそのまま復帰（OFF はデータを消さない）。既存ゲームは migrate で ON 補完＝挙動不変。α/β 両チャネルでトグル表示（BETA_FMT 非追加）。
7. **旧データ互換（D10・Q3）**: `announced` 未定義の既存ゲームがエラーなく開け、**全種目未発表スタート＝チーム勝ち点0**（例D。ルーレットのみ 18H 終了済みなら自動確定）。migrate による発表済み補完コードが**存在しない**こと。発表ボタンを押し直せば改修前と同値に復元できる。個人配点は無影響。
8. ニアドラタブ: 勝ち点タグは「発表済みかつ全開封」でのみ表示。1 on 1: 開封演出（m1Opened・揮発）は従来どおり動作し、発表ボタンだけがデータに残る。
9. viewGame（開封ホール絞り込み）経由でも `announced` が正しく参照される（配分タブ・総合タブで同値）。
10. ライト/ダーク・投影表示で非破綻（新規クラスなし・機能色維持・「未確定」は色だけに頼らず文字タグ併記）。

## 9. 推奨PR分割（2PR・順序あり・連続マージ推奨）

1. **PR-① 計算・データ層（load-bearing・§3.5 前後比較必須）**: js/state.js＋js/calc.js＋（任意）tools/verify.mjs 回帰1件。
   - 注意: ①のみの状態では発表UIが無いため、**ルーレット以外のチーム勝ち点が一律0になる**（D10 により既存ゲームの救済補完もない）。②を同日中に連続マージする運用とし、間を空けない。
2. **PR-② UI・i18n**（①マージ後）: js/game.js・js/results.js・js/roulette.js・js/nav.js・js/i18n.js＋index.html `?v=` 更新。
- **並行作業注意（バッチ91）**: js/results.js・js/i18n.js・styles.css は並行 implementer が編集中。**PR-② は当該PRのマージ後にリベースして着手**。PR-①（calc/state）は衝突しないため並走可。①②を1PRにまとめてもよい（その場合も results/i18n 系の先行PRマージ後に着手）。

## 10. 確認事項への回答記録（2026-08-30 ユーザー回答・本設計はこれで確定）

| Q | 論点 | 回答 |
|---|------|------|
| Q1 | 発表フラグの保存方式 | **明示「発表」ボタン＋`g.announced` データ保存**（既定どおり確定・D1。揮発案・開封状態からの自動推定案は不採用） |
| Q2 | 確定条件 | **ルーレットのみ18H終了で自動確定・他7種目は発表ボタン**（既定どおり確定・D2。ニアドラ/1on1 の開封は演出のまま・確定条件に使わない） |
| **Q3** | 旧データ救済 | **★既定案と逆＝補完しない**（D10）。既存ゲーム（全員18H入力済み含む）も未発表スタート＝チーム勝ち点0。**改修後に既存ゲームの勝ち点が0に戻る挙動変化をユーザー了承済み**。過去コンペの表示は幹事が発表ボタンを押し直す運用（§4.2・例D・受け入れ条件7） |
| Q4 | 配分の暫定反映 | **発表のたびに暫定反映**（既定どおり確定・D4）。1種目でも発表されたらその時点の勝ち点順位で `teamRankPts` を暫定配分し、発表が進むたび更新。全採用種目発表済みで総合カードが「確定」（緑・D5）、それまでは「発表 n/N」（橙）＝暫定の表現 |
| Q5 | 発表後のスコア修正 | **常に最新値で勝者を再計算**（既定どおり確定・D8。フラグ維持・取り消し可） |
