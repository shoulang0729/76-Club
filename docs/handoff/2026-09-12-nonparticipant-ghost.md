# チームメンバーの「ゴースト」混入／チップ誤操作 修正設計（2026-09-12・実コンペ発生）

**区分: 確定**（L1/L2 は §3 計算仕様 load-bearing に触れる。数値はすべて実測で裏取り済み）
**関連正本**: `docs/handoff/2026-07-12-golf-compe-web.md` §3.4 / §3.5 / §4（L1 と同時に追補を入れる）
**サイズ判定**: **L1+L2 = M（モック不要・今すぐ実装可）** / **L3 = M（UI テーマ＝モック承認必須・別Issue）**

> **結論を先に**: 実害は3層あり、**L1/L2（数値と表示）は `js/calc.js`/`js/results*.js`/`js/roulette.js` の参照側統一だけで完全に直る**（既存回帰9ケースは1ビットも動かない＝実測）。**L3（誤操作を誘発するチップUI）は別Issue＋モック承認**にして、L1/L2 の修正を待たせない。

---

## 1. 事象（ユーザー報告・2026-09-12 実コンペ）

> テストでスコアを入れておいた選手が体調不良で出場できず、**チームから削除しておいた**が、大学対抗ルールの試合表スコアに名前が残っていた。選手登録ごと削除してスコアを消した。本来は**チームから削除の時点で**スコア表からいなくなるべき。

ユーザー確認の結果、実際の操作は **「チームカードの名前チップをクリックした」** だった（参加者チェックではない）。ただし調査の過程で**もう1つ独立したバグ**（参加者チェックを外す経路）が見つかったため、本書は**両方**を扱う。

---

## 2. 2つの経路と3層の実害

### 2.1 経路③（今日の症状）— チップ誤操作で「外れずに移動する」

`toggleTeamMember(tid,pid)`（`js/players.js:164-167`）は **①他チームから pid を外す → ②tid に居なければ追加** という実装。
一方チップ一覧（`js/players.js:25`）は **どのチームカードにも `g.participants` 全員**を並べ、`t.memberIds.includes(pid)` で点灯（`.on`）だけ切り替える。

つまり **off のチップを押すと「そのチームへ移動（追加）」になる**のに、見た目は「まだこのチームに入っていない人」と区別が付かない。
幹事が「A大から外す」つもりで **B大カードの a4 チップを押すと、a4 は A大から外れて B大に入る**。A大の数値は正しく減るので**成功したように見える**が、スコア表には B大の行として残り続ける。

**「どのチームからも外す」操作が UI 上に存在しない**のが根本。

### 2.2 経路⑤（別バグ）— 参加者から外しても `memberIds` に残る「ゴースト」

`toggleParticipant`（`js/players.js:138-140`）は `g.participants` から外すだけで、`memberIds` も `g.scores[pid]` も掃除しない。
そして `T.memberIds` を `g.participants` で絞るかどうかが**関数ごとに不統一**なので、多くの集計がゴーストのスコアを拾い続ける。

さらに **UI の罠**: 参加者から外すと、チップ一覧が `g.participants.map(...)` なのでその選手のチップが**どのチームカードからも消え、チームから外す操作ができなくなる**。ユーザーが選手登録ごと削除するしかなかったのはこのため（`delPlayer`＝`js/players.js:134-136` は `participants`・`scores`・`memberIds` を全部掃除するので直る）。

### 2.3 実害の3層

| 層 | 内容 | 経路 | 直し方 | 本設計での扱い |
|---|---|---|---|---|
| **L1 数値が狂う** | `teamGross`/`teamNet`/`holeByHole`/`best2ball`/ニアドラ本数/チーム配点にゴーストのスコアが混入 | ⑤ | 参照側を `participants` で統一（方針A） | **今回・Issue#1・PR-1** |
| **L2 表示に残る** | チーム戦スコア表・ルーレット代表抽選にゴーストが出る | ⑤ | 同上 | **今回・Issue#1・PR-1** |
| **L3 誤操作を誘発するUI** | off チップを押すと移動になる／未所属者が見えない／ゴーストが見えない | ③⑤ | チーム編集UIの再設計 | **別Issue#2・モック承認後** |

**L3 は L1/L2 をブロックしない**（データ・計算に非接触で、触るファイルも `js/players.js`・`js/i18n.js`・`styles.css` と重ならない）。

---

## 3. 根本原因（L1/L2）— `memberIds` を絞るかどうかの不統一

### 3.1 絞っている（正しい）
| 関数 | 位置 | 条件 |
|---|---|---|
| `vegasPair` | `js/calc.js:96` | `participants` |
| `m1MemberIds` | `js/calc.js:129` | `participants` ＋ `state.players` 実在 |
| `uvMembers` | `js/calc.js:163` | `participants` ＋ 実在 ＋ 1H以上入力済み |

### 3.2 絞っていない（バグ）
| 箇所 | 位置 | 影響 |
|---|---|---|
| `holesWon` | `js/calc.js:83,85` | HBH のホール合計にゴーストの打数が入る |
| `best2` | `js/calc.js:92` | ベスト2ボールがゴーストのネットを採用しうる |
| `teamRanked` | `js/calc.js:76` | チームの資格判定 |
| `niadoraTeamCount` | `js/calc.js:196,197` | ゴーストが獲った NP/DC 本数をチームに加算 |
| `teamWinPoints` teams フィルタ／`teamGross`／`teamNet` | `js/calc.js:223,247,248` | **チーム対抗G/N の数値そのものが狂う** |
| `computePoints` のチーム配点 | `js/calc.js:314` | ゴーストに `teamRankPts` を配る |
| `renderScorecard` チーム分岐（メンバー行・`tAt`/`tCell`/`tGross`/`tNet`/`tOut`/`tIn`） | `js/results.js:226,231,232,240,243〜247` | **スコア表にゴーストの行が出る** |
| `renderTeamGame`／`renderTeamNiadora`／`renderTeamCustom`／`renderTeams` | `js/results-team.js:6,139,152,250,251,252` | 同上（表示側の重複実装） |
| `rTeams`／`rlDraw`／`rlTick`／代表 `<select>`／`rlSc` メンバー行／`renderTeams` | `js/roulette.js:2,10,18,19,101,176,242〜244` | **ゴーストがルーレットの代表に抽選されうる** |

---

## 4. 実測（PM の2本のハーネスを追試して完全一致を確認）

ハーネス: `scratchpad/bug-chip.mjs`（実 `toggleTeamMember`/`toggleParticipant` を呼ぶ）・`scratchpad/ghost-proof.mjs`（`teamWinPoints`/`computePoints`/`renderScorecard` を丸ごと見る）。
フィクスチャ: A大`{a1..a4}` / B大`{b1..b4}`、`a4` は全ホール +8 の大叩き、`a4` が NP 1本・DC 1本の勝者。

### 4.1 操作別（現行コード）
| 操作 | memberIds | A大グロス | スコア表の a4 |
|---|---|---|---|
| ① 基準 | A大[a1,a2,a3,a4] B大[b1..b4] | 478 | あり |
| ② **A大カード**の a4 チップを押す（正しい操作） | A大[a1,a2,a3] | 264 ✅ | なし ✅ |
| ③ **B大カード**の a4 チップを押す（**今日の症状**） | A大[a1,a2,a3] **B大[b1..b4,a4]** | 264 | **★あり**（B大の行として） |
| ④ ③のあと B大でもう一度押す | A大[a1,a2,a3] B大[b1..b4] | 264 | なし |
| ⑤ 参加者チェックを外す | A大[a1,a2,a3,**a4**] | **★478** | **★あり** |

> **③ はデータとしては「幹事の操作どおり」**（a4 は正規の参加者で B大のメンバー）。数値も整合している。**純粋に UI の問題**＝L3。方針A では直らない。
> **⑤ は計算そのものが壊れている**＝L1/L2。方針A で直る。

### 4.2 ⑤（ゴースト）の詳細・現行 vs 方針A適用後
| 操作 | teamGross | teamNet | holeByHole | ニアドラ本数 | 大学対抗 | スコア表の a4 |
|---|---|---|---|---|---|---|
| **現行** ① 何もしない | [478, 352] | [322.8, 297.6] | [0, 18] | [2, 1] | A大 P4/N4 平均100.30 | あり |
| **現行** ⑤ 参加者から外す | **[478, 352]**★ | **[322.8, 297.6]**★ | **[0, 18]**★ | **[2, 1]**★ | A大 P3/N3 平均74.40（正） | **あり**★ |
| **現行** ② チームから外す（正） | [264, 352] | [223.2, 297.6] | [18, 0] | [0, 1] | A大 P3/N3 平均74.40 | なし |
| **適用後** ① 何もしない | [478, 352] | [322.8, 297.6] | [0, 18] | [2, 1] | A大 P4/N4 平均100.30 | あり |
| **適用後** ⑤ 参加者から外す | **[264, 352]** | **[223.2, 297.6]** | **[18, 0]** | **[0, 1]** | A大 P3/N3 平均74.40 | **なし** |
| **適用後** ② チームから外す（正） | [264, 352] | [223.2, 297.6] | [18, 0] | [0, 1] | A大 P3/N3 平均74.40 | なし |

**適用後は ⑤ の全出力が ② と完全一致**（バグの定義＝「⑤ が ② と一致しないこと」）。**① は前後で1ビットも動かない。**
→ 大学対抗（`uvMembers`）・ラスベガス（`vegasPair`）・1on1（`m1MemberIds`）は元々正しく、**スコア表の表示だけ**が壊れていた。**チーム対抗G/N・HBH・ニアドラは数値そのものが狂う**（ユーザーが気づいたのは前者だが、後者のほうが深刻）。

### 4.3 境界ケース「チーム全員が参加者から外れた」
| | 現行 | 適用後 |
|---|---|---|
| 対抗のチーム一覧 | A大 / B大（A大は 478 を表示） | **B大のみ**（A大は対抗から消える） |
| 種目の成立 | 成立（2チーム） | **不成立**（対象1チーム＝`add()` の `live<2`） |
| `computePoints` | b1:22, b2:20… | b1:12, b2:10…（チーム配点なし） |

→ **参加者ゼロのチームは「対抗の相手にならない」**とみなすのが正（`m1Teams`／`vegasStandings` が既に採っている規則と同型）。→ 未決 **U1**。

---

## 5. 方針の比較と決定（L1/L2）

| 案 | 内容 | 既存の壊れたデータ | 一時離脱→復帰の運用 | 判定 |
|---|---|---|---|---|
| **(A) 参照側を統一** | 全チーム集計・スコア表・ルーレットで `memberIds` を `participants`（＋実在）で絞る | **直る**（バックアップJSONも読み込んだ瞬間に正しくなる） | 壊さない | **採用（必須）** |
| (B) 書き込み側で整合 | `toggleParticipant` で `memberIds` からも自動削除 | 直らない | **壊す**（参加者に戻してもチームに戻らない＝非可逆） | **却下** |
| (B′) UI で可視化＋任意削除 | ゴーストを警告チップで見せ、ワンタップで外せる | 幹事が気づける | 壊さない（幹事の意思で操作） | **採用（L3へ移す）** |
| (D) migrate で一括掃除 | 読込時に `memberIds -= ghosts` | 直る | **壊す**（非可逆・一時離脱運用を破壊・バックアップの意味を変える） | **却下** |

### 決定: **(A) を今回必須 ＋ (B′) を L3（別Issue）へ**

**根拠**:
1. **(A) だけで L1/L2 の実害はすべて消える**（§4.2 で実証）。データ上の不整合（`memberIds` にゴーストが残る）は残るが、それは「一時的に外れているメンバー」という**意味のある状態**であり、消してはいけない情報。
2. **(B)/(D) は非可逆**。現行の `toggleParticipant` は `g.scores[pid]=g.scores[pid]||Array(18).fill(null)` と明示的に既存スコアを温存しており、「参加者に戻せば元どおり」という設計思想。自動削除／一括掃除はこれを一方的に壊す。
3. 残る問題は「幹事が状態に気づけない」ことだけ → **L3 の UI で解く**のが最小副作用。

---

## 6. L1/L2 実装設計（Issue#1・PR-1）

### 6.1 共通 helper（`js/calc.js`・`holesWon` の直前に新設）

```
teamMembers(g, T)  = T.memberIds.filter(pid => g.participants.includes(pid)
                                            && state.players.find(x => x.id === pid))
teamsOf(g)         = g.teams.filter(t => teamMembers(g, t).length)
```

- `teamMembers` は **`m1MemberIds` と定義が完全に同一** → `m1MemberIds(g,T){ return teamMembers(g,T); }`（挙動不変）。
- `uvMembers(g,T) = teamMembers(g,T).filter(pid => (g.scores[pid]||[]).some(v=>v!=null&&v!==''))`（挙動不変）。
- `vegasPair(g,T){ const m=teamMembers(g,T); return m.length===2?m:null; }`（`state.players` 実在チェックが増えるが挙動不変）。
- **上記3関数の書き換えは必須ではない**（方針Aの効果には不要）。不統一を残さないための整理で、回帰11ケース全一致で安全性を実測済み（§8）。差分を減らしたければ PR-1 から外してよい。

> **注**: `g` が `viewGame()` の `Object.assign` コピーでも `participants` は素通しで参照できる（既存の `uvMembers`／`m1MemberIds` と同じ前提）。

### 6.2 置換表（実装者はこの表どおりに置換する）

| ファイル | 現在 | 変更後 |
|---|---|---|
| `js/calc.js` `teamRanked` | `g.teams.filter(t=>t.memberIds.length)` | `teamsOf(g)` |
| `js/calc.js` `holesWon` | `g.teams.filter(t=>t.memberIds.length)` / `t.memberIds.forEach` | `teamsOf(g)` / `teamMembers(g,t).forEach` |
| `js/calc.js` `best2` | `t.memberIds.map(...)` | `const m=teamMembers(g,t); if(!m.length)return null; m.map(...)` |
| `js/calc.js` `vegasPair` | インライン filter | `teamMembers(g,T)` |
| `js/calc.js` `m1MemberIds` | インライン filter | `teamMembers(g,T)` |
| `js/calc.js` `uvMembers` | インライン filter | `teamMembers(g,T).filter(entered)` |
| `js/calc.js` `niadoraTeamCount` ×2 | `T.memberIds.includes(pid)` | `teamMembers(g,T).includes(pid)` |
| `js/calc.js` `teamWinPoints` teams | `t.memberIds.length&&t.memberIds.some(entered)` | `const m=teamMembers(g,t); m.length&&m.some(entered)` |
| `js/calc.js` `teamWinPoints` teamGross/teamNet | `t.memberIds.reduce(...)` | `teamMembers(g,t).reduce(...)` |
| `js/calc.js` `computePoints` チーム配分 | `r.t.memberIds.forEach(...)` | `teamMembers(g,r.t).forEach(...)` |
| `js/results.js` `tAt`/`tGrossOf`/`tNetOf`/メンバー行/`tCell`/`tGross`/`tNet`/`tOut`/`tIn` | `*.memberIds.*` | `teamMembers(g, *)` |
| `js/results-team.js` `renderTeamGame`/`renderTeamNiadora`/`renderTeamCustom`/`renderTeams` の teams | `g.teams.filter(t=>t.memberIds.length)` | `teamsOf(g)` |
| `js/results-team.js` ニアドラ本数 `cnt` | `T.memberIds.includes(pid)` | `teamMembers(g,T).includes(pid)` |
| `js/results-team.js` `renderTeams` teamGross/teamNet | `t.memberIds.reduce(...)` | `teamMembers(g,t).reduce(...)` |
| `js/roulette.js` `rTeams` | `g.teams.filter(t=>t.memberIds.length)` | `teamsOf(g)` |
| `js/roulette.js` `rlDraw` | `t.memberIds.slice()` | `teamMembers(g,t)` |
| `js/roulette.js` `rlTick` | `!t.memberIds.length` / `t.memberIds[rand]` | `const m=teamMembers(g,t); if(!m.length)return; m[rand]` |
| `js/roulette.js` 代表 `<select>`（L176） | `tm.memberIds.map(...)` | `teamMembers(g,tm).map(...)` |
| `js/roulette.js` `rlSc` メンバー行（L101） | `t.memberIds.filter(実在)` | `teamMembers(g,t)` |
| `js/roulette.js` `renderTeams` teamGross/teamNet（L243-244） | `t.memberIds.reduce(...)` | `teamMembers(g,t).reduce(...)` |

**意図的に変更しない箇所**:
- `js/results.js:98` `teamOf(pid)` / `:173` のチーム名逆引き … 引数 `pid` は既に参加者に限定されている。
- `js/roulette.js` の**記録済み代表 `g.roulette.reps[h]`**（`rlStandings`／`rlMarks`）… **確定した実績なので遡及フィルタしない**。ゴーストが過去ホールの代表として記録されていても取得ホール数は動かない（§8 の `ghostMember` ケースで `roulette` vals が前後不変であることを実証済み）。絞るのは**候補プール（抽選・手動選択・スコア表の行）のみ**。→ 未決 **U3**。
- `migrate()` / バックアップ入出力 … **一切触らない**（(D) 却下）。
- `js/testdata.js` … 生成時は `participants ⊇ memberIds`。
- **`toggleParticipant` / `toggleTeamMember` のロジック** … PR-1 では触らない（L3 へ）。

### 6.3 `g.scores[pid]` を消すか → **消さない（現行維持）**

1. **非可逆**。18ホール分の手入力を捨てることになる。途中棄権して後で戻す等の実運用で復旧不能。
2. 現行実装は既存スコアを明示的に温存している（`g.scores[pid]||Array(18).fill(null)`）＝意図的な可逆設計。
3. 方針A により、**スコアが残っていても計算・表示からは完全に除外される**ので消す動機がない。
4. 「本当に消したい」経路は `delPlayer` が既に提供している。

### 6.4 `niadoraTeamCount` を揃えるか → **揃える**

実コンペではテストデータ投入時に賞も仮入力していることが多く、実際に起こる（§4.2 で本数が `[2,1] → [0,1]` と変わる）。
**`niadora2Sets` 回帰ケースへの影響: なし（実測で確認）。** 同ケースの勝者 `p01/p02/p03/p05/p08/p10` はすべて `participants: ALL` に含まれるため集合が変わらない。スナップショット完全一致を §8 で実証済み。

---

## 7. §3 計算仕様（load-bearing）への追補

`teamGross`／`teamNet`／`holeByHole`／`best2ball`／ニアドラ本数 の**定義が変わる**（「チーム全員」→「チームの参加メンバー」）ため、正本 `docs/handoff/2026-07-12-golf-compe-web.md` に以下の追補を入れる（本設計と同一コミット）。

**§3.5 冒頭に追加**:
> **★2026-09-12 追補（`docs/handoff/2026-09-12-nonparticipant-ghost.md` が正）**: 本節の「メンバー」は一律に **`teamMembers(g,T)` ＝ `T.memberIds ∩ g.participants` かつ `state.players` に実在するもの** を指す（グロス対抗／ネット対抗／ホールバイホール／ベスト2ボール／ニアドラ本数／チーム配点のすべて）。`memberIds` に残っているが `participants` に居ない「ゴースト」は**一切集計しない**。`participants` に1人も居ないチームは**対抗の対象チームにならない**（`vegasStandings`／`m1Teams` の既存規則と同型）。`participants ⊇ memberIds` が成り立つ既存データでは**数値は1ビットも変わらない**（回帰スナップショット9ケース完全一致で実証）。

**§3.4 ベスト2ボールの行に追記**: 「チーム内ネット上位2名」→「チーム内**参加メンバーの**ネット上位2名（§3.5 追補）」

**§4 `teams[].memberIds` の行コメント**:
> `memberIds` は `participants` の部分集合であることを**保証しない**（参加者から一時的に外しても所属は残る＝可逆運用）。集計・表示側は必ず `teamMembers(g,T)` で絞る（§3.5 追補・2026-09-12）。

---

## 8. 回帰テスト（`tools/regress.mjs`）

### 8.1 既存ケースは1つも動かない（実測済み）
既存9ケースはすべて `participants ⊇ ∪memberIds`（`indBasic`/`periaOpts` はチーム無し、`team3`/`customTie`/`customNone`/`niadora2Sets` は `participants:ALL`、`team2Vegas` は完全一致、`univOff`/`univOn` は `ALL.slice(0,11)` ⊇ U1∪U2）。

§6 を全適用した木で `node tools/regress.mjs` を実行 → **9ケース全一致**（リポジトリの現行 `tools/regress-expected.json` とバイト等価）。
**既存ケースの期待値が動いたら、それは意図しない挙動変化。`--update` してはいけない。**

### 8.2 新規ケース（2件・PR-1 で追加）

**フィクスチャ実体（実測に使った定義。この通りに `CASES` の末尾へ追加する）**:

```js
  // J) ゴーストメンバー（α・team3 構成そのまま＋p04 を参加者から外してチームに残す）
  ghostMember: { channel: 'a', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03', 'p04'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06', 'p07', 'p08'] },
      { id: 'T3', name: 'グリーン', memberIds: ['p09', 'p10', 'p11', 'p12'] },
    ],
    participants: ALL.filter(p => p !== 'p04'),                       // ★p04 は memberIds に残したまま＝ゴースト
    scores: mkScores(ALL, (pi, h) => ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),   // ★p04 のスコアも残す
    prizePool: 30000,
    prizes: { niapinWinner: { 2: 'p04', 7: 'p05', 11: 'p09', 16: 'p02' }, draconWinner: { 4: 'p04' } },
    points: { teamEventPts: { teamGross: 2, niadora: 3 } },
    roulette: { cur: 4, reps: {
      0: { T1: 'p01', T2: 'p05', T3: 'p09' }, 1: { T1: 'p02', T2: 'p06', T3: 'p10' },
      2: { T1: 'p03', T2: 'p07' }, 3: { T1: 'p04', T2: 'p08', T3: 'p12' } } },   // ★h=3 の T1 代表がゴースト（記録済み＝遡及しない）
    announced: { teamGross: true, holeByHole: true, niadora: true },
    kanjiBadge: true,
    kanjiRanks: { r1: { enabled: true, dir: 'down' }, r2: { enabled: true, dir: 'down' }, booby: { enabled: true, dir: 'up' } },
    formats: { gross: true, net: true, teamGross: true, teamNet: true, holeByHole: true, roulette: true,
      niadoraInd: true, niadoraTeam: true, stableford: false, olympic: false, callaway: false,
      nassau: false, best2ball: false, vegas: false, match1v1: false },
  }) },
  // K) ゴースト（β・ベスト2/ベガス/大学対抗）: p03（T1 最良ネット50）を参加者から外してチームに残す
  ghostBest2: { channel: 'b', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06'] },
    ],
    participants: ['p01', 'p02', 'p05', 'p06'],                       // ★p03 がゴースト
    scores: mkScores(['p01', 'p02', 'p03', 'p05', 'p06'], (pi, h) => ((pi * 3 + h * 2) % 5) - 2),
    prizePool: 5000,
    announced: { teamGross: true, teamNet: true, best2ball: true, vegas: true, univMatch: true },
    univ: { every: false },
    formats: { gross: true, net: true, teamGross: true, teamNet: true, best2ball: true, vegas: true,
      univMatch: true, holeByHole: true, roulette: false, niadoraInd: false, niadoraTeam: false,
      stableford: false, olympic: false, callaway: false, nassau: false, match1v1: false },
  }) },
```

**J) `ghostMember` の期待差（バグ版 → 修正版・実測値）**

| 種目 | バグ版 vals | 修正版 vals |
|---|---|---|
| `teamGross` | `[326, 302, 266]`（勝者 T3） | **`[238, 302, 266]`（勝者 T1）** |
| `teamNet` | `[268.4, 262.8, 249.6]` | **`[197.6, 262.8, 249.6]`** |
| `holeByHole` | `[0, 9, 9]` | **`[5, 5, 8]`** |
| `niadora` | `[3, 1, 1]` | **`[1, 1, 1]`（3チーム山分け）** |
| `roulette` | `[1.5, 0.5, 1]` | `[1.5, 0.5, 1]`（**不変**＝記録済み代表は遡及しない） |
| `wins` | `[3, 0.5, 2.5]` | `[3, 1, 2]` |

**K) `ghostBest2` の期待差（実測値）**

| 種目 | バグ版 vals | 修正版 vals |
|---|---|---|
| `teamGross` | `[189, 107]` | **`[139, 107]`** |
| `teamNet` | `[183.8, 98.2]` | **`[133.8, 98.2]`** |
| `holeByHole` | `[0, 18]` | **`[8, 10]`** |
| `best2ball` | `[113.8, 98.2]` | **`[133.8, 98.2]`** |
| `vegas` | `[8, 10]` | `[8, 10]`（**不変**＝`vegasPair` は元々正しい） |
| `univMatch` | `[2, 1]` | `[2, 1]`（**不変**＝`uvMembers` は元々正しい） |

> `vegas`／`univMatch`／`roulette` が**前後不変**であることが、「元々正しかった関数を壊していない」ことの証明になる。

### 8.3 期待値更新の手順
`node tools/regress.mjs --update` を1回だけ実行し、`git diff tools/regress-expected.json` が **`ghostMember` / `ghostBest2` の追加ブロックだけ**であることを確認する（既存9ケースのブロックに1行も差分が出ないこと）。差分が出たら実装ミス。

---

## 9. L3 設計（Issue#2・モック承認後に実装）— チーム編集UIの作り直し

### 9.1 現行UIの問題（再掲・整理）

| # | 問題 | 現象 |
|---|---|---|
| P1 | **off チップの意味が2つある**（「まだ入れていない未所属者」と「他チームの人」）のに見た目が同じ | 別チームのカードで押す＝**移動**なのに、外したつもりになる（経路③） |
| P2 | **「どのチームからも外す」導線が無い** | 所属チームのカードでしか外せない。どのカードにいるか分からないと外せない |
| P3 | **未所属の参加者が一覧化されていない** | 全カードが全員を並べるので「誰がどこにも入っていないか」が読み取れない |
| P4 | **ゴースト（参加者でないメンバー）が全カードから消える** | 外す操作が不可能になる（経路⑤の罠）。方針A で実害は消えるがデータは残る |
| P5 | 参加者が10名を超えるとチップがチーム数ぶん重複表示され、縦に長くなる | 3チーム×12名＝36チップ |

### 9.2 案の比較

| 案 | 内容 | P1 | P2 | P3 | P4 | P5 | 移動の手数 | 判定 |
|---|---|---|---|---|---|---|---|---|
| **O1 メンバーのみ表示＋追加は別UI** | カードには所属メンバーだけ（× 付き）。追加は「＋メンバー」行から選ぶ | ◎ | ◎ | ○ | ◎ | ◎ | 2操作 | **軸に採用** |
| O2 現行維持＋他チーム所属を視覚区別 | `選手a4 ·B大` と文字併記＋点線枠 | ○ | × | × | × | × | 1操作 | 部分採用（O1の追加行で使う） |
| O3 移動時の確認ダイアログ | 他チーム所属者を押したら confirm | ○ | × | × | × | × | 1操作＋確認 | 部分採用 |
| O4 「どのチームからも外す」導線 | メンバーチップに × を出す | ○ | ◎ | × | ○ | × | — | **O1に内包** |
| O5 現行維持＋未所属者の可視化だけ | 参加者カードの下に未所属バナー | × | × | ◎ | △ | × | 1操作 | **不足**（P1が残る＝今日の事故が再発） |

**推奨 = O1（軸）＋ O4（内包）＋ O2/O3（追加行の他チーム所属者に適用）**

理由: 今日の事故は **「押したときに何が起きるか分からない」** ことが原因。O5 だけでは P1 が残り再発する。O1 は **チップの意味を1カードにつき1つ（＝そのチームから外す）に固定**でき、追加は別行に分離するので押し間違いが構造的に起きない。移動が2操作になるが、自動2組/3組の後の微調整は**追加行に他チーム所属者も出す（O2＋O3）**ことで1操作＋確認に保つ。

### 9.3 モック材料（PM がモックを作るための仕様）

**画面**: 選手タブ（`view-players`）。カード順は現行どおり
`1 選手マスター → 2 登録一覧 → 3 参加者 → 4 チーム対抗 → 5 バックアップ`（正本 §11.12 N）。変更は **3 と 4 の中身だけ**。

#### 3 参加者カード（＋未所属バナー1行）

```
┌─ 参加者 ───────────────────────────────────── card ┐
│ (選手a1)(選手a2)(選手a3)(選手a4)(選手b1)…            │ ← 現行どおりのチップ列（変更なし）
│ ⚠ どのチームにも入っていない参加者: 選手a4, 選手b3   │ ← ★新規・1行 muted＋⚠・該当者0人なら DOM に出さない
└────────────────────────────────────────────────────┘
```
- 文字サイズ 12px（`.muted` 既存）、上マージン 8px。**色に頼らず `⚠` と文言で伝える**。

#### 4 チーム対抗カード（各チームのブロック）

```
┌─ チーム対抗 ──────────────────────────────── card ┐
│ [＋チーム追加] [自動2組] [自動3組]                   │ ← 現行どおり
│ ┌─ team block (border 1px var(--line), r-md, pad 10px, mt 8px) ─┐
│ │ [A大                              ]  [×]         │ ← 現行どおり（名前入力＋削除）
│ │ 色: (自動 ●) ■■■■■■■■■■                          │ ← 現行どおり（tm-swatch-row）
│ │ ── メンバー 3名 ────────────────────             │ ← ★新規: 小見出し（muted 11px）＋人数
│ │ (選手a1 ×)(選手a2 ×)(選手a3 ×)                    │ ← ★変更: 所属メンバーだけ。.chip.on＋末尾 ×
│ │ ⟨⚠ 選手a4 ×⟩                                     │ ← ★新規: ゴースト（不参加）チップ。点線枠・赤系
│ │ ⚠ の選手は「参加者」に入っていません。集計・         │ ← ★新規: ゴーストが居るときだけ
│ │    スコア表には含まれません。× で外せます。          │
│ │ ── 追加 ────────────────────────────             │ ← ★新規: 小見出し（muted 11px）
│ │ (＋選手b3)(＋選手b4)                              │ ← ★新規: 未所属の参加者（押す＝このチームに追加）
│ │ (＋選手b1 ·B大)(＋選手b2 ·B大)                     │ ← ★新規: 他チーム所属（押す＝確認のうえ移動）
│ └──────────────────────────────────────────────────┘
└────────────────────────────────────────────────────┘
```

**チップの3状態（すべて既存トークンのみ・新規トークンなし）**

| 種類 | クラス | 見た目 | 文字 | 押したとき |
|---|---|---|---|---|
| メンバー | `.chip.on` | 塗り（`--pri`／`--on-fill`）＝現行の on と同一 | `名前 ×` | このチームから外す（どこにも属さなくなる） |
| ゴースト | `.chip.ghost` | 点線枠＋`--danger-bg`／`--danger-line`／`--red` | `⚠ 名前 ×` | このチームから外す |
| 追加（未所属） | `.chip` | 現行の off と同一（枠線＋`--card`） | `＋ 名前` | このチームに追加（確認なし） |
| 追加（他チーム所属） | `.chip.moved` | 現行 off ＋ 破線左罫 or `.muted` 文字色 | `＋ 名前 ·所属チーム名` | **確認ダイアログ**→ OK で移動 |

**寸法**: チップは既存 `.chip` の値をそのまま（`padding:3px 9px` / `font-size:12px` / `margin:3px 4px 0 0` / `border-radius:var(--r-pill)`、モバイル `min-height:44px; padding:9px 14px; font-size:14px`）。
**並び**: メンバーは `memberIds` の登録順（現行と同じ）。ゴーストはメンバーの直後。追加行は **未所属者 → 他チーム所属者** の順、それぞれ `g.participants` の順。
**縦の削減**: 各カードが「自分のメンバー＋追加候補」だけになるので、3チーム×12名でもチップ総数は 12＋（未所属＋他チーム）に減る（P5 改善）。

#### CSS 追加（既存トークンのみ・孤立 `var()` を出さない）
```
.chip.ghost{border-style:dashed;border-color:var(--danger-line);background:var(--danger-bg);color:var(--red)}
.chip.moved{color:var(--muted)}
.chip .x{margin-left:2px;opacity:.7}
```

### 9.4 L3 の関数変更（`js/players.js`）

| 関数 | 変更 |
|---|---|
| `renderPlayers` チーム block | チップ列を **メンバー／ゴースト／追加（未所属）／追加（他チーム）** の4グループに分けて生成。小見出しと注記は該当0件なら出さない |
| `renderPlayers` 参加者カード | 未所属バナー1行を追加（該当0件なら出さない） |
| `teamRemoveMember(tid,pid)` **新設** | `t.memberIds = t.memberIds.filter(x=>x!==pid)` のみ（**どこにも移さない**）。`.on`／ゴーストチップの onclick |
| `teamAddMember(tid,pid)` **新設** | 他チームに居れば `confirm(t('confirm.moveTeam',{from,to}))`→ OK なら他チームから外して追加、キャンセルなら何もしない。居なければそのまま追加 |
| `toggleTeamMember(tid,pid)` | **残す**（既存の inline `onclick` 互換・外部からの呼び出し互換）。内部を `teamRemoveMember`／`teamAddMember` に委譲してもよいが、`autoTeams` 等が壊れないこと |
| `toggleParticipant(pid)` | 参加者から**外す**方向かつチーム所属者のときだけ `confirm(t('confirm.ghostTeam',{team}))`→ OK でチームからも外す。キャンセルはゴーストのまま（**方針A により実害ゼロ・⚠ チップで可視化済み**）。`g.scores[pid]` は消さない |

### 9.5 L3 の i18n（3言語同時・新規6キー）

| キー | ja | zh | en |
|---|---|---|---|
| `team.memberHead` | `メンバー {n}名` | `成员 {n}人` | `Members ({n})` |
| `team.addHead` | `追加` | `添加` | `Add` |
| `team.ghostNote` | `⚠ の選手は「参加者」に入っていません。集計・スコア表には含まれません。× で外せます。` | `带 ⚠ 的选手不在「参赛者」名单中，不计入统计与成绩表。点击 × 可移除。` | `Players marked ⚠ are not in the participant list. They are excluded from all totals and the scorecard. Tap × to remove.` |
| `team.noTeamNote` | `⚠ どのチームにも入っていない参加者: {names}` | `⚠ 未加入任何队伍的参赛者：{names}` | `⚠ Participants not in any team: {names}` |
| `confirm.moveTeam` | `{name} を「{from}」から「{to}」に移しますか？` | `确定将 {name} 从「{from}」移到「{to}」吗？` | `Move {name} from "{from}" to "{to}"?` |
| `confirm.ghostTeam` | `この選手はチーム「{team}」のメンバーです。チームからも外しますか？（キャンセル＝チームに残す。どちらでも集計には含まれません）` | `该选手是「{team}」队的成员。是否也从队伍中移除？（取消＝保留在队伍中。两种情况都不计入统计）` | `This player is a member of team "{team}". Remove from the team as well? (Cancel = keep in the team; either way they are excluded from totals.)` |

`{...}` は既存の `t(key, params)` 置換機構（`univ.selOf` と同型）。**3言語のキー集合一致は `node tools/verify.mjs` が機械検証する。**

### 9.6 不整合の検知をどこに出すか（コーディネータ設問3）

| 不整合 | どこに出す | 根拠 |
|---|---|---|
| 参加者だがどのチームにも居ない | **選手タブの参加者カード**（§9.3 の未所属バナー） | 幹事の作業画面。投影しない |
| チームに居るが参加者でない（ゴースト） | **選手タブのチームブロック**（⚠ チップ＋注記） | 同上 |
| **結果タブ（投影画面）には出さない** | — | **投影前提の表示原則**（正本 §11.14）。大型表示を注意書きで汚さない。幹事の操作UIは控えめ配置が原則であり、そもそも結果画面は「読ませる」画面 | 

→ 未決 **U6**（結果タブの `<details>` 内に控えめに出す案もある）。

---

## 10. 受け入れ条件

### 10.1 Issue#1（L1/L2・PR-1）— 機械検証できる形

1. `node tools/regress.mjs` … **全PASS**。`git diff tools/regress-expected.json` の差分が **`ghostMember`／`ghostBest2` の追加のみ**（既存9ケースのスナップショットが1つも動かない）。
2. `node tools/verify.mjs` … **全PASS**（JS構文／ja・zh・en キー集合完全一致／使用キー未定義参照0／未使用キー0／CSS孤立`var()`なし／計算回帰 #3・Vegas）。
3. §4 の実測再現: A大`{a1..a4}`・B大`{b1..b4}`・`a4` 全ホール+8 で、**`a4` を参加者から外した状態（チームには残る）**において
   - チーム対抗G A大 = **264** ／ チーム対抗N A大 = **223.2** ／ ホールバイホール A大 = **18** ／ ニアドラ A大 = **0**
   - チーム戦スコア表に **`a4` の行が出ない**
   - 強条件: **「参加者から外しただけ」の全出力が「チームから外した」出力と完全一致**
4. 旧バックアップ JSON の読み込み（**ゴーストを含むもの・含まないもの両方**）が例外なく成功し、
   - ゴースト無し → 表示・数値が**完全に従来どおり**
   - ゴースト有り → 集計・スコア表・ルーレット候補からゴーストが消える
5. **localStorage キーは5つのまま**（`golfCompe_v1`／`golfCompe_lang`／`golfCompe_theme`／`golfCompe_channel`／`golfCompe_seenTop`）。`migrate()` は変更しない。
6. `index.html` の `?v=` を PR 番号に一括更新。
7. **i18n キーの追加なし**（L1/L2 は表示文言を増やさない）。

### 10.2 Issue#2（L3・PR-2）

1. `node tools/verify.mjs` 全PASS（新規6キー×3言語・未使用キー0・孤立`var()`なし）。
2. `node tools/regress.mjs` 全PASS かつ **`tools/regress-expected.json` に差分ゼロ**（UI のみ＝計算非接触の証明）。
3. **経路③の再現不能性**: B大カードに a4（A大所属）を出す場合は「追加」行に `·A大` 付きで出し、押すと確認ダイアログが出る。**確認せずに移動が起きない**。
4. **経路②の1操作維持**: A大カードの a4 チップ（×）を押すと a4 はどのチームにも属さなくなり、参加者カードの未所属バナーに現れる。
5. ゴーストが1人も居ない・未所属者も居ないデータでは、選手タブに**注記・バナーが1つも出ない**（DOM に存在しない）。
6. 参加者から外すときの確認ダイアログは**チーム所属者のときだけ**出る。キャンセルしても数値は変わらない（L1 の保証）。
7. `index.html` の `?v=` を PR 番号に一括更新。
8. **モック承認済み**（`/feature` 手順 1.5）。

---

## 11. サイズ判定・モック・Issue / PR 分割

| | Issue#1（L1/L2） | Issue#2（L3） |
|---|---|---|
| サイズ | **M** | **M（UI テーマ）** |
| モック | **不要**（表示文言も i18n キーも増やさない。UI 変更ゼロ） | **必須**（§9.3 がモック材料） |
| 触るファイル | `js/calc.js`・`js/results.js`・`js/results-team.js`・`js/roulette.js`・`tools/regress.mjs`・`tools/regress-expected.json`・`index.html`(?v=)・`docs/handoff/2026-07-12-…md`(§3/§4 追補) | `js/players.js`・`js/i18n.js`・`styles.css`・`index.html`(?v=) |
| 依存 | なし。**単独で今すぐマージできる** | Issue#1 の後（`teamMembers` の存在を前提に説明できるため。技術的な依存はないが、順序は 1→2 が自然） |
| load-bearing | **あり**（§3 計算仕様・要前後比較） | なし（計算非接触） |

**PR 分割**: 各Issue 1PR。`index.html` の `?v=` を両方が触るので**直列**（PR-1 マージ → PR-2 を main にリベース）。

**「ユーザーは早く回したい」への回答**: **PR-1 だけでコンペの数値と表示は完全に正しくなる**。L3 はモック承認の往復が要るが、PR-1 をブロックしない。

**他設計との直列関係（2026-09-12 時点）**: `docs/handoff/2026-09-12-niadora-reveal-per-set.md`（ニアドラのセット別開封）が **`js/results.js` / `js/results-team.js` / `styles.css`** を触る。本書 PR-1 も `js/results.js` / `js/results-team.js` を触るため**直列**（先にマージした側に、後発がリベースする）。触る行は重ならない（向こうは `pzMasked`/`togglePzCell`/`npdc-*`、こちらは `renderScorecard` のチーム分岐と `teams` フィルタ）ので、コンフリクトは `index.html` の `?v=` のみの見込み。本書 PR-2 は `js/players.js`/`js/i18n.js`/`styles.css` なので、向こうの `styles.css` とだけ直列。

---

## 12. 未決事項（既定案つき・ユーザー確認が要る論点）

| # | 論点 | 既定案（このまま進める） | 代替案 | 対象 |
|---|---|---|---|---|
| **U1** | **参加者ゼロのチームを対抗の一覧から消すか**（§4.3） | **消す**（`teamsOf`）。種目不成立＝勝ち点も配らない。`m1Teams`／`vegasStandings` と同型 | チーム名だけ残して値を「-」表示（入力漏れに気づきやすいが種目成立判定が複雑化） | Issue#1 |
| **U2** | チームカードを**メンバーのみ表示**に変えるか（O1）／現行の全員表示を維持するか | **O1 に変える**（今日の事故の直接原因 P1 を構造的に潰す） | 現行維持＋視覚区別のみ（O2・改修は小さいが再発リスクが残る） | Issue#2 |
| **U3** | ゴーストがルーレットの**過去代表として記録済み**の場合、ルーレット用スコア表にその行を残すか | **残さない**（メンバー行は `teamMembers` で単純に絞る。取得ホール数＝`rlStandings` は不変なので実害なし） | 「記録済み代表だった pid」は例外的に行を残す（履歴の可読性は上がるが実装が複雑） | Issue#1 |
| **U4** | 既存データの**一括掃除（migrate）** | **やらない**（非可逆・§5 の (D)） | バックアップ画面に「ゴーストを掃除」ボタンを置く（明示操作なら可逆性の議論を避けられる） | — |
| **U5** | **`g.scores[pid]` の扱い** | **残す**（§6.3・現行維持） | 参加者から外すときに消す（非可逆・非推奨） | — |
| **U6** | **結果タブ（投影画面）に不整合の注意を出すか** | **出さない**（投影前提の表示原則・正本 §11.14）。選手タブのみ | チーム戦カードの `<details>` 内に muted 1行で出す | Issue#2 |
| **U7** | 「移動」の確認ダイアログ（`confirm.moveTeam`） | **出す**（他チーム所属者を追加行から押したときだけ） | 出さない（追加行の `·所属チーム名` 併記だけで足りるという判断） | Issue#2 |

**U1 と U2 は表示が目に見えて変わる**ので、PM がユーザーに一言確認しておくとよい。他は既定案で実害なく進められる。
