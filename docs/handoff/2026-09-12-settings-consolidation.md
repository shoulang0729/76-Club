# 設計：設定画面の再編（ゲーム設定→基本設定の統合／タブ名を画面見出しへ／サブタブ改称） — 2026-09-12

- 作成: 2026-09-12 / architect
- **区分: 確定**（§0 に確認事項5件。**いずれも既定案つき＝既定のまま実装してよい**）
- **サイズ判定: L**（**`views` とタブ構成に触れる**＝CLAUDE.md「タブ/モジュール構成に触れるものは必ず M/L」。加えて i18n キー −1×3言語）
- **モック: あり**（§6.4 に実ブラウザで合成した静止モックのパス。`/feature` 手順 1.5 の承認材料）
- 基準コミット: `8cc08e0`（main・2026-09-12。#170 見出し廃止／#172／#174／#175 取り込み済み）
- 先に読むこと:
  - `docs/handoff/2026-08-20-home-subtabs.md`（**ホーム配下サブタブの正本**。§2 構成／§3.2 `render()`／§3.3 `lastHome`／§5 CSS）
  - `docs/handoff/2026-09-12-result-heading-unify.md`（**直前の方針**。§3.4 が「ホーム配下は対象外」と明記した回。本書 §4 がその続きを決める）
  - 正本 `docs/handoff/2026-07-12-golf-compe-web.md` §11.12（リニューアル設計）・§11.14（投影原則）
  - `docs/handoff/2026-08-20-game-split.md`（basic / game の**分割**を決めた回。本書はその**逆操作**にあたる）
- 実測環境: Chromium 141（`/opt/pw-browsers/chromium-1194`）／`python3 -m http.server`／テストデータ①個人戦フル（12名）。
  **Google Fonts は遮断**して測定（本番は Noto 系。行高は `line-height:1.45` とトークンで決まるため段組み・総高への影響は軽微。±数 px の誤差を含む値として読むこと）

---

## 0. PM への確認事項（一括・既定案のまま進めてよい）

| # | 論点 | **既定案（これで実装する）** | 差し戻しコスト |
|---|---|---|---|
| **Q1** | 統合後のサブタブ名（ja） | **「コンペ設定」**（基本設定＋ゲーム設定の統合先）。`nav.basic` の**値だけ**変更 | i18n 1キーの値のみ＝1行 |
| **Q2** | 「概要」タブの改称 | **「ガイド」**（zh 指南 / en Guide は現状のまま）。en が既に `Guide` で ja/zh だけ「概要/概览」とズレているのを揃える | 同上 |
| **Q3** | 統合後に**折りたたみ**を入れるか | **入れる**（§3.2）。入れないと 1024px で **3,174px＝5.2画面分**になる（§3.3 実測）。折りたたみ後 **1,600px＝2.6画面分** | 大（構成の骨格） |
| **Q4** | 「集計する競技」カードを折りたたむか | **折りたたまない**（常時展開。統合タブの主役＝画面の正体を示すカード） | 小（`<details>` で包むだけ） |
| **Q5** | #166 の扱い | **①（日付/コース重なり）と③（バックアップ移動）は本件に吸収、②（テーマのアイコン化）は別PRで後追い**（§7） | 中（Issue 再編のみ） |

> **確認待ちで止めない。** 上表の既定案で §3〜§9 を書き切ってある。PM が Q1/Q2 を変えたい場合は §5.1 の表の値を差し替えるだけで他節に波及しない。

---

## 1. 結論サマリ（前→後）

| # | 論点 | 決定 | 節 |
|---|---|---|---|
| 1 | ゲーム設定タブの統合先 | **基本設定タブの末尾**（ゲーム選択 → 大会情報 → 集計する競技 → 各セクション → 幹事メニュー） | §3.2 |
| 2 | `renderGame()` の扱い | **`gameSettingsHtml(g)` へ改名し HTML 文字列を返す純関数化**。`js/game.js` は**残す**（モジュール分割維持・`<script>` 読込順不変）。呼び出し元は `js/nav.js` の `render()` と `js/game.js` 内の4つの setter のみ＝全て `renderBasic()` に付け替え | §3.5 |
| 3 | 縦の長さ | 折りたたみ**必須**。全開 3,174px → 既定（全セクション閉）**1,600px**（1024px 幅・β全部ON＝最悪ケース） | §3.3 |
| 4 | 折りたたみの仕組み | 既存の `<details>` スタイルを**そのまま流用**（新規 CSS は summary の見出し化 1 行のみ）。開閉は**揮発変数 `gsOpen`** で再描画をまたいで記憶（localStorage 非保存） | §3.2 / §3.4 |
| 5 | `views` / `index.html` | `views` から `game` を削除、`<div id="view-game">` を削除、`#homeSub` の `<button data-tab="game">` を削除。`render()` の `if(activeTab==='game')` 行を削除 | §3.5 |
| 6 | `lastHome` | **変更不要**。`activeTab` が `'game'` になる経路が消えるだけ。**ただし `lastHome`／`activeTab` に 'game' が残ると `render()` が例外**（実測で再現・§3.5-C） | §3.5 |
| 7 | `golfCompe_seenTop` | **影響なし**。`init.js` の `if(seenTop()) activeTab='basic'` は統合後も有効（むしろ「起動即・全設定が1画面」になり意図に合致）。localStorage キーは**5つのまま** | §3.6 |
| 8 | **要件2の結論** | **ホーム配下は `<h2>` を残す。そのうえで「選択中サブタブを見出しサイズに拡大」方式は採用する**（結果発表と同じ原則を、別の理由で適用する） | **§4.1** |
| 9 | 要件2の CSS | `.subnav button.on{font-size:15px}` ＋ `@media(min-width:1024px){.subnav button.on{font-size:17px}}`。`#view-result .subtab4 button.on` の 15/17px と**同値**（同じ第2階層タブだから） | §4.2 |
| 10 | 行のガタつき | **起きない**（実測）。`.subnav button{height:var(--h-tabrow)}` は `min-height` ではなく**固定 height**＝font-size に非依存。段高 45px（<1024）/ 49px（≥1024）が全ケースで一定 | §4.3 |
| 11 | 要件3の名称 | ガイド / **コンペ設定** / コース / 選手・チーム / スコア（5本）。「基本」を外し、上段「ホーム」との階層混同を断つ | §5.1 |
| 12 | i18n | **新規0・削除1キー×3言語（`nav.game`）**・**値変更7キー**（`nav.top` `nav.basic` `game.basic` `msg.needGame` `home.step1` `result.noIndGame` `standing.noPool` `m1.emptyFmt` のうち言語別に該当するもの）。未使用キー0を維持 | §5.2 |
| 13 | 計算 | **`js/calc.js` を1行も触らない**。`setG/setFmt/setPoints/...` の**シグネチャも保存内容も不変**（再描画先の関数名が変わるだけ） | §11 |
| 14 | #166 | **①③を本件に吸収・②は後追いPR**。`js/basic.js` を全面書き換えするため①③を別PRにすると確実に衝突する | §7 |

---

## 2. 現状（コード＋実ブラウザ実測）

### 2.1 タブ構成（`2026-08-20-home-subtabs.md` §2 の現行形）

```
[ ホーム | 結果発表 ]                       ← .mainnav（1段目・--h-tabrow）
[ 概要 | 基本設定 | ゲーム設定 | コース | 選手・チーム | スコア ]   ← #homeSub .subnav（2段目・--h-tabrow）
```

- `views = { home, basic, game, course, players, score, result }`（`js/nav.js:2`）と `index.html` の `<div id="view-*">` が 1:1。
- `#homeSub` の各ボタンは inline `onclick="go('<tab>')"` ＋ `data-i18n="nav.<key>"`（静的 DOM）。
- 選択中は `.subnav button.on{color:var(--strong);border-bottom-color:var(--pri)}` ＝**色と下線のみ。フォントサイズは非選択と同じ**（13px／≥1024px で 15px／≤374px で 12px）。

### 2.2 `renderBasic()`（`js/basic.js`）が描くもの — 3ブロック

| # | 要素 | 条件 | 中身 |
|---|---|---|---|
| B1 | `.card` `h2=game.title`「ゲーム（コンペ）」 | 常時 | `<select id="gameSel">`＋「＋新規」 |
| B2 | `.card` `h2=game.basic`「基本設定」 | ゲーム選択時 | コンペ名／日付／コース（`.row` 2カラム）／削除・複製 |
| B3 | `<details>` `summary=host.summary`「幹事メニュー」 | 常時 | テストデータのパターン選択＋生成 ＋ **`auditCard()`（`<details summary=audit.summary>`「データ点検」・#171 PR2 で追加）が入れ子で入っている** |

ゲーム未選択時は B1 ＋ `.empty`（`game.emptyCreate`）＋ B3。

### 2.3 `renderGame()`（`js/game.js`）が描くカード — **全8枚**（★要件1-1 の棚卸し）

| # | カード（`h2` キー） | 表示条件 | 中身の要点 | 統合後の置き場所（§3.2） |
|---|---|---|---|---|
| G0 | （`.empty` `msg.needGame`） | **ゲーム未選択** | 「先に基本設定でゲームを作成」 | **削除**（統合後は B1 直下の `game.emptyCreate` が同じ役割。`msg.needGame` キー自体は course.js / players.js が使い続けるので**残す**） |
| G1 | `game.periaCard`「ダブルペリア設定」 | 常時 | 係数／HDCP上限／ダブルパーカット／マイナス許可 | **§S4 `<details class="gsec">`** |
| G2 | `game.everyCard`「エブリハンデ」 | 常時 | 適用チェック＋注記 | **§S5 `<details class="gsec">`** |
| G3 | `game.kanjiCard`「次回幹事」 | 常時（サブ設定は ON 時のみ） | バッジ表示トグル＋対象順位3行＋方向select | **§S8 `<details class="gsec">`** |
| G4 | `game.fmtCard`「集計する競技」（β時は `tagbeta` 併記） | 常時 | 個人戦7・チーム戦10のチェックボックス群（`.fmtgrid`・`h3` で個人戦/チーム戦に区切り） | **§S3 `.card`（常時展開・折りたたまない）** |
| G5 | `game.rlCard`「ルーレット対抗」 | `F.roulette` | チェンジ/チャレンジ回数 | **§S6a `<details class="gsec">`** |
| G6 | `fmt.vegas`「ラスベガス」 | `CHANNEL==='b' && F.vegas` | フリップ／スコア上限 | **§S6b `<details class="gsec">`** |
| G7 | `fmt.univMatch`「大学対抗」 | `F.univMatch` | エブリ適用トグル＋注記2行 | **§S6c `<details class="gsec">`** |
| G8 | `game.ptsCard`「賞金ポイント配点」（`.card.prizewin`） | 常時 | 個人戦/チーム戦/個人賞の配点行＋`<hr>`＋賞金総額 | **§S7 `<details class="gsec">`** |

> `.prizewin` の CSS は `heading-unify` §10.3 で「`js/game.js` が使うので残す」と明記された load-bearing。**クラスは維持したまま `<details class="gsec prizewin">` に移す**（内部の `.ptsrow`/`.ptsedit` レイアウトを壊さないため）。

### 2.4 縦の長さ（実測・単位 px・テストデータ①／`view-*` コンテナの高さ）

**α チャネル・条件付きカード OFF（素の状態）**

| 幅 | 基本設定タブ | ゲーム設定タブ | 合計 |
|---|---|---|---|
| 375 | 410 | **1,683** | 2,093 |
| 820 | 410 | **1,540** | 1,950 |
| 1024 | 457 | **1,932** | 2,389 |
| 1180 | 457 | 1,897 | 2,354 |
| 1366 | 457 | 1,897 | 2,354 |

**β チャネル・ルーレット/ベガス/大学対抗を全 ON（最悪ケース）**

| 幅 | 基本設定 | ゲーム設定（カード別内訳） | ゲーム設定 合計 |
|---|---|---|---|
| 375 | 410 | ペリア296 / エブリ149 / 幹事329 / 競技515 / ルーレット238 / ベガス145 / 大学169 / 配点658 | **2,583** |
| 820 | 410 | 248 / 117 / 297 / 496 / 175 / 145 / 137 / 626 | **2,325** |
| 1024 | 457 | 315 / 144 / 346 / **727** / 189 / 178 / 167 / **796** | **2,946** |
| 1366 | 457 | 297 / 144 / 328 / 727 / 172 / 178 / 167 / 796 | **2,893** |

**固定領域（ヘッダ＋タブ2段）**: 155px（<1024）／163px（≥1024）。
→ 1024×768 の可視コンテンツは **605px**。現行ゲーム設定タブ単独で **4.9画面分**。

---

## 3. 要件1：ゲーム設定タブを基本設定タブへ統合する

### 3.1 方針

> **タブは消すが、カードは消さない。** 8枚のカードを 1 枚も削らず基本設定タブに連結し、**「いま決めること」以外を `<details>` に畳む**ことで縦を管理する。

削らない理由: いずれも `g.*` を直接編集する唯一の UI であり、消すとデータに触れなくなる（§4 データモデルに非接触という制約とも整合）。

### 3.2 統合後のカード順（★これが実装の正）

`renderBasic()` が出力する順序。`S3` までが常時展開、`S4` 以降は `<details class="gsec">`。

| 順 | ID | 見出し（i18n キー） | 形 | 表示条件 | 由来 |
|---|---|---|---|---|---|
| S1 | — | `game.title`「ゲーム（コンペ）」 | `.card`（常時展開） | 常時 | B1（現行のまま） |
| S2 | — | `game.basic`「**大会情報**」（値のみ変更・§5.2） | `.card`（常時展開） | `g` あり | B2（#166① の重なり修正を同梱・§7） |
| S3 | — | `game.fmtCard`「集計する競技」 | `.card`（常時展開） | `g` あり | G4 |
| S4 | `roulette` | `game.rlCard`「ルーレット対抗」 | `<details class="gsec">` | `F.roulette` | G5 |
| S5 | `vegas` | `fmt.vegas`「ラスベガス」 | `<details class="gsec">` | `CHANNEL==='b' && F.vegas` | G6 |
| S6 | `univ` | `fmt.univMatch`「大学対抗」 | `<details class="gsec">` | `F.univMatch` | G7 |
| S7 | `peria` | `game.periaCard`「ダブルペリア設定」 | `<details class="gsec">` | `g` あり | G1 |
| S8 | `every` | `game.everyCard`「エブリハンデ」 | `<details class="gsec">` | `g` あり | G2 |
| S9 | `pts` | `game.ptsCard`「賞金ポイント配点」 | `<details class="gsec prizewin">` | `g` あり | G8 |
| S10 | `kanji` | `game.kanjiCard`「次回幹事」 | `<details class="gsec">` | `g` あり | G3 |
| S11 | `host` | `host.summary`「幹事メニュー」 | `<details class="gsec">` | 常時 | B3（`.gsec` を付与して見た目を統一） |

**順序の根拠**
1. **S1→S2→S3 は「どのコンペか → 何のコンペか → 何を競うか」の一本道**。新規作成時に上から埋めれば設定が完了する。
2. **S4–S6（競技ごとの詳細）は S3 の直後**。S3 のチェックを入れた結果として現れるので、出現位置が視線の直下にあるべき（現行は配点カードの手前にバラバラに出る）。
3. **S7/S8（ハンデ）→ S9（配点）→ S10（次回幹事）** は「初回に決めたら以後さわらない」順。S10 は表彰の演出オプションなので最後。
4. **S11（幹事メニュー）は最下部**（現行どおり・`game.emptyCreate` の文言「最下部の『幹事メニュー』から」と整合）。

**ゲーム未選択時**: S1 ＋ `.empty`（`game.emptyCreate`）＋ S11 のみ（現行 `renderBasic` と同一）。**`gameSettingsHtml()` は呼ばない**＝G0 の `msg.needGame` 空状態は不要になる。

### 3.3 縦の長さ（★要件1-2 の答え・実ブラウザで合成して実測）

折りたたみ**なし**で単純連結した場合と、**あり**（全セクション閉）の実測:

| 幅 | 折りたたみなし（＝単純連結） | **折りたたみあり（全閉・既定）** | 現行ゲーム設定タブ単独 | 可視領域 | 既定の画面数 |
|---|---|---|---|---|---|
| 375 | 2,873 | **1,330** | 2,583 | 605（375×760時） | **2.2 画面** |
| 1024 | 3,174 | **1,600** | 2,946 | 605（1024×768時） | **2.6 画面** |
| 1366 | 3,122 | **1,600** | 2,893 | 737（1366×900時） | 2.2 画面 |

いずれも **β・条件付きカード全ON＝最悪ケース**。α の素の状態（S4–S6 が出ない）では 1024px で
`126 + 263 + 529 + 12×2 + 5×(47+10) ≒ **1,227px**`（＝2.0画面）。

**結論**: 単純連結は 5.2 画面分＝**不可**。`<details>` 折りたたみを入れて **1,600px（2.6画面）** に収める。
これは**現行のゲーム設定タブ単独（2,946px）より 46% 短い**＝タブを1本減らしたうえで縦も短くなる。

内訳（1024px・全閉）: S1 126 ／ S2 263 ／ S3 727 ／ S4–S11 各 47（`<details>` 閉時）＋ margin。
→ **支配項は S3「集計する競技」の 727px**。Q4 で S3 も畳めば 1,600 → 920px まで縮むが、**畳むと統合タブが「見出しだけの一覧」になり画面の正体が消える**ため既定では畳まない。

### 3.4 `<details>` の開閉状態（★再描画対策・ここを外すと使い物にならない）

**問題**: `setFmt` / `setKanjiBadge` / `setKanjiRank` / `setUniv` は保存後に**ビュー全体を再描画**する。統合後はこれが `renderBasic()` になるため、**開いていた `<details>` が全部閉じる**。`js/testdata.js:229` に「★renderBasic() は呼ばない（`<details>` が閉じてしまうため）」という既知の注記があるとおり、実害のある挙動。

**解**: `js/basic.js` に**揮発の開閉テーブル**を持つ。

```js
/* 設定セクションの開閉（2026-09-12-settings-consolidation.md §3.4）。
   揮発＝localStorage 非保存（§11.14 原則4・保存キーは5つのまま）。
   renderBasic() の再描画をまたいで開いたままにするためだけの表示状態。 */
let gsOpen = {};                                 // 'peria'|'every'|'kanji'|'roulette'|'vegas'|'univ'|'pts'|'host' → true=開
function gsToggle(k, open){ gsOpen[k] = open; }   // ontoggle から呼ぶだけ（再描画しない）
```

出力側（`gameSettingsHtml` / `hostMenuCard` の共通ヘルパ）:

```js
const sec=(k, titleHtml, inner, extraCls='')=>`<details class="gsec ${extraCls}"${gsOpen[k]?' open':''} ontoggle="gsToggle('${k}',this.open)">
  <summary>${titleHtml}</summary><div class="in">${inner}</div></details>`;
```

- `ontoggle` は inline 属性＝**既存の inline `onclick`/`onchange` 方式と同じ**（ESM 化しない・グローバル関数依存の規律を維持）。
- 再描画で `open` を付け直したときにも `ontoggle` は発火するが、同じ値を書き戻すだけで無害（再描画を呼ばないこと）。
- **既定は全て閉**（`gsOpen` は空オブジェクト）。リロードで全閉に戻る。
- チェックを外してセクションが消えても `gsOpen[k]` は残る＝再度 ON にすると開いた状態で戻る（望ましい挙動）。

### 3.5 コード変更点の全列挙（★要件1-3）

#### A. `index.html`

| 変更 | 内容 |
|---|---|
| 削除 | `#homeSub` の `<button data-tab="game" onclick="go('game')" data-i18n="nav.game">ゲーム設定</button>`（41行付近） |
| 削除 | `<div id="view-game" style="display:none"></div>`（51行付近） |
| 不変 | `<script src>` の**並びと本数**（`js/game.js` は残る）。`?v=` は PR 番号に一括更新 |

#### B. `js/nav.js`

| 変更 | 内容 |
|---|---|
| `views` | `game:'view-game'` の**エントリを削除**（残り6件）。`index.html` の `<div id="view-*">` と 1:1 を維持 |
| `render()` | `if(activeTab==='game') renderGame();` の**1行を削除** |
| `lastHome` | **変更なし**（`let lastHome='home'` / `goHome()` / `if(activeTab!=='result') lastHome=activeTab;` はそのまま） |

#### C. inline `onclick` と `go()` の後始末（★事故ポイント・実測で再現済み）

- アプリコード内の `go('game')` は **`index.html` の1箇所のみ**（`grep -rn "go('game')" index.html js/` で確認済み。`docs/handoff/assets/*.html` は 2026-07-12 の参考 HTML なので**触らない**）。
- **`activeTab` が `'game'` のまま `render()` が走ると例外**になる。実測（モック合成時に再現）:
  `TypeError: Cannot read properties of null (reading 'scrollIntoView') at render (js/nav.js:63)`
  ← `hs.querySelector('button.on')` が null になるため。
  **対策**: `views` から `game` を消し、`go('game')` の呼び出しを**残さない**。`lastHome` は `render()` 内で `activeTab` から同期されるだけなので、'game' が入る経路は消滅する（揮発なので旧値が残ることもない）。
- **保険は入れない**（`hs.querySelector('button.on')?.scrollIntoView(...)` のような防御的変更はしない）。呼び出し元が1箇所と確定しており、**例外は「消し忘れ」の検出器として機能する**ほうが良い。受け入れ条件 §9-4 で grep を必須にする。

#### D. `js/game.js`

| 変更 | 内容 |
|---|---|
| `renderGame()` → `gameSettingsHtml(g)` | **DOM を書かず HTML 文字列を返す**。`const el=document.getElementById('view-game')` と `el.innerHTML=html` を削除。**引数で `g` を受ける**（呼び出し側が `curGame()` 済み） |
| 空状態 | `if(!g){ ... msg.needGame ... }` の分岐を**削除**（呼び出し側が `g` ありのときだけ呼ぶ） |
| カード→セクション | G1/G2/G3/G5/G6/G7/G8 を `sec()` ヘルパ経由の `<details class="gsec">` に。**G4 は `.card` のまま** |
| setter 4本 | `setKanjiBadge` `setKanjiRank` `setFmt` `setUniv` の `renderGame()` → **`renderBasic()`** |
| 不変 | `setG` `setCap` `setWE` `setKanjiRankDir` `setPoints` `setPointsNum` `setRoulette` `setVegas` の**シグネチャ・保存内容** |
| 不変 | ファイルを**消さない**（`2026-07-13-refactor-split.md` のモジュール分割を維持。`js/basic.js` に吸収すると 170行級の肥大＋読込順の議論が発生する） |

> **依存の向き**: `js/basic.js`（読込 5番目）が `js/game.js`（7番目）の関数を呼ぶ。**読込時ではなく `renderBasic()` 実行時の解決**なので順序問題は起きない（現行 `renderBasic()` が `js/testdata.js`（10番目）の `SD_PATTERNS` を参照しているのと同じ構図）。**`<script>` の並びは変更しない。**

#### E. `js/basic.js`

```
renderBasic():
  html  = S1（ゲーム選択カード・現行のまま）
  if(!g) { html += .empty(game.emptyCreate) + hostMenuCard(); return; }
  html += S2（大会情報カード・#166① 修正込み）
  html += gameSettingsHtml(g)        // ← S3〜S10 を一括で受け取る
  html += hostMenuCard()             // ← S11（<details class="gsec"> 化・gsOpen('host') 対応）
```
＋ §3.4 の `gsOpen` / `gsToggle` を定義（`js/basic.js` の先頭）。

#### F. `styles.css`（追加 3 行・削除 0 行）

```css
/* 設定セクション（2026-09-12-settings-consolidation.md §3.2）: 折りたたみカードの summary を
   カード見出し（.card h2）と同格の見た目にする。枠・余白・マーカーは既存 details 規則を流用＝新規は本行のみ */
details.gsec>summary{font-family:"Noto Serif JP","Noto Serif",serif;font-size:var(--f-title);color:var(--strong)}
```
＋ §4.2 の `.subnav button.on` 2 宣言。**新規トークン（`--*`）は作らない。**

> 既存 `details{border/radius/margin-bottom:10px}`・`details>summary{padding:11px 12px;...}`・`details>summary::before{"› "}`・`details[open]>summary::before{"⌄ "}`・`details .in{padding:0 12px 12px}` を**そのまま使う**。クラス名は `.gsec`（`button.btn.sec` と紛れない名前を選んだ）。

### 3.6 `golfCompe_seenTop` と起動時の挙動（★要件1-4）

| 項目 | 現行 | 統合後 | 判定 |
|---|---|---|---|
| `js/init.js` の `if(seenTop()) activeTab='basic';` | 起動時に「基本設定」タブ | **そのまま有効**（`'basic'` は存続） | **変更なし** |
| `seenTop()` / `setSeenTop()`（`js/home.js`） | `golfCompe_seenTop` を読み書き | 不変 | **変更なし** |
| 「次回から表示しない」チェックの置き場所 | 概要タブの `.card.hometop` の h2 右端 | 不変 | **変更なし** |
| localStorage キー集合 | `golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop` の**5つ** | **5つのまま**（`gsOpen` は揮発変数＝保存しない） | **不変** |
| 意味的な影響 | skip ON のユーザーは「コンペ作成」画面から始まる | **skip ON のユーザーは「コンペ作成＋全ゲーム設定」画面から始まる**＝1タブで設定が完結する | **改善（副次効果）** |

**唯一の注意**: `init.js` の行コメント「起動時はトップ…『次回から表示しない』時は基本設定（どのコンペか）から開始」の**括弧書きが古くなる**。`（どのコンペか＋何を集計するか）` に直すこと（コメントのみ）。

---

## 4. 要件2：設定画面タイトルの視認性

### 4.1 結論：**ホーム配下は `<h2>` を残す。そのうえで「選択中タブを見出しサイズに拡大」も採る。**

結果発表（#170）とは**結論の形が違う**。理由を分けて書く。

#### (a) なぜ結果発表では `<h2>` を消せたのか

`heading-unify` §3.1 の判定ルール:
> そのカードのタイトルが、いま選択中のタブの名前と**同じ役割**を果たしているなら `<h2>` を廃止する。

結果発表は **1タブ＝1主カード**で、`<h2>`「チーム総合順位」とタブ「総合」が**同じものを二度言っていた**。だから消せた。

#### (b) なぜホーム配下では消せないのか

- 統合後の「コンペ設定」タブには **8〜11 個の独立したカード/セクション**が同居する（§3.2）。`<h2>`／`<summary>` は**タブ名ではなく「セクション名」**を担っており、**重複していない**。消すと「どこからどこまでが賞金ポイント配点なのか」が失われる＝情報損失が発生する。
- `heading-unify` §3.4 が「ホーム配下は対象外」と明記した判断は**正しく、本件でも維持する**。
- 加えて統合により**カード数が増える**ので、セクション見出しの価値はむしろ上がる。

#### (c) それでも「どの設定画面か分からない」のは `<h2>` の問題ではない

ユーザーの不満の実体は**画面タイトルの不在ではなく、現在地表示の弱さ**である。現行 CSS:

```css
.subnav button{...font-size:var(--f-body)...}        /* 13px（≥1024px で 15px・≤374px で 12px） */
.subnav button.on{color:var(--strong);border-bottom-color:var(--pri)}   /* ← サイズは同じ */
```

6本（統合後5本）のタブが**全部同じ字の大きさ**で並び、選択中は**色と 2px の下線だけ**。しかも `.subnav` は `overflow-x:auto` で、狭幅では選択中タブが端に寄る。**「画面の名前」として読めていない。**

#### (d) だから答えは「タブ名を見出しサイズに拡大」— 結果発表と同じ原則、別の理由

| | 結果発表（#170） | **ホーム配下（本件）** |
|---|---|---|
| ユース | プロジェクター投影 | **幹事のハンズオン操作** |
| 拡大の目的 | 後方席から読める大型表示（§11.14） | **スクロール中も現在地が分かること** |
| `<h2>` | 廃止（タブ名と重複） | **残す**（セクション名＝重複しない） |
| 拡大幅 | 14→**19px**（旧 `.card h2` と同値） | **13→15px / 15→17px**（控えめ。`.subtab4` と同値） |

**ホーム配下でタブ拡大が特に効く理由**: `.navwrap` は **sticky（3層固定）**なので、`<h2>` と違って**スクロールしても画面から消えない**。長い設定画面（1,600px＝2.6画面）を下までスクロールしても「いまコンペ設定にいる」が常に見えている。**`<h2>` では代替できない役割**であり、`<h2>` と競合もしない（役割が違う）。

### 4.2 CSS（決定値）

```css
/* 追加①: .subnav button.on の既存宣言に font-size を1値足す（styles.css 82行付近） */
.subnav button.on{color:var(--strong);border-bottom-color:var(--pri);font-size:15px}

/* 追加②: 既存の @media(min-width:1024px) ブロック（103行）に1宣言を追記＝新規 @media を作らない */
@media(min-width:1024px){ :root{--h-tabrow:48px} .mainnav button{font-size:15px} .subnav button{font-size:15px}
  .subnav button.on{font-size:17px} .chbadge{min-height:40px} }
```

**15 / 17px の根拠**（恣意的な数字を置かない）

| セレクタ | 階層 | <1024px | ≥1024px | 出典 |
|---|---|---|---|---|
| `#view-result .subtab4 button.on`（結果発表のグループタブ） | **2段目** | 15px | 17px（≥820px） | `heading-unify` §8.2 |
| **`.subnav button.on`（ホーム配下サブタブ）** | **2段目** | **15px** | **17px** | 本書（上に合わせる） |
| `#view-result .subtab-games button.on`（ゲームタブ） | 3段目 | 15px | 19px（≥768px） | `heading-unify` §8.2 |

> `#homeSub .subnav` と `#view-result .subtab4` は**同じ第2階層のタブ**（1段目＝ホーム/結果発表、2段目＝サブタブ/グループタブ）であり、`2026-08-20-home-subtabs.md` §5.2 で既に `--h-tabrow` を共有している。**同じ階層は同じ見出し重み**とするのが最も説明のつく規則。
> ブレークポイントは **`.subnav` 側の既存 1024px に乗せる**（`.subtab4` は 820px だが、`.subnav` に 820px の段差は元々存在しない。新規 `@media` を作らない原則を優先）。

**`.mainnav button.on`（1段目）は変更しない。** 上段は「ホーム／結果発表」の2択で、拡大しても情報が増えない。上段まで太らせると 2段が同じ重みになり階層が潰れる。

### 4.3 検算（★実ブラウザ実測・Chromium 141）

**(1) 行の高さは 1px も変わらない**

`.subnav button{height:var(--h-tabrow)}` は `min-height` **ではなく固定 `height`**（`styles.css:81`）。font-size に一切依存しない。

| 幅 | 選択中 font | `.subnav` 実測高（選択タブを全部切り替えて計測） |
|---|---|---|
| 320 / 375 / 414 / 768 | 15px | **45px（一定）** = `--h-tabrow` 44 ＋ 下罫線 1 |
| 1024 / 1366 | 17px | **49px（一定）** = 48 ＋ 1 |

15px の行ボックス = 15 × 1.45 = 21.75px ≪ 44px、17px = 24.65px ≪ 48px。**クリップも発生しない。**

**(2) 横幅（5タブ・3言語・選択タブを1本ずつ `.on` にして計測）**

`document.documentElement.scrollWidth === window.innerWidth`（＝**ページ全体の横スクロールなし**）を全幅・全言語・全選択パターンで確認済み。`.subnav` の**行内**オーバーフロー（既存仕様の `overflow-x:auto`）は:

| 幅 | ja 案（ガイド/コンペ設定/コース/選手・チーム/スコア） | zh 案 | en 案（Guide/Setup/Course/Players & Teams/Scores） |
|---|---|---|---|
| **320** | 最大 **+7px**（「選手・チーム」選択時）＝行内スクロール | 0 | 最大 **+17px**（現行と同じ傾向） |
| **375** | **0** | **0** | **0** |
| 414 / 768 / 1024 / 1366 | 0 | 0 | 0 |

- 375px 以上では**全言語・全選択パターンでオーバーフロー0**（＝5本が1行に収まる）。
- 320px の数 px は `2026-08-20-home-subtabs.md` §5.4 が設計済みのフォールバック（`overflow-x:auto` ＋ `render()` の `scrollIntoView({inline:'nearest'})`）で吸収される。**破綻ではない。**
- 参考: タブが6本だった現行 ja でも 320px は同様に行内スクロールしていた。**統合で1本減る分だけ余裕が増える。**

**(3) `@media(max-width:374px){ .subnav button{font-size:12px} }` との詳細度**

`.subnav button.on` は (0,2,1)、`@media` 内の `.subnav button` は (0,1,1)。**`.on` が勝つ**ので 320px でも選択中は 15px（非選択は 12px）＝コントラストは最大になる。意図どおり（実測でも確認）。

---

## 5. 要件3：サブタブの名称

### 5.1 名称案（ja / zh / en・統合後5本）

| # | tab | キー | **ja（決定案）** | **zh（決定案）** | **en（決定案）** | 現行からの変化 |
|---|---|---|---|---|---|---|
| 1 | `home` | `nav.top` | **ガイド** | **指南** | Guide | ja/zh の**値のみ**変更（概要/概览） |
| 2 | `basic` | `nav.basic` | **コンペ設定** | **比赛设置** | Setup | ja/zh の**値のみ**変更（基本設定/基本设置） |
| 3 | `course` | `nav.course` | コース | 球场 | Course | **変更なし** |
| 4 | `players` | `nav.players` | 選手・チーム | 选手・队伍 | Players & Teams | **変更なし** |
| 5 | `score` | `nav.score` | スコア | 记分 | Scores | **変更なし** |
| — | （削除） | `nav.game` | ~~ゲーム設定~~ | ~~玩法设置~~ | ~~Games~~ | **キーごと削除**（3言語） |

#### 「コンペ設定」を推す理由（★Issue #166 末尾の経緯を踏まえて）

- #166 の末尾で **「ナビの『ホーム』を『基本設定』に改称する案はユーザー自身が撤回」**と記録されている。つまり**上段ナビは「ホーム」のまま**が確定事項であり、本件でも上段には触れない。
- 撤回の背景にあった論点は「**基本設定**」という語が**アプリ全体の設定**とも**このコンペの設定**とも読めて、**階層が判別できない**こと。統合でこのタブが「コンペ選択＋大会情報＋全競技設定＋配点」を抱えると、「基本」は実態より小さく響く（実際には**基本ではなく全部**）。
- **「コンペ設定」は対象（＝このコンペ）を名指しする**ので、上段「ホーム」との親子関係が言葉の上で成立する（ホーム ▸ コンペ設定）。アプリ内の既存語彙とも一致する（`game.title`「ゲーム（コンペ）」・`game.compeName`「コンペ名」）。
- zh は **`比赛设置`**（`比赛` はアプリ内で「コンペ」の訳語として一貫使用: `game.compeName`=`比赛名称` / `msg.needGame`=`新建或选择比赛` / `m1.emptyFmt`=`比赛设置`）。既存の `赛事` 系は使っていないので**新語を持ち込まない**。
- en は **`Setup` を維持**（`nav.basic` の現行値）。`Games` が消えても "Setup" は「このコンペのセットアップ」として無理がなく、`home.step1` の英文も最小修正で済む（§5.2）。

#### 「概要」→「ガイド」を推す理由

- **en が既に `Guide`**（`nav.top`）で、ja「概要」/ zh「概览」だけが別語になっている。**3言語を揃える**のが筋。
- 中身は `home.step1..4` の**4ステップ手順**＋α/β解説＝「概要」より「ガイド」が実態。
- `2026-08-20-home-subtabs.md` §2 が `nav.home`（ホーム）を使い回さない理由として挙げた「上段と同名を避ける」制約は**そのまま満たす**。

#### 変えないもの

- 「コース」「選手・チーム」「スコア」は**対象を名指しする名詞**で既に曖昧さがない。改称は i18n とユーザーの記憶コストを無駄に増やすだけ＝**触らない**。
- en `Players & Teams` は 320px で行内 +17px になるが、これは**現行と同じ**（本件で悪化しない）。短縮（`Players`）は「チーム」の情報が落ちるので**不採用**（PM が短縮を望む場合は `nav.players` の en 値のみ変更＝1行）。

### 5.2 i18n の増減（ja / zh / en 同時・未使用キー0を維持）

**新規キー: 0。削除キー: 1 × 3言語。**

#### (a) 削除（`verify.mjs` の未使用キー検出を通すため必須）

| キー | ja | zh | en | 唯一の参照元 |
|---|---|---|---|---|
| `nav.game` | ゲーム設定 | 玩法设置 | Games | `index.html` の `data-i18n="nav.game"`（削除するボタン） |

> **誤削除防止**: `nav.basic` `nav.top` `nav.course` `nav.players` `nav.score` `nav.home` `nav.result` は残る。`tab.*` は `DYN_PREFIX` 対象（`tabLabel=k=>t('tab.'+k)`）なので**触らない**。`msg.needGame` は `js/course.js` / `js/players.js` が使い続けるので**残す**（値だけ変更）。`game.periaCard` などカード見出しキーは `<summary>` のテキストとして**全て使われ続ける**。

#### (b) 値だけ変更（キー集合は不変・未使用にもならない）

| キー | 言語 | 変更前 | **変更後** | 理由 |
|---|---|---|---|---|
| `nav.top` | ja | 概要 | **ガイド** | §5.1 |
| | zh | 概览 | **指南** | |
| | en | Guide | （変更なし） | |
| `nav.basic` | ja | 基本設定 | **コンペ設定** | §5.1 |
| | zh | 基本设置 | **比赛设置** | |
| | en | Setup | （変更なし） | |
| `game.basic`（S2 カードの見出し） | ja | 基本設定 | **大会情報** | タブ名と同語の重複を避ける。中身は名前/日付/コース＝大会そのものの情報 |
| | zh | 基本设置 | **比赛信息** | |
| | en | Basic settings | **Competition info** | |
| `msg.needGame` | ja | 先に「**基本設定**」画面でゲームを作成・選択してください | 先に「**コンペ設定**」画面でゲームを作成・選択してください | 画面名の参照 |
| | zh | 请先在「**基本设置**」页新建或选择比赛 | 请先在「**比赛设置**」页新建或选择比赛 | |
| | en | Create or select a game on the **Setup** screen first | （変更なし） | en の画面名は Setup のまま |
| `home.step1` | ja | 「基本設定」でコンペを作成し、「**ゲーム設定**」で行うゲームやポイントを決めます。… | 「**コンペ設定**」でコンペを作成し、**行うゲームやポイントもここで決めます**。… | ゲーム設定タブが消えるため手順文が破綻する |
| | zh | 在「基本设置」中创建比赛，在「**玩法设置**」中选择… | 在「**比赛设置**」中创建比赛，**并在同一页选择要进行的游戏和积分**。… | |
| | en | Create a competition under "Setup" and pick the games and points under "**Games**". … | Create a competition under "Setup" and pick the games and points **there as well**. … | |
| `result.noIndGame` | ja | …「**ゲーム設定**」で選んでください。 | …「**コンペ設定**」で選んでください。 | 存在しない画面名の参照を潰す |
| | zh | …请在「**玩法设置**」中选择。 | …请在「**比赛设置**」中选择。 | |
| | en | …Choose them on the **Games** screen. | …Choose them on the **Setup** screen. | |
| `standing.noPool` | ja | （賞金総額は「**ゲーム設定**」画面で入力すると…） | （賞金総額は「**コンペ設定**」画面で入力すると…） | 同上 |
| | zh | （在「**玩法设置**」页输入奖金总额后…） | （在「**比赛设置**」页输入奖金总额后…） | |
| | en | (Enter a prize pool on the **Games** screen …) | (Enter a prize pool on the **Setup** screen …) | |
| `m1.emptyFmt` | ja | **ゲーム設定**で「1 on 1 マッチプレー」をONに… | **コンペ設定**で「1 on 1 マッチプレー」をONに… | 同上 |
| | zh | 请在**比赛设置**中开启… | （変更なし・既に一致） | |
| | en | Turn on "1 on 1 Match Play" in **game settings** | Turn on "1 on 1 Match Play" in **Setup** | |

> **値を変えないもの（紛らわしいので明記）**: `host.seedNote` の「…チーム・**ゲーム設定**・スコアを一括投入し…」は**画面名ではなくデータ種別**の意味。**変更しない**。

#### (c) grep で潰す確認語

`nav.game` / `view-game` / `renderGame` / `go('game')` / `ゲーム設定` / `玩法设置` / `Games` screen → アプリコード（`index.html` / `js/**` / `styles.css`）で **`docs/handoff/assets/**` を除き 0件**になること（`host.seedNote` の「ゲーム設定」だけは意図的に残る）。

---

## 6. レイアウト図・寸法（★モック承認用・`/feature` 手順 1.5）

### 6.1 ナビ 2段（前→後）

```
【前】1024px                                     【後】1024px
┌───────────────────────────────────────┐      ┌───────────────────────────────────────┐
│ ホーム │ 結果発表                        │ 49px │ ホーム │ 結果発表                       │ 49px  ← 変更なし（15px）
│━━━━━│                                │      │━━━━━│                               │
├───────────────────────────────────────┤      ├───────────────────────────────────────┤
│ 概要 │基本設定│ゲーム設定│コース│選手・ﾁｰﾑ│ｽｺｱ│ 49px │ ガイド │ コンペ設定 │ コース │選手・ﾁｰﾑ│ｽｺｱ│ 49px  ← 段高は不変
│      │━━━━│         │      │        │   │      │        │━━━━━━│        │        │   │
│       ↑選択中も 15px（他と同じ）        │      │           ↑選択中だけ 17px（見出し）    │
└───────────────────────────────────────┘      └───────────────────────────────────────┘
   6タブ                                            5タブ（−1）
```

- 段高: **45px（<1024px）/ 49px（≥1024px）** で前後とも同一（実測・§4.3）。
- 選択中チップは幅が文字数×約2px 広がるだけ。375px 以上でオーバーフロー0（§4.3）。

### 6.2 統合後の「コンペ設定」タブ（1024px・β・条件付き全ON＝最悪ケース／全セクション閉）

```
┌─────────────────────────────────────────────┐
│ ゲーム（コンペ）                               │ 126px  ← .card（常時展開）
│ [ テストコンペ1 個人戦フル (2026-09-01) ▼] [＋新規]│
├─────────────────────────────────────────────┤ ← margin 12
│ 大会情報                                      │ 263px  ← .card（常時展開／#166① 修正込み）
│ コンペ名  [                              ]    │
│ 日付 [2026-09-01]      コース [テスト国際CC]    │   ← 2カラム（#166①: 特定幅で重なるバグをここで直す）
│ [このゲームを削除] [複製]                       │
├─────────────────────────────────────────────┤
│ 集計する競技  [β版]                            │ 727px  ← .card（常時展開・折りたたまない = Q4）
│ 個人戦                                        │
│  ☑グロス個人戦   ☑ネット個人戦                  │
│  ☑ニアドラ個人   ☐ステーブルフォード            │
│  …（2カラム × 8行程度）                        │
│ チーム戦                                      │
│  ☐ニアドラチーム ☐チーム対抗(グロス)            │
│  …                                           │
├─────────────────────────────────────────────┤
│ › ルーレット対抗（抽選ホールバイホール）          │  47px  ← details.gsec（F.roulette のときだけ）
│ › ラスベガス [β版]                             │  47px  ← details.gsec（β かつ F.vegas）
│ › 大学対抗                                     │  47px  ← details.gsec（F.univMatch）
│ › ダブルペリア設定                              │  47px  ← details.gsec
│ › エブリハンデ                                  │  47px  ← details.gsec
│ › 賞金ポイント配点                              │  47px  ← details.gsec.prizewin
│ › 次回幹事                                     │  47px  ← details.gsec
│ › 幹事メニュー（動作確認・上級者向け）            │  47px  ← details.gsec（既存 B3）
└─────────────────────────────────────────────┘
合計 1,600px（= 2.6画面／可視 605px）
```

開いたセクションは `⌄` マーカーに変わり、中身が `.in`（padding `0 12px 12px`）で出る。**開閉は `gsOpen` が覚えるので、競技チェックを触って再描画されても開いたまま**（§3.4）。

### 6.3 寸法表（実測・単位 px）

| 要素 | <1024px | ≥1024px | 出典 |
|---|---|---|---|
| ヘッダ | 65（実測・言語/ゲーム名で可変。`--hdr-h` が追従） | 65 | 既存 |
| タブ段（1段目・2段目 各） | 45（44＋罫線1） | 49（48＋1） | 既存 `--h-tabrow` |
| 固定領域 合計 | **155** | **163** | 実測 |
| `.card`（S1） | 118 | 126 | 実測 |
| `.card`（S2 大会情報） | 226 | 263 | 実測 |
| `.card`（S3 集計する競技） | 515（β全ON）/ 374（α） | 727（β全ON）/ 529（α） | 実測 |
| `<details class="gsec">` 閉 | 46 | 47 | 実測 |
| `<details>` の margin-bottom | 10 | 10 | 既存 CSS |
| `.card` の margin-bottom | 12 | 12 | 既存 CSS |
| 選択中サブタブ font | 15（非選択 13／≤374px は 12） | 17（非選択 15） | 本書 §4.2 |

### 6.4 静止モック（実ブラウザで合成・PM 提示用）

| ファイル | 内容 |
|---|---|
| `/tmp/claude-0/-home-user-76-Club/852799cf-e353-5a31-8eeb-8eaf639e6865/scratchpad/sc-after-merged-1024.png` | **統合後・1024px・ja・light・全セクション閉**（＝本設計の主モック） |
| `…/sc-after-merged-375.png` | 統合後・375px・ja・light・全閉 |
| `…/sc-after-merged-1366.png` | 統合後・1366px・ja・light・全閉 |
| `…/sc-after-merged-open-{375,1024,1366}.png` | 統合後・**全セクション開**（＝折りたたみが無いと何が起きるかの参考） |
| `…/sc-after-merged-dark-{375,1024,1366}.png` | 統合後・dark テーマ |
| `…/sc-before-basic-{375,1024,1366}.png` / `…/sc-before-game-{…}.png` | **変更前**の基本設定／ゲーム設定タブ（比較用・fullPage） |

> モックは**現行アプリの DOM を実ブラウザ上で組み替えて撮ったもの**（リポジトリのコードは 1 行も変更していない）。フォントは Google Fonts 遮断のためシステム sans（本番は Noto）。**scratchpad はセッション限りなので、PM は必要なら早めに退避すること。**

---

## 7. Issue #166 との関係（★判断）

#166 の3点と本件の衝突面:

| #166 の項目 | 触るファイル | 本件との衝突 | **判断** |
|---|---|---|---|
| **① 日付/コース欄が特定幅で重なる（バグ）** | `js/basic.js`（S2 カード）＋ `styles.css` | **確実に衝突**。本件は S2 を含む `renderBasic()` を全面書き換えする | **本件に吸収**。直さないまま統合すると「新しい大会情報カードに既知のバグが乗った」状態で出荷される。**原因特定してから直す**（対症療法禁止は #166 の指示どおり） |
| **③ バックアップを基本設定へ移動** | `js/players.js`（`backup.title` カード・65行）→ `js/basic.js` | **衝突**（移動先が本件で作り替わる） | **本件に吸収**。移動先は **§3.2 の S11 直前に `<details class="gsec">` で1セクション追加**（`gsOpen` キー `backup`）＝本件のセクション模型にそのまま乗る。単独でやると2度組み直しになる |
| **② テーマ選択のアイコン化** | `index.html`（ヘッダ）＋ `styles.css`＋ i18n | **ほぼ無関係**（`js/basic.js` を触らない。`styles.css` は触るが編集箇所が離れている） | **分離して後追いPR**。本件マージ後に着手（`styles.css` の衝突を避けるため直列） |

**結論: #166 は「①③を本件 Issue に吸収し、②だけを残す」形に再スコープする**（PM が #166 本文を更新 or ②専用 Issue を切り直す）。
**実装順**: 本件PR（統合＋①③）→ ② テーマアイコン化PR。

> ③ を含めると、バックアップ（`state` 丸ごと＝全コンペ）が「このコンペの設定」タブに入ることになる。**意味的には「コンペ設定」の外**だが、#166 の「選手タブにあるのは不自然」という指摘は正しい。**S11「幹事メニュー」の直前**（データ管理系をまとめる位置）に置くのが既定案。PM が違和感を持つなら③だけ後追いに戻してよい（本件の構造には依存しない）。

---

## 8. 推奨 PR 分割

**1 Issue ＋ 2 PR（＋ #166② の後追い1本）。**

| PR | 内容 | 触るファイル | 中間状態の出荷可否 |
|---|---|---|---|
| **PR-1（本体）** | タブ統合＋セクション折りたたみ＋`gsOpen`＋`renderGame`→`gameSettingsHtml`＋`views`/`index.html`/`nav.js` ＋ **#166①** ＋ サブタブ改称＋選択中タブ拡大＋ i18n（`nav.game` 削除・値変更7キー） | `index.html` `js/nav.js` `js/basic.js` `js/game.js` `js/i18n.js` `styles.css` | — |
| **PR-2** | **#166③** バックアップカードを `js/players.js` → 統合タブの `<details class="gsec">` へ移動 | `js/basic.js` `js/players.js`（＋`index.html` の `?v=`） | 可 |
| **PR-3** | **#166②** テーマ選択のアイコン化 | `index.html` `styles.css` `js/i18n.js` | 可 |

**PR-1 を分割しない理由**: 「タブを消す」と「タブ名を大きくする」を別PRにすると、
- 先にタブ統合だけ入れる → **「基本設定」という名前のタブにゲーム設定が全部入った状態**が公開される（名前と中身の不一致）。
- 先に拡大だけ入れる → 6タブのまま拡大＝要件2の効果が薄いうえ 320px の余裕を先食いする。
どちらも中途半端なので**1本にまとめる**（CLAUDE.md「関連する小変更は 1 Issue＋1PR」）。

**PR-1 のコミットは 4 本に分ける**（レビュー容易性のため）:

| コミット | 内容 | ファイル |
|---|---|---|
| 1 | 設計書追加（本ファイル） | `docs/handoff/2026-09-12-settings-consolidation.md` |
| 2 | `renderGame()` → `gameSettingsHtml(g)` 純関数化＋セクション化（`gsOpen`/`gsToggle`）＋`renderBasic()` 連結 | `js/basic.js` `js/game.js` `styles.css`（`details.gsec>summary` 1行） |
| 3 | タブ削除（`views`/`index.html`/`render()`）＋ i18n（`nav.game` 削除・値変更）＋ #166① | `index.html` `js/nav.js` `js/i18n.js` `js/basic.js` `styles.css` |
| 4 | 選択中サブタブの拡大 CSS ＋ `?v=` を PR 番号に一括更新 | `styles.css` `index.html` |

---

## 9. 受け入れ条件（★PM が Issue にそのまま貼れるチェックリスト）

```markdown
### 機械検証
- [ ] `node tools/verify.mjs` が全 PASS（特に **未使用キーなし**。`nav.game` の削除漏れがあると FAIL）
- [ ] `node tools/regress.mjs` が `--update` なしで**無差分**（計算非接触の証明）
- [ ] `git diff --stat` に **`js/calc.js` が現れない**
- [ ] `grep -rn "renderGame\|view-game\|nav\.game\|go('game')" index.html js/ styles.css` が **0件**（`docs/handoff/assets/**` は対象外）
- [ ] `grep -c "golfCompe_" js/*.js` が変更前と一致（**localStorage キーは5つのまま**）
- [ ] `git diff` に `localStorage` への**新しいキー文字列が現れない**（`gsOpen` は揮発変数）
- [ ] `index.html` の `?v=` が全て PR 番号（`grep -o '?v=[0-9]*' index.html | sort -u` が1種類）
- [ ] `js/nav.js` の `views` のエントリ数 = `index.html` の `<div id="view-*">` の数 = **6**

### タブ構成（要件1）
- [ ] サブタブが **5本**（ガイド / コンペ設定 / コース / 選手・チーム / スコア）。「ゲーム設定」タブが存在しない
- [ ] コンペ設定タブに、旧ゲーム設定タブの **8枚のカードが1枚も欠けずに**存在する
      （ダブルペリア設定 / エブリハンデ / 次回幹事 / 集計する競技 / ルーレット対抗 / ラスベガス / 大学対抗 / 賞金ポイント配点）
- [ ] カード順が設計 §3.2 のとおり（ゲーム（コンペ）→ 大会情報 → 集計する競技 → 競技別詳細 → ペリア → エブリ → 配点 → 次回幹事 → 幹事メニュー）
- [ ] 「集計する競技」は**常時展開**、それ以外の設定セクションは `<details>` で**既定は閉**
- [ ] **条件付き表示が現行どおり**: ルーレット対抗セクションは `roulette` ON のときだけ／ラスベガスは β かつ `vegas` ON のときだけ／大学対抗は `univMatch` ON のときだけ現れる
- [ ] **開閉が再描画をまたいで保持される**: セクションを開く → 「集計する競技」のチェックを1つ変える → **開いたままである**（`gsOpen`）
- [ ] 同様に、次回幹事のトグル／大学対抗のエブリトグルを操作しても開いているセクションが閉じない
- [ ] リロードすると全セクションが**閉に戻る**（揮発＝保存していない）
- [ ] ゲーム未選択時: 「ゲーム（コンペ）」カード ＋ `game.emptyCreate` ＋ 幹事メニューのみ（設定セクションは出ない）。**例外が出ない**
- [ ] **幹事メニューが従来どおり動く**: テストデータのパターン選択 → 生成が動作し、内側の「データ点検」（#171 PR2）の**点検 → 1件削除**も従来どおり（`#auditOut` の直接書き換え方式が壊れていない）
- [ ] 全ての設定項目が**保存される**（値を変えてリロード → 反映されている）: 係数 / HDCP上限 / ダブルパーカット / マイナス許可 / エブリ適用 / 次回幹事バッジ＋対象順位＋方向 / 各競技チェック / ルーレット回数 / ベガス（フリップ・上限）/ 大学対抗エブリ / 各配点 / 賞金総額 / コンペ名・日付・コース

### 起動と復帰（要件1-4）
- [ ] `golfCompe_seenTop='1'`（「次回から表示しない」ON）でリロード → **コンペ設定タブで起動**する（例外なし）
- [ ] `golfCompe_seenTop` 未設定 → **ガイドタブで起動**する
- [ ] 「次回から表示しない」チェックがガイドタブで従来どおり機能する
- [ ] **結果発表 → 上段「ホーム」で直前のサブタブに復帰**する（例: スコア → 結果発表 → ホーム = スコア）
- [ ] 同じく コンペ設定 → 結果発表 → ホーム = **コンペ設定**に戻る
- [ ] 結果発表タブでは `#homeSub` が非表示、結果発表側 `.subtab4` / `.result-sticky` の位置が従来どおり

### タイトル視認性（要件2）
- [ ] 選択中サブタブのフォントが **15px（<1024px）/ 17px（≥1024px）**、非選択は従来どおり
- [ ] 上段（ホーム／結果発表）のフォントは**変わっていない**
- [ ] **タブ段の高さが選択タブを切り替えても変わらない**（DevTools で `.subnav` の `offsetHeight` を全タブで比較 → 45px / ≥1024px で 49px の一定値）
- [ ] ホーム配下の各カードの `<h2>` / `<summary>` が**残っている**（結果発表の見出し廃止をホーム配下に波及させていない）
- [ ] 縦に長い設定画面を最下部までスクロールしても、ヘッダ＋タブ2段が**固定で残り**、選択中タブ名が常に読める

### 名称と i18n（要件3）
- [ ] i18n 差分が **−1キー（`nav.game`）× 3言語**ちょうど。**新規キー 0**
- [ ] 値変更が設計 §5.2(b) の表どおり（`nav.top` / `nav.basic` / `game.basic` / `msg.needGame` / `home.step1` / `result.noIndGame` / `standing.noPool` / `m1.emptyFmt`）
- [ ] アプリ内の**どの文言にも存在しない画面名（「ゲーム設定」「玩法设置」「Games screen」）が残っていない**
      （例外: `host.seedNote` の「ゲーム設定・スコアを一括投入」＝データ種別の意味なので残る）
- [ ] 3言語切替でサブタブ5ラベルが即時追従する（静的 `data-i18n`）

### 表示（幅 × 言語 × テーマ）
- [ ] **375 / 820 / 1024 / 1180 / 1366px** ×（**ja / zh / en**）×（**light / dark**）で:
      - `document.documentElement.scrollWidth <= window.innerWidth`（**ページ全体の横スクロールなし**）
      - サブタブ5本が**1行に収まる**（折り返しなし。行内スクロールも発生しない）
      - 設定カードの入力欄が**重ならない**（#166①。特に 大会情報カードの「日付」「コース」の2カラム）
      - `<details>` の開閉マーカー（`›` / `⌄`）と見出しが読める
- [ ] dark テーマで `details.gsec>summary` の文字色が背景に埋もれない（`--strong` トークン使用）
- [ ] 統合後のコンペ設定タブの総高が **1024px 幅・全セクション閉で 1,700px 以下**（設計値 1,600px）

### #166 の同梱分
- [ ] ① 日付/コース欄の重なりが **375–1366px の全幅で解消**（原因を PR 本文に記載。対症療法ではないこと）
- [ ] ③ バックアップ機能が**コンペ設定タブ**から使える（PR-2）。書き出し／読み込みが従来どおり動作し、選手・チームタブから消えている
```

---

## 10. やらないこと／触らない範囲（load-bearing）

### 10.1 やらないこと（明示的にスコープ外）

| 項目 | 理由 |
|---|---|
| **カードの中身のレイアウト変更**（`.fmtgrid` の列数、`.ptsrow` の作り、ペリアの入力並び等） | 本件は「置き場所と畳み方」の変更。中身に手を入れると差分が読めなくなる。#166① の重なり修正**だけ**が例外 |
| **`js/game.js` の削除／`js/basic.js` への吸収** | モジュール分割（`2026-07-13-refactor-split.md`）を維持。`<script>` 読込順も不変 |
| **結果発表側の `<h2>` 方針の見直し** | #170 で確定済み。本件は触れない |
| **上段ナビ（ホーム／結果発表）の名称・サイズ** | #166 末尾でユーザーが「ホーム→基本設定」改称を撤回済み |
| **`nav.course` / `nav.players` / `nav.score` の改称** | 現行で曖昧さがない（§5.1） |
| **`tabLabel`（`js/nav.js:51`）の削除** | 現在どこからも呼ばれていない dead const だが、`tab.*` は `DYN_PREFIX` で保護されており verify は通る。掃除は別 Issue |
| **`sdSetPat` の再描画化** | `gsOpen` 導入で技術的には可能になるが、`js/testdata.js` は本件の対象外。別 Issue |
| **`<details>` 開閉の localStorage 保存** | 保存キーを増やさない（load-bearing）。揮発でよい（§11.14 原則4） |
| **ESM 化・inline ハンドラの撤去** | 禁止（CLAUDE.md） |
| **新規 CSS トークン（`--*`）の追加** | 追加は `details.gsec>summary` と `.subnav button.on` の font-size のみ |

### 10.2 触らない（変更したら差し戻し）

- **`js/calc.js`** — §3 計算式。`git diff --stat` に現れてはいけない。
- **`js/state.js` の `newGame()` / `g.*` のスキーマ** — §4 データモデル。設定項目の追加・削除・改名は**しない**。
- **setter のシグネチャと保存内容** — `setG` `setCap` `setWE` `setKanjiBadge` `setKanjiRank` `setKanjiRankDir` `setFmt` `setPoints` `setPointsNum` `setRoulette` `setVegas` `setUniv`。**再描画先の関数名（`renderGame`→`renderBasic`）以外は 1 バイトも変えない**。inline 属性文字列（`onchange="setFmt('gross',this.checked)"` 等）も不変。
- **localStorage キー5つ** — `golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop`。増やさない。
- **`lastHome` / `goHome()` / `go()` のシグネチャ**（`2026-08-20-home-subtabs.md` §3.3）。
- **`--h-tabrow` の値と `.navwrap` の sticky 構成**（3層固定）。`.result-sticky{top:calc(var(--hdr-h) + var(--h-tabrow) + 1px)}` は無改変。
- **`.card h2` の CSS**（108–110行）— 結果発表側の `standing.teamTitle` とホーム配下の全カードが使う。
- **`.prizewin` の CSS** — `<details class="gsec prizewin">` に移っても内部構造は同じ。
- **`.subtab4` / `.subtab-games` の CSS**（結果発表側）— 本件では触らない。
- **i18n ja/zh/en のキー集合完全一致**。
- **`<script src>` の並び**（state→i18n→nav→home→basic→players→game→course→score→testdata→calc→results→results-team→results-m1→roulette→backup→init）。
- **機能色の意味**（勝ち=緑/引分=橙/採用=枠/危険=赤）。`btn.danger`（削除ボタン）はそのまま。

---

## 11. 計算・データ非接触の論証

1. 本件の変更はすべて **(a) HTML 文字列の組み立て先（`view-game` → `view-basic`）**、**(b) 要素の入れ物（`.card` → `<details>`）**、**(c) CSS の font-size**、**(d) i18n の表示文字列** に閉じる。
2. `g.*` を書く経路は **setter 12 本のみ**で、どれも**引数・保存する値・`save()` の呼び方が不変**。変わるのは「保存後にどの render を呼ぶか」だけ（`renderGame()` → `renderBasic()`）で、これは**描画先の DOM ノードが変わったことに伴う機械的な付け替え**。
3. `chFormats(g)` / `curGame()` / `save()` / `computePoints` / `computePayout` / `teamWinPoints` / `nextKanji` はいずれも**呼び出し回数も引数も不変**。
4. `<details>` の開閉は `gsOpen`（揮発）にしか書かない＝`golfCompe_v1` の JSON は**前後で完全一致**。
5. よって `node tools/regress.mjs` は **`--update` なしで無差分**になる。差分が出たら実装が §3/§4 に触れている証拠。

---

## 12. 実装者への注意（つまずきポイント）

1. **`go('game')` を消し忘れると即クラッシュする。** `render()` の `hs.querySelector('button.on').scrollIntoView(...)`（`js/nav.js:63`）が null 参照で落ちる（実測で再現）。`views` から消す＝`display` ループからも消えるため、`view-game` の DOM を残したまま `views` だけ消すと**旧画面が出っぱなし**になる。**`index.html` と `js/nav.js` は同じコミットで直すこと。**
2. **「幹事メニュー」を二重に包まない。** `hostMenuCard()` は既に `<details>` を返すので、**`.gsec` クラスと `gsOpen`/`ontoggle` を足すだけ**にする（新しい `<details>` で包むと3重になる）。
   - **★2026-09-12 追記（#171 PR2 が main に入った）**: `hostMenuCard()` の内側に **`auditCard()`＝「データ点検」の `<details>`（`audit.summary`）が入れ子で入った**。つまり幹事メニューは既に `<details>`（外）＋`<details>`（内）の2段構造である。
     - **`.gsec` は外側（幹事メニュー）にだけ付ける**。内側の `auditCard()` は**素の `<details>` のまま**にする（`details.gsec>summary` の子セレクタなので内側には効かない＝見た目が階層どおりに分かれる）。
     - `auditCard()` / `auditRefresh()` / `runDataAudit()` / `auditDel()` は **`renderBasic()` を呼ばず `#auditOut` を直接書き換える**設計になっている。**この方式を壊さないこと**（`renderBasic()` を呼ぶと `<details>` が閉じるため。`gsOpen` は外側の幹事メニューしか覚えない）。
     - `auditRan`（揮発）と `gsOpen`（揮発）は独立した表示状態。どちらも localStorage に保存しない。
     - 本件の統合で `hostMenuCard()` の**中身・呼び出し順は変えない**（`renderBasic()` の末尾で呼ぶのも現行どおり）。
3. **`ontoggle` から再描画を呼ばない。** 無限ループになる（`open` 付与 → toggle 発火 → 再描画 → `open` 付与 …）。`gsToggle` は代入のみ。
4. **`.prizewin` は `<details>` 側に付ける**（`<details class="gsec prizewin">`）。`.in` の中に付けると既存 CSS のセレクタが外れる可能性があるので、実装後に配点行の見た目を必ず確認。
5. **β/α の切り替え**（`toggleChannel` → `setChannel` → `render()`）でセクションの出没が変わる。α に戻したときに「ラスベガス」セクションが消えること、`g.formats.vegas` の値自体は保持されることを確認（`chFormats` の規律は不変）。
6. **`data-i18n` は静的 DOM にしか効かない。** `<summary>` は `renderBasic()` が生成する動的 HTML なので、**`t('game.periaCard')` のように `t()` で埋める**（現行 `h2` と同じ）。`data-i18n` を付けないこと。
