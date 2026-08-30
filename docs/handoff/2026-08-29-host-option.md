# 次回幹事バッジ機能のオプション化（コンペごと設定・既定OFF）— 2026-08-29（2026-08-30 全面改稿・ユーザー回答反映＝確定）

対象: 結果発表＞個人戦＞ネットタブの**「次回幹事」バッジ機能**（ネット2位＋ブービー＝次回幹事の自動判定・バッジ表示）を、**コンペごとの設定で ON/OFF** できるようにする。**既定 = OFF（非表示）**。
関連正本: `2026-07-12-golf-compe-web.md` §10.6（次回幹事）・§4（データモデル）・**§11.16（本件の正本追補・本設計と同時に追記）**。
**§3 計算仕様には非接触**（nextKanji はバッジ表示専用。配点 computePoints/computePayout・順位計算 ranked/tieBreak に一切関与しないことを確認済み → §3 詳細）。**§4 データモデルに新フィールド追加**（正本 §11.16 追補あり）。

## §0 経緯（初版からの方針転換）

- 初版（2026-08-29）は「幹事機能＝幹事の操作UI（勝者登録・伏せ演出等）の表示ON/OFF・端末単位キー `golfCompe_hostInd`」で設計したが、ユーザー回答により**不採用**。
- 確定事項（ユーザー回答・2026-08-30）:
  1. 対象 = **次回幹事バッジ機能そのもの**（幹事の操作UIオプション化はやらない）。
  2. 既定 = **OFF**（既存ユーザーもバッジが出なくなる挙動変化をユーザー了承済み）。
  3. 保存 = **コンペごと**（`golfCompe_v1` のゲームデータ内。表示状態キーの新設はしない）。
- 初版の操作UI一覧・golfCompe_hostInd 案は破棄（本ファイル改稿で削除。経緯は本節のみ）。

## §1 現行実装の洗い出し（次回幹事バッジの全接点）

| # | 箇所 | 内容 |
|---|------|------|
| 1 | `js/calc.js` L239-247 `nextKanji(g)` | ネット順（`gross>0` の参加者）から `kanjiExempt` を除外した並びで 2位=`eligible[1]`／ブービー=`eligible[length-2]` を算出。**参照元は下記 #2 のみ**（computePoints/computePayout からは呼ばれない＝配点非関与） |
| 2 | `js/results.js` L114-117（renderIndGame の `key==='net'` 分岐） | `nextKanji(g)` を呼び、`hl[nikai]=hl[booby]=t('term.organizer')` を作って `rankCardNS(..., hl)` に渡す。**ネットタブのみ・現行唯一の表示箇所** |
| 3 | `js/results.js` L226 rankCardNS／`js/roulette.js` L201 leaderboard | `hlMap` があれば行ハイライト（.hlrow）＋ `.kanjibadge` 描画（汎用機構・本件では変更しない） |
| 4 | `js/players.js` L51,116,124／`js/state.js` L14 | 選手ごとの `kanjiExempt`（幹事対象外）チェック列と永続化（グローバル選手属性・変更しない） |
| 5 | `js/i18n.js` `term.organizer`／`player.kanjiChk` | バッジ文字「幹事」・選手タブの「幹事対象外」ラベル（変更しない） |
| 6 | `styles.css` `.kanjibadge`／`.hlrow` | バッジ・行ハイライトのスタイル（変更しない） |

計算・配点への絡み: `nextKanji` の呼び出しは #2 の1箇所のみ。`computePoints`/`computePayout`/`ranked`/`tieBreak` は参照しない＝**表示のみの機能**。よって §3 計算仕様は非接触。

## §2 オプションの意味論【確定】

**ゲームごとのブール設定 `g.kanjiBadge`。既定 = `false`（OFF・非表示）**。

- **OFF（既定）**: renderIndGame のネット分岐で `nextKanji(g)` を**呼ばず**、`rankCardNS` に `hlMap=null` を渡す → バッジ・行ハイライトとも出ない。ネット順位・スコア・タイブレーク・配点・他タブはすべて不変。
- **ON**: 現行実装と同一（ネットタブの2位／ブービー行に「幹事」バッジ＋ .hlrow ハイライト。kanjiExempt 除外・繰り下げも現行 nextKanji のまま）。
- 選手タブの「幹事対象外」チェック列は **ON/OFF に関わらず現行のまま表示・編集可**（選手はグローブル属性・ゲーム設定に連動して出没させない。OFF のゲームでは単に参照されないだけ）。

### 前後比較の例
参加10名・ネット順 = 佐藤(1位)・田中(2位)・…・鈴木(9位=ブービー)・高橋(10位)、幹事対象外なし:

| 画面 | 現行（〜本改修前） | 改修後・既定（OFF） | 改修後・ON |
|------|------------------|--------------------|-----------|
| 個人戦＞ネット | 田中・鈴木の行に「幹事」バッジ＋ハイライト | **バッジ・ハイライトなし**（順位・ネット値は同一） | 現行と同一 |
| 個人戦＞グロス他・チーム戦・ポイント | — | 変化なし | 変化なし |

**注意（挙動変化・ユーザー了承済み）**: 既定 OFF のため、**既存ゲームも改修後はバッジが出なくなる**。従来どおり表示したいゲームはゲーム設定で ON にする。

## §3 §3計算仕様への影響 = なし（確認結果の明記）

- `nextKanji` は配点（computePoints）・按分（computePayout）・順位（ranked/tieBreak）・スコア集計のいずれからも参照されない（§1 の洗い出しどおり）。
- OFF で `nextKanji` を呼ばなくなっても、いかなる数値（ネット・pt・¥）も変わらない。**正本 §3 の変更なし・回帰不要**（tools/verify.mjs の計算回帰はそのまま green のはず）。

## §4 データモデル（load-bearing・正本 §4 への追補 = §11.16）

**新フィールド: `game.kanjiBadge: boolean`（既定 `false`）**

- 命名根拠: 既存の同系統命名 `kanjiExempt`（選手）・`.kanjibadge`（CSS クラス）・`nextKanji`（関数）に合わせた `kanji` 接頭。機能実体が「バッジ表示」なので `kanjiBadge`。
- `js/state.js` への追加（2箇所）:
  - `newGame()`: `kanjiBadge:false,` を追加（`womenEvery` の並びの近く）。
  - `migrate()`: `if(g.kanjiBadge===undefined) g.kanjiBadge=false;` を追加。
    - 既存データはフィールド無し＝undefined→falsy で**migrate 無しでも OFF 扱いにはなる**が、既存 migrate の慣例（womenEvery.enabled/prizePool 等すべて明示バックフィル）に合わせ、バックアップ JSON・Phase2 Firestore 転記でフィールドが明示されるよう**追記する（確定）**。
- localStorage キーは `golfCompe_v1` のまま（**新キーなし**）。表示状態キー群（lang/theme/channel/seenTop）にも触れない。データ/表示状態分離の原則はそのまま維持（本設定は「コンペの運営ルール」＝データなので golfCompe_v1 側が正しい置き場）。
- バックアップ（js/backup.js）は state 丸ごと入出力のため自動追従。旧バックアップの取込は migrate で補完。**backup.js の変更不要**。
- 正本 `2026-07-12-golf-compe-web.md` に **§11.16** を追補（本設計と同時に docs コミット。§4 の JSONC ブロック自体は歴代追補の慣例どおり直接編集しない）。

## §5 設定UIの置き場所【確定判断】= ゲーム設定タブ（js/game.js）

- **判断**: コンペごとの設定は現状すべて `js/game.js`（ペリア係数・エブリ・フォーマット・ルーレット・配点・賞金原資）に集約されており、`js/basic.js` は「どのコンペか」（名前/日付/コース）＋幹事メニュー（端末向け動作確認）のみ。次回幹事は「このコンペの運営ルール」なので**ゲーム設定タブ**が正しい。
- **位置**: エブリハンデカードの直後・フォーマットカードの前（個人まわり設定のまとまり。配点に絡まないためポイントカード内には入れない）。
- **形**: womenEvery カードと同型のカード1枚（h2＋チェックボックス1行＋muted 注記）。

```
┌ ゲーム設定タブ ──────────────────┐
│ [ダブルペリア設定カード]（既存）      │
│ [女性エブリハンデカード]（既存）      │
│ ┌ 次回幹事 ──────────────┐ ← 新設カード
│ │ ☐ 次回幹事のバッジを表示        │ ← 既定チェックなし（OFF）
│ │ （muted）ネット2位とブービーを次回│
│ │  幹事として結果発表のネット順位に │
│ │  表示します。対象外の選手は選手タ │
│ │  ブの「幹事対象外」で設定。       │
│ └────────────────────┘
│ [集計フォーマットカード]（既存）      │
│ …                                   │
```

マークアップ例（renderGame 内・エブリカードの直後に挿入）:

```html
html += `<div class="card"><h2>${t('game.kanjiCard')}</h2>
  <label style="display:flex;gap:8px;align-items:center;font-size:14px">
    <input type="checkbox" ${g.kanjiBadge?'checked':''} onchange="setKanjiBadge(this.checked)"> ${t('game.kanjiTgl')}
  </label>
  <div class="muted" class="mt6">${t('game.kanjiNote')}</div></div>`;
```

セッター（setWE と同型・グローバル関数・ESM 化しない）:

```js
function setKanjiBadge(v){ curGame().kanjiBadge=v; save(); }
```

結果側（js/results.js renderIndGame の net 分岐・変更はこの1点のみ）:

```js
const nk = g.kanjiBadge ? nextKanji(g) : null;   // OFF（既定）はバッジ判定自体を行わない
```

## §6 i18n 追加キー（ja/zh/en 3言語同時・キー集合完全一致）

| キー | ja | zh | en |
|------|----|----|----|
| `game.kanjiCard` | 次回幹事 | 下届干事 | Next organizer |
| `game.kanjiTgl` | 次回幹事のバッジを表示（ネット2位とブービー） | 显示下届干事标记（净杆第2名与倒数第2名） | Show next-organizer badges (net 2nd & booby) |
| `game.kanjiNote` | ONにすると結果発表のネット順位で、ネット2位とブービーの行に「幹事」バッジを表示します。対象外にしたい選手は選手タブの「幹事対象外」にチェック。 | 开启后，将在成绩发布的净杆排名中为净杆第2名与倒数第2名标注「干事」。如需豁免某选手，请在选手页勾选「干事豁免」。 | When on, the net standings mark the net 2nd place and the booby with an "Organizer" badge. Exempt players via "Organizer-exempt" in the Players tab. |

- 追加は3キーのみ。バッジ文字は既存 `term.organizer`（幹事/干事/Org.）を流用・変更しない。既存キーの変更・削除なし。

## §7 受け入れ条件

前提: テストデータ投入済み（12名・スコアあり）。

1. **既定=OFF**: 新規ゲーム作成直後・既存ゲーム（改修前データ）とも、個人戦＞ネットに「幹事」バッジ・行ハイライトが**出ない**。ネットの順位・数値・タイブレークは改修前と同一。
2. **ON**: ゲーム設定＞次回幹事カードでチェックを入れると、ネットタブの2位とブービーの行に「幹事」バッジ＋ハイライトが出る（改修前の表示と同一。kanjiExempt の選手は飛ばして繰り下げ）。
3. **ゲームごと独立**: ゲームAを ON・ゲームBを OFF にすると、ゲーム切替でバッジ有無が正しく追従する。ゲーム複製（dupGame）で設定値も複製される。
4. **永続化**: ON にして再読込しても ON のまま。`golfCompe_v1` の該当ゲームに `"kanjiBadge":true` が保存され、**localStorage の新キーは増えていない**。バックアップ書出→初期化→取込で設定が復元される。旧バックアップ（フィールド無し）の取込は OFF になる。
5. **無影響の確認**: グロス/ステーブル等の他個人タブ・チーム戦・ポイント（pt・¥）・ルーレット・選手タブの「幹事対象外」列は ON/OFF で一切変化しない。
6. **i18n**: 3言語でカード・ラベル・注記が切り替わる。`node tools/verify.mjs` green（3言語パリティ・未定義キー参照なし・計算回帰不変）。
7. **キャッシュ**: js/** 変更のため index.html の `?v=` を PR 番号に一括更新。

## §8 触らない範囲

- **§3 計算仕様全部**（nextKanji の判定式＝2位/ブービー/kanjiExempt 除外・繰り下げも含めて不変。OFF は「呼ばない」だけ）。
- `computePoints`/`computePayout`（次回幹事はポイント・賞金に関与しない現状を維持。**次回幹事を配点対象にはしない**）。
- 選手モデル `kanjiExempt`・選手タブのチェック列 UI・`player.kanjiChk` キー。
- `rankCardNS`/`leaderboard` の `hlMap` 汎用機構・`.kanjibadge`/`.hlrow` スタイル。
- localStorage キー集合（golfCompe_v1/lang/theme/channel/seenTop）・データ/表示状態分離。
- 初版で洗い出した幹事の操作UI（勝者登録 details・伏せ演出・目隠し・開封バー）＝**本件では一切触らない**。
- formats キー集合・2階層タブ構成・i18n 既存キー。

## §9 推奨PR分割と実装メモ

**1 Issue = 1 PR で完結**（分割不要の規模）。

| ファイル | 変更 |
|---------|------|
| `js/state.js` | newGame に `kanjiBadge:false`・migrate に undefined バックフィル1行 |
| `js/game.js` | エブリカード直後に次回幹事カード（§5 マークアップ）＋ `setKanjiBadge` |
| `js/results.js` | renderIndGame net 分岐: `const nk = g.kanjiBadge ? nextKanji(g) : null;`（1行） |
| `js/i18n.js` | `game.kanjiCard/kanjiTgl/kanjiNote` ×3言語 |
| `index.html` | `?v=` を PR 番号に更新のみ |

- docs（本ファイル＋正本 §11.16）は設計コミットとして分離（本ブランチでは親がコミット）。
- ESM 化しない・inline onchange → グローバル `setKanjiBadge`・読込順不変。
