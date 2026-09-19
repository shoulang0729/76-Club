# 設計：チーム対抗グロス／ネットを「平均一本」に統一する（合計モード廃止） — 2026-09-19

**種別**: M（★§3 計算仕様に触れる **load-bearing** 変更・**過去コンペの結果が変わる**）
**発端**: ユーザー指摘（2026-09-19）「チーム戦（ネット）は平均で比べないと勝負にならないので変更」
**前件**: Issue #185（PR1 #193 / PR2 #195）＝ `g.teamScoreMode:'sum'|'avg'` を導入し **新規＝平均／既存＝合計** にした
**関連正本**: `2026-07-12-golf-compe-web.md` §3.5／§4、`2026-09-12-team-score-average.md`（本設計で**一部が過去形になる**・§13.2）、`2026-09-13-player-delete-refs.md` §8.3（`refsLive`/`refsDeleted`）、`2026-09-13-best2-per-hole.md`、`2026-08-30-univ-match.md` §4（平均の前例）

---

## 0. ★前提（ユーザー確定・**再議論しない**）

`2026-09-12-team-score-average.md` §0 は「**既存コンペの結果は後から書き換えない**」を土台にしていた。
その後の経緯:

1. ユーザー指摘「チーム戦（ネット）は平均で比べないと勝負にならないので変更」
2. PM が「**過去コンペの優勝チーム・勝ち点・配当が変わります**」と明示したうえで選択肢を提示
3. ユーザーが「**合計を廃止して平均一本に**」を選択

> **したがって §0 の「過去コンペを書き換えない」原則は、チーム対抗グロス／ネットについてはユーザー判断で上書きされた。**
> 本設計・実装・レビューで**この点を論じ直さないこと**（「過去が変わるから差し戻し」は誤り。**変わるのが正**）。
> 一方 §0 は**他の箇所では生きている**（選手の退会／完全削除＝#171、`refsDeleted` の役割、`best2`・`holesWon` 等の既存式）。

**本件の結果として実際に何が変わるか**（回帰25ケース全件実測・§6）: **10ケースの値が変わり、うち3ケースは勝者・勝ち点・配分額まで変わる**。15ケースは1ビットも変わらない。`nextKanji` は**全25ケースで不変**。

---

## 1. PM 確認事項（既定案で最後まで書いてある・異議がなければこのまま実装）

| # | 論点 | 既定案（本設計の採用値） | 根拠 |
|---|---|---|---|
| Q1 | `g.teamScoreMode` フィールドの処分 | **`newGame` から外す＋`migrate` の backfill 行を削除＋計算から参照しない**。既存データに残っている `'sum'`/`'avg'` の文字列は**残置・非参照**（`migrate` で `delete` しない） | §3。アプリ内の廃止フィールド前例（`defaultPoints` の旧・種目別チーム配点／`niapinHoles`）が「既定から削除・既存データは残置・非参照」。`delete` しても旧版アプリ互換は1ミリも改善しない（§3.3 の実表） |
| Q2 | 人数不揃い警告（#195） | **撤去**（i18n 6キー＋`team.noteLow` の計7キー×3言語を削除・`teamMemberCounts`/`teamSizeUneven` も削除） | §4。警告の主張「合計では人数の少ないチームが有利」が**事実でなくなる**＝残すと虚偽表示 |
| Q3 | 平均の母数 | **`teamScoreMembers`（`teamMembers` ∩ 1H以上入力済み）のまま変えない** | §2.2。登録人数を母数にすると 238÷4=**59.5**（人類に不可能なスコア）で勝ってしまう実測 |
| Q4 | 既存回帰ケースの期待値が動くこと | **動くのが正**。受け入れ条件を「**§6 の表のとおりに動く／表に無いものは動かない**」に置き換える | §0・§6 |
| Q5 | `teamAvgEven`/`teamAvgUneven` | **削除**（平均一本化後は `team3`/`ghostMember` と**バイト単位で同一の期待値**になる＝情報量ゼロの重複・実測で確認）。`teamAvgUnentered` は**母数の番人として維持**。代わりに **`teamLegacySum` を新設**（旧JSON の `'sum'` 残骸を読んでも平均になることを固定） | §7 |
| Q6 | `refsLive`/`refsDeleted` | 値は動くが**役割は維持される**（完全削除で勝ち点・配分・ニアドラ勝者が変わることは引き続き出る）。ただし**「teamGross の勝者が入れ替わる」という劇的な差は消える**ので、ケース先頭コメントの文言を更新する | §6.3 |
| Q7 | 表示 | 値列ヘッダは**常に `col.avg`**／注記は**常に `team.noteAvg`**／人数併記は**常に出す**。`col.total` は他4箇所で使うので**残す**。スコア表の「計」行は**合計のまま据え置き**（PM 既定案を採用） | §5 |
| Q8 | ベスト2/HBH/ベガス/大学対抗/任意対決 | **非接触**。`renderTeams` の HTML **バイト一致**で機械的に担保（ハーネス添付・実測済み） | §8 |
| Q9 | PR 分割 | **1本**（変更は約89行＝ほぼ削除。分ける固定費の方が高い） | §12 |
| Q10 | モック | **不要**（新規レイアウトを1つも作らない。結果カードの「後」の姿は**今日すでに本番で見られる**＝新規コンペは既に平均） | §15 |

---

## 2. 決定 A：計算仕様（★§3.5 load-bearing・前後比較）

### 2.1 式（前 → 後）

```
# 前（#185 以降・g.teamScoreMode で分岐）
M(T) = teamScoreMembers(g,T) = { pid ∈ teamMembers(g,T) | 1H以上入力済み }
teamScoreMode==='avg' : teamGross(T) = M=∅ ? null : round1( Σ_{M} effGross(pid) / |M| )
                        teamNet(T)   = M=∅ ? null : round1( Σ_{M} netScore(pid) / |M| )
teamScoreMode==='sum' : teamGross(T) = Σ_{teamMembers} effGross(pid)      ← 丸めなし（素の整数）
                        teamNet(T)   = round1( Σ_{teamMembers} netScore(pid) )

# 後（分岐なし・常に平均）
M(T) = teamScoreMembers(g,T)                       ← ★変えない（Q3）
teamGross(T) = M=∅ ? null : round1( Σ_{M} effGross(pid) / |M| )
teamNet(T)   = M=∅ ? null : round1( Σ_{M} netScore(pid)  / |M| )
round1(v) = Math.round(v*10)/10
```

**変わらないもの**: `'asc'`（小さいほど上位）／`add()` のシグネチャ・同点山分け・`live<2` ガード／`teamWinPoints` の `teams` 絞り込み（`m.some(entered)`）／`null` の扱い（値セル `—`・並びは末尾）／丸め桁（小数第1位）。

### 2.2 母数を変えない理由（#185 §3 の実測をそのまま引用）

| 指標 | 合計（旧） | 平均・母数=**登録4名**（誤） | 平均・母数=**入力済3名**（採用） |
|---|---|---|---|
| T1 グロス（4名登録・うち1名が1打も未入力） | 238 | **59.5** ← 実在しないスコア | **79.3**（238÷3） |
| T2 グロス（4名全員入力） | 302 | 75.5 | 75.5 |
| 勝者 | T1 | **T1**（誤） | **T2**（正） |

未入力メンバーは `gross=0 → effGross=0`、隠しホールが全 `null` で `hd` が 0 クリップされ `netScore=0` になる（#185 §3.1 実測）。**母数を登録人数にすると合計モードより酷い**。
→ `teamScoreMembers` は**1文字も変えない**。

### 2.3 ユーザー体験としての前後（Issue #171 の実データ相当・ネット対抗）

| チーム | 人数 | 旧（合計） | 旧の順位 | 新（平均） | 新の順位 |
|---|---|---|---|---|---|
| A | **3名** | 230.8 | **1位 🏆** | 76.9 | 2位 |
| B | 4名 | 301.4 | 2位 | **75.4** | **1位 🏆** |
| C | 4名 | 344.4 | 3位 | 86.1 | 3位 |

**同人数のときは順位が絶対に変わらない**（`avg = sum/n` は厳密な単調変換）。丸めで**新たな同点**が生まれることだけがあり得て、それは既存 `add()` の山分けに乗る。

### 2.4 参照実装（プロトタイプで `verify.mjs`／`regress.mjs` 全PASS 済み）

`js/calc.js`：現行の「チーム対抗グロス／ネットの集計方法」ブロック（`teamAvgOn`／`teamAggr`／`teamGrossVal`／`teamNetVal`／`teamMemberCounts`／`teamSizeUneven`）を**丸ごと**次で置換する。

```js
/* ---- チーム対抗グロス／ネットの集計（§3.5・docs/handoff/2026-09-19-team-avg-only.md）----
   ★常に「1人あたり平均」。合計モード（旧 g.teamScoreMode）は 2026-09-19 に廃止（ユーザー確定・設計 §0）。
   ★母数（＝分母かつ分子の集合）: teamScoreMembers＝teamMembers ∩ 1H以上入力済み。
     未入力メンバーは effGross=0・netScore=0 なので、登録人数を母数にすると 238÷4=59.5 という
     実在しないスコアで勝ってしまう（実測・2026-09-12-team-score-average.md §3.2）。 */
function teamAggr(g,T,valFn){ const m=teamScoreMembers(g,T); if(!m.length) return null;   // 入力済み0人＝値なし
  return m.reduce((a,pid)=>a+valFn(pid),0)/m.length; }
function teamGrossVal(g,T){ const v=teamAggr(g,T,pid=>effGross(g,pid)); return v==null?null:Math.round(v*10)/10; }
function teamNetVal(g,T){ const v=teamAggr(g,T,pid=>netScore(g,pid)); return v==null?null:Math.round(v*10)/10; }
```

> `teamScoreMembers`／`teamMembers`／`teamsOf`／`holesWon` は**1文字も触らない**（`verify.mjs` の `grab('teamMembers')` 走査が `teamMembers`〜`holesWon` の範囲を切り出すため、この範囲に手を入れると検証器の挙動にも影響する）。上記ブロックは `holesWon` の**後ろ**なので安全（プロトタイプで確認済み）。

---

## 3. 決定 B：`g.teamScoreMode` の処分（Q1）

### 3.1 3案の比較

| 案 | 新規ゲーム | 既存ゲームの保存値 | エクスポートJSON | 実装量 | 判定 |
|---|---|---|---|---|---|
| (a) **完全削除**（`migrate` で `delete`） | フィールド無し | **消える**（ユーザーデータを migrate が削る） | 全ゲームからフィールドが消える | +1行 | ✕（§3.2） |
| (b) **残すが無視**（`newGame` は `'avg'` のまま・`migrate` backfill も残す） | `'avg'` を書く | `'sum'` のまま | 誰も読まない値が増え続ける | 0行 | ✕（読まない値を書き続ける＝将来の誤読の種） |
| (c) ★**採用**: `newGame` から外す＋`migrate` の backfill 行を削除＋計算から参照しない | フィールド無し | **残置・非参照**（触らない） | 旧ゲームにだけ死んだ文字列が残る | −2行 | **◯** |

**(c) を採る理由**
1. **アプリ内の前例がこれ**（`js/state.js` `defaultPoints()` の注記: 旧・種目別チーム配点 `teamGross/teamNet/holeByHole/best2ball/roulette` は「**既定から削除・既存データは残置・非参照**。`niapinHoles` と同じ後方互換パターン」）。
2. `migrate()` はこれまで**補完専用**（`if(x===undefined) x=…`）で、**ユーザーデータを削除した前例が無い**。インポートしたJSONを書き換えると「元ファイルと保存内容が一致しない」状態を新たに作る。
3. **削除しても互換上の利得がゼロ**（§3.3）。

### 3.2 バックアップJSONの往復（★実測ベースの整理）

| シナリオ | (a) 完全削除 | (c) 採用案 |
|---|---|---|
| **旧JSON（`"teamScoreMode":"sum"`）を新アプリで開く** | フィールドが消え、**平均で計算**（＝ユーザー確定どおり） | フィールドは残るが**誰も読まない → 平均で計算**（同じ結果） |
| **旧JSON（`'avg'`）を新アプリで開く** | 平均 | 平均 |
| **新JSON（フィールド無し）を新アプリで開く** | 平均 | 平均 |
| **新JSON を旧版アプリ（キャッシュ残りの古い js）で開く** | 旧 `migrate` が `'sum'` を backfill → **合計で表示** | 同じく **合計で表示**（新規ゲームにはフィールドが無いため） |
| **旧JSON を旧版アプリで開く** | （そもそも新アプリを経由していない） | 合計で表示 |

> **(a) と (c) は「旧版アプリで開いたとき」の挙動が完全に同じ**（フィールドが無ければ旧 `migrate` が `'sum'` を補完するから）。つまり `delete` はユーザーデータを削る代償に**何も得ない**。
> 旧版アプリ問題そのものは `index.html` の `?v=` バンプ＋リロードで自然治癒する範囲（本アプリは GitHub Pages 単一配信）。**「新JSONを旧版アプリで開くと合計で出る」ことは Issue 本文に既知事項として書く**。

**第4案（`migrate` で全ゲームを `'avg'` に上書きして残す）** は「新JSON×旧版アプリ」でも平均になる唯一の案だが、**誰も読まない値を書き続ける**ため (b) と同じ欠点を持ち、将来「まだ分岐が生きている」と誤読される。採らない（PM が旧版互換を重視するなら Q1 で指定のこと）。

**localStorage キーは5つのまま**（`golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop`）。増減なし。

### 3.3 回帰で固定する（新ケース `teamLegacySum`）

`'sum'` が残ったゲーム定義（＝旧バックアップ相当）を1ケース足し、**期待値が `ghostMember`（＝平均）と完全一致**することを固定する。実測で一致を確認済み（§7.2）。これは (a)(c) どちらの実装でも通る＝**実装方式に依存しない要件テスト**。

---

## 4. 決定 C：人数不揃い警告の撤去（Q2）

### 4.1 3案の比較

| 案 | 内容 | 判定 |
|---|---|---|
| **撤去**（★採用） | `game.js` の S3b ごと消える。結果カードの警告行も消す。i18n 7キー×3言語を削除 | **◯**。警告文「**「合計」では人数の少ないチームが有利になります**」は**合計モードが存在しないと意味をなさない**。文中の鉤括弧「合計」が指す設定項目自体が消える |
| 残す（別の理由づけ） | 「人数は揃っている方が望ましい」等に言い換える | ✕。**平均はまさに人数差を吸収するための式**で、グロス／ネット対抗については人数差が不公平でなくなる。理由のない警告は幹事の判断を鈍らせる |
| 文言を変える | 「ホールバイホールでは人数の少ないチームが有利です」に差し替え | △→**別Issue**。これは**事実**（§14.1 で実測: 3名 13.5勝 vs 4名 4.5勝）だが、**出す条件が変わる**（`F.teamGross||F.teamNet` → `F.holeByHole`）・置き場所も変わる（S3b は消える）ので、本件に混ぜると差分の性質が2つになる。**申し送りとして別 Issue 化**（§14.1） |

### 4.2 削除する i18n キー（ja/zh/en 同時・7キー×3＝21行相当）

| キー | 削除後の参照 | 備考 |
|---|---|---|
| `game.teamScoreCard` | 0（S3b 消滅） | |
| `game.teamScoreSum` | 0 | |
| `game.teamScoreAvg` | 0 | |
| `game.teamScoreNote` | 0 | |
| `game.teamScoreWarn` | 0 | |
| `game.teamScoreWarnTag` | 0 | |
| `team.noteLow`（「合計が少ない方が勝ち」） | 0（注記は常に `team.noteAvg`） | |

**削除してはいけない（＝残すもの）**

| キー | 残る参照箇所 |
|---|---|
| `col.total`（「計」） | `js/results.js:266`（スコア表ヘッダ）・`js/results.js:327`（チーム「計」行）・`js/score.js:19`・`js/course.js:74,76`・`js/roulette.js`（**ベスト2ボールカードの値列ヘッダ**） |
| `col.avg`（「平均」） | `js/roulette.js`（グロス／ネット対抗カードの値列ヘッダ＝**常時**） |
| `team.memN`（「{n}名」） | `js/roulette.js`（チーム名の人数併記＝**常時**）。※`js/game.js` 側（警告文の組み立て）は消える |
| `team.noteAvg` | `js/roulette.js`（注記＝**常時**） |

**検証器の効き方**（削除漏れ・削除しすぎの両方が落ちる）
- 削除しすぎ（まだ参照が残っているのに辞書から消した）→ `■ i18n 使用キー` の**未定義参照**で FAIL。
- 削除漏れ（参照を消したのに辞書に残した）→ `■ i18n 未使用キー` で FAIL。
- 3言語のどれかを消し忘れ → `■ i18n キー数一致 / ja基準の欠落なし` で FAIL。

**実測（プロトタイプ）**: キー定義数 **443 → 436**（−7）、`verify.mjs` **全PASS**。

### 4.3 撤去に伴って消える JS

| 対象 | ファイル | 備考 |
|---|---|---|
| `teamMemberCounts(g)` / `teamSizeUneven(g)` | `js/calc.js` | 警告専用。他に参照なし（実測） |
| `setTeamScoreMode(v)` | `js/game.js` | inline `onchange` もろとも消える |
| `teamScoreWarn(g)` / `teamScoreWarnTag()` | `js/game.js` | |
| S3b セクション（`gsSec('teamScore', …)`） | `js/game.js` | `gsOpen` は自由キーのマップなので残骸ゼロ |
| `if(p.teamScore) g.teamScoreMode=p.teamScore;` と `p6` の `teamScore:'sum'` | `js/testdata.js` | テストデータ⑥も平均になる（人数 2/2＝**勝者は不変**・#185 §9.6 実測） |

---

## 5. 決定 D：表示（Q7）

### 5.1 結果発表 → チーム戦 → グロス対抗／ネット対抗カード

```
 前（合計モードのコンペ＝既存コンペを開いたとき）        後（すべてのコンペ）
┌─ グロス対抗 ────────────────────┐        ┌─ グロス対抗 ────────────────────┐
│ 合計が少ない方が勝ち             │ .muted │ 1人あたりの平均が少ない方が勝ち  │ .muted
│ ⚠[人数不揃い] 人数が揃っていま…  │ 条件付 │ （警告行は無し）                 │
│ ┌──┬──┬────────────┬──────┐      │        │ ┌──┬──┬─────────────┬──────┐     │
│ │👁 │順│チーム       │  計  │      │        │ │👁 │順│チーム        │ 平均 │     │
│ │👁 │🥇│レッド       │  238 │      │        │ │👁 │🥇│グリーン 4名  │ 66.5 │     │
│ │👁 │2 │グリーン     │  266 │      │        │ │👁 │2 │ブルー   4名  │ 75.5 │     │
│ │👁 │3 │ブルー       │  302 │      │        │ │👁 │3 │レッド   3名  │ 79.3 │     │
│ └──┴──┴────────────┴──────┘      │        │ └──┴──┴─────────────┴──────┘     │
│ [全表示] [発表]                  │        │ [全表示] [発表]                  │
└──────────────────────────────────┘        └──────────────────────────────────┘
```

| 要素 | 決定 |
|---|---|
| 値列ヘッダ | **常に `col.avg`「平均」**（`key==='teamGross'||key==='teamNet'` のときだけ。`dir==='desc'` の HBH は従来どおり `'H'`、ベスト2は `col.total`「計」のまま） |
| 注記 | **常に `team.noteAvg`**「1人あたりの平均が少ない方が勝ち」 |
| チーム名の人数併記 | **常に出す**（`team.memN`＝`teamScoreMembers` の人数）。目隠し中は名前ごとマスクなので出ない（現行どおり）。**投影先で「66.5 × 4名」が検算できる**＝§11.14 の「色だけに頼らず文字併記」と同じ思想 |
| 値セル | 現行のまま（`null` は `—`・並びは末尾） |
| 目隠し・発表ボタン・`posBadge` | **不変** |

**実装上の注意**: 現行の `const avg = teamAvgOn(g) && (key==='teamGross'||key==='teamNet');` は、**`teamAvgOn(g) &&` を落とすだけ**にする（`avg` 変数そのものを消して常時 `col.avg` にすると、**ベスト2ボール／HBH/ベガスのカードまで巻き込む**）。§8 のバイト一致検証がこの事故を検出する。

### 5.2 スコア表（`js/results.js` `renderScorecard`）— 「計」行は**据え置き**（PM 既定案を採用）

| 要素 | 決定 | 根拠 |
|---|---|---|
| チーム「計」行（ホール別セル・OUT/IN・グロス・ネット） | **合計のまま**（`teamMembers` 全員の `reduce`・現行の式を1文字も変えない） | ①行ラベルが `col.total`「計」で、**左のホール別セルの足し算の延長**。ここだけ平均にすると同じ行の中で単位が混ざる ②この表は「そのチームの実合計を見る欄」であって**勝敗の値ではない**（勝敗の正は順位カード1箇所＝#157 の二重管理事故の再発防止） ③狭い列に括弧書きを足すと投影レイアウトが崩れる |
| チームの並べ替え（`scSortTeam==='gross'|'net'`） | **変更不要**。すでに `teamGrossVal`/`teamNetVal` を呼んでいる（`js/results.js:301-302`）＝自動で平均順になる | 順位カードと表の並びが構造的に一致 |
| コメント | `js/results.js:298-300` の「（合計/平均の分岐込み）」「下の『計』行の値は合計のまま（§6.4）」を**本設計を指すよう書き換える**（コメントのみ） | |

**既知の見かけ上のギャップ（承知のうえ）**: 4名登録・1名未入力のチームでは、カードが「**79.3 / 3名**」なのに表の「計」は **238**（4行のうち1行が空）。238÷3=79.3 は**表の上では暗算しづらい**。それでもカードに `3名` と出ているので検算の手がかりは残る。ここを直す（＝「計」行を入力済み母数で出す／平均を併記する）のは**別Issue**（§14.3）。

### 5.3 コンペ設定タブ（`js/game.js`）— カードが1枚減る

```
 前                                                後
┌─ コンペ設定（#view-basic）──────────┐        ┌─ コンペ設定（#view-basic）──────────┐
│ [card] ゲーム（コンペ）        S1    │        │ [card] ゲーム（コンペ）        S1    │
│ [card] 大会情報                S2    │        │ [card] 大会情報                S2    │
│ [card] 集計する競技            S3    │        │ [card] 集計する競技            S3    │
│ ▶ チーム対抗の集計（合計／平均）S3b  │ ←削除  │ ▶ ルーレット対抗               S4    │
│ ▶ ルーレット対抗               S4    │        │ ▶ ダブルペリア設定             S7    │
│ ▶ ダブルペリア設定             S7    │        │ …                                    │
└──────────────────────────────────────┘        └──────────────────────────────────────┘
```

閉じた状態で **44px（1行）減るだけ**。S4 以降の番号・並び・開閉状態（`gsOpen`）は不変。新しい要素は1つも増えない。

---

## 6. ★回帰期待値の全件実測（本設計の中核・Q4）

**測定方法**: 作業ツリー外のコピー（`js/**` をコピーしたもの）で `teamAvgOn` を常時 `true` にし、`migrate` の backfill を外して `node tools/regress.mjs --update` → 現行 `tools/regress-expected.json` と機械比較。アプリのコードは1バイトも変更していない。

### 6.1 25ケースの全件結果（★これが受け入れ条件の本体）

| # | ケース | 変化 | 変わる項目（前 → 後） |
|---|---|---|---|
| 1 | `indBasic` | **変わらない** | チーム対抗 OFF |
| 2 | `team3` | **値のみ** | `teamGross` `[326,302,266]`→`[81.5,75.5,66.5]`（w`[2]` 不変）／`teamNet` `[268.4,262.8,249.6]`→`[67.1,65.7,62.4]`（w`[2]` 不変）。`wins`/`computePoints`/`computePayout`/`nextKanji` **不変**（4/4/4＝同人数） |
| 3 | `retiredNoop` | **値のみ** | `team3` と同一（同じ `TEAM3_GAME` を共有） |
| 4 | `refsLive` | **値のみ** | `team3` と同一の `teamGross`/`teamNet` 値変化。`wins`/`points`/`payout`/`nextKanji` **不変** |
| 5 | `refsDeleted` | **★勝者・勝ち点・配分が変わる** | `teamGross` `[247,302,266]` w`[0]` → `[82.3,75.5,66.5]` w`[2]`／`teamNet` `[200.6,262.8,249.6]` w`[0]` → `[66.9,65.7,62.4]` w`[2]`／`wins` `[2,3,0]`→`[0,3,2]`／`computePoints` p01 5→0・p02 7→2・p04 5→0・p09 2→7・p10 10→15・p11 0→5・p12 0→5／`computePayout.total` 81→86・配分額11人ぶん変化／`nextKanji` **不変** |
| 6 | `team2Vegas` | **値のみ** | `teamGross` `[139,104]`→`[69.5,52]`（w`[1]` 不変・2/2名）。`best2ball`/`vegas`/`match1v1` の値は**1ビットも動かない**／`wins`/`points`/`payout`/`nextKanji` **不変** |
| 7 | `univOff` | **変わらない** | チーム対抗 OFF |
| 8 | `univOn` | **変わらない** | 大学対抗は独自の平均（`uvStanding`）＝非接触 |
| 9 | `customTie` | **変わらない** | |
| 10 | `customNone` | **変わらない** | |
| 11 | `periaOpts` | **変わらない** | |
| 12 | `niadora2Sets` | **値のみ** | `teamGross` `[326,302,266]`→`[81.5,75.5,66.5]`（w`[2]` 不変）。ニアドラ側は不変 |
| 13 | `ghostMember` | **★勝者・勝ち点・配分が変わる** | `teamGross` `[238,302,266]` w`[0]`→`[79.3,75.5,66.5]` w`[2]`／`teamNet` `[197.6,262.8,249.6]` w`[0]`→`[65.9,65.7,62.4]` w`[2]`／`wins` `[3,1,1]`→`[1,1,3]`／`computePoints` p01 10→5・p02 12→7・p03 10→5・p09 7→12・p10 15→20・p11 5→10・p12 5→10／`computePayout.total` 94→99／`nextKanji` **不変** |
| 14 | `ghostBest2` | **値のみ** | `teamGross` `[139,107]`→`[69.5,53.5]`／`teamNet` `[133.8,98.2]`→`[66.9,49.1]`（ともに w`[1]` 不変）。`best2ball` `[139,107]`・`vegas`・`holeByHole`・`univMatch` は**不変**／`wins`/`points`/`payout`/`nextKanji` **不変** |
| 15 | `niadoraIndOff` | **値のみ** | `teamGross` `[326,302,266]`→`[81.5,75.5,66.5]`（w`[2]` 不変） |
| 16 | `niadoraCustomOnly` | **変わらない** | |
| 17 | `niadoraRouletteOnly` | **変わらない** | |
| 18 | `niadoraUnivOnly` | **変わらない** | |
| 19 | `best2Absent` | **★勝者・勝ち点・配分が変わる** | `teamGross` `[238,302,79]` w`[2]`→`[79.3,75.5,79]` w`[**1**]`／`teamNet` `[197.6,262.8,65.4]`→`[65.9,65.7,65.4]`（w`[2]` 不変）／`wins` `[0,1,2]`→`[0,2,1]`／`computePoints` p05 11→16・p06 5→10・p07 15→20・p08 5→10・p09 10→5・p10 10→5・p11 10→5／`computePayout.total` 68→73／`nextKanji` **不変**。※T3 は3名登録・入力済み1名なので **79 → 79（79÷1）で不変**＝合計モードが偶然すでに平均だった箇所 |
| 20 | `best2Hole` | **変わらない** | `teamGross`/`teamNet` OFF |
| 21 | `best2Short` | **変わらない** | 同上 |
| 22 | `best2Solo` | **変わらない** | 同上 |
| 23 | `teamAvgEven` | **変わらない**（が §7 で**削除**） | 既に `'avg'`。値は `team3` の「後」と完全一致 |
| 24 | `teamAvgUneven` | **変わらない**（が §7 で**削除**） | 既に `'avg'`。値は `ghostMember` の「後」と完全一致 |
| 25 | `teamAvgUnentered` | **変わらない**（維持） | 既に `'avg'`。母数の番人 |

**要約**: **変わるのは 10 ケース**（`team3`/`retiredNoop`/`refsLive`/`refsDeleted`/`team2Vegas`/`niadora2Sets`/`ghostMember`/`ghostBest2`/`niadoraIndOff`/`best2Absent`）。**変わらないのは 15 ケース**。
**勝者・勝ち点・配分額まで動くのは 3 ケースだけ**（`refsDeleted`/`ghostMember`/`best2Absent`＝いずれも**人数が不揃いなケース**）。
**`nextKanji` は 25/25 で不変**（チーム対抗は次回幹事の決定に関与しない＝構造の確認）。
**`best2ball`/`vegas`/`holeByHole`/`match1v1`/`univMatch`/`niadora`/`roulette`/`customMatch` の `vals`・`winners` は全ケースで不変**。

### 6.2 「同人数なら順位は動かない」が実データで確認できる

値だけが動いた7ケース（2,3,4,6,12,14,15）は**すべてチーム人数が揃っている**（4/4/4 または 2/2）。勝者が動いた3ケースは**すべて人数が不揃い**（3対4、または入力済み人数が不揃い）。§2.3 の数学的性質がそのまま出ている。

### 6.3 `refsLive` / `refsDeleted` は役割を果たし続けるか（Q6）★要注意

このペアは「**ゲームデータは完全に同一で、`state.players` に p03 が居るか居ないかだけが違う**」構成で、**完全削除が過去コンペを書き換えること**を固定するフィクスチャ。

| 観点 | 前（合計） | 後（平均） |
|---|---|---|
| `teamGross` の勝者 | グリーン(T3) → **レッド(T1)** に入れ替わる（`326→247` で最小に） | **入れ替わらない**（`81.5→82.3`・どちらも T3 勝ち） |
| `teamNet` の勝者 | T3 → **T1** に入れ替わる | **入れ替わらない**（`67.1→66.9`） |
| `wins` | `[1.5,1.5,2]` → `[2,3,0]` | `[1.5,1.5,2]` → `[0,3,2]` ★**依然として大きく変わる** |
| ニアドラ（`niadora`） | 勝者 `[0,1]`→`[1]`・T1 の本数 2→1 | **同じ（不変）** |
| `computePoints` | p03 が消える・9人ぶん変動 | p03 が消える・**11人ぶん変動** |
| `computePayout.total` | 108 → 81 | 108 → **86** |

> **結論: 役割は果たし続ける**（むしろ差分項目は増えている）。ただし「**削除で優勝チームが入れ替わる**」という一番わかりやすい症状は消え、代わりに「値が 81.5→82.3 とわずかに動く／ニアドラ勝者と勝ち点・配分が動く」に変わる。
> **副作用としてこれは良い知らせ**でもある: 平均は「人数が1人減ったこと」自体で勝敗をひっくり返さない＝**完全削除の破壊力が小さくなった**（残るのはニアドラ等の記録参照切れ）。
> **実装時にやること**: `tools/regress.mjs` の `refsLive/refsDeleted` **先頭コメント**（現在「teamGross 勝者が グリーン → レッド／賞金ポイント総量 108 → 81」と書いてある）を実測値に合わせて更新する（**フィクスチャ定義は1文字も変えない**）。

---

## 7. 決定 E：回帰ケースの整理（Q5）

### 7.1 `teamAvgEven` / `teamAvgUneven` は**削除**

実測（プロトタイプ）:

```
team3      == teamAvgEven    : true   （JSON バイト一致）
ghostMember== teamAvgUneven  : true   （JSON バイト一致）
```

- `teamAvgEven` は「`team3` と完全同一構成＋`'avg'`」、`teamAvgUneven` は「`ghostMember` と完全同一構成＋`'avg'`」として作られた（#185 §10.2）。**合計モードが消えた今、元ケースそのものが平均ケースになる**ので、両者は**同じ入力・同じ期待値の重複**になる。
- 重複は「3ケース PASS している」という**誤った安心**を生み、フィクスチャ2本ぶんの保守コストだけが残る。
- それぞれが担っていた主張は元ケースが引き継ぐ:
  - 「同人数なら勝者・勝ち点・配分が変わらない」→ `team3`（4/4/4）。§6.1 #2 のとおり `wins`/`points`/`payout` が不変であることで固定される。
  - 「人数差で勝者が入れ替わる（#171 の実害解消）」→ `ghostMember`（実質3/4/4 で w`[0]`→w`[2]`）と `best2Absent`。

### 7.2 「合計に戻せないこと」を固定する新ケース `teamLegacySum`（★追加）

| 項目 | 内容 |
|---|---|
| 目的 | **旧バックアップ（`"teamScoreMode":"sum"` が残っている JSON）を読み込んでも平均で計算される**ことを固定する。合計へ戻す分岐が再導入されたら必ず落ちる |
| 構成 | `ghostMember` と**完全に同じ構成**＋ `teamScoreMode:'sum'`（＝差分の出どころを残骸フィールドだけに限定） |
| 期待値 | `ghostMember` と**完全一致**（`teamGross [79.3,75.5,66.5]` w`[2]` / `teamNet [65.9,65.7,62.4]` w`[2]` / `wins [1,1,3]`）。**実測で一致を確認済み** |
| 実装非依存 | `migrate` で `delete` する実装でも、単に読まない実装でも同じ結果＝§3 の Q1 をどちらに倒しても通る |

### 7.3 `teamAvgUnentered` は**維持**（母数の番人）

- 2チーム・T1 の p04 が1打も未入力。**母数を登録人数にした誤実装なら `[59.5,75.5]` w`[0]`** になる（正は `[79.3,75.5]` w`[1]`）。
- フィクスチャから `teamScoreMode:'avg'` の1行だけ落とす（フィールドが無くなるため）。**期待値は1ビットも変わらない**（実測確認済み）。
- ケース名はそのまま（「平均の母数＝入力済み」の意味で今も正確）。改名は JSON キーの delete+add になり差分が読みにくくなるので**しない**。

### 7.4 ケース数の増減

**25 → 24**（`teamAvgEven`/`teamAvgUneven` 削除、`teamLegacySum` 追加）。
`tools/regress.mjs` は「期待値のみに存在（ケース削除?）」を FAIL として検出するので、`--update` での期待値再生成が必須。

---

## 8. 非接触の機械的担保（Q8）★実装者・レビュアー必読

`js/roulette.js` の `card()` は **teamGross / teamNet / best2ball / holeByHole** の4種目で共用（ベガスは別ブロック）。表示分岐（`avg`）の撤去で**ベスト2ボールのヘッダまで「平均」にしてしまう**のが最も起きやすい事故。

### 8.1 バイト一致ハーネス（実測済み・そのまま使える）

`scratchpad/cardhtml.mjs` として保存（**リポジトリにコミットしない**。`tools/` に置くかは PR レビューで判断）。`renderTeams(g, only)` の出力 HTML を種目ごとに取り出して main と比較する。

```js
/* renderTeams のカード HTML をバイト単位で取り出す。使い方: node cardhtml.mjs <repo-root> */
import fs from 'node:fs'; import vm from 'node:vm';
const root = process.argv[2];
const FILES = ['state','i18n','nav','game','score','calc','results-team','roulette'];
const src = FILES.map(n => fs.readFileSync(`${root}/js/${n}.js`,'utf8')).join('\n');
const PAR=[4,4,3,4,5,4,4,3,4,4,4,3,4,5,4,4,3,4];
const HID=[0,1,3,4,6,8,10,12,13,15,16,17];
const players=[['p01','明','M','1958-04-02','none'],['p02','蓮','M','1990-11-23','none'],['p03','桜','F','1985-06-15','every1'],
  ['p05','美咲','F','1993-09-09','every2'],['p06','豪','M','1980-12-01','none']]
  .map(([id,name,gender,birth,everyType])=>({id,name,gender,birth,everyType}));
const ids=players.map(p=>p.id);
const scores=Object.fromEntries(ids.map((pid,pi)=>[pid,PAR.map((p,h)=>Math.max(1,p+(((pi*3+h*2)%5)-2)))]));
const hidden=Array(18).fill(false); HID.forEach(i=>hidden[i]=true);
const game={ id:'G1',name:'X',date:'2026-09-19',course:'',par:PAR.slice(),hidden,periaCoef:0.8,periaCap:null,
  womenEvery:{enabled:true},
  teams:[{id:'T1',name:'レッド',color:'red',memberIds:['p01','p02','p03']},{id:'T2',name:'ブルー',color:'blue',memberIds:['p05','p06']}],
  participants:['p01','p02','p05','p06'], scores, prizes:{niapinWinner:{},draconWinner:{}}, prizePool:5000,
  vegas:{flip:true,cap:'doublePar'}, match1v1:{teamA:null,teamB:null,pairs:[]},
  announced:{teamGross:true,teamNet:true,best2ball:true,vegas:true,holeByHole:true},
  formats:{gross:true,net:true,teamGross:true,teamNet:true,best2ball:true,vegas:true,holeByHole:true,
    roulette:false,niadoraInd:false,niadoraTeam:false,stableford:false,olympic:false,callaway:false,
    nassau:false,match1v1:false,univMatch:false,customMatch:false} };
const sandbox={console,Math,JSON,Date,
  localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  document:{documentElement:{setAttribute(){},getAttribute:()=>null},querySelectorAll:()=>[],
    querySelector:()=>null,getElementById:()=>null,addEventListener(){}},
  window:{matchMedia:()=>({matches:false,addEventListener(){}}),addEventListener(){}},
  __GAME:JSON.stringify(game), __PLAYERS:JSON.stringify(players)};
const driver=`
CHANNEL='b'; LANG='ja';
state={players:JSON.parse(__PLAYERS),games:[JSON.parse(__GAME)],currentGameId:'G1'}; migrate(state);
const g=curGame();
globalThis.__OUT=JSON.stringify({ best2ball:renderTeams(g,'best2ball'), holeByHole:renderTeams(g,'holeByHole'),
  vegas:renderTeams(g,'vegas'), teamGross:renderTeams(g,'teamGross'), teamNet:renderTeams(g,'teamNet') });`;
vm.runInContext(src+'\n'+driver, vm.createContext(sandbox));
console.log(sandbox.__OUT);
```

**使い方**（reviewer）:
```bash
node scratchpad/cardhtml.mjs <main のワークツリー>   > /tmp/before.json
node scratchpad/cardhtml.mjs <PR ブランチのワークツリー> > /tmp/after.json
node -e "const a=require('/tmp/before.json'),b=require('/tmp/after.json');
  for(const k of ['best2ball','holeByHole','vegas']) console.log(k, a[k]===b[k]?'IDENTICAL':'DIFFERS');"
```

**期待結果（本設計のプロトタイプで実測済み）**
```
best2ball  IDENTICAL   ← 値列ヘッダ「計」・注記「各ホール上位2名の合計（少ない方が勝ち）」のまま
holeByHole IDENTICAL   ← 値列ヘッダ「H」・注記「取ったホール数（多い方が勝ち）」のまま
vegas      IDENTICAL   ← 別ブロック（card() 不使用）
teamGross  DIFFERS     ← 注記/ヘッダ/人数併記/値（139→69.5 等）
teamNet    DIFFERS     ← 同上
```

### 8.2 計算側の非接触（`regress.mjs` が担保）

§6.1 のとおり `best2ball`/`vegas`/`holeByHole`/`match1v1`/`univMatch`/`niadora`/`roulette`/`customMatch` の `vals`・`winners` は**全24ケースで不変**。加えて `verify.mjs` の `#3`（エブリ後基準 HDCP）・`Vegas netA=29` も PASS（プロトタイプ確認済み）。

---

## 9. 実装点の全列挙（実装者はこれを上から潰す）

| # | ファイル | 変更 | 行数目安 |
|---|---|---|---|
| 1 | `js/calc.js` | §2.4 のブロック置換（`teamAvgOn`/`teamAggr` の分岐・`teamMemberCounts`/`teamSizeUneven` を削除） | −30 |
| 2 | `js/state.js` | `migrate()` の `if(g.teamScoreMode===undefined) g.teamScoreMode='sum';` と直上の2行コメントを削除／`newGame()` の `teamScoreMode:'avg',` 行を削除 | −3 |
| 3 | `js/game.js` | S3b ブロック（`if(F.teamGross || F.teamNet){ … }`）を削除／`setTeamScoreMode`・`teamScoreWarn`・`teamScoreWarnTag` を削除 | −28 |
| 4 | `js/roulette.js` | `const avg = teamAvgOn(g) && (…)` → `const avg = (key==='teamGross'||key==='teamNet');`／`const tsWarn=teamScoreWarn(g);` 削除／`tsNote` を `t('team.noteAvg')` 固定に／冒頭コメントの「合計/平均の分岐込み」を書き換え | −5 |
| 5 | `js/results.js` | **コメントのみ**（`:298-300` の分岐説明を本設計参照に）。`tGrossOf`/`tNetOf` と「計」行は**無変更** | 0（実質） |
| 6 | `js/i18n.js` | §4.2 の7キー×3言語を削除（443→436） | −18 |
| 7 | `js/testdata.js` | `if(p.teamScore) g.teamScoreMode=p.teamScore;`＋直上コメント／`p6` の `teamScore:'sum',` を削除 | −5 |
| 8 | `tools/regress.mjs` | `teamAvgEven`/`teamAvgUneven` のケース削除／`teamAvgUnentered` から `teamScoreMode:'avg',` 行を削除＋コメント更新／`teamLegacySum` 新設（§7.2）／`refsLive`/`refsDeleted` の**コメントだけ**更新（§6.3） | ±60 |
| 9 | `tools/regress-expected.json` | `node tools/regress.mjs --update` で再生成。**差分が §6.1 の表と §7.4 のケース増減に一致すること**をレビューで確認 | 自動 |
| 10 | `index.html` | `?v=` を PR 番号に一括更新（それ以外は触らない） | — |
| 11 | `styles.css` | **触らない** | 0 |

合計: アプリコード約 **−89 行**（ほぼ削除）＋ 回帰ハーネス。

---

## 10. 触らない範囲（load-bearing・変更したら差し戻し）

- **§3 の個人計算**: `gross`/`effGross`/`periaHdcp`（§11.12 H・§11.22 オプション込み）/`netScore`/`adjHole`/`stablefordPts`/`olympicPts`/`callawayHdcp`/`net9`/`nassauTotalNet`/`tieBreak`/`ranked`。
- **他のチーム種目**: `holesWon`／`best2`・`best2HoleVal`・`best2HolePick`／`vegas*`／`m1*`／`niadoraTeamCount`／`customPts`／`uvStanding`・`uvMembers`。
- `teamMembers`（ゴースト対策 #151/#171）と `teamScoreMembers`（#186）＝**1文字も変えない**。
- `add()` のシグネチャ・同点山分け・`live<2` ガード／`teamWinPoints` の `teams` 絞り込み／`anyTeamEventFmt` の9項／`announced` ゲート／`teamEventPts` のキー集合／`formats` のキー集合。
- localStorage キー5つ（`golfCompe_v1`・`_lang`・`_theme`・`_channel`・`_seenTop`）。
- 非 ESM・inline `onclick/onchange` 依存／`index.html` の `<script>` 読込順／機能色の意味／`styles.css`。
- `tools/regress.mjs` の**フィクスチャ定義**（`teamAvgUnentered` の1行削除と、削除する2ケース、`refsLive`/`refsDeleted` の**コメント**を除く）。
- スコア表の「計」行の式（§5.2）。

---

## 11. 受け入れ条件（★PM が Issue にそのまま貼れる・機械検証できる形）

### 機械検証
- [ ] `node tools/verify.mjs` 全PASS。**i18n キー定義数が 443 → 436**（ja/zh/en とも7キー減・削除キーは §4.2 の7つちょうど）
- [ ] `node tools/regress.mjs` 全PASS（**24ケース**）
- [ ] **`tools/regress-expected.json` の差分が §6.1 の表と完全一致**すること:
  - [ ] 値が変わるのは **10ケース**のみ: `team3` / `retiredNoop` / `refsLive` / `refsDeleted` / `team2Vegas` / `niadora2Sets` / `ghostMember` / `ghostBest2` / `niadoraIndOff` / `best2Absent`
  - [ ] **変わらないのは 13ケース**（＋削除2・追加1）: `indBasic` / `univOff` / `univOn` / `customTie` / `customNone` / `periaOpts` / `niadoraCustomOnly` / `niadoraRouletteOnly` / `niadoraUnivOnly` / `best2Hole` / `best2Short` / `best2Solo` / `teamAvgUnentered` — **1バイトも動いていない**
  - [ ] `team3` の `teamGross` が `[81.5,75.5,66.5]` w`[2]`・`teamNet` が `[67.1,65.7,62.4]` w`[2]`・`wins` が `[1.5,1.5,2]`（**同人数なので勝ち点・配分・`nextKanji` は不変**）
  - [ ] `ghostMember` の `wins` が `[3,1,1]` → `[1,1,3]`（#171 の実害解消）
  - [ ] `refsDeleted` の `wins` が `[2,3,0]` → `[0,3,2]`・`computePayout.total` が 81 → 86
  - [ ] `best2Absent` の `teamGross` が `[79.3,75.5,79]` で winners `[1]`（T3 の 79 は **79÷1 で不変**）
  - [ ] **`nextKanji` が 24/24 ケースで無変更**
  - [ ] `best2ball`/`vegas`/`holeByHole`/`match1v1`/`univMatch`/`niadora`/`roulette`/`customMatch` の `vals`・`winners` が**全ケースで無変更**
- [ ] ケース増減: `teamAvgEven`・`teamAvgUneven` が**削除**され、`teamLegacySum` が**追加**されている
- [ ] `teamLegacySum` の期待値が `ghostMember` と**完全一致**（`teamGross [79.3,75.5,66.5]` w`[2]` / `wins [1,1,3]`）＝**旧JSON の `'sum'` 残骸を読んでも合計に戻らない**
- [ ] `teamAvgUnentered` の期待値が**1バイトも変わっていない**（`teamGross [79.3,75.5]` w`[1]`＝母数は入力済みメンバー）
- [ ] §8.1 のハーネスで **`best2ball` / `holeByHole` / `vegas` の HTML が main と IDENTICAL**
- [ ] `index.html` の `?v=` が PR 番号に一括更新されている
- [ ] `styles.css` の差分が **0 行**

### コード（grep で確認できる）
- [ ] `grep -rn teamScoreMode js/` の結果が **0件**（`calc.js`/`state.js`/`game.js`/`roulette.js`/`testdata.js` すべてから消えている）
- [ ] `grep -rn "teamAvgOn\|teamScoreWarn\|teamSizeUneven\|teamMemberCounts\|setTeamScoreMode" js/` が **0件**
- [ ] `teamScoreMembers` / `teamMembers` / `teamsOf` / `holesWon` / `best2*` / `vegas*` / `uv*` に**差分なし**
- [ ] `migrate()` に `delete` が**入っていない**（既存データの `teamScoreMode` は残置・非参照＝§3 Q1）
- [ ] `js/results.js` の「計」行（`tGross`/`tNet`/`tOut`/`tIn`/`tCell`）に**差分なし**（コメント以外）

### 実ブラウザ（reviewer）
- [ ] 既存コンペ（合計モードで保存されたもの）を開くと、グロス対抗／ネット対抗カードが**平均表示になり、値列ヘッダが「平均」・注記が「1人あたりの平均が少ない方が勝ち」・チーム名に「n名」**が出る
- [ ] コンペ設定タブに「チーム対抗の集計（合計／平均）」セクションが**もう無い**（S3 の次が S4 ルーレット対抗）
- [ ] 人数を不揃いにしても**警告が出ない**（設定・結果カードとも）
- [ ] ベスト2ボール／ホールバイホール／ラスベガス／大学対抗／任意対決／1on1 のカードが**現行と同じ見た目**（ベスト2の値列ヘッダが「計」のまま）
- [ ] 誰も入力していないチームの値が `—` で**並びの末尾**
- [ ] スコア表のチームの並びが順位カードと一致し、「計」行は**合計のまま**
- [ ] 旧バックアップ JSON をインポート → 平均で表示される（インポート前後でアプリが落ちない）
- [ ] アプリ内テストデータ ②④⑤⑥ を作成 → 勝者が変わらない（いずれも人数が揃っている）／⑥も平均で表示される
- [ ] `ja/zh/en` × `light/dark` × 幅 375/768/1024 で崩れなし

---

## 12. PR 分割（Q9）

**1本**（`fix(team): チーム対抗グロス／ネットを平均一本に統一する（合計モード廃止）`）。

| 理由 | 詳細 |
|---|---|
| 分けられない | 計算（`calc.js`）と表示（`roulette.js`）と設定UI（`game.js`）は**同時に消さないと中間状態が壊れる**（例: 設定UIだけ残すと「合計」を選んでも何も起きないラジオが出る） |
| 小さい | アプリコード約 −89 行・ほぼ削除。レビューの主対象は `regress-expected.json` の差分（§6.1 の表と突き合わせるだけ） |
| 直列の注意 | `js/calc.js` を触る**並走タスク（`2026-09-19-provisional-hdcp.md`）とは直列**にする（§14.2） |

---

## 13. 正本・既存設計書への追補文（★PM が貼る。architect は編集しない）

### 13.1 `2026-07-12-golf-compe-web.md` §3.5（チーム対抗）— 既存の #185 追補の直後に追記

```markdown
- **★2026-09-19 追補【確定・load-bearing・過去コンペの結果が変わる】（`docs/handoff/2026-09-19-team-avg-only.md` が正）**: グロス対抗／ネット対抗の**合計モードを廃止し、平均一本に統一**した（ユーザー確定）。`g.teamScoreMode` による分岐は**削除**（既存データのフィールドは残置・非参照。`newGame` は書かない・`migrate` は補完しない）。式は常に **Σ（母数）÷ 母数**、**母数＝`teamScoreMembers(g,T)`＝`teamMembers(g,T)` ∩ 1H以上入力済み**（#186）、丸めは小数第1位、判定値＝表示値、同点は `add()` の山分け。**2026-09-12 追補の「既存ゲームは `'sum'` backfill ＝過去コンペの値は変わらない」は本追補で撤回**され、**既存コンペを開いたときのグロス対抗／ネット対抗の値・勝者・勝ち点・配分額も平均で言い直される**（回帰24ケースのうち10ケースの値が変わり、うち3ケース＝人数が不揃いなケースで勝者・勝ち点・配分が変わることを実測済み。`nextKanji` は全ケース不変）。**ベスト2ボール・ホールバイホール・ラスベガス・1on1・ニアドラ・任意対決・大学対抗は非接触**（`renderTeams` の HTML バイト一致で担保）。人数不揃い警告（#195）は根拠が消えたため**撤去**。
```

### 13.2 `2026-07-12-golf-compe-web.md` §4（データモデル）— `game.teamScoreMode` の行を置換

```markdown
- `game.teamScoreMode`: **廃止フィールド（2026-09-19）**。`'sum' | 'avg'` でグロス対抗／ネット対抗の集計方法を切り替えていたが、**平均一本に統一したため計算から参照しない**。`newGame` は書かず `migrate` も補完しない。**既存データに残っている値は残置・非参照**（旧・種目別チーム配点や `niapinHoles` と同じ後方互換パターン）。回帰ケース `teamLegacySum` が「`'sum'` が残っていても平均で計算される」ことを固定している（`2026-09-19-team-avg-only.md` §3/§7）。
```

### 13.3 `2026-09-12-team-score-average.md` の陳腐化（★PM 判断で先頭に貼る）

> この設計書は **2026-09-19 に一部が過去のもの**になった。architect は当該ファイルを編集していないので、PM が貼るかどうかを決めること（貼らない場合でも、本設計書 §0 が上位であることは Issue に明記する）。

```markdown
> **⚠ 2026-09-19 更新（`docs/handoff/2026-09-19-team-avg-only.md` が上位）**: 本設計の **§0（既存コンペは合計のまま＝過去の結果を書き換えない）は、チーム対抗グロス／ネットについてユーザー判断で撤回**された。合計モードは廃止され、**全コンペが平均**になった。したがって本書の **§0 / §4.1 の `'sum'` 分岐 / §5.1–5.4（`teamScoreMode`）/ §6.1（設定 S3b）/ §6.2（人数不揃い警告）/ §8 の `game.teamScore*`・`team.noteLow` / §10.1–10.2 / §13 / §14** は**歴史的記録**として読むこと。**今も生きているのは §3（平均の母数＝`teamScoreMembers`。実測 59.5 の話）・§4.2（丸めと同点）・§4.3（種目別勝ち点表は表示変更なし）・§4.4（`null` の扱い）・§6.3 の表示方針・§6.4（スコア表の「計」は合計据え置き）・§11.2（`best2` の未入力メンバー採用バグ）**。
```

---

## 14. 申し送り（本件ではやらない）

### 14.1 ★ホールバイホールの人数不揃いは**本当に不公平**（別 Issue 候補・実測あり）

`holesWon(g)` は各ホールについて **`teamMembers` 全員の `adjHole` の素の合計**を比べる。人数が違うと構造的に少人数チームが勝つ。

**実測**（β・3名 vs 4名・`2026-09-19` に vm ハーネスで測定）:

| チーム | 人数 | 取ったホール数（18H中） |
|---|---|---|
| T1 | **3名** | **13.5** |
| T2 | 4名 | 4.5 |

→ グロス／ネット対抗を平均にしても、**ホールバイホールには人数差の不公平が丸ごと残る**。選択肢は ①HBH も平均（＝`tot/cnt` で比べる。§3 load-bearing 変更）②人数不揃い警告を HBH 向けに作り直す ③現状維持（ローカルルールとして幹事が人数を揃える）。
**本件では触らない**（HBH は `2026-08-20-team-points.md` の勝ち点にも効くので独立に設計すべき）。同じことは `best2`（各ホール上位2名＝人数が少ないと上位2名が薄い）にも程度の差で当てはまる。

### 14.2 並走設計 `2026-09-19-provisional-hdcp.md`（開封途中の暫定HDCP）との衝突

- 本件が触る `js/calc.js` の範囲は **`teamAggr`/`teamGrossVal`/`teamNetVal`＋`teamMemberCounts`/`teamSizeUneven` の削除だけ**（`holesWon` の直後〜`best2` コメントの直前）。
- 暫定HDCP 側は `periaHdcp`／`netScore`／隠しホール開封まわり（ファイル前半）を触る見込み。**行としては重ならない**が、`netScore` の値が変われば **`teamNetVal` の値＝本件の回帰期待値も動く**。
- **申し送り**: 両者は**直列**にし、**後に入る方が `regress-expected.json` を再生成**する。後発PR のレビューでは「前発PR が宣言した差分（§6.1 の表 / 暫定HDCP 側の表）と重ならないこと」を確認する。`tools/regress.mjs` の**フィクスチャ定義の行**は両者とも触らない（本件が触るのは削除2ケース＋追加1ケース＋コメントのみ）。

### 14.3 その他

- `best2(g,T)` が**未入力メンバーの `netScore=0` をベストボールとして採用する**バグ（#185 §11.2 で実測・未修正）。`teamScoreMembers` に差し替えれば直るが値が動く＝別設計・別 Issue。
- スコア表「計」行と平均カードの見かけ上のギャップ（§5.2 末尾）。
- 「上位N名平均」（母数の足切り）は引き続きスコープ外。`teamScoreMode` を消すので、将来やるなら新しいフィールド名で設計し直す。

---

## 15. モックの要否（Q10）

**不要**。根拠:

1. **新しいレイアウトを1つも作らない**。変更は (a) 設定カードが1枚消える（§5.3）(b) 既存カードの文字列が「計→平均」「合計が少ない方が勝ち→1人あたりの平均が…」に固定される (c) チーム名に `n名` が常に付く — **いずれも #185 で実装済み・本番稼働中の見た目**。
2. **「後」の姿は今日すでに本番で見られる**: 新規コンペは既に平均モードなので、`https://shoulang0729.github.io/76-Club/` で新規コンペを作れば §5.1 右側の画面がそのまま出る。**モックを作るより実物を見る方が速い**。
3. 寸法変化は**コンペ設定タブが 44px（1行）縮むだけ**で、他の画面のレイアウトは不変。

> UI テーマの規律（CLAUDE.md「UI テーマは実装着手前にモック承認」）は**画面構成・ナビ・レイアウト再編**に対するもので、本件は該当しない。PM がモックを求める場合は「既存コンペを開いたグロス対抗カードの before/after スクリーンショット2枚」で足りる（実装前に main で before、実装後に after）。
