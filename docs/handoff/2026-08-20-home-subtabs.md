# 設計：サイドメニュー廃止 → ホームタブ配下の全幅サブタブ化（#navCur 廃止） — 2026-08-29 確定

対象: `index.html` / `js/nav.js` / `js/home.js` / `js/i18n.js` / `styles.css`。**表示・導線のみ**の変更（§3計算・データモデル§4・localStorage キー集合に非接触＝正本 2026-07-12 への追記は不要）。
前提コード: **PR #66（bd25743・固定サイドメニュー）＋ Issue #61 実装（`2026-08-20-game-split.md` の最終形＝basic 分割・5作業画面）**。この2つが揃った状態の上に実装する（**#61 マージ後に着手**）。行番号は流動するため、本書は**セレクタ/関数名/キー名**で位置を特定する。

ユーザーフィードバック（原文）: 「ホーム配下のサイドメニュー、ゲームコース選手スコアの選択時に、上のタブに個別メニューが表示されるのは良くないです。サイドメニューでなく、ホームタブのサブタブにすると、横幅が全部使えるので都合が良いのではないでしょうか」

→ ナビ反復の3度目（ドロワー #58 → 固定サイドメニュー #66 → 本件）。指摘は2点: (1) **#navCur（作業画面名が上段タブ列に出る仕組み）が良くない**、(2) **サイドメニューの左カラムが幅を食う**。解は「上段2タブ＋ホーム配下の**全幅サブタブ列**（結果発表の `.subtab4` と同じ下線タブ流儀）」。サブタブは作業画面表示中も**出続け**、現在地は active 下線で示す（navCur の役割を置換）。

## 0. 既存設計との上書き関係（必読）

| 既存節 | 内容 | 本設計での扱い |
|---|---|---|
| `2026-08-20-home-menu.md`（PR #66）全体 | ホーム2カラム（.homegrid 左=固定メニュー .homemenu/.hm-item） | **廃止（本設計 §1/§4 が上書き）**。ホームは1カラム全幅に戻る |
| 同 §3 / `2026-08-20-home-drawer.md` の「#navCur 現在地表示」 | `#navCur` 表示専用ボタン＋`WORK_TABS` による isWork 判定 | **全廃**（削除一覧＝本設計 §7）。現在地表示はサブタブの `.on` 下線が担う |
| home-menu §0 で存続とした「2タブ（ホーム/結果発表）」「結果発表はメニューに入れない」「表示状態は揮発」 | — | **存続**（サブタブにも結果発表は入れない） |
| home-menu §2.2 の項目リスト（基本設定→ゲーム設定→コース→選手→スコア・5項目・順序固定） | — | **存続**。置き場所を固定メニュー→**サブタブ列**へ変更し、先頭に「概要」を追加（=6項目・§2） |
| home-menu §2.2 の説明2行目（`home.d.*`） | タイトル＋説明の2行構成 | **廃止**（サブタブは1行ラベル）。`home.d.*` 5キー＋`home.menu` を削除（§6）。案内はガイド4ステップ（`home.step1..4`）が既に担う |
| `2026-08-20-game-split.md` §5.2 | `WORK_TABS` に basic 追加 | **失効**（WORK_TABS 自体を削除。navCur が消えるため用途がなくなる） |
| 同 §5.4 / §6.1 | 起動タブ 'basic'（seenTop=1 時）・`nav.basic` キー | **存続**（`nav.basic` はサブタブのラベルとして引き続き使用）。`home.d.basic` は本設計で削除 |
| 同 §2（chwrap 50:50） | α/β カードの grid CSS | **存続・無改変**。右カラム制約（home-menu §0）が消え、元設計どおり**画面幅いっぱいで50:50**に戻る |
| 正本 §11.14 | 投影前提の表示原則 | ホーム系は幹事の作業画面＝通常UIで可。原則4のみ準拠（サブタブの現在地 `lastHome` は揮発・保存キー増ゼロ） |

## 1. 結論サマリ（前→後）

- **前（#66＋#61）**: ナビ=ホーム｜結果発表｜#navCur（作業画面中のみ画面名を表示）。ホームは2カラムで左に固定メニュー5項目。作業画面からの横移動は「ホーム→メニュー項目」の2タップ。
- **後**:
  - ナビ=**ホーム｜結果発表 の2段構え**。上段2タブの直下に**ホーム系サブタブ列（全幅・6項目）**: **概要｜基本設定｜ゲーム設定｜コース｜選手｜スコア**。結果発表表示中のみサブタブ列を隠す（結果発表は独自の `.subtab4` を持つため二重にしない）。
  - **#navCur を完全廃止**（DOM・JS・CSS・`WORK_TABS` とも削除）。現在地はサブタブの下線（`.on`）＋上段「ホーム」タブの下線で示す。上段タブ列に作業画面名は**二度と出ない**。
  - **ホーム（概要）は1カラム全幅**: ガイド → α/β解説 → α/βカード50:50 → skip チェック。`.homegrid/.homemenu/.hm-item` は全廃。
  - **作業画面間の横移動が1タップ化**（スコア⇄コース等。前=2タップ）。**ヘッダ＋1段目タブ＋2段目サブタブの3層を sticky 固定**（ユーザー追加要件・§5.1）＝スクロール中も現在地と導線が常時可視。**1段目と2段目のタブ高さは同一**（共通トークン `--h-tabrow`・§5.2）。
  - **結果発表→ホームの戻り**: 揮発変数 `lastHome` に直前のホーム系サブタブを記憶し、上段「ホーム」タブで**直前の作業画面に復帰**（既定として確定。§3.3 に理由）。localStorage 非保存。
  - i18n: **追加1キー×3言語**（`nav.top`=概要）、**削除6キー×3言語**（`home.menu`・`home.d.basic/game/course/players/score`）。localStorage 非接触。

## 2. サブタブ構成（順序固定）

| # | tab（activeTab 値） | ラベルキー | ja | zh | en | 遷移先 view |
|---|---|---|---|---|---|---|
| 1 | home | `nav.top`（新設） | 概要 | 概览 | Guide | view-home（ガイド＋α/β） |
| 2 | basic | `nav.basic` | 基本設定 | 基本设置 | Setup | view-basic |
| 3 | game | `nav.game` | ゲーム設定 | 玩法设置 | Games | view-game |
| 4 | course | `nav.course` | コース | 球场 | Course | view-course |
| 5 | players | `nav.players` | 選手 | 选手 | Players | view-players |
| 6 | score | `nav.score` | スコア | 记分 | Scores | view-score |

- 先頭「概要」= 旧ホームコンテンツの置き場（有力案どおりサブタブ内包・既定表示）。ラベルに `nav.home`（ホーム/首页/Home）を使い回さない理由: 上段「ホーム」タブ直下に同名サブタブが並ぶと親子が判別できないため。en は "Guide"（"Overview" は §5.4 の幅検算で不利）。
- **結果発表はサブタブに入れない**（上段タブ・従来決定の踏襲）。
- activeTab の取りうる値・`views` マップは**不変**（'home' が「概要」に対応するだけ。state/URL/保存への影響ゼロ）。

## 3. ナビ（index.html / js/nav.js）

### 3.1 index.html — `#mainNav` 一帯を差し替え

```html
<div class="navwrap">
  <nav id="mainNav" class="mainnav">
    <button data-tab="home" onclick="goHome()" data-i18n="nav.home">ホーム</button>
    <button data-tab="result" onclick="go('result')" data-i18n="nav.result">結果発表</button>
  </nav>
  <nav id="homeSub" class="subnav">
    <button data-tab="home"    onclick="go('home')"    data-i18n="nav.top">概要</button>
    <button data-tab="basic"   onclick="go('basic')"   data-i18n="nav.basic">基本設定</button>
    <button data-tab="game"    onclick="go('game')"    data-i18n="nav.game">ゲーム設定</button>
    <button data-tab="course"  onclick="go('course')"  data-i18n="nav.course">コース</button>
    <button data-tab="players" onclick="go('players')" data-i18n="nav.players">選手</button>
    <button data-tab="score"   onclick="go('score')"   data-i18n="nav.score">スコア</button>
  </nav>
</div>
```

- 削除: `#navCur` ボタン行。
- **`.navwrap` が sticky を引き受け**（2段を1ユニットで追従・§5.1）。`.mainnav` 自体の sticky は外す。
- 上段ホームは `goHome()`（直前サブタブへ復帰・§3.3）。静的 DOM＋`data-i18n` なので言語切替は `applyStaticI18n` が既存機構のまま反映（renderHome での再生成不要）。
- `<main>`・view-* の並び・script 読込順（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→roulette→backup→init）は**変更しない**。

### 3.2 js/nav.js — 変更3点＋削除2点

```js
let lastHome='home';   // ホーム系で最後に居たサブタブ（揮発・非保存）。結果発表からの復帰先
function goHome(){ go(lastHome); }
function go(tab){ rlStopTimer(); activeTab=tab; render(); }   // 不変

function render(){
  Object.entries(views).forEach(([k,id])=> document.getElementById(id).style.display = k===activeTab?'':'none');
  const g=curGame();
  document.getElementById('hdrGame').textContent = g? `${g.name}　${g.date}${g.course?'　@'+g.course:''}` : t('hdr.noGame');
  if(activeTab!=='result') lastHome=activeTab;                      // ← navCur の3行をこの塊に置換
  const hs=document.getElementById('homeSub');
  hs.style.display = activeTab==='result' ? 'none' : '';
  hs.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.tab===activeTab));
  if(activeTab!=='result') hs.querySelector('button.on').scrollIntoView({block:'nearest',inline:'nearest'});
  const par = activeTab==='result' ? 'result' : 'home';             // 上段タブは「親」を点灯
  document.querySelectorAll('#mainNav button').forEach(b=>b.classList.toggle('on', b.dataset.tab===par));
  /* chBadge 更新・renderHome/renderBasic/…/renderResult 分岐は現行のまま不変 */
}
```

- **削除**: `const WORK_TABS=[…]`（navCur 専用だった。他に参照なしを確認済み）と、render 内の navCur 更新3行（`const nc=…` / `nc.style.display=…` / `if(isWork)…`）。
- `scrollIntoView({inline:'nearest'})` は §5.4 の横スクロール時に active タブを可視域へ入れる保険（`block:'nearest'` なので縦スクロールは発生しない。sticky で常に縦可視のため）。
- `views` マップ・`SC_NARROW_MQ`・rlStopTimer・その他グローバルは**不変**。

### 3.3 結果発表→ホームの戻り挙動（既定として確定）

**直前のサブタブを維持**する（概要に戻さない）。理由: ラウンド中の幹事は「スコア入力⇄結果発表」を高頻度に往復するため、毎回 概要 に戻すと常に+1タップ＋現在位置の喪失になる。`lastHome` は render 内で同期するので、起動直後（init.js が `activeTab='basic'` をセットするパス）も最初の render で 'basic' になり、goHome が概要へ吸われることはない。**揮発**（リロードで 'home' に戻る・localStorage 非保存＝§11.14 原則4・保存キー増ゼロ）。概要へは常時見えているサブタブ「概要」1タップで到達可能。

## 4. ホーム＝概要サブタブ（js/home.js）

`HOME_MENU` 定数と `mi` テンプレート、`.homegrid`/`.homemenu` ラッパを**削除**し、1カラム化する。

```js
function renderHome(){
  const el=document.getElementById('view-home');
  const chCard=(c)=>{ …（現行のまま・不変）… };
  el.innerHTML = `
    <div class="card hometop">
      <h2>${t('home.title')}</h2>
      <div class="muted">${t('home.lead')}</div>
      <ol class="homesteps"><li>${t('home.step1')}</li><li>${t('home.step2')}</li><li>${t('home.step3')}</li><li>${t('home.step4')}</li></ol>
    </div>
    <div class="card"><h2>${t('ch.title')}</h2>
      <div class="rule">${t('ch.note')}</div>
      <div class="muted mt6">${t('ch.common')}</div>
    </div>
    <div class="chwrap">${chCard('a')}${chCard('b')}</div>
    <label class="tgl seentop"><input type="checkbox" ${seenTop()?'checked':''} onchange="setSeenTop(this.checked)"> ${t('home.skip')}</label>`;
}
```

- ガイド4ステップ・ALPHA_GAMES/BETA_GAMES・chCard・seenTop/setSeenTop・`golfCompe_seenTop` の意味は**不変**。init.js（`if(seenTop()) activeTab='basic'`）も**不変**。
- `.chwrap` は右カラム制約が消え**画面幅いっぱいで50:50**（game-split §2 の元設計に戻る。CSS 無改変・560px 以下縦積みも不変）。

## 5. CSS（styles.css）

### 5.1 3層 sticky 固定と2段ナビ（変更・新設）

**ユーザー追加要件**: 「ヘッダ、1段目タブ、2段目タブはスクロールしないで固定。1段目タブ、2段目タブは高さ同じで。」

sticky 積層（上から）: **ヘッダ**（既存 `header{position:sticky;top:0;z-index:20}`・高さ≈50px＝不変）→ **`.navwrap`（1段目＋2段目を包む単一 sticky・top:50px・z-index:18）**。2段目を個別 sticky にせずラッパで一体化するので top 値の連鎖は 0→50px の2つだけで済み、段高が変わっても崩れない。z-index は header(20) > navwrap(18) > .result-sticky(15) > コンテンツ、の既存序列を維持。

```css
/* 主ナビ: ホーム/結果発表の2タブ＋ホーム配下の全幅サブタブ（2026-08-20-home-subtabs.md）。
   ヘッダ(top:0)＋タブ2段(.navwrap top:50px)の3層 sticky。タブ段の高さは --h-tabrow で1段目/2段目/結果発表側とも共通 */
.navwrap{position:sticky;top:50px;z-index:18}
.mainnav{display:flex;gap:6px;align-items:center;background:var(--card);border-bottom:1px solid var(--line);padding:0 12px}
.mainnav button{border:0;border-bottom:2px solid transparent;background:transparent;color:var(--sub);
  padding:0 10px;min-height:var(--h-tabrow);font-size:var(--f-body);font-weight:var(--w-bold);cursor:pointer;letter-spacing:.02em}
.subnav{display:flex;gap:6px;background:var(--card);border-bottom:1px solid var(--line);padding:0 12px;
  overflow-x:auto;scrollbar-width:none}
.subnav::-webkit-scrollbar{display:none}
.subnav button{flex:1 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;color:var(--sub);
  padding:0 2px;min-height:var(--h-tabrow);font-size:var(--f-body);font-weight:var(--w-bold);cursor:pointer;letter-spacing:.02em;white-space:nowrap}
.subnav button.on{color:var(--strong);border-bottom-color:var(--pri)}
@media(max-width:374px){ .subnav{gap:4px} .subnav button{font-size:12px} }
@media(min-width:1024px){ .mainnav button{font-size:15px} .subnav button{font-size:15px} }
```

- `.mainnav` から `position:sticky;top:50px;z-index:18` を **`.navwrap` へ移動**。`.mainnav button.on` は現行のまま不変。既存 `@media(min-width:1024px){ .mainnav button{min-height:48px;font-size:15px} }` の min-height は §5.2 のトークン側へ移す（font-size:15px は上記のとおり残す）。
- **1段目・2段目のボタン縦 padding を 0 にし、高さは `min-height:var(--h-tabrow)` のみで決める**（button の UA 既定でラベルは上下中央）。両段の実高 = `--h-tabrow`＋境界線1px で**完全一致**。
- 見た目は結果発表 `.subtab4` と同流儀（下線 active・地は `--card`・トークンのみ＝ライト/ダーク自動反転・ベタ塗りなし）。
- `margin-bottom:-1px`（下線を境界線に重ねる `.subtab4` の技）は**両段とも使わない**: subnav 側は overflow-x:auto のスクロールコンテナ内で負マージンが1pxの縦オーバーフロー（=不要な縦スクロール）を作るため、mainnav 側は残すと段の実高が subnav と1pxズレて「高さ同じ」要件に反するため。下線が境界線の1px上に出る差のみ（実用上判別不能）。両段の実高 = `--h-tabrow`＋1px で完全一致。
- `flex:1 0 auto`: 広幅では6ボタンが余白を等分して全幅に展開（subtab4 と同じ見え方）、狭幅では縮まず自然幅を保って**横スクロールにフォールバック**。

### 5.2 共通タブ段仕様（`--h-tabrow`・results-regroup と共用）

```css
:root{ …既存トークン…; --h-tabrow:44px }                     /* タブ段の高さ（1段目/2段目/結果発表サブタブ共通） */
@media(min-width:1024px){ :root{ --h-tabrow:48px } }
```

- **数値確定**: 狭幅 **44px**（タッチターゲット下限・現行 mainnav 実測≈41px からの微増）／1024px 以上 **48px**（現行 mainnav の min-height:48 を踏襲）。ダークテーマ側（`html[data-theme="dark"]`）への複製は不要（寸法トークンはテーマ非依存＝`:root` のみ）。
- **共用の約束（並行設計 results-regroup 向け・あちらの設計ファイルは本書から参照するだけで編集しない）**: 結果発表側のタブ段（`.subtab4` およびあちらで新設する段）も `min-height:var(--h-tabrow)`＋縦 padding 0 に揃えること。段の sticky top は固定値でなく `top:calc(50px + var(--h-tabrow) + 1px)`（=ヘッダ50＋1段目タブ＋境界線）を推奨。本件PRでは `.subtab4`/`.result-sticky` に**手を入れない**（現行 `top:95px` は §5.4 の検算どおり整合済み）。

### 5.3 削除（サイドメニュー資産一式）

- `.homegrid`
- `.homemenu` / `.homemenu h2`
- `.hm-item` / `.hm-item:active` / `.hm-item .hm-t` / `.hm-item .hm-d`
- `#navCur{cursor:default}`
- `@media(max-width:760px){ .homegrid{…} }`
- `@media(min-width:1024px){ .hm-item{…} }`
- コメント2箇所を更新: 「主ナビ: …作業画面へはホームの固定メニューから（home-menu.md）」→ 本書参照に、「.chwrap … 右カラム内で50:50」→「全幅で50:50」に。

### 5.4 検算（320px 幅×3言語・縦可視領域・既存 sticky 整合）

**横 @320px**（6タブ・w-bold 800・letter-spacing .02em 込み概算）:

利用可能幅 @320px = 320 − コンテナ padding 24 = 296px。ボタン実幅 = 文字幅 + padding 左右4px。

**≤374px（font 12px・gap 4px・合計 gap 20 + pad 24 = 固定費44px → 文字幅予算 252px）**:

| 言語 | ラベル文字幅（全角=12px/半角≈7.2px） | 合計 | 判定 |
|---|---|---|---|
| ja | 概要24＋基本設定48＋ゲーム設定60＋コース36＋選手24＋スコア36 | 228px | **✓ 296px 内（総計 272px）** |
| zh | 概览24＋基本设置48＋玩法设置48＋球场24＋选手24＋记分24 | 192px | **✓（総計 236px）** |
| en | Guide36＋Setup37＋Games38＋Course44＋Players50＋Scores45 | 250px | **✓ ぎりぎり（総計 294px）** |

**375–1023px（font 13px・gap 6）**: ja 総計≈325px・en≈342px → 375px 以上で全言語収まる ✓。
**≥1024px（font 15px）**: ja≈369px → コンテナ余裕 ✓。

**フォールバック（en @320px が概算より太った場合など）**: `overflow-x:auto` により**折返し・レイアウト破壊なしで横スクロール**（スクロールバー非表示・端のタブが部分見切れ＝スクロール可能のアフォーダンス）。§3.2 の `scrollIntoView` が active タブを常に可視域へ入れる。ラベル短縮・2段折返しは**不採用**（短縮は画面見出しと乖離、折返しは縦を80px超食う）。

**縦（固定領域の増分と可視領域）**: 固定3層 = ヘッダ≈50px＋タブ2段（44+1）×2=90px → **計≈140px**（前: 50＋navバー≈41＋(作業画面では固定なし)≈91px。増分≈49px）。最小級端末 320×568（iPhone SE 初代）でコンテンツ可視 ≈**428px**（カード2枚分・スコア入力の OUT 段が1画面に入る）✓。結果発表表示中はサブタブ非表示＝固定 ≈95px（従来同等）。

**既存 sticky との整合**: 結果発表では subnav が `display:none` になるため navwrap 実効高 = 1段目のみ（50＋44+1=95px）→ `.result-sticky{top:95px}` は狭幅で**ちょうど一致**（無改変で従来どおり）。≥1024px では 50+48+1=99px > 95px となり result-sticky 上端 4px が navwrap 下に潜るが、z-index(15<18)＋`.mainnav` の不透明背景で隠れ、現行（nav 実高≈98px）と同じ挙動＝表示劣化なし。恒久解（`top:calc(50px + var(--h-tabrow) + 1px)` 化）は results-regroup 側の管轄（§5.2）。

## 6. i18n（js/i18n.js・ja/zh/en キー集合一致を維持）

### 6.1 追加（1キー×3言語）

| キー | ja | zh | en |
|---|---|---|---|
| `nav.top` | 概要 | 概览 | Guide |

### 6.2 削除（6キー×3言語＝18エントリ。使用箇所は §4 で消える）

`home.menu`・`home.d.basic`・`home.d.game`・`home.d.course`・`home.d.players`・`home.d.score`

- メニュー説明文（home.d.*）の情報はガイド4ステップ（`home.step1..4`）が既に網羅しており、ユーザーが失う情報はない。ツールチップ化はモバイル主用途で機能しないため不採用（既定として確定）。
- **不変**: `nav.home/basic/game/course/players/score/result`（#61 の値のまま。サブタブ・画面誘導文言の両方で使用継続）・`home.title/lead/step1..4/skip`・`ch.*`・`msg.needGame`・`tab.*`（未使用温存の既存決定 N-4 のまま。`tab.home` は使わない）。
- 正味 **−5キー**。verify.mjs のパリティ・未定義参照チェックで担保。

## 7. 削除資産一覧（残存参照ゼロにすること）

| 種別 | 対象 |
|---|---|
| index.html | `#navCur` ボタン |
| js/nav.js | `WORK_TABS` 定数・render 内 navCur 更新3行 |
| js/home.js | `HOME_MENU` 定数・`mi` テンプレート・`.homegrid`/`.homemenu` ラッパ DOM |
| styles.css | §5.3 の10ルール＋コメント |
| js/i18n.js | §6.2 の6キー×3言語 |

grep 確認語: `navCur` / `WORK_TABS` / `HOME_MENU` / `homegrid` / `homemenu` / `hm-item` / `hm-t` / `hm-d` / `home.menu` / `home.d.` → いずれもアプリコード（index.html/js/**/styles.css）で**0件**になること（docs/** の履歴は残ってよい）。

## 8. 挙動比較（前→後・1行例）

- 起動（seenTop 未設定）: 前=ホーム2カラム（左メニュー）→ 後=上段ホーム点灯＋サブタブ「概要」下線＋ガイド/α:β 50:50 が全幅。
- 起動（seenTop=1）: 前=基本設定＋navCur「基本設定」が上段に出現 → 後=基本設定＋サブタブ「基本設定」下線（**上段タブ列は常に2つのまま**＝指摘の解消点）。
- スコア入力中に Par 修正: 前「ホーム→コース」2タップ → 後 サブタブ「コース」**1タップ**（サブタブ常時表示の利得）。
- 発表→入力修正→発表: 前「ホーム→スコア→結果発表」3タップ → 後「ホーム(=スコアに復帰)→結果発表」**2タップ**（lastHome）。
- 結果発表の投影中: ナビ=「ホーム｜結果発表(下線)」のみ。サブタブ列は非表示＝従来と同じ静けさ（§11.14）。
- 320px・en: 6タブが1行に収まる（§5.4）。仮に収まらない端末でも横スクロールで破綻しない。
- 長いスコア表を下までスクロール: 前=タブ1段のみ残存（作業画面の現在地表示は画面外） → 後=**ヘッダ＋2段タブが固定で残り**、現在地と全導線が常時1タップ圏（追加要件の充足点）。
- リロード: lastHome は消え概要基点に戻る（保存キー増ゼロ・`golfCompe_v1` 不変）。

## 9. 触らない範囲（load-bearing）

§3 計算・`state`/`golfCompe_v1` と localStorage 全キー（**キー追加もなし**・`golfCompe_seenTop` の読み書き含む）・`views` マップと activeTab の値集合・`go()` のシグネチャ・init.js・各画面の中身（renderBasic/renderGame/renderCourse/renderPlayers/renderScore/renderResult と `.subtab4`/`.result-sticky` 一式）・chCard/ALPHA_GAMES/BETA_GAMES・`.chwrap` CSS・script 読込順（CLAUDE.md 変更不要）・inline onclick / 非ESM・ヘッダ（chBadge/テーマ/言語）・`tab.*` キー温存。**並行作業中の js/results.js（results-regroup 設計）には触れない**（共用トークン `--h-tabrow` の適用はあちらの実装時・§5.2）。

## 10. 受け入れ条件

1. `node tools/verify.mjs` 全パス（i18n 3言語キー集合一致・未定義キー参照0・CSS孤立var()なし・計算回帰 #3/Vegas 一致）。
2. ナビが2段構え: 上段=ホーム｜結果発表、下段=概要/基本設定/ゲーム設定/コース/選手/スコアの6サブタブ（結果発表なし）。**どの作業画面を開いても上段タブ列に画面名が出ない**（#navCur 廃止）。
3. サブタブは home/basic/game/course/players/score の全画面で表示され、現在画面が下線 `.on`。結果発表では非表示になり、結果発表側 `.subtab4` の表示・sticky 位置が従来どおり。
4. 上段「ホーム」は activeTab がホーム系のとき下線、結果発表のとき「結果発表」が下線（両方点灯・両方消灯が起きない）。
5. 結果発表→上段「ホーム」で**直前の作業サブタブに復帰**（例: スコア→結果発表→ホーム＝スコア）。リロード後は概要基点。localStorage のキー集合・`golfCompe_v1` の JSON は前後不変。
6. 概要（ホーム）が1カラム全幅: ガイド→α/β解説→α/βカード50:50（560px 以下縦積み）→skip。`.homegrid/.homemenu/.hm-item` が DOM/CSS/JS から消えている（§7 の grep 0件）。
7. **3層固定**: ヘッダ・1段目タブ・2段目サブタブがページスクロールで動かない（縦に長い作業画面を最下部までスクロールして確認）。重なり順は ヘッダ > タブ2段 > 結果発表サブタブ > コンテンツ。
8. **1段目と2段目のタブ段が同一高さ**（`--h-tabrow`: 狭幅44px／1024px以上48px。目視＋DevTools 実測で両段一致）。トークンは `:root` に1箇所定義で、`.mainnav button`/`.subnav button` 両方が参照している。
9. 320px×3言語で折返し・レイアウト崩れなし（ja/zh/en とも §5.4。仮にはみ出す環境では横スクロールで吸収され、active タブが自動で可視域に入る）。320×568 でコンテンツ可視領域 ≈428px を確保（3層固定 ≈140px）。
10. 3言語切替でサブタブ6ラベルが即時追従（静的 data-i18n）。ライト/ダーク両テーマ非破綻。
11. i18n 差分が **+1キー（`nav.top`）/−6キー（§6.2）×3言語**ちょうどで、他キーの値変更なし。

## 11. 推奨PR構成

**1 Issue・1 PR**（files: index.html / js/nav.js / js/home.js / js/i18n.js / styles.css）。分割しない理由: navCur 削除とサブタブ新設は同一機構の差し替えで、分けると中間状態（現在地表示なし）が出荷されるため。**#61（game-split 実装PR）のマージ後に着手**（index.html/nav.js/home.js/i18n.js が競合するため直列。CLAUDE.md「同じファイル群は直列」）。results-regroup（js/results.js）とはファイルが重ならないため並走可。
