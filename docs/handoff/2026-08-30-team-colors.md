# 2026-08-30 チームカラー設定（team-colors）

要件（ユーザー原文）: 「チームカラーを設定できるようにしたい。」

現状はチーム名からの正規表現導出（`tmColor(name)`・js/nav.js:84）のみで、ユーザーが色を選べない。
例: チーム名を「チームパープル」にすると既知名に当たらず灰（`--tm-gray`）になる。
本設計で **チームごとにプリセット5色から色を選択・保存**できるようにし、未設定時は現行の名前導出にフォールバックする（後方互換・前後差ゼロ）。

区分: **設計案**（§12 の確認事項はあるが、既定で実装着手可。回答が既定と異なれば追補）。

---

## 1. 現状把握（利用面の洗い出し・2026-08-30 時点）

色の解決は既に **nav.js `tmColor(name)` に一元化済み**。`var(--tm-*)` を直接書いている箇所は下記3行のみで、他は全てこの2関数経由:

| 箇所 | 内容 |
|---|---|
| js/nav.js:84-85 | `tmColor(name)` … 名前正規表現 → `'var(--tm-red)'` 等5トークン。**唯一の解決点** |
| js/roulette.js:3 | `rColor(name)` = `tmColor(name)` の別名 |
| js/roulette.js:4 | `rColorBg(name)` = `rColor(name).replace(')','-bg)')` → `'var(--tm-red-bg)'`（淡地ペア解決） |

呼び出し面（全て**チーム名文字列**を渡している）:

- **js/results.js**: 96（個人戦のチーム名タグ）・111（チーム別合計）・168（ニアドラのチーム行）・203（チーム戦 `colorOf`）・304（総合ヒーロー）・315（チーム戦ヘッダ・マスク時 `？？？` は色なし）・344（総合カード）・403/426（1 on 1 サマリ/カード）
- **js/roulette.js**: 99（順番表示）・125（スタンディング）・144（WIN 文字・勝ちチーム名）・154/162（パネル枠色 `--rl-tc` と淡地 `--rl-tc-bg`）・173/175（払い戻し操作行）
- **styles.css**: `--tm-red/blue/green/yellow/gray` ×5 ＋ 淡地 `--tm-*-bg` ×5 を **light（:root）/dark 両テーマで定義済み**（styles.css:23,25,46-47）。CSS 側から `var(--tm-*)` を参照する規則はなし（JS inline のみ）

チーム編集 UI: js/players.js:11-20（選手タブ「チーム対抗」カード。名前 input＋削除＋メンバーchip）。
データ: `g.teams[] = {id, name, memberIds[]}`（state.js。正本 §4）。テストデータ（testdata.js:27）と autoTeams/addTeam（players.js:134-138）は名前のみ生成。

**含意**: `tmColor` の内部だけを「設定色優先＋名前導出フォールバック」に差し替えれば、上記全利用面（WIN 文字・勝ちカード淡地・ヒーロー・配分表ラベル・1 on 1 等）が**呼び出し側の変更ゼロで**追従する。`rColorBg` の文字列置換も、返り値が `var(--tm-<key>)` 形式を保つ限りそのまま機能する。

## 2. 決定事項（既定と根拠）

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| D1 | 色の選択肢 | **プリセット5色限定**（red/blue/green/yellow/gray = 既存トークン） | 淡地 `-bg` ペアとダークテーマ値が既に4値/色で揃っており追加コストゼロ。自由 HEX は淡地・ダーク導出式（HSL 変換等）が必要でコスト大、かつ「面に濃色ベタ塗りしない」原則との整合検証も必要 → 不採用（§12 Q1） |
| D2 | 保存先 | `team.color`（**任意フィールド**・値はトークンキー文字列 `'red'|'blue'|'green'|'yellow'|'gray'`） | キー文字列なら light/dark 切替はトークン任せ。未設定（フィールド無し）=自動（名前導出）で**migrate 不要**・旧データ/バックアップ完全互換 |
| D3 | フォールバック | `color` 未設定 or 不正値 → 現行の名前正規表現導出 | 前後差ゼロを保証。不正値ガードで壊れたインポートにも安全 |
| D4 | 解決点の署名 | `tmColor(name)` の**署名は変えない**（内部で curGame().teams を名前引き） | 呼び出し15箇所を無変更で済ませ、差分最小・並行実装と衝突しにくい。teams は高々数件で O(n) 検索は無視できる |
| D5 | 同名チームが同一ゲームに複数 | 先勝ち（`find` の最初の一致） | 現行も同名なら同色になる仕様であり劣化なし。同名運用自体が想定外 |
| D6 | 同色重複 | **許容・警告なし**（§12 Q2） | 通常2〜3チーム・幹事が意図して選ぶ前提。警告 UI のコスト > 効用。スウォッチは常に5色すべて選択可 |
| D7 | チーム数 > 5 | 許容（6チーム目以降は必然的に色重複） | D6 と同じ。現行も名前プリセット4種の循環で重複し得る |
| D8 | addTeam/autoTeams の既定 | `color` を**付与しない**（=自動のまま） | 既定名（チームレッド等）は名前導出で正しい色になるため。testdata.js も無変更 |
| D9 | UI 配置 | 選手タブのチーム行内（名前 input の下）にスウォッチ行 | 色は「チームの属性」なので編集行に同居が自然。別カード不要 |
| D10 | 色設定の保存領域 | `golfCompe_v1`（`state` 内の team オブジェクト） | 表示状態ではなく**コンペデータ**（バックアップ・共有に載るべき）。localStorage キー追加なし |

## 3. データモデル（正本 §4 への追記案 — 本ファイルにのみ記載。正本の編集は実装 Issue とは別に PM/architect が docs 単独コミットで行う）

> **正本追記案**（2026-07-12-golf-compe-web.md §4 の teams 行を下記に差し替え）:
> ```
> "teams": [ { "id":"t1", "name":"チームレッド", "memberIds":["xxx"], "color":"red" } ],
>     // color: 任意。'red'|'blue'|'green'|'yellow'|'gray'（styles.css の --tm-* トークンキー）。
>     // 未設定/不正値は名前導出フォールバック（tmColor）。migrate 不要（2026-08-30-team-colors.md）
> ```

- migrate（state.js）への追加は**不要**（任意フィールドのため）。
- バックアップ（backup.js）は state 丸ごと JSON なので自動で保存/復元される。変更不要。

## 4. 色解決の一元化（js/nav.js・実装仕様）

nav.js:83-85 の `tmColor` を以下に置き換える（形はこの通りでなくてよいが、挙動・関数名・返り値形式は厳守）:

```js
/* チーム識別色（§11.8 トークン＝light/dark 自動反転）。設定色(team.color)優先・未設定は名前導出。
   返り値は 'var(--tm-<key>)' 固定形式（roulette.js rColorBg の '-bg)' 置換が依存・load-bearing） */
const TM_KEYS=['red','blue','green','yellow','gray'];
function tmKeyByName(name){ return /レッド|赤/.test(name)?'red':/ブルー|青/.test(name)?'blue'
  :/グリーン|緑/.test(name)?'green':/イエロー|黄/.test(name)?'yellow':'gray'; }
function tmKey(tm){ return (tm&&TM_KEYS.includes(tm.color))?tm.color:tmKeyByName(tm?tm.name:''); }
function tmColor(name){ const g=typeof curGame==='function'?curGame():null;
  const tm=g&&g.teams.find(x=>x.name===name);
  return `var(--tm-${tm?tmKey(tm):tmKeyByName(name)})`; }
```

- `tmKey(teamObj)` は players.js の UI（プレビュー・選択状態）からも使う共通ヘルパー。
- 読込順は現行のまま（state→i18n→nav→…）。`curGame` は state.js 定義・呼び出しは描画時のみなので順序問題なし。`typeof` ガードは保険。
- `rColor`/`rColorBg`（roulette.js）は**無変更**で追従する。

## 5. 設定 UI（js/players.js・選手タブ「チーム対抗」カード）

### 5.1 レイアウト（チーム1行ぶん・モック用）

```
┌───────────────────────────────────────────────┐
│ [チームレッド____________(input・文字色=有効色)]  [×] │  ← 既存行（input に色プレビュー追加）
│ カラー: (自動) ●red ●blue ●green ●yellow ●gray  │  ← 新設スウォッチ行
│ [chip 選手A on] [chip 選手B] [chip 選手C on] …    │  ← 既存メンバー行
└───────────────────────────────────────────────┘
```

- スウォッチ行: ラベル `team.colorLabel` ＋「自動」chip（`team.colorAuto`）＋ 丸スウォッチ×5 を横並び（`display:flex; gap:8px; align-items:center; margin-top:6px; flex-wrap:wrap`）。
- **選択状態**: `team.color===key` のスウォッチに `.on`。未設定なら「自動」chip に `.on`。自動 chip は現在の名前導出色を小さな丸ドットで併記（色だけに頼らない表示原則: 選択中は `.on` の枠＋ドット/チェックで示す）。
- **プレビュー**: チーム名 input の `style` に `color:var(--tm-${tmKey(t)})` を追加（文字色のみ・背景は塗らない）。色 or 名前を変えると `renderPlayers()` 再描画で即反映。
- 操作関数（グローバル・inline onclick 用）:
  ```js
  function setTeamColor(id,key){ const tm=curGame().teams.find(t=>t.id===id);
    if(key) tm.color=key; else delete tm.color;   // 自動=フィールド削除（JSON を汚さない）
    save(); renderPlayers(); }
  ```
- マークアップ例（1チームぶん・`k` はキー文字列で XSS 不問）:
  ```html
  <div class="row tm-swatch-row"><span class="muted">${L.label}</span>
    <span class="chip ${t.color?'':'on'}" onclick="setTeamColor('${t.id}',null)">${L.auto}
      <span class="tm-dot" style="background:var(--tm-${tmKeyByName(t.name)})"></span></span>
    ${TM_KEYS.map(k=>`<button class="tm-swatch ${t.color===k?'on':''}" title="${L[k]}"
      style="background:var(--tm-${k})" onclick="setTeamColor('${t.id}','${k}')"></button>`).join('')}
  </div>
  ```

### 5.2 実装上の注意（★ハマりどころ）

- players.js:15 の `g.teams.map(t=>…)` は **map 変数 `t` が i18n の `t()` を隠蔽**している。map 内で `t('team.colorLabel')` は呼べないので、**map の前でラベルを hoist** すること:
  `const L={label:t('team.colorLabel'),auto:t('team.colorAuto'),red:t('tmc.red'),blue:t('tmc.blue'),green:t('tmc.green'),yellow:t('tmc.yellow'),gray:t('tmc.gray')};`
  （map 変数の `tm` へのリネームでも可だが、差分が膨らむため hoist を推奨）

### 5.3 CSS（styles.css 追加。トークンのみ使用・新規カスタムプロパティなし）

```css
.tm-swatch{width:28px;height:28px;border-radius:50%;border:2px solid var(--card);
  outline:1px solid var(--line);cursor:pointer;padding:0;flex:none}
.tm-swatch.on{outline:2px solid var(--strong);outline-offset:2px}
.tm-dot{display:inline-block;width:10px;height:10px;border-radius:50%;flex:none}
```
- タッチ端末向け: styles.css:442 の既存メディアクエリ（.chip 44px のブロック）に `.tm-swatch{width:34px;height:34px}` を追加。
- ダークテーマ対応はトークン任せ（`--tm-*` が dark で反転済み）。追加定義不要。

## 6. i18n 追加キー（ja/zh/en 3言語同時・キー集合完全一致）

| キー | ja | zh | en |
|---|---|---|---|
| `team.colorLabel` | カラー | 颜色 | Color |
| `team.colorAuto` | 自動 | 自动 | Auto |
| `tmc.red` | 赤 | 红 | Red |
| `tmc.blue` | 青 | 蓝 | Blue |
| `tmc.green` | 緑 | 绿 | Green |
| `tmc.yellow` | 黄 | 黄 | Yellow |
| `tmc.gray` | 灰 | 灰 | Gray |

`tmc.*` はスウォッチの `title`（ツールチップ/読み上げ用。色だけに頼らない原則）。各言語ブロックの `game.teamCard` 近辺に配置。

## 7. 前後比較（表示差）

| ケース | 前（現行） | 後 |
|---|---|---|
| 既存データ（color 未設定）全般 | 名前導出色 | **完全一致（差分ゼロ）** |
| チーム名「チームレッド」・color 未設定 | 赤 `--tm-red` | 赤（同一） |
| チーム名「チームパープル」・color 未設定 | 灰 `--tm-gray`（フォールバック） | 灰（同一） |
| チーム名「チームパープル」・color='blue' 設定 | （不可能） | 全画面で青 `--tm-blue`（WIN 文字・枠・淡地 `--tm-blue-bg` 含む） |
| チーム名「チームレッド」・color='green' 設定 | （不可能） | 全画面で緑（**設定が名前導出に優先**） |
| 色設定後にチーム名を変更 | — | 設定色を維持（名前に引きずられない） |
| 「自動」に戻す | — | 名前導出に復帰（`color` フィールド削除） |

計算（§3）・順位・配分への影響: **なし**（表示色のみ）。

## 8. 受け入れ条件

1. color 未設定の既存データで、全画面（選手/結果発表の全サブタブ/ルーレット）の表示が現行と一致する（プレビュー用の名前 input 文字色を除く）。
2. 選手タブの各チーム行に「カラー: 自動＋5スウォッチ」が表示され、タップで即保存（`save()`）・即再描画される。選択状態が枠で判別でき、`title` に色名（現在言語）が付く。
3. 色を設定すると以下すべてが設定色に追従する: 個人戦のチーム名タグ／チーム別合計／チーム戦カード・ヘッダ／総合ヒーロー・総合カード／ニアドラのチーム行／1 on 1 サマリ・カード／ルーレット（順番・スタンディング・WIN 文字・パネル枠色・勝ちカード淡地塗り・払い戻し行）。
4. 淡地は対応する `--tm-<key>-bg` が使われる（ルーレット勝ちカードで確認）。
5. ダークテーマ切替で色がトークン値どおり反転する。
6. `node tools/verify.mjs` がパスする（i18n 3言語パリティ・計算回帰含む）。
7. localStorage キーの追加・変更なし。バックアップのエクスポート→インポートで color が保存/復元される。
8. `tmColor` の返り値が `var(--tm-<key>)` 形式を維持し、`rColorBg` が淡地を正しく解決する。
9. 不正な color 値（手編集インポート等）では名前導出にフォールバックし例外を出さない。

## 9. 触らない範囲

- §3 計算仕様（一切非接触。表示色のみの機能）。
- localStorage キー集合（`golfCompe_v1` 内の team オブジェクトにフィールド追加のみ）。
- `--tm-*` / `--tm-*-bg` トークンの**値**（light/dark とも現行のまま）。
- roulette.js の `rColor`/`rColorBg`、results.js の全呼び出し行（署名不変のため無変更）。
- state.js（migrate 追加不要）・testdata.js・backup.js・index.html の script 構成（`?v=` 一括更新を除く）。
- addTeam/autoTeams の既定動作（色は自動のまま）。

## 10. 推奨PR分割

**1 Issue＝1 PR**（差分が小さく分割の固定費に見合わないため）:
- js/nav.js（`TM_KEYS`/`tmKeyByName`/`tmKey`/`tmColor` 差し替え）＋ js/players.js（スウォッチ UI＋`setTeamColor`）＋ js/i18n.js（7キー×3言語）＋ styles.css（`.tm-swatch`/`.tm-dot`）＋ index.html `?v=` 更新。

並走注意: nav.js / players.js / i18n.js / styles.css を触る他タスクとは直列にすること。

## 11. 確認事項（product decision・一括質問。未回答なら既定で実装可）

- **Q1: プリセット5色限定でよいか？** 既定=よい（D1）。増色する場合（例: purple/teal）は light/dark × 本体/淡地の**4値/色**のデザイン決めが必要（`--e2-ink:#7d3c98` 系の紫は流用候補あり）。自由 HEX は淡地・ダーク自動導出式の設計が別途必要で今回は非推奨。
- **Q2: 同色重複は警告なしの許容でよいか？** 既定=許容（D6）。警告が欲しい場合はスウォッチ横に注意アイコン＋i18n 1キー追加の小追補で対応可。
- **Q3: addTeam の既定チーム名（'チームレッド' 等・日本語固定）は今回スコープ外でよいか？** 既定=スコープ外（色は名前でなく color フィールドで選べるようになるため、名前の多言語化は独立課題）。

---
---

# 追補（2026-08-30・バッチ91-A・**ユーザー確定要件**）

区分: **確定**。本追補は §1〜§11 のうち以下を上書きする（他の節は有効なまま）:
- **D1（5色限定）→ 10色に拡張**（§12・§13）
- **D8（addTeam は色付与しない）→ 重複回避の自動割当で明示保存**（§14）
- **§4 の `TM_KEYS` → 10キー・順序変更**（§13.3）
- **§6 の i18n 表 → 5キー追加で計12キー**（§15.2）
- Q1/Q3 はユーザー回答済み扱い（Q1=10色に拡張・Q3=既定名リストを10種へ拡張〈§14.3〉）。Q2（同色重複=許容）は既定どおり確定。

## 12. 新5色の選定（決定と根拠）

新設5色: **purple / orange / teal / pink / lime**（候補にあった brown は不採用）。

- 選定基準: 相互識別性（色相環上の間隔）・白地/濃地での可読コントラスト・投影原則（後方から判別）・ダークテーマ可読性。
- 既存5色の色相は red≈6°・yellow(琥珀)≈37°・green(深緑)≈146°・blue≈205°・gray=無彩色。**brown（≈20°台・低彩度）を入れると暖色帯（red/orange/yellow）が4色に密集**し、特に投影距離で yellow(琥珀)・brown の混同リスクが高い → **lime（黄緑≈75°）を採用**して色相を分散させた（Tableau10 等の10色カテゴリパレットの知見に整合。ユーザーが brown を希望する場合の代替4値は §13.4 に併記＝差し替えコストほぼゼロ）。
- yellow との混同注意（コーディネータ指摘）: orange は**赤寄り（色相≈19°）かつ高彩度**にして琥珀色の yellow（≈37°・金色系）と分離。lime は緑寄り（light≈75°/dark≈72°）で yellow と30°以上離す。
- pink は red(朱系)との混同を避け**マゼンタ寄り**（light≈329°/dark≈324°）。teal は green(146°)と blue(205°)の中間を**シアン寄り**（≈185°）で取り両者と分離。
- purple の light 本体 `#7d3c98` は既存 `--e2-ink`（エブリE2バッジ・styles.css:21）と**値が偶然一致**するが、トークンは別に新設する（意味が別・dark 値も別。E2バッジは極小表示で実害なし）。

## 13. 新色トークン（HEX 確定値・styles.css 追記仕様）

### 13.1 設計思想との整合（実測レンジ）

既存トークンのレンジに合わせた: light 本体=白地で読める濃色（L 25〜46%・白地コントラスト概算 3.7〜7:1）／light 淡地=同色相の極淡（L 89〜93%）／dark 本体=濃地で読める明色（L 56〜74%）／dark 淡地=同色相の暗色（L 16〜21%）。新色は全て **light 本体の白地コントラスト ≥ 4.2:1（既存最小 yellow≈3.7 を下回らない）・dark 本体の --card(#16202f) コントラスト ≥ 6:1**。

### 13.2 HEX 値表（★実装はこの値どおり。20値追加・既存10値は不変）

| キー | light 本体 `--tm-<k>` | light 淡地 `--tm-<k>-bg` | dark 本体 | dark 淡地 | 色相メモ |
|---|---|---|---|---|---|
| purple | `#7d3c98` | `#f0e2f7` | `#c084e8` | `#33204a` | 紫 282°/276° |
| orange | `#d35400` | `#fbe7d9` | `#f0954a` | `#452a10` | 橙 24°/27°（赤寄り・yellow と分離） |
| teal | `#0e7c86` | `#d9f0f2` | `#4cc7d4` | `#123c42` | 青緑 185°（シアン寄り） |
| pink | `#c2377f` | `#f9e0ed` | `#ee7ec2` | `#4a1e3c` | 桃 329°/324°（マゼンタ寄り） |
| lime | `#66801a` | `#ecf3d2` | `#b5cf4f` | `#303f12` | 黄緑 75°/72° |

- 白地コントラスト概算（light 本体）: purple 7.1 / orange 4.2 / teal 4.9 / pink 5.1 / lime 4.5。
- --card(#16202f) コントラスト概算（dark 本体）: purple 6.0 / orange 7.1 / teal 8.1 / pink 6.5 / lime 9.4。
- styles.css の追記位置: `:root` は既存 23行（本体）・25行（淡地）の各行末に続けて同じ行 or 直後行に追加。dark は 46-47行に同様。**既存10値（5色×本体/淡地×2テーマ）は1文字も変えない**。

### 13.3 `TM_KEYS` の改訂（§4 を上書き・表示順=自動割当順の単一ソース）

```js
const TM_KEYS=['red','blue','green','yellow','purple','orange','teal','pink','lime','gray'];
```
- 既存4色 → 新5色 → **gray は最後**（「無色に近い」ため自動割当の最終候補・スウォッチ末尾）。
- スウォッチ表示順・§14 の自動割当順は**この配列一つ**を参照する（順序の二重定義禁止）。
- `tmKey`/`tmColor`/`rColorBg`（§4）はこの配列拡張だけで10色対応（ロジック変更なし）。`tmKeyByName` の正規表現は**5色のまま拡張しない**（既存データの「現状表示維持」保証のため。例: 既存の「チームオレンジ」は現行どおり灰のまま。色は UI で明示選択 or 新規追加時の自動割当で付く）。

### 13.4 （参考）brown 差し替え用の代替4値

ユーザーが lime より brown を望んだ場合のみ使用: light 本体 `#8c5a3c` / light 淡地 `#f2e7dd` / dark 本体 `#c79a76` / dark 淡地 `#3a2a1c`（キー `brown`・`tmc.brown`= 茶/棕/Brown）。既定は lime（§12 の根拠）。

## 14. 既定色の重複回避自動割当（addTeam / autoTeams）

### 14.1 割当ルール（確定）

```js
/* 使用中判定は「有効色」（設定色 or 名前導出＝tmKey）。未設定の既存チームの見た目の色も使用中として避ける */
function tmPickColor(g,name){ const used=new Set(g.teams.map(t=>tmKey(t)));
  const nk=tmKeyByName(name);
  if(nk!=='gray' && !used.has(nk)) return nk;       // ① 名前導出色が空いていれば優先（gray への導出=「未知名」なので優先しない。§14.2）
  return TM_KEYS.find(k=>!used.has(k)) || nk; }     // ② 使用中なら TM_KEYS 先頭から最初の未使用色 ③ 全10色使用中は名前導出（重複許容）
```
- **割当順序** = `TM_KEYS` の並び: red → blue → green → yellow → purple → orange → teal → pink → lime → gray。
- addTeam / autoTeams とも、生成するチームに `color: tmPickColor(g, name)` を**明示保存**する（名前導出色を使う場合も保存＝後で名前を変えても色が変わらない・決定的）。
- 10チーム超（③）: 名前導出色で重複許容（Q2 の確定どおり警告なし）。
- **既存データ・testdata.js は触らない**（migrate なし。testdata の3チームは名前導出で従来どおり表示・color フィールドなしのまま）。

### 14.2 補足: ①で gray 導出を優先しない理由（★実装時に外さないこと）

新既定名（パープル等・§14.3）は `tmKeyByName` が **gray に落ちる**（正規表現は5色のまま＝§13.3）。もし①が gray も優先すると、5チーム目（チームパープル）に purple より先に gray が割り当たってしまう。gray への導出は「未知名フォールバック」であって色指定の意図ではないため、①から除外する（§14.1 の `nk!=='gray'` ガード）。gray を使いたい場合はスウォッチで明示選択できるほか、②の最終候補として10チーム目に自動でも付く。

連続追加例（受け入れ確認用・§14.3 の10種名リスト適用後）:

| n | 既定名（§14.3） | 割当色 | 経路 |
|---|---|---|---|
| 1〜4 | レッド/ブルー/グリーン/イエロー | red/blue/green/yellow | ① |
| 5〜9 | パープル/オレンジ/ティール/ピンク/ライム | purple/orange/teal/pink/lime | ②（名前導出=gray→スキップ→未使用先頭が名前と一致） |
| 10 | グレー | gray | ② |
| 11 | レッド（循環） | red（重複） | ③（全色使用中→名前導出） |

autoTeams(2/3): 空配列から レッド/ブルー(/グリーン) を生成 → red/blue(/green) が明示保存される（表示は従来どおり）。

### 14.3 addTeam 既定名リストの10種拡張（D8 と旧Q3 既定の改訂）

players.js:134 の `names` を10種に拡張し、**名前と色の対応がずれない**ようにする（5チーム目が「チームレッド(紫)」になる不整合の回避）:

```js
const names=['レッド','ブルー','グリーン','イエロー','パープル','オレンジ','ティール','ピンク','ライム','グレー'];
// 既定名は 'チーム'+names[g.teams.length%10]（従来の %4 を %10 へ）
```
- 既定名は従来どおり**日本語固定の初期データ値**（i18n 対象外。'チームレッド' と同じ扱い）。多言語化は引き続き独立課題。
- 名前・色とも幹事が後から自由に変更可（色は明示保存済みなので名前変更に追従しない＝§7 の仕様どおり）。

## 15. UI・i18n・CSS の差分（§5・§6 への追補）

### 15.1 スウォッチ UI

- §5.1 のマークアップは `TM_KEYS.map` のため**自動で10個描画**される。行は既指定の `flex-wrap:wrap` で折返し（タッチ時 34px×10＋自動chip で概ね2行）。順序は TM_KEYS どおり（gray 末尾）。
- ラベル hoist（§5.2 の `L`）に新5色ぶんを追加: `purple:t('tmc.purple'), orange:t('tmc.orange'), teal:t('tmc.teal'), pink:t('tmc.pink'), lime:t('tmc.lime')`。

### 15.2 i18n 追加5キー（計12キー・ja/zh/en 同時）

| キー | ja | zh | en |
|---|---|---|---|
| `tmc.purple` | 紫 | 紫 | Purple |
| `tmc.orange` | 橙 | 橙 | Orange |
| `tmc.teal` | 青緑 | 青绿 | Teal |
| `tmc.pink` | 桃 | 粉 | Pink |
| `tmc.lime` | 黄緑 | 黄绿 | Lime |

### 15.3 styles.css

§13.2 の20値を `:root` と `html[data-theme="dark"]` に追記（コメントで「新5色 2026-08-30-team-colors.md §13」参照を付す）。`.tm-swatch` 等の部品 CSS は §5.3 のまま変更なし。

## 16. 受け入れ条件（追補・§8 に加える）

10. スウォッチが**10個＋自動**表示され、狭幅で折り返して全て操作できる。順序は red,blue,green,yellow,purple,orange,teal,pink,lime,gray。
11. 新5色それぞれについて: 設定→全利用面（§8-3 の一覧）追従・淡地 `--tm-<k>-bg` 解決（ルーレット勝ちカード）・ダーク切替で §13.2 の dark 値に反転。
12. addTeam 連続実行で §14.2 確定版の表どおりに 1〜10 チーム目へ相異なる色が明示保存され、11 チーム目は重複許容（警告なし）。既定名は 'チームレッド'…'チームグレー' の10種循環。
13. autoTeams(2)/(3) で red/blue(/green) が `color` に明示保存され、表示は従来と同一。
14. **既存データ（color 未設定）は表示不変**: `tmKeyByName` は5色のまま（例: 既存「チームオレンジ」は灰のまま）。migrate なし。
15. `node tools/verify.mjs` パス（i18n 12キー×3言語パリティ含む）。

## 17. 触らない範囲・PR分割（改訂）

- 触らない範囲は §9 のとおり。ただし「addTeam/autoTeams の既定動作」は本追補 §14 で変更（自動割当＋既定名10種）、styles.css は**既存トークン値不変のまま20値追加**、と読み替える。testdata.js・state.js（migrate）・backup.js・§3計算・localStorage キー集合は引き続き非接触。
- **PR分割: 引き続き 1 Issue＝1 PR**（基本設計＋本追補を一括実装。nav.js＋players.js＋i18n.js＋styles.css＋index.html `?v=`）。追補ぶんの差分は TM_KEYS 5要素・tmPickColor 1関数・addTeam/autoTeams 数行・トークン20値・i18n 5キーで、分割固定費に見合わない。

## 18. 確認事項（追補・任意。未回答なら既定で実装可）

- **Q4: 5色目の新色は lime（黄緑）でよいか？** 既定=lime（§12: brown は暖色帯4色目になり yellow(琥珀)と混同リスク）。brown 希望なら §13.4 の4値＋`tmc.brown`（茶/棕/Brown）に差し替え（コストほぼゼロ）。
- **Q5: addTeam 既定名の10種拡張（§14.3・日本語固定のまま）でよいか？** 既定=拡張する（名前と色の対応ずれ回避）。不要なら names は4種のまま＝5チーム目以降「チームレッド(紫)」等の名色不一致が出る点だけ許容すること。
