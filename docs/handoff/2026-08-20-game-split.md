# 設計：ホームα/β左右均等分割＋ゲーム画面の「基本設定/ゲーム設定」2分割（ドロワー5項目化） — 2026-08-29 確定

対象: `index.html` / `js/nav.js` / `js/init.js` / `js/game.js` / **新規 `js/basic.js`** / `js/home.js` / `js/i18n.js` / `styles.css` / `CLAUDE.md`（読込順の1行）。
**表示・導線のみ**の変更（§3計算・データモデル§4・localStorage キー集合に非接触＝正本 2026-07-12 への追記は不要）。
基準コミット: main=bb9b37e（行番号は全てこの時点）。

## 0. 既存設計との上書き関係（必読）

| 既存節 | 内容 | 本設計での扱い |
|---|---|---|
| `2026-08-20-home-drawer.md` §1・§2.2 | ドロワー項目＝**ゲーム/コース/選手/スコア の4項目固定** | **項目リストを本設計 §4.1 が上書き（5項目化）**。ドロワーの形態（左スライド・揮発・アニメなし・淡色ハイライト）・`#navCur`・2タブ構成・CSS（§5）は全て存続 |
| 同 §3 | `WORK_TABS=['game','course','players','score']` | **本設計 §5.2 が上書き**（basic を先頭に追加） |
| 同 §3 末尾 | 「init.js の `activeTab='game'` 開始もそのまま」 | **本設計 §5.4 が上書き**（`'basic'` へ変更） |
| 正本 §11.12 N（N-1） | ゲームタブのカード構成（選択/新規・基本設定・ペリア・エブリ・採用・ルーレット・ポイント・幹事メニュー） | **カードの所属画面と並びを本設計 §3 が上書き**。各カードの**中身（入力項目・setter・state への書き込み）は不変** |
| `2026-08-20-1on1-match.md`（並行設計・未コミット) | 1 on 1 組合せカードは**選手画面**へ | 非干渉。1on1 の配点（m1win/m1draw）は従来どおり**ポイントカード内**＝本設計でも「ゲーム設定」画面のポイントカードに残る |
| 正本 §11.14 | 投影前提の表示原則 | 本件は**幹事の作業画面**＝大型化不要・通常の作業UIで可（原則3のみ準拠：ドロワー=控えめ・開閉は揮発） |

## 1. 結論サマリ（前→後）

1. **ホーム**: α/β の2枚カード（chcard）を `.rank-wrap`（可変幅 flex・max-width 320px）から**専用 `.chwrap`（grid 1fr 1fr）**へ → 画面幅いっぱいを**左右50:50**（α左・β右）。**560px 以下は縦積み（α上・β下）**。両カードは等高・「この版を使う」ボタンは下端揃え。
2. **ゲーム画面を2分割**:
   - **基本設定**（新 view `basic`・新ファイル `js/basic.js`）＝「どのコンペか」: ゲーム選択/新規カード＋基本設定カード（コンペ名/日付/コース名/削除/複製）＋**幹事メニュー（テストデータ）**。
   - **ゲーム設定**（既存 view `game`・`renderGame` の残り）＝「何をどう集計するか」: **共通設定（ペリア・エブリ）→ 採用フォーマット（fmtgrid）→ 個別設定（ルーレット・Vegas）→ 賞金ポイント配点（最後）**。Vegas 詳細（flip/cap）は fmtgrid カード内から**独立カードへ抽出**（β且つ ON 時のみ表示）。
3. **ドロワー5項目**: **基本設定 → ゲーム設定 → コース → 選手 → スコア**（結果発表は引き続き入れない）。
4. **起動タブ**（seenTop=1 時）: `'game'` → **`'basic'`**（「どのコンペか」から始まる＝従来の初手と同じ体験。`golfCompe_seenTop` キー・値の意味は不変）。
5. i18n: **追加2キー×3言語**（`nav.basic`・`home.d.basic`）、**値のみ変更9キー**（画面名の指し先更新。うち3キーは選手画面への**指し先誤り修正**を兼ねる）。削除0。

## 2. ホーム α/β 50:50（js/home.js＋styles.css）

- **js/home.js 35行**: `<div class="rank-wrap">${chCard('a')}${chCard('b')}</div>` → `<div class="chwrap">${chCard('a')}${chCard('b')}</div>`（変更はラッパの class 名1箇所のみ。chCard 生成・ALPHA_GAMES/BETA_GAMES・seenTop チェックは不変）。
- **styles.css**: `.chcard` ブロック（83–87行）の直後に新設:
```css
/* ホームのα/β 2カラム（左右50:50・560px以下で縦積み。2026-08-20-game-split.md §2） */
.chwrap{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.chwrap>.card{margin-bottom:0;display:flex;flex-direction:column}
.chwrap>.card>div:last-child{margin-top:auto}   /* 「この版を使う」ボタンを下端揃え */
@media(max-width:560px){ .chwrap{grid-template-columns:1fr} }
```
- **設計意図**: grid の既定 stretch で両カード**等高**、ゲーム数の差（α8個/β6個のピル）でボタン位置がズレない。α左・β右は DOM 順（chCard('a') が先）で決まる。縦積み時も α 上（安定版を先に見せる）。ブレークポイントは既存の狭幅境界 560px（styles.css 89行の @media と同値）に合わせる。
- `.rank-wrap`（214行〜）は結果発表で使用中＝**触らない**。`.chcard` 系（枠色・on リング）も不変。
- **前→後の見え方**: 前=両カード max-width:320px で左寄り（広幅では右に余白）→ 後=常に半々でコンテナ幅一杯。

## 3. カード×新画面マッピング（load-bearing な並び）

| # | カード（現 game.js 行） | 前（ゲーム画面） | 後 | 備考 |
|---|---|---|---|---|
| 1 | ゲーム選択/新規（`game.title`・4–11行） | 1番目 | **基本設定 1番目** | そのまま移設 |
| 2 | 基本設定（`game.basic`・16–24行） | 2番目 | **基本設定 2番目** | コンペ名/日付/コース名/削除/複製 |
| 3 | 幹事メニュー（`hostMenuCard`・87,91–97行） | 最後 | **基本設定 最後** | テストデータ投入＝コンペ丸ごと生成なので「どのコンペか」側。`game.emptyCreate` の文言「最下部の幹事メニュー」も引き続き成立 |
| 4 | ダブルペリア設定（`game.periaCard`・26–31行） | 3番目 | **ゲーム設定 1番目（共通設定）** | 係数/上限 |
| 5 | エブリハンデ（`game.everyCard`・33–35行） | 4番目 | **ゲーム設定 2番目（共通設定）** | |
| 6 | 集計する競技（`game.fmtCard`・fmtgrid/bchk・41–55行） | 5番目 | **ゲーム設定 3番目（有効/無効チェック）** | **Vegas 詳細（48–54行）をカード外へ抽出**（→#7b） |
| 7a | ルーレット対抗設定（`game.rlCard`・57–62行） | 6番目 | **ゲーム設定 4番目（個別設定）** | **常時表示**（formats のチェック対象外＝常設ゲームのため。既定として確定） |
| 7b | **Vegas 設定カード（新設・中身は現48–54行そのまま）** | fmtgrid 内 | **ゲーム設定 5番目（個別設定）** | h2=`t('fmt.vegas')`＋`tagbeta`。**`CHANNEL==='b' && F.vegas` の時のみ表示**（=チェックONのゲームのみ表示。既定として確定。setFmt→renderGame 再描画で出没） |
| 8 | 賞金ポイント配点（`prizewin`・64–85行） | 7番目 | **ゲーム設定 最後** | m1win/m1draw 行も従来どおりこのカード内（F.match1v1 時のみ） |

- **個別設定の表示既定**: 「チェックONのみ表示」を採用（Vegas で現行踏襲・カード数を最小に保つ）。ルーレットのみ例外的に常時（チェックボックスが存在しないため隠すと到達不能になる）。今後 β フォーマットに固有設定が増えた場合も同じ規則（ONのみ表示）に従う。
- **セクション見出しは追加しない**（カード h2 で自明・i18n 3キー×3言語の増を回避。既定として確定）。
- **ゲーム未選択時**: 基本設定=現行どおり 選択カード＋`game.emptyCreate`＋幹事メニュー（game.js 14行の分岐を移設）。ゲーム設定=`<div class="empty">${t('msg.needGame')}</div>` のみ（course.js 7行と同型）。

## 4. DOM（index.html）

### 4.1 ドロワー（43–46行の4ボタン→5ボタンに差し替え）
```html
  <button data-tab="basic" onclick="go('basic')"><span class="hl-t" data-i18n="nav.basic">基本設定</span><span class="hl-d" data-i18n="home.d.basic">コンペの作成・選択・日付・コース名</span></button>
  <button data-tab="game" onclick="go('game')"><span class="hl-t" data-i18n="nav.game">ゲーム設定</span><span class="hl-d" data-i18n="home.d.game">ペリア設定・集計するゲーム・賞金ポイント配点</span></button>
  <button data-tab="course" onclick="go('course')">（現行のまま）</button>
  <button data-tab="players" onclick="go('players')">（現行のまま）</button>
  <button data-tab="score" onclick="go('score')">（現行のまま）</button>
```
順序は**基本設定→ゲーム設定→コース→選手→スコア 固定**（ユーザー指定）。course/players/score の3ボタンは無変更。

### 4.2 view コンテナ（50行の前に1行追加）
```html
  <div id="view-basic" style="display:none"></div>
```
（`view-home` と `view-game` の間。表示制御は render() の views ループが担うので位置は表示に影響しないが、タブ順に合わせる。）

### 4.3 script（62行 `js/home.js` の直後に1行追加）
```html
<script src="js/basic.js"></script>
```
新しい読込順: **state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→roulette→backup→init**。verify.mjs は index.html の script タグから動的取得（tools/verify.mjs 16行）なので新ファイルは自動で検査対象に入る。

## 5. JS

### 5.1 新規 `js/basic.js`（game.js 2–24・87・91–97・106–110行の移設）
```js
/* ============================ BASIC SETUP（どのコンペか・2026-08-20-game-split.md） ============================ */
function renderBasic(){
  const el=document.getElementById('view-basic');
  let html = （現 game.js 4–11行の 選択/新規カードをそのまま）;
  const g=curGame();
  if(!g){ el.innerHTML=html+`<div class="empty">${t('game.emptyCreate')}</div>`+hostMenuCard(); return; }
  html += （現 game.js 16–24行の 基本設定カードをそのまま）;
  html += hostMenuCard();
  el.innerHTML=html;
}
function hostMenuCard(){ …（現91–97行をそのまま移設）… }
function createGame(){ … } function selectGame(id){ … } function deleteGame(){ … } function dupGame(){ … }   // 現106–110行を無改変で移設
```
- `setG`/`save`/`curGame`/`seedTestData` 等は**グローバル関数の実行時解決**なのでファイル跨ぎで問題なし（非ESM前提・関数シグネチャ変更なし）。
- `setG('name'|'date'|'course')` の `render()` 呼び（game.js 98行）は基本設定画面の再描画＋ヘッダ `hdrGame` 更新として従来どおり機能する（setG 自体は game.js に残す）。

### 5.2 `js/game.js`（renderGame の縮小＋Vegas 抽出）
- `renderGame()` から 選択/新規カード・基本設定カード・`hostMenuCard()` 呼び・`createGame/selectGame/deleteGame/dupGame/hostMenuCard` 定義を**削除**（basic.js へ）。
- 冒頭を `const g=curGame(); if(!g){ el.innerHTML=`<div class="empty">${t('msg.needGame')}</div>`; return; }` に（course.js 7行と同型）。
- fmtgrid カード（41–55行）の `${(CHANNEL==='b'&&F.vegas)?…:''}` 部分（48–55行）を**独立カードに抽出**して ルーレットカードの後に移動:
```js
  if(CHANNEL==='b' && F.vegas){
    html += `<div class="card"><h2>${t('fmt.vegas')} <span class="tag tagbeta">${t('ch.b')}</span></h2>
      （現48–54行の flip チェック＋cap セレクトをそのまま。囲みの border-top/padding-top の inline style は不要になるので除去）</div>`;
  }
```
- setter 群（setG/setCap/setWE/setFmt/setPoints/setPointsNum/setRoulette/setVegas）は**無改変で game.js に残す**。`setFmt` の `renderGame()` 再呼びが Vegas カードの出没を担う（現行と同じ）。
- カード並びは §3 の表どおり: ペリア→エブリ→fmtgrid→ルーレット→Vegas(条件)→ポイント。

### 5.3 `js/nav.js`（3箇所）
- 2行: `const views = { home:'view-home', basic:'view-basic', game:'view-game', course:'view-course', players:'view-players', score:'view-score', result:'view-result' };`
- 52行: `const WORK_TABS=['basic','game','course','players','score'];`（ドロワー項目＝幹事の作業画面。`#navCur` は既存機構のまま新画面名を表示）
- 62–67行の分岐に追加: `if(activeTab==='basic') renderBasic();`（`if(activeTab==='game')` の直前）。
- drawerToggle/go/render のその他・`SC_NARROW_MQ`（46行・course/score 条件）は不変。

### 5.4 `js/init.js`（8行）
```js
if(seenTop()) activeTab='basic';   // 「次回から表示しない」時は基本設定（どのコンペか）から開始
```
`golfCompe_seenTop` のキー・値・読み書き箇所（home.js 4–5行）は不変。ホーム経由の初期タブ挙動（未設定→home）も不変。

## 6. i18n（js/i18n.js・ja/zh/en キー集合一致を維持）

### 6.1 追加（2キー×3言語）
| キー | ja | zh | en |
|---|---|---|---|
| `nav.basic` | 基本設定 | 基本设置 | Setup |
| `home.d.basic` | コンペの作成・選択・日付・コース名 | 创建・选择比赛・日期・球场名 | Create or pick a competition, date and course name |

（en の navCur 幅検算: "Setup"≈45px → home-drawer §5.3 の式で ☰42+Home49+Results70+Setup65=226+gap18+pad24=268px ✓ @320px。"Basic settings" を採らないのはこの幅制約のため。）

### 6.2 値のみ変更（キー名不変・9キー。※印3キーは選手画面への指し先誤り修正を兼ねる—チーム/参加者は §11.12 N 以降選手画面にある）
| キー | ja 新値 | zh 新値 | en 新値 |
|---|---|---|---|
| `nav.game` | ゲーム設定 | 玩法设置 | Games |
| `home.d.game` | ペリア設定・集計するゲーム・賞金ポイント配点 | 派利亚设置・统计项目・奖金积分配置 | Peria settings, events to score, prize points |
| `msg.needGame` | 先に「基本設定」画面でゲームを作成・選択してください | 请先在「基本设置」页新建或选择比赛 | Create or select a game on the Setup screen first |
| `home.step1` | 「基本設定」でコンペを作成し、「ゲーム設定」で行うゲームやポイントを決めます。コース（パー・隠しホール・ニアピン/ドラコン）は「コース」で設定します。 | 在「基本设置」中创建比赛，在「玩法设置」中选择要进行的游戏和积分。球场（标准杆・隐藏洞・近旗奖/远打奖）在「球场」页设置。 | Create a competition under "Setup" and pick the games and points under "Games". Set the course (pars, hidden holes, NP/LD) under "Course". |
| `standing.noPool` | （賞金総額は「ゲーム設定」画面で入力すると配分額が出ます） | （在「玩法设置」页输入奖金总额后显示分配额） | (Enter a prize pool on the Games screen to see payouts) |
| `team.emptyFmt` | 「ゲーム設定」画面の「集計する競技」でチーム戦の項目をONにしてください。 | 请在「玩法设置」页的「统计项目」中开启团队赛项目。 | Turn on team events under "Events to score" on the Games screen. |
| ※`score.pickParts` | 「選手」画面で参加者を選んでください | 请在「选手」页选择参赛者 | Pick participants on the Players screen |
| ※`team.emptyTeams` | 「選手」画面でチームを作成し、メンバーを割り当ててください。 | 请在「选手」页创建队伍并分配成员。 | Create teams and assign members on the Players screen. |
| ※`rl.need2` | 2チーム以上が必要です。「選手」画面でチームを作成してください。 | 需要2支以上队伍。请在「选手」页创建队伍。 | Needs 2+ teams. Create them on the Players screen. |

- 削除: 0キー。`game.title`/`game.basic`/`game.emptyCreate`/`host.*`/`game.fmtCard`/`game.rlCard`/`game.ptsCard`/`fmt.vegas`/`vegas.*` は**値も含め不変**（basic/game 両画面で再利用）。`tab.*` は未使用のまま温存（N-4 決定踏襲・`tab.basic` は追加しない）。

## 7. CLAUDE.md（読込順の1行のみ・PR-② に含める）
「★load-bearing」節の読込順: `（state→i18n→nav→home→players→game→…）` → `（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→roulette→backup→init）` に更新。他の記述は変更しない。

## 8. 挙動比較（前→後・1行例）

- 起動（seenTop=1）: 前=ゲーム画面（選択+全設定が1画面）→ 後=**基本設定**画面＋navCur「基本設定」点灯。コンペを選ぶ初手は同じ。
- コンペ名を直したい: 前「☰→ゲーム」→ 後「☰→基本設定」。入力欄・保存（setG→save）は完全一致。
- ペリア係数を変えたい: 前「☰→ゲーム（2枚スクロール）」→ 後「☰→ゲーム設定（先頭カード）」。
- Vegas ON: 前=fmtgrid カード下部に詳細が展開 → 後=fmtgrid の下・ルーレットの次に**独立カード**が出現。OFF で消える（前と同じ揮発表示・g.vegas の値は保持）。
- テストデータ投入: 前「ゲーム画面最下部」→ 後「基本設定画面最下部」（`game.emptyCreate` の案内どおり）。
- ホーム: 前=α/βカードが最大320pxで左寄せ → 後=画面幅50:50（560px以下で縦積み）。ボタン位置が両カードで揃う。
- localStorage: 前後で**キー集合・`golfCompe_v1` の JSON とも完全一致**（activeTab は非保存の揮発変数）。

## 9. 触らない範囲（load-bearing）

§3 計算（calc.js/results.js/roulette.js）・`state` 構造/`newGame()` の既定値・localStorage 全キー（追加もなし）・`golfCompe_seenTop` の読み書き・setter 群のシグネチャと保存内容・fmtgrid のチェック項目/bchk の β 出し分け・ポイントカードの行構成（m1win/m1draw 含む）・ドロワーの形態/CSS（home-drawer §5）・`#mainNav` 2タブ・ヘッダ・course/players/score/result 画面・**js/course.js・js/testdata.js（並行作業中）**・inline onclick / 非ESM・`.rank-wrap`（結果発表用）。

## 10. 受け入れ条件

1. `node tools/verify.mjs` 全パス（新 basic.js 含む構文・i18n 3言語キー集合一致・未定義キー参照0・CSS孤立var()なし・計算回帰 #3/Vegas 一致）。
2. ドロワーが上から**基本設定/ゲーム設定/コース/選手/スコア**の5項目（結果発表なし）。各項目タイトル＋説明の2行・現在地の淡色ハイライト・遷移で自動クローズ（3言語でラベル追従）。
3. 基本設定画面＝ゲーム選択/新規・コンペ名/日付/コース名・削除/複製・幹事メニュー（最下部）。ゲーム未選択時は選択カード＋`game.emptyCreate`＋幹事メニュー。
4. ゲーム設定画面の並びが**ペリア→エブリ→集計する競技→ルーレット→（β且つVegas ON時のみ）Vegas→賞金ポイント配点（最後）**。ゲーム未選択時は `msg.needGame`（基本設定画面へ誘導する新文言）のみ。
5. Vegas チェック OFF→ON でカード出現・ON→OFF で消滅、flip/cap の値は g.vegas に保持（前と同じ）。α版では Vegas トグル自体が非表示（bchk・前と同じ）。
6. seenTop=1 起動で基本設定画面＋navCur「基本設定」。navCur は 5 画面すべてで画面名を表示、ホーム/結果発表で非表示。320px 幅 ja/zh/en でナビ折返しなし。
7. ホームの α/β カードが広幅で左右50:50（α左・β右）・等高・ボタン下端揃え、560px 以下で縦積み（α上）。`ch.enter`/`ch.current` の動作不変。
8. localStorage のキー集合・`golfCompe_v1` の JSON が操作前後で不変。テストデータ投入が基本設定画面から従来どおり動く。
9. 移設した関数群（createGame/selectGame/deleteGame/dupGame/hostMenuCard）が basic.js に**無改変**で存在し、game.js に重複定義が残っていない（グローバル二重定義なし）。
10. CLAUDE.md の読込順の記述が新 script 順と一致。

## 11. 推奨PR分割（1 Issue・2PR。触るファイルが重ならないため並走可）

1. **PR-① ホーム50:50**（小・先行可）: js/home.js（class 1箇所）＋styles.css（`.chwrap` 新設）。
2. **PR-② 画面分割本体**: index.html（ドロワー5項目・view-basic・script 追加）・js/basic.js（新規）・js/game.js（縮小＋Vegas 抽出）・js/nav.js（views/WORK_TABS/分岐）・js/init.js（'basic'）・js/i18n.js（§6）・CLAUDE.md（§7）。
