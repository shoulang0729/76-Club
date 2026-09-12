# 設計：ニアピン／ドラコンを2セット運用する（OUTスタート組／INスタート組） — 2026-09-12

- 作成: 2026-09-12 / architect
- **区分: 確定**（§7 の個人配点1件のみ未決＝§15）。ユーザー確認済み要件は §1。
- **サイズ判定: M**（§3 計算仕様に触る・§4 データモデル追補あり・i18n 3言語×2キー・表示レイアウト変更）
- **load-bearing 該当: あり** → `niadoraTeamCount`（`js/calc.js:193-197`）と `computePoints` の個人賞加算（`js/calc.js:288-289`）。**前後比較は §6.2／§7.2**、**既定OFFでの無差分証明手順は §6.4**。
- 関連設計:
  - 正本 `2026-07-12-golf-compe-web.md` §3.6（ニアピン/ドラコン）・§4（`prizes`）・§11.14（投影原則）・§11.15（種目別勝ち点）→ **本件で §3.6/§4 に最小追補**（§12）
  - `docs/handoff/2026-08-20-npdc-par.md` … 対象ホールの par 導出（`niapinHolesOf`/`draconHolesOf`）・「廃止フィールドは残置・非参照」パターンの前例
  - `docs/handoff/2026-08-20-team-points.md` §3.3.1 … ニアドラ本数＝チーム種目の勝ち点
  - `docs/handoff/2026-09-06-m1-1v2.md` §2.1 … 「既存の形をそのまま有効にする」後方互換パターン（本件で比較検討・§3.1 案B）
  - `docs/handoff/2026-09-11-m1-start-side.md` §7.2 / `docs/handoff/2026-09-06-shotgun-flags.md` §3.3 … 既存の「スタートホール」概念2件 → **統合可否の結論は §4.3**

---

## 0. 結論サマリ

| 論点 | 決定 | 根拠 |
|---|---|---|
| 勝ち点の扱い | **「ニアドラ」は1種目のまま**（`teamEventPts` にキーを足さない）。ただし**本数は両セット合算** | §2。IN 組の旗が勝ち点に1本も効かない状態を作らない |
| データ表現 | **並行フィールド追加**：`g.prizes.niapinWinner2` / `draconWinner2`（キー=ホールindex・値=pid） | §3.1。セット1のフィールドを**1バイトも変えない**＝旧データ・旧バックアップ・旧JSが無変換で有効 |
| migrate | **必要**（空オブジェクトの backfill 3行のみ）。データ変換はゼロ | §3.3。`setPrize()` が `prizes[k][h]=v` と書くため、フィールド未定義だと例外になる（罠） |
| セットの識別 | **セット番号 1 / 2**。UI 表示名は **リテラル `OUT` / `IN`**（i18n キーを作らない＝スコアカードの `OUT`/`IN` 見出しと同じ扱い） | §4.1・§4.2 |
| 誰がどちらの組か | **アプリは持たない**。幹事が各ホールで2つの勝者欄を埋めるだけで成立 | §4.1。#140/#132 との共通化は**今回行わない**（将来パスは §4.3） |
| 使用切替 | **コンペごとのオプション `g.prizes.twoSets`・既定 false** | §5。既定OFFで既存コンペの表示・数値・**DOM 文字列が1つも動かない** |
| 個人配点 | **セット2の勝者にも同額（`P.niapin`/`P.dracon`）を付ける**（既定案） | §7。ただし配分原資の取り分が動くため**未決1件**として残す（§15-A） |
| 表示 | ヒーローカードは**1ホール=1セル**のまま、セル内を `OUT` 行 / `IN` 行の2行に | §8。開封（マスク）粒度は**ホール単位のまま**＝「全開封で表示本数＝`niadoraTeamCount`」の不変条件を無改造で維持 |
| 新規ファイル | **なし**（`js/state.js` `js/calc.js` `js/roulette.js` `js/results.js` `js/results-team.js` `js/i18n.js` `styles.css` `js/testdata.js`） | |
| localStorage キー | **5つのまま**（`golfCompe_v1` の `g.prizes` 配下のみ） | CLAUDE.md load-bearing |

---

## 1. 要件

### 1.1 ユーザー原文

> ニアドラチーム戦、2セットやりたいんだけど作れる？

### 1.2 確認済みの回答（PM 経由・2026-09-12）

| 質問 | 回答 |
|---|---|
| 「2セット」の意味 | **「1ホール旗2本が近い。INスタート組とOUTスタート組で作る。」** |
| チーム戦の勝ち点 | **「とりあえず表示だけ・勝ち点は後で」** → §2 の解釈で確定（ユーザー承認済み） |

### 1.3 運用モデル（何が起きているか）

ダブルスタート（1番スタート組＝OUT 組 / 10番スタート組＝IN 組）のコンペでは、両組が同じ Par3 を**別々の時間帯に**通る。1本の旗を両組で共有すると、先に回った組の記録が後の組に上書きされてしまう（あるいは後半組が旗を見つけられない）。そこで**各 Par3 に旗2本・各 Par5 に旗2本**を置き、**OUT 組の勝者・IN 組の勝者をそれぞれ決める**。

```
            3H (Par3)                       5H (Par5)
  ┌────────────────────┐        ┌────────────────────┐
  │ 🚩 OUT組用ニアピン旗 │        │ 🚩 OUT組用ドラコン旗 │
  │ 🚩 IN 組用ニアピン旗 │        │ 🚩 IN 組用ドラコン旗 │
  └────────────────────┘        └────────────────────┘
        ↓ 勝者2人                      ↓ 勝者2人
   niapinWinner[2] = OUT組の勝者    draconWinner[4]  = OUT組の勝者
   niapinWinner2[2]= IN 組の勝者    draconWinner2[4] = IN 組の勝者
```

**アプリが知る必要があるのは「各ホールにつき勝者が2人いる」ことだけ**で、誰が OUT 組で誰が IN 組かは知らなくてよい（§4.1）。

---

## 2. 勝ち点の解釈（★最初に決めた論点・ユーザー承認済み）

「勝ち点は後で」を素直に「何もしない」と読むと**不整合が出る**。`niadoraTeamCount`（`js/calc.js:193-197`）は現在「1ホール＝勝者1人」を前提に `niapinWinner[h]` だけを数えているので、セット2を並行フィールドに置いただけでは **IN 組の旗が8本あっても勝ち点に1本も効かない**。

### 2.1 検討した3解釈

| | 内容 | 評価 |
|---|---|---|
| **解釈A（採用）** | 種目は「ニアドラ」1つのまま。**本数だけ両セット合算** | ユーザーの「勝ち点は後で」＝「種目を増やすな」を満たしつつ、IN 組の旗が死なない。`teamEventPts` のキー集合・種目別勝ち点表の行数・`TP_EV_ORDER`（`js/results-team.js:80`）すべて不変 |
| 解釈B | 「ニアドラOUT」「ニアドラIN」の2種目に割る | `teamEventPts` に新キー2個＋`TP_EV_ORDER` 変更＋i18n 追加＋勝ち点表が1行増える。**「勝ち点は後で」に真っ向から反する** |
| 解釈C | セット2は完全に表示専用（本数にも勝ち点にも入れない） | 実装は最小だが「旗を2本立てたのに片方は集計対象外」が幹事に説明できない。IN 組の参加者から見て不公平 |

**決定：解釈A**。将来ユーザーが「OUT/IN 別々に勝ち点を付けたい」と言い出したら、そのとき解釈B へ移る（データはそのままで `teamWinPoints` に `add('niadoraOut',…)` `add('niadoraIn',…)` を足すだけ＝**データ移行不要**。§3.1 で並行フィールドを選んだ副次的な利点）。

### 2.2 解釈Aの帰結

- `teamEventPts.niadora` は**据え置き**（既定 1）。重みを 1 にしたまま本数だけ倍増するので、**「ニアドラ種目の勝ち点が2倍になる」ことはない**（勝ち点は「その種目の1位に w」なので、本数がいくつでも配られる勝ち点は同じ）。
- 変わるのは **「どのチームがニアドラ1位か」の判定に IN 組の旗も効くようになる**という1点だけ。§6.2 に数値例。

---

## 3. データモデル（★正本 §4 追補）

### 3.1 案の比較

現状：`g.prizes.niapinWinner = { "<holeIdx>": "<pid>" }`（1ホール＝1人）。

| | **案A（採用）並行フィールド** | 案B 共用体（#124 パターン） | 案C 入れ子 `sets` |
|---|---|---|---|
| 形 | `niapinWinner{}` ＋ `niapinWinner2{}` | `niapinWinner[h] = pid \| [pidOut, pidIn]` | `prizes.sets = [{niapinWinner,…},{…}]` |
| 旧データ | **そのまま有効**（セット1のフィールドは不変） | そのまま有効 | **移行が必要**（既存2フィールドを `sets[0]` へ移す＝破壊的） |
| 旧バックアップ JSON | **無変換で読める** | 無変換で読める | migrate で書き換えが要る（往復で形が変わる） |
| 新データを旧JS（キャッシュ）で開く | セット1だけ見える・**例外なし** | `pts[['a','b']]`→undefined で**黙って0pt**・`memberIds.includes([...])`→false。例外は出ないが値が静かに壊れる | `prizes.niapinWinner` が消えるので**セット1まで消える**（致命的） |
| 読み出し側の改修 | フィールド名を組み立てる helper 1本 | 全参照箇所に正規化 helper が必要（`pid \| pid[]` の分岐） | 全参照箇所の書き換え |
| 「セット2のみ登録」の表現 | `niapinWinner2[h]` だけ入る＝自然 | `[null,'pid']` と null 穴を開ける＝不自然 | 自然 |
| セットを3以上に拡張 | `Winner3` が要る（が要件外） | 配列長で自然 | 自然 |

**決定：案A**。決め手は「旧JSが新データを読んだときの安全性」と「セット1を一切変えない」こと。セット3以上の拡張性は要件にない（ダブルスタート＝2ウェーブが物理的上限。トリプルスタートは日本のコンペ運用でほぼ存在しない）ので、拡張性を理由に案Bを採る必要はない。

> `js/backup.js` は `JSON.stringify(state)` / `JSON.parse` → `migrate(s)` の8行（`js/backup.js:2-7`）＝**形式非依存**。案Aは `backup.js` を**1行も触らずに往復する**。

### 3.2 スキーマ（正本 §4 追補案・本文は §12.2）

```jsonc
"prizes": {
  "niapinHoles":[], "draconHoles":[],        // ★2026-08-20 廃止フィールド（非参照・残置）
  "niapinWinner": { "2":"xxx" },             // セット1（OUT組）。既存フィールド・意味も形も不変
  "draconWinner": { "4":"yyy" },             // セット1（OUT組）
  "twoSets": false,                          // ★2026-09-12 2セット運用（既定 false＝従来と完全に同一）
  "niapinWinner2": { "2":"zzz" },            // ★2026-09-12 セット2（IN組）。twoSets:false のとき非参照（残置）
  "draconWinner2": { "4":"www" }             // ★2026-09-12 セット2（IN組）
}
```

| 論点 | 決定 | 根拠 |
|---|---|---|
| セット1のフィールド名を `niapinWinner1` に改名するか | **しない** | 改名は全旧データの移行を要求する。`〜2` を足すだけなら移行ゼロ（`niapinHoles` 残置と同じ非破壊方針） |
| `twoSets` の置き場所 | **`g.prizes.twoSets`**（`g.formats` には入れない） | `formats` は「どの種目を集計するか」のスイッチで `chFormats()`・結果タブ・勝ち点に波及する。本件は**種目ではなく賞データの持ち方のモード**。#132 が同じ理由で `formats` を避けた前例あり（shotgun-flags §3.3） |
| セット2のデータを OFF 時に消すか | **消さない**（残置・非参照） | npdc-par §2 の「対象外ホールの勝者エントリは削除せず保持し、集計・表示から無視」と同じ非破壊・可逆規則。誤ってOFFにしても再ONで復活する |
| localStorage キー | **増やさない** | CLAUDE.md load-bearing |

### 3.3 migrate（`js/state.js` の `migrate()` 内・prizes 行の直後）

```js
// ニアドラ2セット（2026-09-12-niadora-2sets.md §3.3）。既定OFF＝従来と完全に同一挙動
if(g.prizes.twoSets===undefined) g.prizes.twoSets=false;
if(!g.prizes.niapinWinner2) g.prizes.niapinWinner2={};
if(!g.prizes.draconWinner2) g.prizes.draconWinner2={};
```

**★罠（実装者向け）**: 読み出しだけなら `(g.prizes.niapinWinner2||{})[h]` で migrate 不要に見えるが、**書き込み側 `setPrize(k,h,v)`（`js/roulette.js:224`）は `curGame().prizes[k][h]=v` と直接代入する**ため、フィールドが未定義の旧データで `TypeError` になる。migrate の backfill は**必須**。防御として `setPrize` 側にも 1 行ガードを入れてよい（`if(!P[k])P[k]={};`）。

`newGame()`（`js/state.js:98`）の `prizes` 初期値にも同じ3フィールドを明記する。

### 3.4 参照を閉じる helper（`js/state.js`・`niapinHolesOf` の直後）

全参照箇所がこの3本だけを呼ぶ（将来 §4.3 の統合や案B移行が来ても、差し替えるのはここだけ）。

```js
/* ニアドラ2セット（2026-09-12-niadora-2sets.md §3.4）。s=1|2。OFF のときセット2は存在しない扱い */
function prizeSetCount(g){ return (g.prizes && g.prizes.twoSets) ? 2 : 1; }
function prizeField(kind,s){ return (kind==='np'?'niapinWinner':'draconWinner') + (s===2?'2':''); }
function prizeWinnerOf(g,kind,h,s){ return ((g.prizes||{})[prizeField(kind,s)]||{})[h] || ''; }
function prizeSetLabel(s){ return s===2?'IN':'OUT'; }   // リテラル（§4.2・i18n キーを作らない）
```

- `prizeSetCount(g)===1` のとき、`for(let s=1;s<=1;s++)` は**既存の単一走査と完全に等価**（§6.1 で論証）。
- `prizeWinnerOf` は未登録を `''`（falsy）で返す＝既存コードの `if(pid&&…)` 判定と同じ意味。

### 3.5 参照箇所の棚卸し（実装チェックリスト）

| ファイル:行 | 箇所 | 対応 |
|---|---|---|
| `js/state.js:98` | `newGame().prizes` | 3フィールド追加（§3.2） |
| `js/state.js:39` | `migrate()` の prizes | backfill 3行（§3.3） |
| `js/state.js:82-83` の直後 | — | helper 4本を新設（§3.4） |
| `js/calc.js:193-197` | `niadoraTeamCount` | **★load-bearing**・セット走査に（§6.1） |
| `js/calc.js:288-289` | `computePoints` の個人賞加算 | **★load-bearing**・セット走査に（§7.1） |
| `js/calc.js:266-267` | `teamWinPoints` の niadora ゲート | **変更なし**（本数の出どころが変わるだけ） |
| `js/roulette.js:205-223` | `renderPrizes` | ON 時のみ2セレクト（§9） |
| `js/roulette.js:224` | `setPrize` | **シグネチャ変更なし**（`k` にフィールド名を渡す設計なので `'niapinWinner2'` がそのまま通る）＋防御ガード1行 |
| `js/results.js:154-171` | `renderPrizeHero` | ON 時のみセル内2行（§8.2） |
| `js/results-team.js:146-150` | `npOf`/`dcOf`/`allOpen` | セット走査に（§8.3） |
| `js/testdata.js:212-216` | `sdPrizes` | 任意（§13.3 PR2） |
| `js/i18n.js` | 2キー×3言語 | §11 |
| `styles.css` | `.npdc-set` ほか | §8.2・§9.2 |

---

## 4. セットの識別子と表示名

### 4.1 アプリは「誰がどちらの組か」を持たない（★決定）

**持たない。** 理由：

1. 本機能の出力（勝者2人・本数・配点）は「各ホールに勝者枠が2つある」だけで**完全に決まる**。組の所属は一切使わない（`niadoraTeamCount` も `computePoints` も `memberIds` しか見ない）。
2. 組の所属を持つと、24人のコンペで24タップの割当入力が発生する。表彰式の直前に幹事がやる作業としては重い（#132 §3.1 と同じ論理）。
3. 幹事の頭の中では「3H の旗2本のうち、OUT 組の旗を取ったのは誰か」が既に分かっている。アプリはその2つの箱を提供すれば足りる。
4. 万一の誤入力（OUT 組の人を IN 欄に入れる）が起きても、**本数も配点も同じ**（集計はセットを区別しない＝§2 解釈A）。**誤入力の被害が構造的にゼロ**。これが「軽い設計でよい」ことの決定的な根拠。

→ **セットは「表示上のラベル」でしかない。データは `1` / `2` という番号のみ。**

### 4.2 表示名は `OUT` / `IN` のリテラル（i18n キーを作らない）

- `OUT` / `IN` はゴルフ用語として ja/zh/en 共通。既存の `renderScorecard` も `<th class="sub">OUT</th>` をリテラルで出している（`js/results.js` のスコアカード）。同じ扱いにする。
- 副次効果: `verify.mjs` の「未使用キー」検出・3言語パリティのリスクをゼロにできる。
- **ショットガン等で OUT/IN の意味が無いコンペでも破綻しない**か → 破綻する場合の逃げ道は §15-B（未決の軽い論点。既定は「OUT/IN 固定」）。

### 4.3 #140（1on1 の OUT/IN スタート）・#132（ショットガンの旗）との関係 → **今回は統合しない**

| | #132 `g.shotgun.groups[].startHole` | #140 `g.match1v1.starts[key]` | **本件** |
|---|---|---|---|
| 単位 | 組（パーティ） | 1on1 のマッチ | **NP/DC の旗** |
| 値 | 1-based ホール番号 `1..18` | 同左 | **セット番号 1/2 のみ**（ホール番号を持たない） |
| 用途 | 旗の受け渡し表 | 開封順の演出 | 勝者枠の本数 |
| メンバー所属 | 持たない | ペアの pid が識別子 | **持たない**（§4.1） |

**統合しない理由**:

1. 3件とも「スタート側」という言葉を使うが、**本件だけは誰がどちらかを解決する必要がない**（§4.1-4）。共通化しても本件が得るものがゼロで、逆に「組の登録」という前提条件が増える＝ダブルスタートの普通のコンペで入力量が増える（#140 §7.2 が `g.shotgun` 依存を却下したのと同じ論法）。
2. #132/#140 はどちらもバックログ（未着手）。未着手2件に依存を作ると本件が着手できない。
3. 3つ目の「スタート側」概念が増えることは事実だが、**本件のそれは列挙型（1/2）であって座標（ホール番号）ではない**＝そもそも型が違う。無理に同じ型にするほうが誤り。

**将来の統合パス（設計として担保）**: もし「セット1は1番スタート、セット2は10番スタート」とアプリに教えたくなったら、

```
g.prizes.setStarts = [1, 10]    // 1-based ホール番号。#132/#140 と同じ表現
prizeSetLabel(s) の中身だけ差し替える（既定 [1,10] なら従来どおり OUT/IN 表記）
```

- **勝者データ（`niapinWinner` / `niapinWinner2`）は一切変換不要**。セット番号 → スタートホールの写像を1本足すだけ。
- 候補J（`g.parties[]` にメンバー所属つき）が将来入った場合も、本件は「セット番号 → 組」の写像を `prizeSetLabel` / 新 helper に閉じ込めれば済む（§3.4 で参照を1箇所に閉じてある）。

---

## 5. 2セットを使うかどうかの切替（★既定OFF）

**決定：コンペごとのオプション `g.prizes.twoSets`・既定 `false`。**

| 案 | 評価 |
|---|---|
| **既定OFF のオプション（採用）** | ダブルスタートは全コンペの一部。既定ONにすると単一スタートのコンペで空欄が倍出る。**既定OFFなら既存コンペの表示・数値・DOM 文字列が1つも動かない**ことを機械的に示せる（§14） |
| 常に2枠出す | 単一スタート運用で空の `IN` 欄が8個並ぶ＝幹事の誤入力源。既存コンペの見た目も全部変わる。却下 |
| 自動判定（誰かがセット2に入っていたらON） | 状態が暗黙になり、消し忘れデータで勝手にONになる。却下 |

**トグルの置き場所：勝者登録パネル（`renderPrizes` の先頭）。**

- 理由: このパネルは既に `<details class="prize-edit">` に畳まれた幹事操作UI（投影原則 §11.14「幹事の操作UIは控えめ配置」）で、**セットを増やす操作とセット2を埋める操作が同じ画面に並ぶ**のが最短動線。ゲーム設定タブに置くと、勝者登録中にタブを往復することになる。
- 代替案（ゲームタブ `js/game.js` のカード）も検討したが、`game.js` のカード群は「集計方式の設定」で、賞データの入力モードとは層が違う。却下（ただし将来 game.js に集約したくなったら `setG` 相当で移せる）。

```
  ▼ 個人賞（ニアピン / ドラコン）          ← <details> の summary
  ┌──────────────────────────────────────┐
  │ 対象ホールの勝者を選んで記録します。      │  prize.recNote
  │ ☐ 1ホールに旗2本（OUT組 / IN組）        │  ★新設トグル prize.twoSets
  │    ダブルスタートのコンペ用…（muted）    │  ★新設 prize.twoSetsNote
  │ ── ニアピン ──                          │
  │ …                                      │
  └──────────────────────────────────────┘
```

---

## 6. 計算仕様（★§3 追補・load-bearing）

### 6.1 `niadoraTeamCount` の変更（`js/calc.js:193-197`）

**前（現行）**:

```js
function niadoraTeamCount(g,T){ let n=0;
  niapinHolesOf(g).forEach(h=>{ const pid=(g.prizes.niapinWinner||{})[h]; if(pid&&T.memberIds.includes(pid))n++; });
  draconHolesOf(g).forEach(h=>{ const pid=(g.prizes.draconWinner||{})[h]; if(pid&&T.memberIds.includes(pid))n++; });
  return n; }
```

**後**:

```js
/* §3.3.1 ニアドラ本数（NP＋DC獲得本数のチーム合計）。2セット運用（prizes.twoSets）では
   OUT組/IN組の旗を合算して数える（種目は「ニアドラ」1つのまま＝2026-09-12-niadora-2sets.md §2）。
   twoSets:false（既定）では prizeSetCount(g)===1 となり従来と完全に同一の走査。 */
function niadoraTeamCount(g,T){ let n=0; const S=prizeSetCount(g);
  for(let s=1;s<=S;s++){
    niapinHolesOf(g).forEach(h=>{ const pid=prizeWinnerOf(g,'np',h,s); if(pid&&T.memberIds.includes(pid))n++; });
    draconHolesOf(g).forEach(h=>{ const pid=prizeWinnerOf(g,'dc',h,s); if(pid&&T.memberIds.includes(pid))n++; });
  }
  return n; }
```

**等価性（既定OFF時）**: `S===1` のとき走査は `s=1` の1周のみ。`prizeWinnerOf(g,'np',h,1)` は `(g.prizes.niapinWinner||{})[h] || ''` を返し、`if(pid&&…)` の判定は `undefined` と `''` で同値（どちらも falsy）。**加算回数・順序とも旧実装と同一** → 出力は常に一致する。

**`teamWinPoints`（`js/calc.js:266-267`）は変更しない**：`nd.reduce((a,b)=>a+b,0)>=1` の成立判定も `add('niadora', nd,'desc')` も本数の出どころに無関心。

### 6.2 数値例（前後比較）

コース: Par3 = 3H・8H・12H・17H（index 2,7,11,16）／Par5 = 5H・14H（index 4,13）。
チームA = {a1,a2,a3}、チームB = {b1,b2,b3}。`teamEventPts.niadora = 1`。

| ホール | セット1（OUT） | セット2（IN） |
|---|---|---|
| 3H NP | a1 | b3 |
| 8H NP | b1 | a3 |
| 12H NP | a2 | （未登録） |
| 17H NP | （未登録） | b1 |
| 5H DC | b2 | a1 |
| 14H DC | a1 | b2 |

| | チームA | チームB | ニアドラ種目の勝者 |
|---|---|---|---|
| **現行 / 本件の既定OFF**（セット1のみ） | NP 2 ＋ DC 1 = **3** | NP 1 ＋ DC 1 = **2** | **A に勝ち点 +1** |
| **twoSets:true**（両セット合算） | NP 3 ＋ DC 2 = **5** | NP 3 ＋ DC 2 = **5** | **同数＝山分け（A・B に +0.5 ずつ）** |

- セット2を無視した場合（＝もし `niadoraTeamCount` を直さなかった場合）、IN 組の旗6本が勝ち点判定に**一切効かない**。これが §2 で「本数は合算」を選んだ理由。
- 表の A=5 / B=5 は**表示側（`renderTeamNiadora` の `npOf`/`dcOf`）の全開封時の値と一致**しなければならない（§8.3 の不変条件）。

### 6.3 §3 計算仕様のうち**変えないもの**

ダブルペリア／エブリ／ステーブルフォード／オリンピック／キャロウェイ／握り（ナッソー）／ベスト2ボール／HBH／ラスベガス／1on1／大学対抗／ルーレット — **一切触らない**。本件が触るのは `niadoraTeamCount` と `computePoints` の NPDC 加算2行のみ。

### 6.4 既定OFF での回帰無差分の証明手順（★実装者・レビュア必須）

**順序を守ること**（フィクスチャを足す前に無差分を確認する＝「既存挙動不変」の証明）。

```
① js/calc.js（＋ js/state.js の helper）を変更する。regress のフィクスチャはまだ1つも足さない。
② node tools/regress.mjs
   → 期待値 tools/regress-expected.json と PASS（差分ゼロ）。
     ここで差分が出たら、それは「意図しない挙動変化」＝実装のバグ（既定 twoSets:false のため出るはずがない）。
   ※ tools/regress.mjs の baseGame は prizes:{niapinWinner:{},draconWinner:{}} を直書きし（tools/regress.mjs:50）、
     vm 内の migrate() が twoSets:false を補完する。したがって①の時点で既に「旧データ＝2セット未設定」の経路を通る。
③ node tools/verify.mjs   → 全 PASS。
④ ②③の結果を PR 本文に貼る（無差分の証明）。
⑤ そのうえで 2セットのケースを1つ追加する（下記）。node tools/regress.mjs --update で期待値を再生成し、
   git diff tools/regress-expected.json が「追加ケースのキーだけ増えている」ことを目視確認する。
   既存ケースの値が1つでも変わっていたら差し戻し。
```

**追加するフィクスチャ（案）**: 既存の `teamFull` 相当ケースを複製し、

```js
prizes: { twoSets:true,
  niapinWinner: { 2:'p03', 7:'p08', 11:'p01', 16:'p05' }, draconWinner: { 4:'p02', 13:'p10' },
  niapinWinner2:{ 2:'p08', 7:'p03', 11:'p05' },           draconWinner2:{ 4:'p10', 13:'p02' } },
```

- 検証したいこと: (a) `niadoraTeamCount` が両セット合算になる、(b) `computePoints` の個人賞が両セットに付く、(c) `computePayout` の配分が(b)に従って動く、(d) **同一人物が両セットで勝つケース**（上例では 2H/7H で p03 と p08 が入れ替わっており、13H DC で p02 が両方には勝っていない → **同一人物ケースを別途1ホールだけ作る**：`niapinWinner2[16]='p05'` を足して 17H を p05 が両セット制覇＝個人 +4pt になることを見る）。

---

## 7. 個人配点（`js/calc.js:288-289`）★未決1件つき

### 7.1 既定案：**セット2の勝者にも同額を付ける**

```js
// prizes（対象ホールは par から導出。2セット運用では両セットの勝者に加算＝2026-09-12-niadora-2sets.md §7）
const S=prizeSetCount(g);
for(let s=1;s<=S;s++){
  niapinHolesOf(g).forEach(h=>{ const pid=prizeWinnerOf(g,'np',h,s); if(pid&&pts[pid]!=null)pts[pid]+=(P.niapin||0); });
  draconHolesOf(g).forEach(h=>{ const pid=prizeWinnerOf(g,'dc',h,s); if(pid&&pts[pid]!=null)pts[pid]+=(P.dracon||0); });
}
```

**理由**: 「旗1本＝`P.niapin` pt」という既存の意味を素直に延長する。IN 組の勝者だけ半額/無得点だと、同じ賞を取ったのにスタート時刻で待遇が変わる（参加者に説明できない）。

**`S===1` のとき旧コードと完全等価**（§6.1 と同じ論証）。

### 7.2 数値例（配分原資への影響）★これが未決の理由

前提: par72（Par3×4・Par5×4＝旗8本/セット）、`P.niapin=P.dracon=2`、全旗に勝者あり、`prizePool=¥100,000`。
参加者全体のポイント合計が **1セット運用で 100pt**（うち NPDC は 8本×2pt = **16pt**）だったとする。

| | ポイント総量 | NPDC のポイント | NPDC が原資に占める割合 | 1pt あたり配分 |
|---|---|---|---|---|
| 1セット運用（現行） | 100pt | 16pt | **16.0%** | ¥1,000 |
| 2セット運用（既定案） | 116pt | 32pt | **27.6%** | ¥862 |

- 旗を1本も取っていない 10pt の選手: **¥10,000 → ¥8,621（−13.8%）**。
- 旗を1本取った 10pt の選手（NPDC 2pt 込み）: 同じく ¥10,000 → ¥8,621。
- 旗を1本取った選手が「セット1もセット2も同じホールで取った」場合（§10-①）: 10pt → 12pt、¥10,000 → ¥10,345。

つまり **2セット運用にすると、ニアドラ勝者層へ原資の取り分が約 12 ポイント分移動する**。これはコンペの賞金設計に関わるので、ユーザーの明示確認を取る（§15-A）。

### 7.3 代替案（§15-A で併記する）

| 案 | 実装 | 帰結 |
|---|---|---|
| **A（既定案）** セット2も同額 | 上記 | NPDC が原資の 27.6%（上例） |
| B セット2は半額 | `s===2 ? Math.round((P.niapin||0)/2) : (P.niapin||0)` | NPDC 24pt / 100+8=108pt → **22.2%**。ただし「同じ賞なのに額が違う」説明が要る。既定2pt が奇数のとき丸め規則が発生 |
| C セット2は個人ポイント対象外 | セット2を `computePoints` で走査しない | NPDC は 16pt / 100pt → **16.0%（現行と同じ）**。チーム本数（§6）と表示にだけ効く。「IN 組の勝者は個人賞金ゼロ」になり §7.1 の不公平問題が残る |
| D 配点キーを2セット用に分ける（`P.niapin2`） | `defaultPoints()` にキー追加＋配点UI 2行増 | 完全自由だが設定項目が増え、`defaultPoints` 変更で **regress スナップショットが全ケース差分**になる。過剰 |

---

## 8. 表示（投影原則 §11.14 対象）

### 8.1 守る原則

1. 後方席から読める大型表示を主役（`--f-rl-hole:48px` / `--f-rl-name:30px` を流用。**セット2を足しても勝者名のフォントは下げない**）。
2. **セットの区別を色だけに頼らない** → `OUT` / `IN` の**文字を必ず併記**する。
3. 幹事の操作UI（勝者登録・一括開封）は控えめ配置のまま。
4. 演出の開封状態は揮発（`pzMode`/`pzExcept`・localStorage に保存しない）。

### 8.2 ホール別勝者カード `renderPrizeHero`（`js/results.js:154-171`）

**レイアウト（twoSets:true）**: セル数は**増やさない**（1ホール=1セル）。セル内を2行にする。

```
  ── 375px 幅・2列グリッド（.npdc-hero は現行のまま repeat(2,1fr) / gap 10px）──
  セル外寸 ≒ 156 × 175px（withTeam 時 ≒ 210px）

  ┌────────────────────────┐   ┌────────────────────────┐
  │      12H  ニアピン       │48 │       5H  ドラコン      │   ← .npdc-top（現行のまま）
  │  · · · · OUT · · · · ·   │13 │  · · · · OUT · · · · ·  │   ← ★.npdc-set（新）13px bold var(--sub)
  │       田中 太郎          │30 │       佐藤 花子         │   ← .npdc-name（30px・現行のまま）
  │        赤チーム          │13 │        青チーム         │   ← .npdc-team（withTeam のみ）
  │  ─────────────────────  │   │  ─────────────────────  │   ← ★.npdc-row+.npdc-row の上罫線
  │  · · · · IN  · · · · ·   │13 │  · · · · IN  · · · · ·  │
  │       鈴木 一郎          │30 │          —              │   ← 未登録は .npdc-name.empty（—）
  │        青チーム          │13 │                         │
  └────────────────────────┘   └────────────────────────┘
      枠色: np=--info-line / dc=--danger-line（現行のまま）
  ≥768px: .npdc-hero は repeat(4,1fr)（現行のまま）→ Par3×4＋Par5×2 = 6セルが2行に収まる
```

**決定と根拠**:

| 論点 | 決定 | 根拠 |
|---|---|---|
| 1ホール=1セル（2行）か、1旗=1セル（2倍のセル数）か | **1ホール=1セル** | ①ホール番号 48px を1回しか描かないので**勝者名のフォントを下げずに済む**。②「同じホールの旗2本」という運用が視覚的に対応する。③セル数が倍だとモバイルで縦2倍のスクロールになり、投影でも1画面に収まらない |
| セットラベルの位置 | **名前の上に1行・中央寄せ** | 名前の左横に置くと 156px のセルで名前の折返しが増える（30px フォントで全角4字→3字）。上に置けば名前は全幅を使える |
| 区別の手段 | **文字 `OUT`/`IN` ＋ 行間の罫線**（色は使わない） | §8.1-2。既存の np/dc 枠色（青/赤）は**区分**の意味に予約済みなので、セット区別に色を足すと意味が衝突する |
| 開封（マスク）の粒度 | **ホール単位のまま**（`pzMasked(h)`・`togglePzCell(h)` を変更しない） | §8.4。セル1つ＝タップ1回＝両セット同時開封。演出としても「12H の旗2本を同時に発表」が自然 |
| twoSets:false のとき | **現行と完全に同じ DOM**（`.npdc-set` も罫線も出さない） | §14 の DOM 一致条件 |

**新規 CSS（`styles.css` の `.npdc-team` の直後）**:

```css
/* ニアドラ2セット（2026-09-12-niadora-2sets.md §8.2）: セット区別は文字（OUT/IN）＋罫線のみ＝色に依存しない */
.npdc-set{font-size:13px;font-weight:var(--w-bold);letter-spacing:.08em;color:var(--sub);line-height:1.2}
.npdc-row+.npdc-row{margin-top:6px;padding-top:6px;border-top:1px solid var(--line)}
```

### 8.3 チーム戦ニアドラ・ヒーロー `renderTeamNiadora`（`js/results-team.js:138-165`）

**レイアウトは変えない。** 表示値（`n` / `NP x ・ DC y`）が両セット合算になるだけ。

```js
const opened=h=>!pzMasked(h);
const S=prizeSetCount(g);
const cnt=(kind,holes,T)=>holes.filter(()=>true).reduce((n,h)=>{ let c=0;
  for(let s=1;s<=S;s++){ const pid=prizeWinnerOf(g,kind,h,s); if(pid&&T.memberIds.includes(pid)&&opened(h))c++; }
  return n+c; },0);
const npOf=T=>cnt('np',niapinHolesOf(g),T);
const dcOf=T=>cnt('dc',draconHolesOf(g),T);
```

`allOpen` も同様にセット走査へ（「勝者がいるホール」の判定を `いずれかのセットに勝者がいる` に広げる）:

```js
const anyWinner=(kind,h)=>{ for(let s=1;s<=S;s++) if(prizeWinnerOf(g,kind,h,s)) return true; return false; };
const allOpen=[...niapinHolesOf(g).filter(h=>anyWinner('np',h)),
               ...draconHolesOf(g).filter(h=>anyWinner('dc',h))].every(opened);
```

**★不変条件（既存・維持必須）**: *全開封時に `npOf(T)+dcOf(T) === niadoraTeamCount(g,T)`*。
マスク粒度をホール単位に据え置いた（§8.2）ため、`opened(h)` のフィルタは §6.1 のセット走査に対して**ホール単位で一様に効く** → 全開封（`opened` が恒真）なら両者は同じ加算列になる。**S=1/S=2 のどちらでも成立**する。

### 8.4 開封演出の互換

- `pzMode` / `pzExcept` / `togglePzAll()` / `togglePzCell(h)` — **すべて変更なし**（キーはホール index のまま）。
- localStorage 非保存のまま（表示状態の分離原則）。
- 「セット別に開封したい」要望が将来出たら `pzExcept` のキーを `` `${h}:${s}` `` へ拡張する。そのとき `allOpen` の定義も旗単位に直す必要がある（§15-C として軽く記録）。
- **★2026-09-12 追記（本節は上書きされた）**: ユーザー要望「オープンは個別にしたい」により、上記の将来パスを**即日実施**することになった。開封は**旗単位（OUT組/IN組を別タップ）**が正。設計は `docs/handoff/2026-09-12-niadora-reveal-per-set.md` が正本（`pzExcept` キー＝`` `${h}:${s}` ``・`pzMasked(h,s)`/`togglePzCell(h,s)` の第2引数省略可・不変条件は同書 §7.2 で旗集合 F(g) 上に再定義）。**`js/calc.js` は非接触**＝§6/§7 の計算仕様は本追記の影響を受けない。

---

## 9. 登録UI `renderPrizes`（`js/roulette.js:205-223`）

### 9.1 レイアウト（375px）

```
  twoSets:false（既定・現行と完全に同一 DOM）
  ┌──────────────────────────────────────────┐
  │ [12H]                [ 田中 太郎     ▾]   │   .row between / select max-width:60%
  └──────────────────────────────────────────┘

  twoSets:true
  ┌──────────────────────────────────────────┐
  │ [12H]   OUT  [ 田中 太郎            ▾]    │
  │         IN   [ 鈴木 一郎            ▾]    │
  └──────────────────────────────────────────┘
    │       │    └ select: flex:1; min-width:0（残り全幅 ≒ 233px @375）
    │       └ .pz-set: 幅 34px 固定・13px bold・var(--sub)
    └ .pill: ≒48px
  内訳: 375 − 本文左右余白 24 − カード内padding 28 − pill 48 − gap 8 − setラベル 34 − gap 8 ＝ 225px
```

- 2セレクトは**横並びにしない**（375px で1つ約110px＝氏名が読めない）。**縦積み**にする。
- ホールのピル（`12H`）はセット2行にまたがって左に1つだけ（`align-items:center`）。
- `onchange` は既存 `setPrize` をそのまま使う: `setPrize('niapinWinner',h,v)` / `setPrize('niapinWinner2',h,v)`。**setPrize のシグネチャ変更なし**（§3.5）。

### 9.2 新規 CSS

```css
/* ニアドラ2セット・登録UI（§9）。375px で2セレクトを縦積み */
.pz2{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;max-width:60%}
.pz2-row{display:flex;align-items:center;gap:8px}
.pz2-row select{flex:1;min-width:0}
.pz-set{flex:0 0 34px;font-size:13px;font-weight:var(--w-bold);letter-spacing:.06em;color:var(--sub)}
```

（`max-width:60%` は現行の select のインラインスタイルを踏襲。実装時にインラインのまま書いてもよいが、2セット分岐が入るのでクラス化を推奨。）

---

## 10. 端ケース

| # | ケース | 挙動（決定） |
|---|---|---|
| ① | **同一人物が両セットで勝つ** | **許可**（バリデーションしない）。個人配点は 2×`P.niapin`、チーム本数は +2。ヒーローセルには同じ名前が2行並ぶ。既存も「複数ホールで同一人物」を許しており一貫。物理的にはあり得ない（人は片方の組でしか回らない）が、幹事のブラインド入力ミスを**ブロックしない**方針（既存の非バリデーション方針を継承）。警告も出さない |
| ② | **片方のセットだけ勝者未登録** | 通常運用（IN 組が先に終わっていない等）。未登録側は `—`（`.npdc-name.empty`）・カウント対象外・配点なし。`allOpen` の判定では「勝者がいるホール」に含める（§8.3）＝もう片方が登録済みなら開封対象 |
| ③ | **par 導出ホールが0本**（Par3/Par5 なし） | 現行と同じ。`renderPrizes` は `''` を返し、個人戦タブは `prize.emptyCfg`、チーム戦ニアドラの併設カードも省略。`twoSets` の値に関係なく同じ |
| ④ | **twoSets を ON→OFF** | セット2のデータは**残置・非参照**（§3.2）。本数・配点は即座にセット1のみに戻る。再度 ON で完全復活（非破壊・可逆＝npdc-par と同じ規則） |
| ⑤ | **par 変更で対象外になったホールのセット2エントリ** | 現行と同じく保持・無視（`niapinHolesOf` が返さないホールは走査されない） |
| ⑥ | **セット2の勝者がどのチームにも所属しない** | 現行と同じ（`niadoraTeamCount` はどのチームにも数えない／個人配点は `pts[pid]!=null`＝参加者なら付く） |
| ⑦ | **旧JS（キャッシュ）が新データを開く** | `twoSets`/`*Winner2` は未知フィールド＝**完全に無視**。セット1だけが従来どおり動く。例外なし・データ破壊なし（`backup.js` は state 丸ごとの入出力なのでフィールドも保全される） |
| ⑧ | **新JSが旧バックアップ JSON を読む** | `migrate()` が3フィールドを backfill（§3.3）→ `twoSets:false` ＝従来の見た目・数値そのまま |
| ⑨ | **`dupGame()`（`js/basic.js:47`）でコンペ複製** | `JSON.parse(JSON.stringify())` の深いコピー＝形式非依存。`twoSets` も勝者も複製される（望ましい挙動） |

---

## 11. i18n（ja / zh / en 同時・キー集合完全一致）

### 11.1 追加キー（2キー × 3言語 = 6エントリ）

| キー | ja | zh | en | 使用箇所 |
|---|---|---|---|---|
| `prize.twoSets` | `1ホールに旗2本（OUT組 / IN組）` | `每洞两面旗（OUT组 / IN组）` | `Two flags per hole (OUT / IN waves)` | `js/roulette.js` `renderPrizes` のトグル label |
| `prize.twoSetsNote` | `ダブルスタートのコンペ用。OUT組・IN組それぞれの勝者を記録します。OFF のときは1ホール1人（従来どおり）。` | `用于分两批开球的比赛。分别记录 OUT 组和 IN 组的获奖者。关闭时每洞一人（与以往相同）。` | `For two-wave (double start) events: record a winner for each of the OUT and IN waves. When off, one winner per hole as before.` | 同トグル直下の `.muted` |

- どちらも**実コードから参照される** → `verify.mjs` の「未使用キー」検出に引っかからない（`KNOWN_UNUSED` への追加は不要）。
- **`OUT` / `IN` のラベルはキーを作らない**（§4.2・リテラル。`renderScorecard` の `OUT`/`IN` 見出しと同じ扱い）。
- 既存キー（`prize.title` / `prize.recTitle` / `prize.recNote` / `term.niapin` / `term.dracon` / `term.niadora` / `fmt.niadora*`）は**値も含め変更しない**。

---

## 12. 正本への追補（本書と同時に反映）

### 12.1 §3.6 に追加する1行

> - **★2026-09-12 追補（2セット運用）**: ダブルスタートのコンペ向けに、各対象ホールの勝者枠を2つ持てる（`prizes.twoSets`・**既定 OFF**＝従来と完全に同一）。ON のとき個人配点は**両セットの勝者に**それぞれ加算し、チーム種目「ニアドラ」の本数も**両セット合算**で数える（種目は1つのまま＝`teamEventPts` にキーを追加しない）。詳細・前後比較は `docs/handoff/2026-09-12-niadora-2sets.md` が正。

### 12.2 §4 の `prizes` コメント追補

§3.2 のスキーマ3行（`twoSets` / `niapinWinner2` / `draconWinner2`）を jsonc ブロックに追記し、`prizes/meta:` の要約行にも `twoSets, niapinWinner2{}, draconWinner2{}` を足す。

---

## 13. サイズ判定・モック・PR 分割

### 13.1 サイズ判定：**M**

§3 計算仕様・§4 データモデル・i18n キー集合に触るため S ではない（CLAUDE.md「判定に迷ったら M/L」以前に明確に M）。新規モジュールなし・タブ構成不変なので L でもない。

### 13.2 モック：**推奨（必須ではない）**

- 「ナビ・画面構成の再編」ではなく既存カード内部の2行化。**§8.2 のレイアウト図＋寸法で実装者は迷わない**。
- ただし投影画面の見え方が変わるので、PM 判断で 1 枚（`twoSets:true` のニアドラタブ・375px と 1280px）をユーザーに見せてから実装に入ってよい。その際の材料は §8.2 / §9.1 の図がそのまま使える。

### 13.3 PR 分割（推奨2本・順に直列）

| PR | 内容 | 触るファイル | 完了条件 |
|---|---|---|---|
| **PR1** データ・計算・登録UI | §3（state 3フィールド＋migrate＋helper4本）／§6.1（`niadoraTeamCount`）／§7.1（個人配点）／§9（`renderPrizes` の2セレクト＋`setPrize` ガード）／§11（i18n 2キー×3）／§9.2 CSS | `js/state.js` `js/calc.js` `js/roulette.js` `js/i18n.js` `styles.css` `index.html`(?v=) | §6.4 の①〜④（**regress 無差分**）＋ verify 全PASS。この時点でセット2は「登録できるが大型表示には出ない（本数・配点には効く）」 |
| **PR2** 投影表示・回帰フィクスチャ | §8.2（`renderPrizeHero` 2行化＋CSS）／§8.3（`renderTeamNiadora` の合算）／§6.4 の⑤（regress ケース追加）／§13.4（testdata 任意） | `js/results.js` `js/results-team.js` `styles.css` `tools/regress.mjs` `tools/regress-expected.json` `js/testdata.js` `index.html`(?v=) | 全開封時に表示本数＝`niadoraTeamCount`（§8.3 不変条件）。`--update` の差分は追加ケース分のみ |

- **直列**（両PRとも `styles.css` と `index.html` の `?v=` を触る）。
- 小さく収まるなら1本にまとめてよいが、その場合も **§6.4 の①〜④を先に実行し、その結果を PR 本文に貼る**こと（regress 無差分の証明を、フィクスチャ追加コミットの**前**のコミットで残す）。

### 13.4 テストデータ（任意・PR2）

`js/testdata.js` の `sdPrizes`（212-216行）を `p.np2` / `p.dc2` に対応させ、**既存パターンには追加しない**（追加すると既存パターンの見た目が変わる）。2セット専用のパターンを1つ足すかは実装者判断。足す場合はパターン定義に `prizes:{twoSets:true}` 相当の指定が要る。

---

## 14. 受け入れ条件（機械検証できる形）

### 14.1 共通（両PR）

1. `node tools/verify.mjs` が**全 PASS**（JS 構文／i18n ja=zh=en 完全一致・空値なし・en 日本語残存なし／使用キー未定義参照なし／**未使用キー 0 件**／CSS 孤立 `var()` なし／計算回帰）。
2. `index.html` の `?v=` を**当該 PR 番号に一括更新**（`js/**`・`styles.css` を触るため）。
3. `localStorage` キーが **5つのまま**（`golfCompe_v1` / `golfCompe_lang` / `golfCompe_theme` / `golfCompe_channel` / `golfCompe_seenTop`）。
   - 機械確認: `grep -n "localStorage\." js/*.js` の出力に新規キーが増えていないこと。
4. 新規 JS ファイルなし・`index.html` の `<script>` 読込順に変更なし。

### 14.2 既定OFF で既存挙動が1つも動かないこと（★本件の核）

5. **regress 無差分**: §6.4 ①〜④の手順で、**フィクスチャを足す前**に `node tools/regress.mjs` が差分ゼロで PASS（PR1 本文に貼る）。
6. **DOM 文字列一致**: `twoSets` を持たない（または false の）ゲームで、main と本ブランチの以下3つの出力文字列が**完全一致**する。
   - `renderPrizes(curGame())`
   - `renderPrizeHero(curGame(), true)`
   - `renderTeamNiadora(curGame())`
   - 取得手順: テストデータのパターン（チーム戦あり・NPDC 勝者登録済み）を投入 → DevTools コンソールで各関数を評価 → `copy(…)` でクリップボードへ → main 側と `diff` して**空**であること。
7. 既存 `tools/regress-expected.json` の**既存ケースの値が1つも変わっていない**（PR2 の `--update` 差分レビュー）。

### 14.3 2セット ON の機能条件

8. `twoSets:true` で各対象ホールに**2つのセレクト**が出る（OUT / IN の文字ラベル併記）。375px 幅（DevTools iPhone SE）で**横スクロールが発生せず**、選手名が省略されずに読める。
9. `twoSets:true` の `niadoraTeamCount(g,T)` が §6.2 の数値例どおり（A=5 / B=5 で山分け）になる。
10. **全開封時**に `renderTeamNiadora` の表示本数（`n` と `NP x ・ DC y`）が `niadoraTeamCount(g,T)` と**一致**する（既存の不変条件・S=1 と S=2 の両方で確認）。
11. 部分開封中は、未開封ホールの**両セットとも**名前が `？？？` になり、勝ち点タグが出ない（既存のネタバレ防止規則を維持）。
12. 個人配点: 同一人物が両セットで勝ったホールで `computePoints` が `2 × P.niapin` を加算する（§6.4⑤のフィクスチャで検出）。

### 14.4 後方互換

13. **旧バックアップ JSON**（`twoSets`/`*Winner2` を持たない）が例外なく読める。読み込み後にニアドラの本数・配分金額が**インポート前と同一**。
14. **エクスポート → インポートで往復**する（`twoSets:true` とセット2の勝者が保持される）。`js/backup.js` は**無改修**。
15. `twoSets` を ON → 勝者登録 → OFF → ON で、セット2の勝者が**残っている**（非破壊・可逆）。
16. `dupGame()` でコンペを複製すると `twoSets` と両セットの勝者が複製される。

---

## 15. 未決事項（ユーザー確認・それぞれ既定案つき）

### A.（★PM がユーザーに確認する1件）個人賞ポイントをセット2にも同額付けるか

- **既定案: 付ける**（§7.1）。旗1本＝2pt という意味を素直に延長する。
- **影響**: par72・全旗に勝者ありの場合、NPDC が配分原資に占める割合が **16.0% → 27.6%**（旗を取っていない選手の取り分は **−13.8%**）。数値の内訳は §7.2。
- **代替**: B＝セット2は半額（22.2%）／C＝セット2は個人ポイント対象外（16.0%・チーム本数と表示にだけ効く）。
- どれを選んでも §3（データ）・§8（表示）・§6（チーム本数）は変わらない。**変わるのは `computePoints` の3行だけ**なので、後から変更しても移行コストはゼロ（ただし `regress-expected.json` の更新が要る）。

### B.（軽微）ラベルを `OUT` / `IN` 固定にしてよいか

- **既定案: 固定**（§4.2）。ダブルスタート＝OUT組/IN組が本件の唯一のユースケース。
- 代替: `セット1` / `セット2`（i18n 3キー必要）。ショットガンや3ウェーブ運用が将来出たときに再検討（§4.3 の `setStarts` で対応可能）。

### C.（軽微）開封をセット別にしたいか

- **既定案: ホール単位のまま**（§8.2・タップ1回で旗2本を同時発表）。表示側と計算側の一致証明が最も単純になる。
- セット別開封が欲しい場合は `pzExcept` のキーを `` `${h}:${s}` `` に拡張し、`allOpen` を旗単位に再定義する（§8.4）。別Issue で。
- **★2026-09-12 解決（既定案は採用されなかった）**: ユーザー判断で**セット別開封**に決定。設計は `docs/handoff/2026-09-12-niadora-reveal-per-set.md`（別Issue・`js/results.js` / `js/results-team.js` / `styles.css` のみ変更。§3 計算・§4 データモデル・i18n・localStorage は非接触）。本書 §8.2/§8.4 の「開封粒度＝ホール単位」の記述は**同書に上書きされている**。
