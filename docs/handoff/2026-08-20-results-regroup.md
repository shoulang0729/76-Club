# 設計：結果発表を「個人戦／チーム戦／ポイント」×ゲーム別タブの2階層に再構成 — 2026-08-20

- **区分**: 【確定】（ユーザー要望原文あり。タブ並び・階層はユーザー指定。細部の既定は本書 §3 の決定表）
- **性質**: **表示の再配置のみ**。§3 計算・§4 データモデル・localStorage・i18n の既存キー集合構造に非接触（i18n は +1 キー・値変更2件のみ）。正本 `2026-07-12-golf-compe-web.md` への追記は不要（§3/§4 非接触）。
- **上書き対象（サブタブ構成）**: 本書は結果発表のサブタブ構成を定める従来記述を**上書き**する:
  - 正本 §11.12 系の `resultSub` 6タブ構成（prize / ind / team / m1 / roulette / pts の横並び）
  - `2026-08-20-1on1-match.md` §7.1（1 on 1 タブを最上段サブタブへ追加）→ **チーム戦グループ配下へ移動**
  - `2026-08-20-team-points.md` §6.2 の「チーム戦タブ内の配置」→ **本書 §6 が配置を再定義**（team-points.md 自体は編集しない。計算・カードの中身仕様 §6.2①③③' は有効なまま）
- **実装対象**: `js/results.js`（主）・`js/roulette.js`（`renderTeams` にフィルタ引数）・`js/nav.js`（`resultSub` 宣言1行の置き換え）・`js/i18n.js`・`styles.css`。**計算関数（js/calc.js）は一切触らない**。

---

## 1. ユーザー要望（原文）

> 結果発表はこの並びが正しいね。ゲームもタブ画面で分けたほうがわかりやすいね。
> 個人戦
> ・ニアドラ
> ・グロス
> ・ネット
> チーム戦
> ・ニアドラ
> ・グロス
> ・ネット
> ・1 on 1
> ・ルーレット
> ポイント

**追加要件（同日・原文）**:

> ヘッダ、1段目タブ、2段目ダブ（タブ）はスクロールしないで固定。1段目タブ、2段目ダブは高さ同じで。

## 2. 前→後サマリ

```
【前】結果発表サブタブ（1階層・6ボタン flex均等）
  [ニアドラ][個人戦][チーム戦][1 on 1(β)][ルーレット][ポイント配分]
   └ 個人戦タブ = スコア表＋全形式の順位カード横並び
   └ チーム戦タブ = チーム別スコア表＋全対抗カード横並び

【後】2階層（上段=グループ3つ flex均等 / 下段=ゲーム別チップ・横スクロール）
  上段: [個人戦][チーム戦][ポイント]
  下段（個人戦）:  [ニアドラ][グロス][ネット] ＋β: [ステーブルフォード][オリンピック][キャロウェイ][握り(トータル)]
  下段（チーム戦）: [総合][ニアドラ*][グロス][ネット][ホールバイホール] ＋β: [ベスト2ボール][ラスベガス][1 on 1] ＋ [ルーレット]
  下段（ポイント）: なし（renderStanding を直接表示）
  * チーム戦ニアドラは team-points（Issue #67）の計算実装後に自動出現（§6）
```

- 1 on 1・ルーレットは**上段サブタブから消え、チーム戦グループ配下へ移動**（ユーザー指定）。
- 「ポイント配分」→ラベル「ポイント」に短縮（ユーザーの語）。中身は現行 `renderStanding`（pt 表＋賞金按分）のまま。NP/DC 勝者登録（現行「ニアドラ」タブ）は**個人戦＞ニアドラ**へ移動し、**ヒーロー表示が主役・登録 select は details 内に控えめ配置**（§5.1.1・追加要望）。

## 3. 決定事項（既定込み・確定）

| # | 論点 | 決定 | 根拠 |
|---|------|------|------|
| D1 | 上段グループ | `ind`（個人戦）/ `team`（チーム戦）/ `pts`（ポイント）の3つ。既定=個人戦 | ユーザー並び。現行既定 `resultSub='ind'` と同じ着地 |
| D2 | 下段の既定タブ | 各グループの**先頭タブ**（個人戦=ニアドラ・チーム戦=総合）。タブ消失時（形式OFF・α切替）も先頭へフォールバック | ユーザーがニアドラを先頭に指定。フォールバック規則と統一 |
| D3 | 個人戦β形式の並び | グロス→ネットの後に ステーブルフォード→オリンピック→キャロウェイ→握り(トータル) | 現行 `renderIndividual` の順位カード順を踏襲 |
| D4 | チーム戦の並びと HBH/β の位置 | 総合→ニアドラ→グロス→ネット→**HBH**→β(ベスト2→ラスベガス→1 on 1)→ルーレット | ユーザーの相対順（ニアドラ<グロス<ネット<1on1<ルーレット）を保持し、未言及の HBH/β をネットと 1on1 の間に挿入。1 on 1 はルーレット直前=ユーザー指定どおり |
| D5 | チーム戦「総合」タブ | 先頭に新設。team-points の①総合カード＋②種目別勝ち点表の**受け皿**（実装前はチーム別スコア表のみ）。★モック承認時にユーザーが**「総合」タブ表示を明示選択**（2026-08-20 確定） | タスク制約「チーム戦グループの先頭に総合サマリ」。実装順どちらでも破綻しない（§6） |
| D6 | ポイントグループ | 下段タブなし・`renderStanding` 単独（統合ではなく現行 pts タブそのまま） | ユーザーの「ポイント」1語に収める。勝者登録は個人戦＞ニアドラへ |
| D7 | 各ゲームタブの中身 | **既存カードの再配置のみ**。個人戦=バナー＋当該形式の順位カード＋共通スコアカード（＋当該ルール1行の details）。チーム戦=当該対抗カード（＋グロス/ネット/HBH はチーム別スコア表） | 工数最小。順位カードを上（投影の主役）・スコア表を下（操作=開封バー内蔵） |
| D8 | スコア表の並べ替え追従 | タブ切替時に `scSortInd`/`scSortTeam` を当該指標へ自動セット（グロス/ネット/HBH タブのみ。タブ内での手動切替は従来どおり可） | ネットタブでグロス順に見える不整合の回避。1行で済む |
| D9 | 下段タブの表示条件 | 採用中フォーマット連動（`chFormats(g)`）。個人戦ニアドラ・チーム戦総合・ルーレットは常時表示 | 現行の「カードを出さない」ゲートをタブ単位に昇格。空タブを見せない |
| D10 | 表示状態 | `resGrp`＋`resGame`（グループ別選択のオブジェクト）を **js/results.js に宣言・揮発**。localStorage 非保存。`resultSub` は廃止 | 現行方針（表示状態の分離・揮発）。`let resultSub` の二重宣言回避のため新名 |
| D11 | 下段タブの UI | 横スクロールのチップ列（flex 均等にしない）。`.subtab-games` 新設 | β時 チーム戦9タブは 320px に均等では入らない（§9 検算）。投影原則=タブ UI は控えめ |
| D12 | ルール解説 | 現行の全ルール一括 `<details>` を廃止し、各ゲームタブ末尾に当該 `rule.*` 1行だけの `<details>` を置く（rule.match1v1→1on1タブ・rule.vegas→ラスベガスタブへ移設） | ゲーム別タブの趣旨に一致。i18n キー流用（増減なし） |
| D13 | sticky 固定（追加要件） | ヘッダ・#mainNav（既存 sticky）に加え、**上段＋下段タブを1つの `.result-sticky` に同居させてまとめて sticky 固定**（top 連鎖 0→50→95px・z-index 20→18→15。§8.1） | ユーザー原文「ヘッダ、1段目タブ、2段目ダブはスクロールしないで固定」。sticky を2つに分けず1ブロックにする方が top 連鎖の手動同期定数が増えない |
| D14 | タブ段の高さ統一（追加要件） | 上段・下段とも**同一の段高**: トークン `--tab-h`（:root=40px／≥768px=44px／≥1024px=48px）を新設し両ボタンの min-height に使う（§8.2） | ユーザー原文「1段目タブ、2段目ダブは高さ同じで」。数値は並行設計 **home-subtabs の「共通タブ段仕様」と揃える**（§8.2 注記。あちらのファイルは編集しない） |
| D15 | 1 on 1 タブの sticky 拡張（追加要件） | チーム戦＞1 on 1 タブでは **チームサマリカード＋操作バーカードも `.result-sticky` に同居**させ固定（スクロールは対戦カード群のみ）。方式=**1つの sticky コンテナ**（サマリ/バーは可変高のため top を積む多段 sticky にしない）。§8.3 | ユーザー原文「1on1 このカードまではスクロール禁止だね」。**他のゲームタブへは一般化しない**（グロス/ネット等の順位カードは非固定のまま＝今回の指定は 1 on 1 のみ） |
| D16 | 個人戦ニアドラのヒーロー表示（追加要望） | 個人戦＞ニアドラタブの主役を**ホール別ヒーローセルのグリッド**に（ホール番号=`--f-rl-hole`・区分文字併記=ニアピン/ドラコン・勝者名=`--f-rl-name`・未登録=控えめ「—」）。**列数は固定: 広幅(≥768px)=4列・狭幅(〜767px)=2列**（★モック承認時のユーザー修正「4人1行か2名ずつ2行で」・auto-fill の中途半端な折返し廃止）。§5.1.1 | ユーザー原文「ニアドラ（個人・チーム）の結果表示はヒーロー表示が良いな」。数値階層はルーレットパネル（rl-hole 48>rl-name 30）と同型＝投影トークン共用（正本 §11.14） |
| D17 | 勝者登録UIの控えめ化 | 現行 `renderPrizes`（select 群カード）は**中身無変更のまま `<details>`（既定=閉）に包んで**ヒーローの下へ | §11.14「幹事の操作UIは控えめ配置（details 折りたたみ）」。renderPrizes 非改変＝工数最小 |
| D18 | ニアドラ発表演出（伏せ→開き） | master トグル（既存 `ns.allShow/allHide` キー流用）＋**セルタップで個別開閉**（XOR・`pzMode`/`pzExcept` 揮発・localStorage 非保存）。未登録セルは対象外 | 既存 nsMode/nsExcept と同型の最小実装。表彰式で勝者を伏せておき順に開ける（開封演出は揮発＝§11.14） |

## 4. 状態変数とタブ生成（js/results.js）

### 4.1 表示状態（揮発・localStorage 非保存）

```js
// js/results.js 先頭（m1RevealMode と同じ置き場）
let resGrp='ind';                          // 'ind' | 'team' | 'pts'
let resGame={ ind:'prize', team:'overall' };  // グループ別の選択中ゲームタブ（セッション内は記憶）
```

- `js/nav.js` の `let resultSub='ind';`（現 nav.js:22）は**削除**（`setResultSub` も削除）。同名を results.js に再宣言すると通常 script のグローバルレキシカル二重宣言でエラーになるため**新名必須**。
- 再読込で既定（個人戦＞ニアドラ）に戻る=仕様（演出状態を保存しない・正本 §11.14）。
- `revealHoles`・`show`・`nsMode/nsExcept`・`tgMode/tgExcept`・`scSortInd/scSortTeam`・`m1RevealMode/m1Opened`・`rl` は**全て現行のまま**（宣言場所も変更しない）。

### 4.2 セッター

```js
function setResGrp(grp){ if(!(grp==='team'&&resGame.team==='roulette')) rlStopTimer(); resGrp=grp; renderResult(); }
function setResGame(k){ if(k!=='roulette') rlStopTimer();
  resGame[resGrp]=k;
  if(resGrp==='ind' && (k==='gross'||k==='net')) scSortInd=k;                       // D8
  if(resGrp==='team'&& (k==='gross'||k==='net'||k==='hbh')) scSortTeam=k;           // D8
  renderResult(); }
```

- rlStopTimer の規則は現行 `setResultSub`（'roulette' 以外へ移動でスピン停止）と同値。

### 4.3 タブリスト生成（表示条件=D9）

```js
function resGameTabs(grp,g){ const F=chFormats(g); const T=[];
  if(grp==='ind'){
    T.push(['prize', t('result.sub.prize')]);                    // 常時（対象ホールなしは中身の empty）
    if(F.gross)      T.push(['gross', t('term.gross')]);
    if(F.net)        T.push(['net',   t('term.net')]);
    if(F.stableford) T.push(['stb',   t('term.stableford')]);
    if(F.olympic)    T.push(['oly',   t('term.olympic')]);
    if(F.callaway)   T.push(['cal',   t('term.callaway')]);
    if(F.nassau)     T.push(['nas',   t('pts.nassauTotal')]);
  } else if(grp==='team'){
    const anyTeam=F.teamGross||F.teamNet||F.holeByHole||F.best2ball||F.vegas||F.match1v1;
    T.push(['overall', t('result.sub.overall')]);                // 常時（空状態は §5）
    if(anyTeam && typeof niadoraTeamCount==='function')          // ★team-points 実装後に自動出現（§6）
                     T.push(['nd',    t('result.sub.prize')]);
    if(F.teamGross)  T.push(['gross', t('term.gross')]);
    if(F.teamNet)    T.push(['net',   t('term.net')]);
    if(F.holeByHole) T.push(['hbh',   t('term.hbh')]);
    if(F.best2ball)  T.push(['b2',    t('term.best2')]);
    if(F.vegas)      T.push(['vegas', t('term.vegas')]);
    if(F.match1v1)   T.push(['m1',    t('result.sub.match1v1')]);
    T.push(['roulette', t('result.sub.roulette')]);              // 常時（format トグルなし・現行踏襲）
  }
  return T;   // 'pts' は []（下段なし）
}
```

- α切替（`chFormats`）でβ形式タブは自動消滅 → 現行の `resultSub==='m1' && CHANNEL!=='b'` ガードは**削除**（4.4 のフォールバックが受ける）。

### 4.4 renderResult 骨格

```js
function renderResult(){
  const el=document.getElementById('view-result'); const g0=curGame();
  if(!g0){ el.innerHTML=`<div class="empty">${t('result.noGame')}</div>`; return; }
  const parts=g0.participants.filter(pid=>state.players.find(x=>x.id===pid));
  if(!parts.length){ el.innerHTML=`<div class="empty">${t('result.noParts')}</div>`; return; }
  const tabs=resGameTabs(resGrp,g0);
  if(tabs.length && !tabs.some(([k])=>k===resGame[resGrp])) resGame[resGrp]=tabs[0][0];   // フォールバック=先頭
  const g=viewGame(g0);
  let body, m1Head='';
  if(resGrp==='pts') body=renderStanding(g, parts);                       // 現行そのまま
  else if(resGrp==='ind') body=renderIndGame(g, parts, resGame.ind);
  else if(resGame.team==='m1'){ const P=renderMatch1v1Parts(g0);          // §8.3: head=サマリ＋操作バー（sticky 同居・D15）
    m1Head=P.head; body=P.body; }
  else body=renderTeamGame(g, g0, parts, resGame.team);                   // roulette は g0（生）を使う
  const grpBtn=k=>`<button class="${resGrp===k?'on':''}" onclick="setResGrp('${k}')">${t('result.sub.'+k)}</button>`;
  const sticky=`<div class="result-sticky">
    <div class="subtab4">${grpBtn('ind')}${grpBtn('team')}${grpBtn('pts')}</div>
    ${tabs.length?`<div class="subtab-games">${tabs.map(([k,lb])=>`<button class="${resGame[resGrp]===k?'on':''}" onclick="setResGame('${k}')">${lb}</button>`).join('')}</div>`:''}
    ${m1Head}
  </div>`;
  el.innerHTML = sticky + body;
  const on=el.querySelector('.subtab-games .on'); if(on) on.scrollIntoView({inline:'center',block:'nearest'});
}
```

- 実装注（1 on 1・D15）: `renderMatch1v1Tab(g)` は `renderMatch1v1Parts(g)`（返り値 `{head, body}`）に改名・分割する: **head=チームサマリカード＋共通開封バーカード**（現行の `top`＋`bar` 変数の中身そのまま・仕様不変）、**body=対戦カード群**。ガード時（m1.emptyFmt / m1.need2Teams / 組合せなし）は `{head:'', body:空状態カード}`＝空状態は固定しない。§5.2 の m1 行の details(`rule.match1v1`) は body 末尾。

- 実装注: sticky 文字列は `<div class="result-sticky">` [上段] [下段] [m1Head（1 on 1 タブのみ・§8.3）] `</div>` の1コンテナ。`renderMatch1v1Tab(g)` は `renderMatch1v1Parts(g)`（返り値 `{head, body}`）に改名・分割する: **head=チームサマリカード＋共通開封バーカード**（現行 `top`＋`bar` 変数の中身そのまま）、**body=対戦カード群**。ガード時（m1.emptyFmt / m1.need2Teams / 組合せなし）は `{head:'', body:空状態カード}`＝空状態は固定しない。

- `renderIndividual`/`renderPrizeTab`/`renderTeamTab`/`setResultSub` は廃止し、`renderIndGame`/`renderTeamGame` に再編（中身のカード関数 `rankCardNS`/`leaderboard`/`renderScorecard`/`renderPrizes`/`renderTeams`/`renderRouletteTab`/`renderMatch1v1Tab`/`renderStanding` は**呼び出し場所が変わるだけで無変更**。例外: `renderTeams` へのフィルタ引数追加 §5.2）。

## 5. 各ゲームタブの中身（マッピング表・空状態）

### 5.1 個人戦グループ `renderIndGame(g, parts, key)`

共通: `banner` = 現行 renderIndividual の入力進捗バナー（全ゲームタブ共通・ニアドラタブには出さない）。`hl` = `nextKanji` の幹事バッジ（**ネットタブのみ**・現行どおり）。

| key | タブ名 | 中身（上から） | 空状態 |
|-----|--------|----------------|--------|
| `prize` | ニアドラ | **①ヒーローカード `renderPrizeHero(g0)`（新設・§5.1.1）→ ②`<details>`（既定=閉）内に `renderPrizes(g0)`（勝者登録 select 群・中身無変更）** | 対象ホールなし → 現行 `prize.emptyCfg` カード（ヒーロー・details とも出さない） |
| `gross` | グロス | banner ＋ `rankCardNS(グロス…)`（エブリON時タイトル `result.grossEvery`・現行どおり）＋ `renderScorecard(g,parts,null)` ＋ details(`rule.gross`) | —（タブ自体が F.gross 連動） |
| `net` | ネット | banner ＋ `rankCardNS(ネット…, hl)` ＋ scorecard ＋ details(`rule.net`) | — |
| `stb` | ステーブルフォード | banner ＋ `leaderboard(stablefordPts…)` ＋ scorecard ＋ details(`rule.stableford`) | — |
| `oly` | オリンピック | banner ＋ `leaderboard(olympicPts…)` ＋ scorecard ＋ details(`rule.olympic`) | — |
| `cal` | キャロウェイ | banner ＋ `leaderboard(callawayNet…)` ＋ scorecard ＋ details(`rule.callaway`) | — |
| `nas` | 握り(トータル) | banner ＋ `leaderboard(nassauTotalNet…)` ＋ scorecard ＋ details(`rule.nassau`) | — |

- 順位カードが上・スコア表が下（**投影の主役=順位**。現行 renderIndividual は逆順だった→本書で上書き）。順位カードは `rank-wrap` で包む（1枚でも既存幅ルールを流用）。
- 開封バー・合計トグル・目隠し（nsMode/nsExcept・show.totals）はスコアカード/順位カード内蔵のまま**無変更**。`revealHoles` は全タブ共通（タブを切り替えても開封数は共有=現行と同じ1変数）。

#### 5.1.1 ニアドラのヒーロー表示（D16〜D18・投影原則 §11.14 適用）

**①ヒーローカード `renderPrizeHero(g0)`**（js/results.js 新設。`g0`＝生ゲームでよい: `prizes` は viewGame 非依存＝どちらでも同値）:

- `h2` = `t('prize.title')`（「ニアピン / ドラコン」）＋ `cardtools` に master トグル（`ns.allShow`/`ns.allHide` キー流用・D18）。
- 本体 = `.npdc-hero`（グリッド・**狭幅=2列/広幅(≥768px)=4列の固定列数**。モック承認時のユーザー修正で確定）に**ホール番号昇順**で対象ホールのセルを並べる（NP/DC 混在・区分はセル内の文字併記。対象ホール = `niapinHolesOf(g)`/`draconHolesOf(g)`＝パー連動導出のまま）。
- **セル構造**（ルーレットパネルと同じ階層: ホール大 → 名前）:
  ```html
  <div class="npdc-cell np|dc" onclick="togglePzCell(7)">      <!-- 未登録セルは onclick なし -->
    <div class="npdc-top"><span class="npdc-hole">7<small>H</small></span>
      <span class="npdc-kind">ニアピン</span></div>              <!-- t('term.niapin') / t('term.dracon') -->
    <div class="npdc-name">山田 太郎</div>                       <!-- 勝者名（登録済み） -->
  </div>
  ```
  - ホール番号 = `--f-rl-hole`（基準48px）・勝者名 = `--f-rl-name`（基準30px）＝投影トークン共用（新トークンなし）。
  - 区分文字 = `term.niapin`/`term.dracon` を**必ず併記**（色だけに頼らない §11.14-2）。色は既存流用: NP=`var(--prid)`＋`--info-line` 枠 / DC=`var(--red)`＋`--danger-line` 枠（renderPrizes の pill 配色と同義・面は `--card` のまま=濃色ベタ塗りなし）。
  - **未登録**: 名前欄を「—」（`var(--sub)`・控えめ）。伏せ演出の対象外・タップ無効。
  - **伏せ状態**（D18）: 名前欄を既存 `.mask` スパンで「？？？」。判定 `pzMasked(h) = (pzMode==='hide') !== pzExcept.has(h)`。
- **表示状態（揮発・js/results.js 宣言・localStorage 非保存）**:
  ```js
  let pzMode='show'; let pzExcept=new Set();   // nsMode/nsExcept と同型（キー=ホールindex・NP/DC は対象ホールが素で排他）
  function togglePzAll(){ pzMode = pzMode==='show'?'hide':'show'; pzExcept.clear(); renderResult(); }
  function togglePzCell(h){ if(pzExcept.has(h)) pzExcept.delete(h); else pzExcept.add(h); renderResult(); }
  ```

**②勝者登録（幹事UI・控えめ=D17）**: `<details class="prize-edit mt10"><summary>${t('prize.recTitle')}</summary><div class="in">${renderPrizes(g0)}</div></details>`。既定=閉。**`renderPrizes` の中身（select 群・setPrize）は一切変更しない**（外側から包むだけ）。登録変更は `setPrize`→`renderResult()` でヒーローに即反映（既存フロー）。

- **チーム戦＞ニアドラタブとの関係**: あちらのヒーロー化は **team-points 側の architect が追補設計**する（本書は §6 の配置スロット定義のみ・team-points.md 系ファイルは非編集）。本節の `.npdc-*` スタイル・`--f-rl-*` 階層は**再利用してよい**（強制はしない。チーム名色は `tmColor` 併用を想定）。

### 5.2 チーム戦グループ `renderTeamGame(g, g0, parts, key)`

共通ガード: `teams=g.teams.filter(t=>t.memberIds.length)` が空なら `roulette`/`m1` 以外のタブは現行文言 `team.emptyTeams` の空カード（roulette は既存 `rl.need2`、m1 は既存 `m1.need2Teams` 等の自前ガードに任せる）。

`renderTeams(g, only)`: 既存 `renderTeams(g)`（js/roulette.js）に**省略可能な第2引数**を追加し、`only` 指定時は当該フォーマットのカード1枚だけ返す（各 `if(F.x)` を `if(F.x && (!only||only==='x'))` に。無指定は現行どおり全カード=後方互換）。

| key | タブ名 | 中身（上から） | 空状態 |
|-----|--------|----------------|--------|
| `overall` | 総合 | 【team-points 実装後】①チーム総合カード＋②種目別勝ち点表（team-points.md §6.2① の仕様のまま・置き場所だけ本タブ）→ ③`renderScorecard(g, g.participants, teams)`。【実装前】チーム別スコア表のみ | チームなし→`team.emptyTeams`／チーム形式が1つも無い→スコア表は出しつつ現行 `team.emptyFmt` は不要（総合タブはスコア表があれば成立） |
| `nd` | ニアドラ | team-points.md §6.2③ のニアドラカード（`niadoraTeamCount` を desc 表示・注記 `team.noteNiadora`） | タブ自体が `typeof niadoraTeamCount==='function'` ゲート（§6）。本数0でもカードは出す（0行表示） |
| `gross` | グロス | `renderTeams(g,'teamGross')` ＋ `renderScorecard(g, g.participants, teams)` | — |
| `net` | ネット | `renderTeams(g,'teamNet')` ＋ scorecard | — |
| `hbh` | ホールバイホール | `renderTeams(g,'holeByHole')` ＋ scorecard | 2チーム未満→カード側の既存条件どおり非表示（スコア表のみ） |
| `b2` | ベスト2ボール | `renderTeams(g,'best2ball')`（スコア表なし） | — |
| `vegas` | ラスベガス | `renderTeams(g,'vegas')`（ベガス表・点差）＋【team-points 実装後】注記 `team.noteVegasHbh` ＋ details(`rule.vegas`) | 資格チーム不足→既存 `vegas.needTeams` |
| `m1` | 1 on 1 | `renderMatch1v1Parts(g0)`＝現行 `renderMatch1v1Tab` の分割改名（開封2方式・大型UP・§13〜§15 の仕様に一切触れない）。**head（チームサマリカード＋操作バーカード）は sticky 同居=D15/§8.3**・body=対戦カード群＋details(`rule.match1v1`) | 既存ガード（m1.emptyFmt / m1.need2Teams / m1.noPairs）→ head なし・body に空状態カード（非固定） |
| `roulette` | ルーレット | `renderRouletteTab(g0)` **現行そのまま**（スピン・チェンジ/チャレンジ・rlScorecard。roulette-standings 設計とも非干渉） | 既存ガード（rl.need2） |

- グロス/ネット/HBH タブのスコア表は同一関数の再掲（コード追加なし）。並べ替えスイッチ（scsw 3択）はスコア表内に残す（D8 の自動追従＋手動切替可）。
- 目隠し（tgMode/tgExcept）はカード内蔵のまま無変更。

### 5.3 ポイントグループ

- 下段タブなし。`renderStanding(viewGame(g0), parts)` 現行そのまま（pt 表＋賞金按分・revealHoles 注記込み）。team-points 実装後に pt の中身（チーム由来分）が変わるのは計算側の話で、本タブの表構造は無変更。

## 6. team-points（Issue #67・未実装）との整合

**team-points.md は編集しない**。同設計 §6.2 が定める3要素の「置き場所」だけ本書が再定義する:

| team-points §6.2 の要素 | 本再構成での置き場所 |
|---|---|
| ① チーム総合カード＋種目別勝ち点表 | チーム戦＞**総合**タブの先頭（スコア表の上） |
| ③ ニアドラカード | チーム戦＞**ニアドラ**タブ（専用タブ・タブ出現条件=§4.3）。※ユーザー要望によりこのカードも**ヒーロー表示化**の対象＝**team-points 側 architect が追補設計**（本書は配置スロットと §5.1.1 の共通スタイル参照のみ提供） |
| ③' ベガスカードの注記 `team.noteVegasHbh` | チーム戦＞**ラスベガス**タブのカード直下 |

**実装順はどちらが先でも破綻しない**:
- ニアドラタブは `typeof niadoraTeamCount==='function'`（team-points PR-① の calc 関数）を出現ゲートにする → 本件が先に入っても壊れず、calc が入った時点でタブが自動出現（UI は team-points PR-② で入れる。それまでゲートは false のままタブなし）。
  - 注: PR-①だけ入った状態ではゲート true だがカード描画コード未実装、という中間を作らないため、**ゲート判定とニアドラカード描画は同一PR（team-points PR-②相当）で入れる**こと。本件PRではニアドラタブのコードを入れない（スロット定義のみ）。
- 総合タブは実装前=スコア表のみで成立（§5.2）。team-points PR-② は「旧 renderTeamTab の先頭」ではなく「renderTeamGame の 'overall' 分岐の先頭」へ①②を差し込む。
- **逆順の場合**（team-points PR-②が先・旧構造に §6.2 どおり実装済み）: 本件PRが上表のとおり3要素を各タブへ再配置する（カードの中身・関数は移動のみ）。
- **推奨順**: ①本件（表示骨格）→ ②team-points PR-①（calc/state）→ ③team-points PR-②（UI を本書のタブ配置で実装）。理由: PR-② のUIを一度旧構造に作ってから動かす手戻りが消える。

## 7. i18n（js/i18n.js・ja/zh/en 3言語同時）

**追加 1キー**:

| key | ja | zh | en |
|-----|----|----|----|
| `result.sub.overall` | 総合 | 综合 | Overall |

**値変更 2件（キー集合不変・enは変更なし）**:

| key | ja | zh | en |
|-----|----|----|----|
| `result.sub.pts` | ポイント配分 → **ポイント** | 积分分配 → **积分** | Points（そのまま） |

- ニアドラヒーロー（§5.1.1）は**追加キーなし**: カード題=`prize.title`・区分=`term.niapin`/`term.dracon`・master トグル=`ns.allShow`/`ns.allHide`・details 見出し=`prize.recTitle`・未登録=リテラル「—」を流用。

**削除 0**。流用キー: `result.sub.prize`（個人戦・チーム戦両方のニアドラタブ名。ja=ニアドラ/zh=近旗/远打/en=NP/LD）・`result.sub.ind`/`result.sub.team`（上段）・`result.sub.match1v1`・`result.sub.roulette`・`term.gross/net/stableford/olympic/callaway/hbh/best2/vegas`・`pts.nassauTotal`・`rule.*`・空状態各キー。

- team-points の追加キー（`term.niadora` ほか8つ）は同設計の実装時に入る。本件は依存しない（ニアドラタブ名に `result.sub.prize` を使うため）。

## 8. styles.css（セレクタ名基準）

### 8.1 sticky 積層（追加要件 D13・top 連鎖と z-index）

上段＋下段は**1つの `.result-sticky` ブロックに同居**（§4.4 の DOM どおり）。sticky を増やさないので top の手動同期定数は現行の1つ（95px）のまま。

| 層 | セレクタ | position | top | z-index | 高さ（目安） | 変更 |
|---|---|---|---|---|---|---|
| ヘッダ | `header` | sticky | 0 | 20 | ≈50px | なし |
| 主ナビ | `.mainnav` | sticky | 50px | 18 | ≈45px | なし |
| 結果タブ2段 | `.result-sticky` | sticky | 95px | 15 | ≈104px（=8+40+6+40+2+8。モバイル） | **中に `.subtab-games` が増える**のみ（宣言は無変更） |
| トースト | `.toast` | fixed | — | 50 | — | なし |

- top=95px は header(≈50)＋mainnav(≈45) の手動同期定数（既存慣例のまま。ヘッダ高を変える別件が出たら要追随）。
- z-index は既存の序列（20>18>15）で下位が上位の裏に潜る＝変更不要。`.result-sticky` は不透明地 `var(--bg)`＋下影つき（既存）なので、下をスクロールしてもタブ2段は常時可読。
- 開封バー（`.reveal-bar`）・カード群は**非 sticky のまま**（sticky にしない。固定領域はタブ2段まで＝縦の可視領域を守る）。
- **sticky 祖先に overflow を付けない**こと: `overflow-x:auto` は子の `.subtab-games` にだけ付ける（`.result-sticky` 自体や main に付けると sticky が無効化される）。

### 8.2 タブ段高の統一（追加要件 D14・数値確定）

共通トークン `--tab-h` を新設し、上段・下段ボタン両方の min-height に使う:

| ブレークポイント | `--tab-h` | 根拠 |
|---|---|---|
| :root（既定・〜767px） | **40px** | 現行 .subtab4 実測≈35px を切り上げ、チップと視覚整合 |
| `@media(min-width:768px)` | **44px** | 既存768px節の .subtab4（font15px/pad12px≈41px）をタッチ44ptへ切り上げ |
| `@media(min-width:1024px)` | **48px** | 既存 `.subtab4 button{min-height:48px}` と同値（既存行はトークン参照に置換可） |

> **注記（共通タブ段仕様）**: この 40/44/48 は並行設計 **`2026-08-20-home-subtabs`（ホーム側タブ段）の「共通タブ段仕様」と揃える**。トークン `--tab-h` は共用とし、**先にマージされた PR が :root に定義・後発は参照のみ**（i18n キーの重複回避と同じ運用）。万一名称・数値が食い違ったら**後発が先行に合わせる**（本ファイルも home-subtabs ファイルも互いを編集しない）。

```css
:root{ --tab-h:40px }                                   /* 768px:44px / 1024px:48px で上書き */
/* 上段（既存 .subtab4 に min-height を追加・他は無変更） */
.subtab4 button{min-height:var(--tab-h)}                 /* padding 9px 2px は既存のまま（中央寄せはボタン既定で成立） */
/* 結果発表 下段ゲームタブ（横スクロールチップ・2026-08-20 results-regroup） */
.subtab-games{display:flex;gap:6px;overflow-x:auto;padding:6px 2px 2px;scrollbar-width:none}
.subtab-games::-webkit-scrollbar{display:none}
.subtab-games button{flex:0 0 auto;white-space:nowrap;min-height:var(--tab-h);
  display:inline-flex;align-items:center;border:1px solid var(--line);background:var(--card);
  color:var(--sub);border-radius:var(--r-pill);padding:0 12px;font-size:var(--f-small);
  font-weight:var(--w-bold);cursor:pointer;letter-spacing:.02em}
.subtab-games button.on{background:var(--pri);color:var(--on-fill);border-color:var(--pri)}
```

- 段高=ボタン高で規定（min-height 同値 → 「1段目と2段目の高さ同じ」）。チップは縦 padding をやめ min-height＋inline-flex 中央寄せ＝高さが必ず `--tab-h` に揃う。
- 選択中の塗りは `.tgl.on` と同じ既存トークン（`--pri`/`--on-fill`）＝小面積チップの選択表示で前例あり（「面の濃色ベタ塗り禁止」は大面積の話・ダークテーマもトークンで自動対応）。
- メディアクエリ追記: `@media(min-width:768px)` に `:root{--tab-h:44px}` と `#view-result .subtab-games button{font-size:14px;padding:0 14px}`。`@media(min-width:1024px)` に `:root{--tab-h:48px}`（既存 `.subtab4 button{min-height:48px}` はトークン参照へ置換してよい＝同値）。

### 8.3 1 on 1 タブの sticky 拡張（追加要件 D15）

**固定範囲**: ヘッダ → 主ナビ → 上段タブ → 下段タブ → **チームサマリカード**（例「チームレッド 3 – 2 チームブルー」＋AS タグ）→ **操作バーカード**（全組一括/一組ずつ seg・次の組・全組オープン・すべて伏せる／一括時は開封4ボタン＋タグ）。**スクロールするのは対戦カード群（と rule details）のみ**。

- **方式（確定）**: 多段 sticky（各要素に top を積む）ではなく、**`.result-sticky` コンテナ1つに m1Head（サマリ＋バー）を同居**させる（§4.4）。理由: サマリ/バーは**可変高**（チーム名の長さ・狭幅での折返し・一括/一組ずつでボタン数が変わる）で top 定数の連鎖が組めない。1コンテナなら top=95px・z-index=15 の**既存宣言のまま変更ゼロ**。
- **背景（透け防止）**: `.result-sticky` は不透明 `var(--bg)`（既存）。サマリ/バーは `card` クラス＝不透明 `var(--card)` 面＋既存下影 → 下を通る対戦カードは透けない。追加 CSS は原則不要。カード下マージンで sticky 底に隙間が出る場合のみ `.result-sticky .card{margin-bottom:0}` ＋ `.result-sticky .card+.card{margin-top:6px}` を追加（数値はこの2つ・セレクタ名基準）。
- サマリ・バー・対戦カードの**中身/挙動は §13〜§15 のまま一切不変**（開封状態 m1Opened・m1RevealMode の揮発モデル含む）。位置が sticky 内になるだけ。
- **一般化しない**: 他のゲームタブ（グロス/ネット/HBH/総合など）の順位カード・スコア表は**非固定のまま**（固定はタブ2段まで）。今回のユーザー指定は 1 on 1 のみ。将来他タブへ広げる場合は別 Issue。

### 8.4 ニアドラヒーロー（D16・セレクタ名基準）

列数は**固定**（★モック承認時のユーザー修正「4人1行か2名ずつ2行で」）: 基準（〜767px）=**2列**・`@media(min-width:768px)`=**4列**。auto-fill による端数の中途半端な折返しはしない。境界の具体値は既存ブレークポイント 768px に揃える（コーディネータ指示の「700px 以下目安」を本書で 767/768px に確定＝新規ブレークポイントを増やさない）。

```css
/* ニアドラ ヒーロー表示（個人戦＞ニアドラ。§5.1.1・投影トークン共用）
   列数固定: 〜767px=2列 / ≥768px=4列（モック承認時のユーザー修正） */
.npdc-hero{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.npdc-cell{border:2px solid var(--line);border-radius:var(--r-sm);background:var(--card);
  padding:10px 12px;text-align:center;cursor:pointer}
.npdc-cell.np{border-color:var(--info-line)}
.npdc-cell.dc{border-color:var(--danger-line)}
.npdc-top{display:flex;justify-content:center;align-items:baseline;gap:8px}
.npdc-hole{font-size:var(--f-rl-hole);font-weight:var(--w-bold);line-height:1;color:var(--ink)}
.npdc-hole small{font-size:.35em;font-weight:var(--w-bold)}
.npdc-kind{font-size:var(--f-small);font-weight:var(--w-bold);letter-spacing:.04em}
.np .npdc-kind{color:var(--prid)}  .dc .npdc-kind{color:var(--red)}
.npdc-name{font-size:var(--f-rl-name);font-weight:var(--w-bold);line-height:1.15;margin-top:4px;
  overflow-wrap:anywhere;min-height:1.15em}
.npdc-name.empty{color:var(--sub);font-size:var(--f-title);font-weight:var(--w-med);cursor:default}
```

- メディアクエリ追記: `@media(min-width:768px)` に `.npdc-hero{grid-template-columns:repeat(4,1fr)}` の1行。
- 未登録セルは `.npdc-name.empty`（「—」控えめ）＋セル側の `onclick` なし（cursor は名前側で default 指定・実装はセルに `style="cursor:default"` でも可）。
- 伏せ表示は既存 `.mask` を `.npdc-name` 内で使用（追加 CSS 不要）。
- フォントは `--f-rl-*` の既存メディアクエリ（66/40→70/44→76/48px）に自動追随＝**列数の1行以外に追加メディアクエリ不要**（セル内容・伏せ演出はモック承認どおり不変。狭幅2列の長い名前は `overflow-wrap:anywhere` の折返しで吸収）。

## 9. 検算（320px・投影）

- **上段（横）**: 有効幅 ≈ 320 − main 左右余白(≈24) = 296px → 3ボタン各 ≈ 98px。最長ラベル「チーム戦」4字 × 14px ≈ 56px ＋ padding 4px → **余裕で収まる**（現行6ボタン(1つ≈49px)より改善）。
- **下段（横）**: 横スクロールなので本数非依存。最長チップ「ホールバイホール」8字 × 13px ≈ 104px ＋ padding 24px ＋ border 2px ≈ **130px < 296px** で1チップは必ず視認可。βチーム戦フル9タブ ≈ 合計 720px → スクロールで対応、`scrollIntoView` で選択中チップを常に可視化（§4.4）。折返しなし（`white-space:nowrap`・`flex:0 0 auto`）。
- **縦（固定領域増・D13）**: 320px 幅端末縦持ち（例 320×568）で固定領域 = header ≈50 ＋ mainnav ≈45 ＋ result-sticky ≈104（8＋40＋6＋40＋2＋8） ≈ **199px** → コンテンツ可視 ≈ **369px（画面の約65%）**＝大型順位カード2〜3行が入る。現行（1段35px・固定≈146px）比 **+53px** の固定増は許容（タブ迷子の解消が優先・ユーザー指定）。横持ち小型端末（縦320px）は可視 ≈121px と狭いが、投影・閲覧の主戦場は縦持ちスマホ〜iPad/外部モニタ（正本 §11.14）で割り切る。
- **縦（1 on 1 タブ・D15）**: 320×568 でサマリカード ≈65px（m1-teamsum 1行＋padding。狭幅ではチーム名の文字が縮む既存挙動で1行維持前提・2行折返し時 +24px）＋操作バーカード ≈95px（一組ずつ: seg＋3ボタンが2行に折返し／一括: 開封4ボタン＋タグ2行）→ 固定合計 ≈ **199＋65＋95 ≈ 359px**・対戦カード可視 ≈ **209px ＝ heroカード約1枚分**。狭幅では1組ずつ確認する運用（一組ずつモード）と噛み合うため許容。iPad 横/投影では固定比が下がり2〜3カード可視。
- **sticky 内の横スクロール（D13）**: `overflow-x:auto` は `.subtab-games`（stickyの子）のみ → sticky 無効化の条件（sticky 要素自身や祖先の overflow）に該当せず、**固定中もチップの横スクロール・scrollIntoView が動作**する。
- **ニアドラヒーロー（D16）**: 320px は**2列固定** → セル幅 ≈ (296−10)/2 ≈ **143px**（ホール番号48px＋「H」は収まる。勝者名30pxは約4字/行・長名は `overflow-wrap:anywhere` で折返しセル高が伸びる）。セル高 ≈ 107px（1行名）→ 可視369px に**2行(4セル)強**＝NP2+DC2 の典型設定がほぼ1画面。≥768px は**4列固定**（典型4ホール=1行・8ホールでも2行）で端数の中途半端な折返しなし。
- **投影**（正本 §11.14): タブUIは小型チップ=控えめ。各タブの主役は既存の大型カード（`lb.big`・m1-hero・rl-panel）で不変。順位カードをスコア表より上に置き、後方席が最初に見るものを勝敗にする（D7）。タブ2段が常時固定されることで、投影中に幹事がスクロール位置を戻さずタブを切り替えられる。

## 10. 触る範囲 / 触らない範囲

**触る**: `js/results.js`（renderResult 再編・renderIndGame/renderTeamGame/renderPrizeHero 新設・`pzMode`/`pzExcept` 揮発状態追加・renderIndividual/renderPrizeTab/renderTeamTab/setResultSub 廃止）・`js/roulette.js`（`renderTeams` に省略可能引数 `only` のみ）・`js/nav.js`（`resultSub` 宣言と `'pts' | 'ind' | …` コメントの1行削除のみ）・`js/i18n.js`（§7）・`styles.css`（§8）。

**触らない（load-bearing）**: `js/calc.js` 全部（§3 計算）・`renderScorecard`/`rankCardNS`/`leaderboard`/`renderPrizes`/`renderStanding`/`renderRouletteTab` の**中身**（呼び出し位置のみ変更）・`renderMatch1v1Tab` の**生成HTML/挙動**（§8.3 の head/body 分割＝返し方のみ変更。サマリ/バー/対戦カードの中身・開封モデルは不変）・localStorage 全キー・`revealHoles`/`show`/`nsMode`/`tgMode`/`m1Opened`/`rl` の各表示状態モデル・1 on 1 の §13〜§15 仕様・ルーレット進行/抽選・`docs/handoff/2026-08-20-team-points.md`・`2026-08-20-roulette-standings.md`・データモデル/バックアップ。header/.mainnav の sticky 宣言（top/z-index）も無変更（§8.1）。

## 11. 受け入れ条件

1. `node tools/verify.mjs` 全PASS（i18n パリティ: +1キー3言語同時・計算回帰 #3/Vegas 無変更でPASS）。
2. **α既定**: 上段 [個人戦][チーム戦][ポイント]。下段=個人戦 [ニアドラ][グロス][ネット]／チーム戦 [総合][グロス][ネット][ホールバイホール][ルーレット]（formats 既定全ON時）／ポイント=下段なし。初期表示=個人戦＞ニアドラ。
3. **β全ON**: 個人戦7タブ・チーム戦8タブ（＋team-points 実装後はニアドラで9）。順序=§3 D3/D4 のとおり（1 on 1 はルーレットの直前）。
4. 各タブの中身が §5 のマッピングどおり。順位カードが上・スコア表が下。ルール details は当該ゲームの1行のみ。
5. **挙動不変の確認**: 順位・スコア値・目隠し（ns/tg/show.totals）・開封（revealHoles 共有）・1 on 1 の開封2方式・ルーレットのスピン/チェンジ/チャレンジが再配置前と同一動作。ポイントタブの pt/賞金額が再配置前と一致。
6. フォーマットOFFで当該タブ消滅。チーム戦＞1 on 1 表示中にαへ切替→総合タブへフォールバック（エラーなし）。ルーレット以外のタブへ移動でスピン停止（現行同等）。
7. 表示状態は揮発: 再読込で個人戦＞ニアドラに戻る。localStorage に新キーが増えていない。
8. 320px で上段3ボタンが折返しなし・下段が横スクロール＋選択中チップ可視。iPad（768/1024）でチップがタッチ44pt 相当。ライト/ダーク非破綻。
9. チームなし/参加者なし/ゲームなしの空状態が §5 の文言で表示（既存キーのみ）。
10. **sticky（D13）**: 結果発表でどれだけ下へスクロールしても ヘッダ・主ナビ・上段タブ・下段タブが画面上部に残る（top 連鎖 0/50/95px・z-index 20/18/15）。下段チップは固定中も横スクロール・scrollIntoView が動作。下を通るコンテンツが透けない（不透明地＋下影）。
11. **タブ段高（D14）**: 上段ボタンと下段チップの高さが全ブレークポイントで一致（`--tab-h`=40/44/48px）。home-subtabs 側実装と同一トークン・同一値（先行PRが :root 定義・後発は参照。§8.2 注記）。
12. **1 on 1 sticky（D15）**: チーム戦＞1 on 1 でチームサマリカードと操作バーカードまで固定され、対戦カード群だけがスクロールする。一括/一組ずつの切替・開封操作が固定位置のまま機能し、開封挙動は §13〜§15 と同一。空状態（組合せなし等）は固定されない。他のゲームタブではカード固定なし（タブ2段まで）。
13. **ニアドラヒーロー（D16〜D18）**: 個人戦＞ニアドラで対象ホールがホール順にヒーローセル表示（ホール番号大＋ニアピン/ドラコン文字併記＋勝者名 `--f-rl-name`）。**列数固定: 〜767px=2列・≥768px=4列**（auto-fill 由来の端数折返しがない。典型 NP2+DC2 は広幅で4セル1行）。未登録は「—」控えめ・タップ無効。master「全非表示」で登録済みセルの名前が「？？？」になり、セルタップで個別開閉（揮発・再読込で全表示）。登録 select 群は details（既定=閉）内にあり、変更がヒーローへ即反映。`setPrize`/`renderPrizes` の生成HTML・保存挙動は不変＝登録データの前後互換。i18n 追加キーなし。320px で2列・破綻なし。

## 12. 推奨実装順・PR分割

- **単一PR**（例 `feat/results-regroup`）: 触る5ファイルは1機能として不可分（タブ骨格と中身の移動を分けると中間状態が壊れる）。
- **着手タイミング**: 画面分割（game-split）実装が index.html/js/nav.js/js/i18n.js 等を改修中 → **そのマージ後に着手**（nav.js の1行削除・i18n 追記が衝突するため。後発リベース）。
- team-points #67 との順序は §6（推奨: 本件が先）。
