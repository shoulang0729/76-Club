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

---
---

# 追補（2026-08-30）: 対象順位の選択＋繰り上げ/繰り下げオプション【確定・ユーザー回答反映】

ユーザー原文: 「次回幹事を1位、2位、ブービーでオプションとして。さらに繰り上げ繰り下げのオプションも付けて」
前提: PR #85 マージ済み（main 141d9b9）。`g.kanjiBadge:boolean`（既定 false）・ON時は固定「ネット2位＋ブービー」・kanjiExempt は `nextKanji` の filter 方式でスキップ。
本追補は §1〜§9 を**上書きせず拡張**する（§2 の意味論と §4 のデータモデルに追加。`nextKanji` の**判定式を変更**するため load-bearing 扱い・前後比較例 §13 必須）。正本は **§11.17** を追補。
**区分: 確定**（§16 の Q1/Q2 にユーザー回答済み: Q1=提案の語義で OK・Q2=**(c) 順位ごとに方向設定**で確定）。

## §10 要件の分解と決定事項【確定】

1. **対象順位の選択**: 1位／2位／ブービーを**個別 ON/OFF（複数選択可）**。既存の「2位＋ブービー」は r2=ON・booby=ON の組合せで表現。
2. **マスタースイッチ**: 既存 `kanjiBadge` を**維持**する。
   - 根拠: PR #85 で出荷済みの UI 連続性・1タップで機能全体を殺せる・OFF にしても順位選択の設定値が保存されたまま残る。
   - `kanjiBadge=ON` かつ 3順位すべて OFF → **バッジなしの有効な状態**（エラー・強制補正はしない。注記文で示すのみ）。
3. **繰り上げ／繰り下げ**: **順位ごと**に方向を設定する（Q2=(c) ユーザー確定・UI 複雑化は許容）。データは各順位 `{enabled, dir}` の組（§12）。ゲーム全体で1方向の `kanjiShift` 案は**廃案**（設計段階のみ・未実装のため廃止フィールドは発生しない）。

## §11 意味論の厳密定義（判定式・load-bearing）【確定】

### §11.1 順位リスト
`ranked(parts, netScore, 'asc')` の並び（現行 nextKanji と同じ: 参加者のうち `gross>0`・タイブレーク §10.19 込み）。リスト長 = N。**位置**: 1位 = idx0・2位 = idx1・ブービー = idx N-2。位置が存在しない（idx<0 または idx≥N）対象は**該当なし**。

### §11.2 シフト（免除時の代替探索・順位ごと）
各対象順位 k（r1/r2/booby）は自分の方向 `kanjiRanks[k].dir` を持つ。対象位置の選手が `kanjiExempt` の間、**位置を1つずつその方向へ移動**して最初の非免除者を採用する:
- **`'down'`＝繰り下げ**: 順位数値が**大きい**方向（1位→2位→…→最下位）。ブービーでは**ブービーメーカー（最下位）方向**。
- **`'up'`＝繰り上げ**: 順位数値が**小さい**方向（…→2位→1位）。
- 連続免除はそのまま歩き続ける（§13 例G）。
- **端の打ち切り**: リスト端を越えたら**その対象は該当なし**（逆方向へのフォールバックはしない・他の対象順位の判定には影響しない）。
  - 特記: **1位で `'up'`** は上に順位が無いため、1位の選手が免除なら常に該当なしになる（設定として許容・UI の選択肢文言で明示 §15）。

### §11.3 重複の扱い
複数の対象順位が**同一人物**に解決した場合（例: N=3 で2位とブービーが同位置・シフトの合流）、**バッジは1個**（再シフトして別人に散らさない。現行実装も hl マップ上書きで1個＝同等）。

### §11.4 実装スケッチ（js/calc.js `nextKanji` 置き換え）
返り値を `{nikai,booby,sameCount}` から **pid 配列（重複除去済み・該当なしは空配列）**へ変更。呼び出し元は results.js の net 分岐のみ（§1 #2）。

```js
/* next kanji（§11.17）: 対象順位 kanjiRanks を順位ごとの dir 方向に免除スキップして解決。表示専用・配点非関与 */
function nextKanji(g){
  const parts=g.participants.filter(pid=>{const p=state.players.find(x=>x.id===pid); return p && gross(g,pid)>0;});
  const order=ranked(parts,pid=>netScore(g,pid),'asc').map(r=>r.pid);
  const N=order.length, R=g.kanjiRanks;
  const exempt=pid=>{const p=state.players.find(x=>x.id===pid); return !p||p.kanjiExempt;};
  const resolve=(i0,dir)=>{ const step=dir==='up'?-1:1;
    for(let i=i0; i>=0&&i<N; i+=step){ if(!exempt(order[i])) return order[i]; } return null; };
  const T=[]; if(R.r1.enabled)T.push([0,R.r1.dir]); if(R.r2.enabled)T.push([1,R.r2.dir]); if(R.booby.enabled)T.push([N-2,R.booby.dir]);
  return [...new Set(T.filter(([i])=>i>=0&&i<N).map(([i,d])=>resolve(i,d)).filter(Boolean))];
}
```

results.js 側（net 分岐・現行 L117-118 を差し替え）: `const pids = g.kanjiBadge ? nextKanji(g) : []; const hl = pids.length ? {} : null; pids.forEach(pid=>hl[pid]=t('term.organizer'));`。バッジ文字は既存 `term.organizer`「幹事」のまま（順位別の文字分けはしない）。

### §11.5 旧 filter 方式との違い（明記）
旧実装は「免除者を除外したリストで 2位/ブービーを数え直す」ため、**対象位置と無関係な免除者でも対象が動く**副作用があった（例B': 1位が免除だと2位対象が3位へ／例D: 最下位が免除だとブービー本人が非免除でもブービーが繰り上がる）。新方式は**対象位置起点のシフト**なので、免除者が対象位置とシフト経路上にいない限り結果は動かない。migrate 既定（§12）は「対象本人・経路上の免除」ケースでは旧と完全一致し、この副作用ケースのみ是正として差が出る（§13 で網羅）。

## §12 データモデル（§4 追補・正本 §11.17）【確定】

**追加フィールド（`golfCompe_v1` 内・localStorage 新キーなし）**:

| フィールド | 型 | 既定 | 意味 |
|-----------|----|------|------|
| `game.kanjiRanks` | `{ r1:{enabled,dir}, r2:{enabled,dir}, booby:{enabled,dir} }`（enabled:boolean・dir:'down'\|'up'） | `{ r1:{enabled:false,dir:'down'}, r2:{enabled:true,dir:'down'}, booby:{enabled:true,dir:'up'} }` | 対象順位と免除時のシフト方向（順位ごと） |

- ネスト命名 `enabled` は既存 `womenEvery.enabled` の慣例に合わせた。`kanjiShift`（単一方向案）は**採用しない**（未実装のまま廃案＝データに痕跡なし）。
- **migrate 既定 = 現行挙動の保存**: `r2=ON/'down'`・`booby=ON/'up'`・`r1=OFF`。旧 filter 方式は実質「2位=下方向・ブービー=上方向」の挙動のため、この組合せで対象本人／経路上免除のケースは完全一致（§13 例A/B/C/G）。旧方式固有の副作用ケース（例B'/D）のみ §11.5 の是正で差が出る。
- `r1.dir` の既定は `'down'`（1位で 'up' は常に該当なしになるため、既定として妥当なのは down のみ）。
- `js/state.js` 追記: `newGame()` に上記既定を追加・`migrate()` に `if(!g.kanjiRanks) g.kanjiRanks={r1:{enabled:false,dir:'down'},r2:{enabled:true,dir:'down'},booby:{enabled:true,dir:'up'}};`（kanjiBadge の値に関わらず補完）。
- `kanjiBadge:boolean`（既定 false）は**そのまま維持**（マスタースイッチ・§10-2）。
- バックアップは state 丸ごとのため自動追従（backup.js 変更なし）。旧バックアップ取込は migrate 補完。

## §13 前後比較例（判定式変更・必須）【確定】

前提: N=10・ネット順 P1(1位)〜P10(最下位)・P9=ブービー。「旧」= PR #85 時点（filter 方式・2位＋ブービー固定）。「新既定」= kanjiBadge:ON・migrate 既定（r2=ON/down・booby=ON/up・r1=OFF）。

| 例 | 免除者 / 設定 | 旧 | 新既定 | 差の説明 |
|----|--------------|----|--------|---------|
| A | なし | P2, P9 | P2, P9 | **一致**（最頻ケース） |
| B | P2 | P3, P9 | P3, P9 | **一致**（r2 down で1つ歩く） |
| C | P9(ブービー) | P2, P8 | P2, P8 | **一致**（booby up で1つ歩く）★**移行後デフォルトで挙動不変の代表例** |
| G | P2, P3 連続免除 | P4, P9 | P4, P9 | **一致**（連続免除は歩き続ける） |
| B' | P1（対象位置外の免除） | P3, P9 | **P2**, P9 | **差**: 旧は filter 副作用で2位対象が動いた。新は経路外免除に不動（§11.5 是正） |
| D | P10(BM)（対象位置外の免除） | P2, **P8** | P2, **P9** | **差**: 旧は非免除のブービー本人が動いた。新は本人のまま（§11.5 是正） |
| E | r1=ON/'up'・P1 免除 | —（旧に1位対象なし） | 1位対象**該当なし**（端打ち切り §11.2）・r2/booby は独立に判定 | 新設定の端ケース |
| F | なし・N=3・r2+booby | P2 に1個 | P2 に**1個**（idx1 が両対象・§11.3） | 重複はバッジ1個・旧同等 |
| H | booby='down' に変更・P9 免除 | —（旧に下方向なし） | ブービー対象→**P10**（BM方向） | 順位ごと方向で新たに選べる挙動 |

- 数値（ネット・pt・¥）は全ケースで不変＝**変わるのはバッジの付く行のみ**。
- 既定 OFF（kanjiBadge=false）のゲームは新旧とも表示ゼロで差なし。

## §14 設定UI（js/game.js「次回幹事」カードの拡張）【確定】

マスター ON のときだけサブ設定を表示（Vegas 個別設定カードの出没と同型）。`setKanjiBadge` に `renderGame()` を追加して出没を再描画。**各順位=1行（チェック＋方向 select）**。チェック OFF の行の select は disabled（誤解防止）。

```
┌ 次回幹事 ─────────────────────────────┐
│ ☑ 次回幹事のバッジを表示                        ← 既存（文言から「（ネット2位とブービー）」を削除）
│ ─ 以下はマスターON時のみ表示 ─
│ 対象順位（幹事対象外の選手だった場合の代わりも選択）:
│ ☐ 1位      [下の順位へ（1位→2位）▼(disabled)]
│ ☑ 2位      [下の順位へ（2位→3位）▼]            ├ 下の順位へ（…）＝各行の既定†
│ ☑ ブービー  [上の順位へ（ブービー→下から3番目）▼]  └ 上の順位へ（…）
│ （muted）ネット順位のうち選んだ順位に「幹事」バッジを表示。
│  対象の選手が「幹事対象外」のときは行ごとに選んだ方向の次の選手へ。
│  1位で「上の順位へ」を選ぶと、1位が対象外の場合は該当なしになります。
└──────────────────────────────────┘
† 行の既定 = migrate/newGame 既定（1位・2位=下の順位へ／ブービー=上の順位へ・§12）
```

セッター（グローバル関数・ESM 化しない）:

```js
function setKanjiRank(k,v){ curGame().kanjiRanks[k].enabled=v; save(); renderGame(); }   // 再描画で select の disabled を追従
function setKanjiRankDir(k,v){ curGame().kanjiRanks[k].dir = v==='up'?'up':'down'; save(); }
function setKanjiBadge(v){ curGame().kanjiBadge=v; save(); renderGame(); }   // 既存＋再描画追加
```

- 方向 select の選択肢は**順位ごとの具体例つき文言**（§15。「繰り上げ/繰り下げ」の方向語は UI に使わない＝語義取り違え防止・Q1 回答準拠）。

## §15 i18n（追加10キー＋文言更新2キー・ja/zh/en 同時）【確定】

**追加**:

| キー | ja | zh | en |
|------|----|----|----|
| `game.kanjiRanks` | 対象順位 | 目标名次 | Target ranks |
| `game.kanjiR1` | 1位 | 第1名 | 1st |
| `game.kanjiR2` | 2位 | 第2名 | 2nd |
| `game.kanjiBooby` | ブービー | 倒数第2名 | Booby |
| `game.kanjiR1Down` | 下の順位へ（1位→2位） | 顺延到下一名（第1名→第2名） | Next rank down (1st → 2nd) |
| `game.kanjiR1Up` | 上の順位へ（1位の上は無し＝対象外なら該当なし） | 提前到上一名（第1名之上无人，豁免时无人当选） | Next rank up (none above 1st; no badge if exempt) |
| `game.kanjiR2Down` | 下の順位へ（2位→3位） | 顺延到下一名（第2名→第3名） | Next rank down (2nd → 3rd) |
| `game.kanjiR2Up` | 上の順位へ（2位→1位） | 提前到上一名（第2名→第1名） | Next rank up (2nd → 1st) |
| `game.kanjiBoobyDown` | 下の順位へ（ブービー→最下位） | 顺延到下一名（倒数第2名→最后一名） | Next rank down (booby → last) |
| `game.kanjiBoobyUp` | 上の順位へ（ブービー→下から3番目） | 提前到上一名（倒数第2名→倒数第3名） | Next rank up (booby → 3rd from last) |

**文言更新（キーは不変・値のみ・3言語同時）**: `game.kanjiTgl`＝「次回幹事のバッジを表示」（順位の固定記載を削除。zh/en も同旨）／`game.kanjiNote`＝「ネット順位のうち選んだ順位に「幹事」バッジを表示します。対象の選手が幹事対象外のときは、行ごとに選んだ方向の次の選手に移ります。1位で「上の順位へ」の場合は該当なしになります。」（zh/en 同旨・実装時に3言語同時更新）。

## §16 ユーザー確認事項【回答確定・2026-08-30】

- **Q1 語義**: 提案どおりで確定（繰り下げ＝対象位置が下位方向へ・繰り上げ＝上位方向へ。UI は方向語を使わず「下の順位へ（2位→3位）」等の具体例表記）。
- **Q2 既定方向とブービー**: **(c) 順位ごとに方向設定**で確定（ユーザー明示選択・UI 複雑化は許容）。migrate 既定は現行挙動を保存する組合せ（2位=down・ブービー=up・1位=OFF/down）＝§12。
- 既定で確定済み（異論なし扱い）: マスタースイッチ維持・重複時バッジ1個・端打ち切り＝該当なし。

## §17 受け入れ条件・触らない範囲・PR分割（追補分）【確定】

**受け入れ条件**（§7 に追加。前提: テストデータ・kanjiExempt を付け替えながら確認）:
1. 旧データ互換: PR#85 時点で kanjiBadge=ON だったゲームは migrate 後「1位=OFF・2位=ON/下へ・ブービー=ON/上へ」となり、§13 例A/B/C/G のケース（免除なし・対象本人免除・連続免除）で表示が旧と完全一致。例B'/D（経路外免除）のみ §11.5 の是正どおり差が出る。
2. 対象順位: 1位/2位/ブービーの各チェックが独立に効く（1位のみON→ネット1位の行だけにバッジ等）。全OFF→バッジなし（エラーなし）。
3. 方向が順位ごとに独立: 2位=下へ・ブービー=上へ の状態で、2位免除→3位・ブービー免除→下から3番目（例B/C）。ブービーを「下へ」に変えると免除時に最下位へ（例H）。
4. 端打ち切り: 1位=ON/上へ・1位免除 → 1位対象のみ該当なし・他対象は正常（例E）。
5. 重複: N=3・r2+booby で同一人物にバッジ1個（例F）。
6. サブ設定はマスターON時のみ表示・チェックOFF行の select は disabled・OFF→ONで設定値が保持されている。
7. ネット順位・数値・配点・他タブは全設定で不変。`node tools/verify.mjs` green・3言語切替OK・`?v=`更新。
8. バックアップ書出→初期化→取込で kanjiRanks 設定が復元される。旧バックアップ（kanjiRanks 無し）の取込は migrate 既定になる。

**触らない範囲**（§8 に追加): `kanjiBadge` の既定 false・`ranked`/タイブレーク・`term.organizer`・rankCardNS の hlMap 機構・kanjiExempt の選手タブUI。


**推奨PR分割**: **1 PR で完結**。js/calc.js（nextKanji 置き換え §11.4）・js/state.js（migrate/newGame）・js/game.js（カード拡張＋セッター §14）・js/results.js（net 分岐の hl 組み立て §11.4）・js/i18n.js（追加10キー＋更新2キー×3言語）・index.html（`?v=` のみ）。
