# 設計：トップナビ2タブ化（ホーム・結果発表）＋ドロワーメニュー — 2026-08-29 確定

対象: `index.html` / `js/nav.js` / `js/home.js` / `js/i18n.js` / `styles.css`。**表示・導線のみ**の変更（§3計算・データモデル §4 非接触＝正本 2026-07-12 への追記は不要）。
基準コミット: main=44ba6a6（行番号は全てこの時点）。

## 0. 既存設計との上書き関係（必読）

| 既存節 | 内容 | 本設計での扱い |
|---|---|---|
| 正本 §11.12 E | ☰＝マスター系のみ・スコア/結果を主ナビへ | **失効済み**（L で失効）。参考のみ |
| 正本 §11.12 L | ☰ハンバーガー＋`#appMenu` ポップアップを**廃止**して5タブ化 | **タブ構成の規定を本設計が上書き**。L のうち「chBadge をヘッダタイトル右へ」「ヘッダ右=テーマ→言語」「nav.score=『スコア』」は**存続**。「☰廃止」は本設計で**別形態（左スライドのドロワー）として再導入**＝旧 appmenu（右上ポップアップ・青ベタ塗り active）の単純復活ではない |
| 正本 §11.12 N | 6タブ化（ゲーム→コース→選手→スコア→結果→ホーム）＋狭幅ナビ圧縮（N-3） | **タブ構成と N-3 の狭幅 CSS を本設計が上書き**。N のカード再配置（N-1/N-2）・js/course.js・`msg.needGame` 等の画面構成は**全て存続**（画面の中身は不変） |
| #45（S・eb51d9e） | ホームタブ先頭へ・「結果」→「結果発表」改称 | **存続**（2タブでも ホーム→結果発表 の順・ラベル継承） |
| 正本 §11.14 | 投影前提の表示原則 | **準拠**: 結果発表は上部タブに常設（投影運用で迷わない）／ドロワー＝幹事用で控えめ（原則3）／開閉状態は揮発（原則4） |

## 1. 結論サマリ（前→後）

- **前**: `#mainNav` ＝ ホーム｜ゲーム｜コース｜選手｜スコア｜結果発表 の6タブ。ホームにリンクカード5枚（home.d.*）。
- **後**: `#mainNav` ＝ **［☰］ホーム｜結果発表｜（現在地）** の2タブ＋2補助ボタン。
  - **☰（`#menuBtn`）**: ナビ左端に常時表示（全画面共通・結果発表でも表示）。押すと**左からのドロワー `#appDrawer`**＋薄暗オーバーレイが開く。
  - **ドロワー項目（上から4つ・固定）**: ゲーム / コース / 選手 / スコア。各項目は**タイトル＋説明の2行**（説明は既存 `home.d.*` を再利用）。**結果発表は入れない**（発表導線＝上部タブと分離）。
  - **現在地タブ（`#navCur`）**: 作業画面（game/course/players/score）表示中のみ、「結果発表」の右に現在画面名を**アクティブ下線つき**で表示。押すとドロワーが開く（作業画面間の横移動）。ホーム/結果発表では非表示。
  - **戻り導線**: 上部「ホーム」タブ（sticky で常時見えている）。作業画面では ホーム/結果発表 タブは非点灯・`#navCur` のみ点灯。
  - **ホーム**: リンクカード群（メニューカード）を**削除**し、ガイドカード末尾に「☰ メニュー」ワイドボタンを1個追加（初見者の入口）。ガイド・α/βカード・skip チェックは不変。
  - **開閉状態は揮発**（`style.display` のみ。localStorage に一切保存しない・リロードで閉）。**アニメーションなし**（旧 appmenu と同じ display 切替。既定として確定）。

## 2. DOM（index.html）

### 2.1 `#mainNav`（34–41行を差し替え）
```html
<nav id="mainNav" class="mainnav">
  <button id="menuBtn" class="menubtn" onclick="drawerToggle()" data-i18n-title="home.menu">☰</button>
  <button data-tab="home" onclick="go('home')" data-i18n="nav.home">ホーム</button>
  <button data-tab="result" onclick="go('result')" data-i18n="nav.result">結果発表</button>
  <button id="navCur" style="display:none" onclick="drawerToggle()"></button>
</nav>
```
- game/course/players/score の4ボタンを**削除**。`#navCur` は data-i18n を持たない（テキストと `data-tab` は render() が毎回設定）。
- `data-i18n-title="home.menu"` → applyStaticI18n が title＋aria-label を設定（chBadge と同パターン）。

### 2.2 ドロワー（`</nav>` 直後・`<main>` の前に新設）
```html
<div id="drawerOverlay" class="drawer-overlay" onclick="drawerToggle(false)"></div>
<nav id="appDrawer" class="drawer">
  <div class="drawer-h" data-i18n="home.menu">メニュー</div>
  <button data-tab="game" onclick="go('game')"><span class="hl-t" data-i18n="nav.game">ゲーム</span><span class="hl-d" data-i18n="home.d.game">コンペ作成・ゲーム選択・ポイント設定</span></button>
  <button data-tab="course" onclick="go('course')"><span class="hl-t" data-i18n="nav.course">コース</span><span class="hl-d" data-i18n="home.d.course">パー・隠しホール・ニアピン/ドラコン対象ホール</span></button>
  <button data-tab="players" onclick="go('players')"><span class="hl-t" data-i18n="nav.players">選手</span><span class="hl-d" data-i18n="home.d.players">選手の登録・参加者とチームの設定</span></button>
  <button data-tab="score" onclick="go('score')"><span class="hl-t" data-i18n="nav.score">スコア</span><span class="hl-d" data-i18n="home.d.score">ラウンド中の打数入力</span></button>
</nav>
```
- 順序は**ゲーム→コース→選手→スコア 固定**（ユーザー指定）。閉じる手段＝項目選択（go 内で閉）／オーバーレイタップ／☰ 再押下。専用✕ボタンは置かない（旧 appmenu と同様・最小構成）。
- `<main>`（view-* 6個）・script 読込順は**一切変更しない**。

## 3. JS（js/nav.js のみ・3箇所）

1. **`drawerToggle` 新設**（旧 toggleMenu＝21f23f6~1 の nav.js 48–50行と同型・id だけ差し替え）:
```js
function drawerToggle(force){ const d=document.getElementById('appDrawer'), o=document.getElementById('drawerOverlay');
  const open = (force!==undefined)? force : (d.style.display!=='block');
  d.style.display=open?'block':'none'; o.style.display=open?'block':'none'; }
```
   開閉状態は DOM の style.display のみ＝**揮発**（§11.14 原則4。localStorage・state 非接触）。
2. **`go()`（48行）**: `function go(tab){ rlStopTimer(); drawerToggle(false); activeTab=tab; render(); }`（旧 L 以前の `toggleMenu(false)` と同じ位置に1呼び出し追加。activeTab→render の切替機構そのものは不変）。
3. **`render()`（53行付近）**: 既存の `.on` トグル行の**直前**に現在地タブ更新を追加し、セレクタを拡張:
```js
const WORK_TABS=['game','course','players','score'];   // ドロワー項目＝幹事の作業画面（トップレベル const・53行の外でも可）
const nc=document.getElementById('navCur'), isWork=WORK_TABS.includes(activeTab);
nc.style.display=isWork?'':'none'; nc.dataset.tab=isWork?activeTab:''; if(isWork) nc.textContent=t('nav.'+activeTab);
document.querySelectorAll('#mainNav button,#appDrawer button').forEach(b=>b.classList.toggle('on', b.dataset.tab===activeTab));
```
   - `#navCur` は `data-tab=activeTab` を持つので既存トグルで自動点灯。ホーム/結果発表では `data-tab=''` ＋非表示。`#menuBtn` は data-tab なし＝点灯しない。言語切替は setLang→render 経由でラベル追従（i18n.js 386–392行・不変）。
- **変更しないもの**: `views` マップ・`activeTab` 初期値・`SC_NARROW_MQ` リスナ（46行・course/score 条件のまま有効）・rlStopTimer・render() の各 renderXxx 分岐・init.js（`seenTop()` で `activeTab='game'` 開始も**そのまま**＝起動直後から `#navCur`「ゲーム」が点灯表示され成立する）。

## 4. js/home.js（2箇所削除＋1行追加）

- **削除**: `link` ヘルパ（13–14行）と「メニュー」カード（32–38行の `<div class="card"><h2>${t('home.menu')}</h2><div class="homelinks">…</div></div>` 全体）。
- **追加**: ガイドカード（hometop）の `</ol>` 直後に `<div class="mt10"><button class="btn sec wide" onclick="drawerToggle(true)">☰ ${t('home.menu')}</button></div>`（初見者向けの入口。新規 i18n キー不要）。
- ALPHA_GAMES/BETA_GAMES・chCard・seenTop チェックは**不変**。

## 5. CSS（styles.css）

### 5.1 削除
- `.homelinks`（69行）/ `.homelink`（70–71行）/ `.homelink .hl-t`（72行）/ `.homelink .hl-d`（73行）＝ホームのリンクカード廃止に伴う孤立CSS。
- `@media(max-width:560px)` 内の `.homelinks{grid-template-columns:1fr}`（80行）と `.mainnav{padding:0 6px;gap:2px} .mainnav button{padding:11px 5px;font-size:12px;letter-spacing:0}`（83行）＝ N-3 の6タブ圧縮ルールは2タブ化で不要（基準 padding に戻す）。同 media 内の `header .gamename` / `.hdrsel` は**残す**。
- 59行のコメント「…6タブ常時表示（☰は廃止）」→「☰ドロワー（作業4画面）＋ホーム/結果発表の2タブ＋現在地 #navCur（本ファイル＝2026-08-20-home-drawer.md）」に更新。

### 5.2 新設（mainnav ブロックの直後に追加）
```css
/* ドロワー（幹事の作業導線・§11.14 原則3。開閉は揮発＝JSが display 切替・アニメなし） */
.mainnav .menubtn{font-size:18px;padding:9px 12px;color:var(--strong);line-height:1}
.drawer-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:35}
.drawer{display:none;position:fixed;left:0;top:0;bottom:0;width:min(78vw,300px);background:var(--card);
  border-right:1px solid var(--line);box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:40;padding:10px;overflow-y:auto}
.drawer-h{font-family:"Noto Serif JP","Noto Serif",serif;font-size:var(--f-title);font-weight:700;color:var(--strong);
  padding:6px 8px 10px;border-bottom:1px solid var(--line);margin-bottom:8px}
.drawer button{display:flex;flex-direction:column;gap:3px;width:100%;text-align:left;border:0;background:var(--card);
  border-radius:var(--r-sm);padding:12px 10px;cursor:pointer}
.drawer button .hl-t{font-size:var(--f-title);font-weight:var(--w-bold);color:var(--strong)}
.drawer button .hl-d{font-size:var(--f-small);color:var(--sub);line-height:1.4}
.drawer button.on{background:var(--hl-bg)}
.drawer button.on .hl-t{color:var(--prid)}
@media(min-width:1024px){ .drawer{width:300px} .drawer button{padding:14px 12px} .mainnav .menubtn{min-height:48px;min-width:48px} }
```
- **設計意図**: active は旧 appmenu の「青ベタ塗り（--pri 塗り＋白文字）」ではなく**淡色ハイライト（--hl-bg）＋濃青文字**＝§11.4/§11.8 の「面に濃色ベタ塗りしない」トーンに整合。hl-t/hl-d のクラス名は旧 homelink から**ドロワー配下のセレクタとして引き継ぎ**（トークンのみ使用＝ライト/ダーク自動反転）。
- z-index 検算: header=20 ＜ mainnav=18 ＜ overlay=35 ＜ drawer=40 ＜ toast=50 → ドロワーはヘッダごと覆い、トーストは最前面のまま。
- `.mainnav .menubtn` は `.mainnav button` 基本則（62–63行）を継承しつつ specificity(0,2,0) でサイズ上書き（@1024 の `.mainnav button{font-size:15px}` にも勝つ）。

### 5.3 幅の検算（320px・基準 padding 11px 10px / 13px に復帰後）
- ja 最悪（作業画面中）: ☰(≈42)＋ホーム(2字26+20=46)＋結果発表(4字52+20=72)＋navCur最長「スコア」(3字39+20=59) ≈ 219＋gap6×3=18＋左右24 ≈ **261px ✓**
- en 最悪: ☰42＋Home(≈49)＋Results(≈70)＋Players(≈70) ≈ 231＋18＋24 ≈ **273px ✓**（zh はさらに短い）
- ドロワー @320px: min(78vw,300px)=249px → 右に 71px のオーバーレイ帯が残り「外タップで閉じる」が成立 ✓

## 6. i18n（js/i18n.js・ja/zh/en キー集合一致を維持）

- **追加: 0キー**（ドロワー見出し・☰の title＝既存 `home.menu`、項目＝既存 `nav.*`＋`home.d.*` を再利用）。
- **削除: 1キー×3言語** — `home.d.result`（ja 13行「順位・チーム戦・ルーレット・ポイント配分」/ zh 135行「排名・团队赛・轮盘・积分分配」/ en 257行「Rankings, team matches, roulette, point payouts」）。ホームのリンクカード廃止で唯一の使用箇所（home.js 37行）が消えるため。`home.menu`・`home.d.game/course/players/score`・`nav.*`・`tab.*`（未使用だが N-4 の決定どおり温存）は**残す**。
- **値のみ変更（キー名不変）** — 旧タブ（game/course/players/score）を「〜タブ」と呼ぶ文言を「〜画面」へ。**ja 11キー / en 9キー / zh 0キー**（zh は元から「页/画面」表記のため変更不要。「結果タブ/個人戦タブ」系はタブのまま正なので対象外）:

| キー | ja 新値 | en 新値 |
|---|---|---|
| msg.needGame | 先に「ゲーム」画面でゲームを作成・選択してください | Create or select a game on the Game screen first |
| game.everyNote | 適用ON時、各選手の`<b>`エブリ区分`</b>`（選手画面で設定）に応じてE1=−18/E2=−36を差し引きます。グロス個人戦・ネット個人戦の両方に反映。 | When on, E1=−18 / E2=−36 is deducted per each player's `<b>`handicap type`</b>` (set on the Players screen), applied to both gross and net rankings. |
| score.pickParts | 「ゲーム」画面で参加者を選んでください | Pick participants on the Game screen |
| standing.noPool | （賞金総額は「ゲーム」画面で入力すると配分額が出ます） | (Enter a prize pool on the Game screen to see payouts) |
| m1.need2Teams | メンバーのいるチームがちょうど2チーム必要です（選手画面で2チームに分けてください） | （変更なし・tab 表記なし） |
| prize.emptyCfg | 「ゲーム」画面で対象ホールを設定してください。 | Set target holes on the Game screen. |
| team.emptyTeams | 「ゲーム」画面でチームを作成し、メンバーを割り当ててください。 | Create teams and assign members on the Game screen. |
| team.emptyFmt | 「ゲーム」画面の「集計する競技」でチーム戦の項目をONにしてください。 | Turn on team events under "Events to score" on the Game screen. |
| rl.need2 | 2チーム以上が必要です。「ゲーム」画面でチームを作成してください。 | Needs 2+ teams. Create them on the Game screen. |
| home.step3 | ラウンド中は「スコア」に打数を入れていきます。 | Enter strokes under "Scores" as the round progresses. |
| home.step4 | 「結果発表」で順位・チーム対抗・ルーレット・ポイント配分を表示します（1ホールずつ開封する表彰式リビールも可能）。 | （変更なし・既に "Results"） |

（zh の該当キーは全て現行値のまま。home.step3 zh「记分」/step4 zh「结果」も nav ラベルと整合済み）

## 7. 挙動比較（前→後・1行例）

- 起動（初回・seenTop 未設定）: 前後ともホーム。前=タブ6本＋リンクカード5枚 → 後=タブ2本＋☰、ガイドカード末尾に「☰ メニュー」ボタン。
- 起動（seenTop=1）: 前=ゲームタブ点灯でゲーム画面 → 後=ゲーム画面＋ナビ「☰｜ホーム｜結果発表｜**ゲーム**(下線)」（init.js 不変で成立）。
- Par を変えたい: 前「コースタブをタップ」→ 後「☰ →（2番目）コース」。画面内容・保存は完全一致。
- スコア画面から発表へ: 前後とも上部タブ「結果発表」1タップ（不変）。発表から入力修正へ: 後は「☰ → スコア」（結果発表画面でも☰は左端に控えめ表示）。
- ドロワーを開いたままリロード: 閉じた状態で起動（揮発・保存キー増ゼロ）。
- 結果発表の投影中: ナビは「☰｜ホーム｜結果発表(下線)」のみ＝前（6タブ）より画面上部が静かになる。§11.14 に沿い改善方向。

## 8. 触らない範囲（load-bearing）

§3 計算・`state`/`golfCompe_v1` と localStorage 全キー（**キー追加もなし**）・`views` マップと activeTab/render の切替機構・各画面の中身（renderGame/renderCourse/renderPlayers/renderScore/renderResult/renderHome のガイド＋チャネル部）・script 読込順・inline onclick 方式（ESM化しない）・ヘッダ（K/L の構成・chBadge）・結果発表のサブタブ・機能色・`tab.*` キーと tabLabel（未使用のまま温存）。

## 9. 受け入れ条件

1. `node tools/verify.mjs` 全パス（i18n 3言語キー集合一致・未定義キー参照0・CSS孤立var()なし・計算回帰 #3/Vegas 一致）。
2. ナビが「☰｜ホーム｜結果発表」になり、☰でドロワー開閉。項目は上から**ゲーム/コース/選手/スコア**の4つ（結果発表なし）。項目タップで遷移＋自動クローズ、オーバーレイタップ・☰再押下でクローズ。
3. 作業画面で `#navCur` が現在画面名＋下線で表示され、タップでドロワーが開く。ホーム/結果発表では非表示。ホーム/結果発表タブの点灯は自画面のみ。
4. ドロワー内の現在画面項目が淡色ハイライト（青ベタ塗りでない）。ライト/ダーク両テーマで非破綻。
5. seenTop=1 起動でゲーム画面＋navCur「ゲーム」点灯。ルーレット回転中に go() でタイマー停止（従来どおり）。
6. リロードでドロワーは閉。localStorage のキー集合が前後で不変（`golfCompe_v1` の JSON も不変）。
7. ホームからリンクカード群が消え、「☰ メニュー」ボタンからドロワーが開く。ガイド4ステップ・α/βカード・skip は従来どおり。
8. 320px 幅（ja/zh/en）でナビ折返し・横スクロールなし、ドロワー右にオーバーレイ帯が残る。1024px で ☰/タブ min-height:48px・ドロワー項目のタッチ余裕。
9. `homelinks`/`homelink`・`home.d.result`・N-3 の狭幅 mainnav 圧縮ルールへの参照が index.html/js/styles.css から消えている（孤立CSS/デッドコードなし）。

## 10. 推奨PR分割（1 Issue・2PR。まとめて1PRでも成立）

1. **PR-① ドロワー化本体**: index.html（ナビ差し替え＋ドロワーDOM）・js/nav.js（drawerToggle/go/render）・js/home.js（カード削除＋☰ボタン）・styles.css（§5）・i18n `home.d.result` 3言語削除。
2. **PR-② 文言ポリッシュ**（PR-①マージ後・値のみ）: §6 の表（ja 11 / en 9 キー）。verify のキー集合は不変のため独立レビュー可。
