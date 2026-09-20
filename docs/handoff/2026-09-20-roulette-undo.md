# 設計：ルーレット対抗「1ホールをなかったことにする」 — 2026-09-20

**種別**: M（ルーレットの状態遷移に触る。ただし **§3 計算式・§4 データモデル・localStorage キーは不変**）
**発端**: ユーザー（2026-09-20）「ルーレットは手が滑って止めてしまうことがあるので、１ホールなかったことにするような操作ができるようにしたい。現状できないよね？」
**正本**: `2026-07-12-golf-compe-web.md` §11.3（チェンジ/チャレンジのハーフ制）・§11.14（投影原則）／`2026-08-20-roulette-hero.md`・`2026-08-20-roulette-standings.md`（現行UI）
**触るファイル**: `js/roulette.js`・`js/nav.js`（`rl` の初期値2行）・`js/i18n.js`（5キー×3言語）・`tools/regress.mjs`＋`tools/regress-expected.json`・`index.html`（`?v=` のみ）。**`styles.css` は変更なし**。

---

## 1. PM 確認事項（既定案で最後まで書いてある・異議がなければそのまま実装）

| # | 論点 | 既定案 | 根拠 |
|---|---|---|---|
| Q1 | 操作の形 | **ボタン1個**「直前の1操作を取り消す」。文脈でラベルが変わる（抽選直後＝**抽選をやり直す** / 確定直後＝**1ホール戻す**） | §4。2状態が同時に立たない設計なので1ボタンで足りる |
| Q2 | 戻せる深さ | **1手だけ**・**揮発**（`rl.undo`。localStorage に書かない） | §5.3・§6 |
| Q3 | confirm | **両方あり**（文言は別キー） | §11.14-3。投影中に公開済みの表示を巻き戻す操作 |
| Q4 | 誤操作そのものの防止 | **採用**: スピン開始から **800ms** は STOP を受け付けない（ボタンも `disabled`） | §8。本命の原因対策 |
| Q5 | 過去コンペ／他ゲーム | **不可**（スナップショットは `gid` 一致時のみ適用。揮発なのでリロード後も不可） | §7 |
| Q6 | やり直しでチェンジ／チャレンジの消費は | **戻す**（＝完全に「なかったこと」） | ユーザー原文「なかったことに」。§5.2 |
| Q7 | 18H終了後（`cur=18`）でも「1ホール戻す」を出すか | **出す**（今は `rlReset`（全消し）しか戻す手段がない最悪ケース） | §7.3 |
| Q8 | PR | **1本**（合計 ~70行・同一ファイル） | §11 |
| Q9 | モック | **不要**（既存 flex 行に `sm` ボタン1個） | §12 |

---

## 2. 現状（コード実測・`js/roulette.js`）

| できること | 実体 |
|---|---|
| チェンジで引き直す | `rlChange(tid)`＝`remChange--` → `rlBeginSpin([tid])`。**残0なら不可** |
| 代表を手で直す | `rlForceRep(tid,pid)`（`rl-dev` の `<details>`・現在ホールのみ） |
| 消費回数を戻す | `rlRefund(tid,which)`（同上） |
| 全部やり直す | `rlReset()`（`reps/pool/remChange/remChallenge/cur` を全消し・confirm あり） |

**できないこと**: `R.cur` を減らす手段が存在しない（`rlNextHole` で増えるか `rlReset` で0になるかだけ）。

**★不可逆に見える2点（実測で確認）**
1. `rlNextHole` が `R.pool[tid]` に代表を push する。さらに `rlDraw` は候補が尽きると `pool[tid]=[]` に**リセット**する（:13）＝「pop すれば戻る」は**一般には成立しない**。
2. `R.cur===9`（後半開始）で `remChange`/`remChallenge` を**上書き**（§11.3・前半の余りは失効）。上書き前の値はどこにも残らない。
   - ただし **`remChange` は上書き前は必ず 0**。`rlCanAdvance` の `left = 8-cur` が `cur=8` で 0 になり、全チーム `remChange<=0` でないと進めないため。実測: `cur=8, remChange={1,0,0,0}` → `rlCanAdvance=false` / 全0 → `true`。
   - **失われるのは `remChallenge` の前半余りだけ**（チャレンジは使い切り必須でない）。

**★勝ち点との関係（実測）**: `rlStandings` は `for(h=0; h<R.cur; h++)`＝**現在ホールは数えない**。4チーム18H固定フィクスチャで `cur=18 → won=[3.5,5,6,3.5]` / `cur=17 → [3,5,6,3]`。`cur=17` のまま `reps[17]` を別人に差し替えても `won` は `[3,5,6,3]` のまま＝**現在ホールの引き直しは勝ち点を1ミリも動かさない**。`teamWinPoints` の `roulette` 項の `vals` も同じ値で追随する（`cur` を変えると変わる）。

---

## 3. 要件の切り分け（ユーザーの一文に2つ入っている）

| | ケースA「抽選のやり直し」 | ケースB「1ホール戻す」 |
|---|---|---|
| いつ | STOP を滑らせた直後（**確定して次のホール を押す前**） | 「確定して次のホール」を押した後 |
| 戻したいもの | `reps[cur]`（＋チェンジ/チャレンジの消費） | `cur`・`pool`・`remChange/remChallenge` |
| 過去の結果への影響 | **なし**（§2 の実測） | **あり**（そのホールが取得Hから外れる＝ルーレットの勝ち点が変わる） |
| 頻度 | 高い（ユーザーの訴えはこれ） | 低いが、起きると現状 `rlReset` しか手がなく**被害が最大** |

**結論: 両方やる。** 既定の入口は **1ボタン**にし、どちらの状況かはアプリが判断してラベルを出し分ける（ユーザーに「今はAかBか」を考えさせない）。**推奨する第一の解は §8 の誤操作防止**で、取り消しはその補完。

---

## 4. 方式比較

| 案 | 内容 | 判定 |
|---|---|---|
| **(a) 逆操作** | `cur--`＋`pool` pop＋残数の復元 | **不採用**。`rlDraw` の pool リセット（§2-1）で pop が逆操作にならない／`remChallenge` の前半余りは復元不能／「逆操作」を将来 `rlNextHole` の変更と同期し続ける保守コストが高い |
| **(b) スナップショット（採用）** | 変更を起こす操作の**直前**に `g.roulette` を丸ごと deep clone して1個だけ持つ | **採用**。`rlNextHole` が何を副作用に持つかを知らなくて済む＝仕様追加に自動追従。復元は「代入1回」＝過去の結果を壊す経路が構造的にない |
| **(c) 既存 dev メニューのUI整備だけ** | `rlForceRep`/`rlRefund` を「取消」として見せる | **部分的に不採用**。ケースA は「チェンジで引く→Refund で戻す」で近似できるが、代表が**必ず別人になる**（`rlDraw` の `excludePid`）ので「なかったことにして引き直す」にならない。**ケースB（`cur` を戻す）は原理的に不可能** |

**過去コンペを書き換えないか**（`2026-09-12-team-score-average.md` §0 の原則）:
- (b) のスナップショットは**揮発**（メモリのみ）＋**`gid` 一致チェック**。→ 別のコンペを開いた瞬間・リロードした瞬間に取り消し不能になる。**過去コンペを後から書き換える経路が存在しない**。
- ケースB は「いま進行中のコンペの、いま押したばかりの確定」だけを取り消す。これは記録の改変ではなく**入力ミスの訂正**（`rlForceRep`/`rlRefund` と同じ性質）。

### 4.1 なぜ揮発か（保存しない根拠）
- 保存する場合のサイズは実測 **1,510 B/スナップショット**（4チーム・18H・pool満杯）＝容量は問題ない。問題は**寿命**: `golfCompe_v1` に入れるとバックアップJSON・インポートにも載り、**半年前のコンペを開いたら「1ホール戻す」ボタンが生えている**。これは §11.14-4（演出・進行状態をデータに混ぜない）と記録の不可変性に反する。
- 揮発にすると副作用として**ボタンは「取り消せる瞬間」にしか存在しない**＝投影画面が普段は今までどおり（ボタン0個増）になる。これが最大の利点。

---

## 5. 採用設計

### 5.1 揮発状態（`js/nav.js` の `rl` に3つ追加・**データではない**）
```
let rl={ spinning:false, spinTeams:[], timer:null, challengeFrom:null,
         stopLock:false, lockTimer:null, undo:null };
```
`rl.undo = { gid, kind:'spin'|'next', h, teams:[tid...], snap:<g.roulette の deep clone> }`（**最大1件**）

### 5.2 関数（`js/roulette.js`）

| 関数 | 役割 |
|---|---|
| `rlMark(g,kind,teams)` | **変更前**に `rl.undo` を作る（`snap=JSON.parse(JSON.stringify(g.roulette))`） |
| `rlAdvance(g)` | `rlNextHole` の**状態遷移部分だけ**を切り出した純関数（pool push → `cur++` → `cur===9` の再付与）。**中身は現行の3文をそのまま移すだけ・1文字も変えない** |
| `rlApplyUndo(g)` | `gid` 一致＋`snap` 内の全 pid が `state.players` に存在することを検証 → `g.roulette = clone(snap)`。戻り値 bool。**DOM/confirm/save を呼ばない**（回帰ハーネスから直接呼べるようにするため） |
| `rlUndoKind(g)` | 今出すべきラベル種別 `'spin'`/`'next'`/`null` を返す |
| `rlUndo()` | confirm → `rlApplyUndo` → `'spin'` なら同じチームで再スピン／`'next'` なら `rl.undo=null` して再描画 |

呼び出し側（**`rlMark` は必ず状態を変える前**）:
```
rlStartInitial()  : ids=全チーム        → rlMark(g,'spin',ids); rlBeginSpin(ids);
rlChange(tid)     : 残数ガードの後       → rlMark(g,'spin',[tid]); R.remChange[tid]--; save(); rlBeginSpin([tid]);
rlChallengeDo(f,t): 残数ガードの後       → rlMark(g,'spin',[t]);  R.remChallenge[f]--; ...
rlNextHole()      : rlCanAdvance の後    → rlMark(g,'next',[]);   rlAdvance(g); ...
rlReset()         : rl.undo=null;
```
- `kind:'spin'` の取り消しは `rl.undo` を**消さない**＝気に入るまで何度でもやり直せる（毎回「そのスピンの直前」に戻る）。`rlStop` の `excludePid`（チェンジ時に前の代表を除外する仕様）も、`reps[h]` がスピン直前の値に戻るので**初回と同じ挙動**になる。
- `kind:'next'` の取り消しは適用後に `rl.undo=null`（同じスナップショットの再適用は無意味なので、ボタンを消す）。
- `rlForceRep`/`rlRefund`（dev メニューの手動修正）は `rl.undo` を**触らない**。ルールは「`rl.undo` は直前の START／チェンジ／チャレンジ／確定 の**1つだけ**を覚える」。

### 5.3 深さを1にする根拠
- ユーザーの訴えは「押した瞬間に気づく」＝**1手で足りる**。
- 2手以上戻すと、途中に `rlDraw` の pool リセット・ハーフ境界の再付与・`rlForceRep` の手修正が挟まり、「どこまで戻ったのか」が幹事にも観客にも説明できなくなる（投影中に説明できない操作は事故の元）。
- 深さ1なら **`rl.undo` は常に1個**＝状態が膨らまない。2手以上戻したいときは `rlReset`（confirm つき全リセット）か dev メニューで直す、を正とする。
- 既知の限界（設計として受容）: 「確定 → 次のホールを回した」後は `rl.undo` が上書きされ、**確定の取り消しはできない**。回すより前に気づく想定。

### 5.4 ガード（`rlApplyUndo` が false を返す条件）
1. `rl.undo.gid !== g.id`（別コンペに切り替えた・リロードした）
2. `snap.reps` / `snap.pool` に **`state.players` に居ない pid** が含まれる（間に選手を完全削除した＝`js/players.js` の削除が `roulette.reps/pool` を掃除する仕様があるため、復元すると削除済み選手が生き返る）
→ false のときは `rl.undo=null` にして `toast('toast.rlUndoStale')`。

---

## 6. データモデル・migrate・localStorage

**変更なし。** `newRoulette()` も `migrate()` も 1 行も触らない。localStorage キーは **5つのまま**（`golfCompe_v1` / `_lang` / `_theme` / `_channel` / `_seenTop`）。バックアップJSONの形も不変。
→ 正本 §4 への追補は**不要**。§11.3 に注記を1段落足すかどうかは PM 判断（貼り付け用テキストは §13）。

---

## 7. 勝ち点（`rlStandings` / `teamWinPoints`）への影響

| 操作 | `rlStandings().won` | `teamWinPoints` の `roulette` 項 | 総合順位配分 |
|---|---|---|---|
| **抽選のやり直し**（ケースA） | **不変**（現在ホールは `h<cur` の外） | **不変** | **不変** |
| **1ホール戻す**（ケースB） | そのホール分だけ減る（例: `[3.5,5,6,3.5]` → `[3,5,6,3]`） | `vals` が追随（勝者が変わりうる） | 変わりうる |

- ケースB は**意図した変化**。confirm 文言に「このホールの結果は取り消され、取得Hの集計から外れます」と明記する。
- **進行中のコンペにだけ許す**（§5.4 ガード1）。過去コンペには揮発スナップショットが存在しないのでボタン自体が出ない。
- 既に `g.announced.roulette=true`（結果を連携済み）でも取り消しは許す。他種目と同じで連携は可逆（`tpAnnounceUI`）＝ここだけ特別扱いしない。

### 7.3 18H 終了後
`R.cur>=18` の分岐（スタンディング＋リセット＋連携のみの画面）でも `rl.undo.kind==='next'` なら「1ホール戻す」を出す。**現状ここは `rlReset`（18H全消し）しか戻す手段がない**＝被害最大のケースなので、ここを救うことが本件の実利の半分を占める。

---

## 8. 誤操作そのものを減らす（★これが本命）

**原因の見立て**: `mainBtn` は `START` と `STOP` が**同じ位置・同じ大きさ**に描かれる（`.rl-main`）。START を押した指がそのまま2度目のタップ（あるいは長押しの離し損ね）をすると、**同じ座標に現れた STOP を即座に押す**。これが「手が滑る」の主要経路。

**採用**: スピン開始から **`RL_STOP_LOCK_MS = 800ms`** は STOP を受け付けない。
- `rlBeginSpin`: `rl.stopLock=true; rl.lockTimer=setTimeout(()=>{ rl.stopLock=false; const b=document.getElementById('rl-main'); if(b)b.disabled=false; }, 800)`
- `rlStop()`: 先頭に `if(rl.stopLock) return;`
- 描画: STOP ボタンに `id="rl-main"` を付け、`rl.stopLock` なら `disabled` 付きで描く（再描画が挟まってもロック状態が保たれる）。
- `rlStopTimer()`: `clearTimeout(rl.lockTimer); rl.lockTimer=null; rl.stopLock=false`（タブ切替・リセットで確実に解除）。
- **CSS 追加なし**: 既存の `button.btn:disabled{opacity:.4}` がそのまま効く（0.8秒だけ赤が薄くなる＝「まだ押せない」が伝わる）。

**800ms の根拠**: モバイルのダブルタップ判定は一般に 300ms 前後、指の置き直しを含めても 500ms 程度。ルーレットの `rlTick` は 75ms 刻みなので 800ms は約10コマ＝演出としても「一瞬で止まった」感が消える下限。上限は「わざと早く止めたい幹事の邪魔をしない」範囲。**1秒を超えない**こと。

**不採用にした防止策**:
- **STOP を START と別位置に置く**（構造的には最善）→ `.rl-main` の配置変更＝レイアウト再編でモック承認が必要になり、費用が釣り合わない。将来やるなら別Issue。
- **長押しで停止** → 投影の場で「押しても止まらない」は事故の元。
- **停止の取り消し確認ダイアログ** → 毎ホール出るので論外。

**それでも取り消しが要る理由**: ロックは「START直後の滑り」しか防げない。回転中に手や袖が当たる／別の人が押す、は防げない。**防止（ロック）＋回復（取り消し）の二段**を採る。

---

## 9. UI（配置・ラベル）

`.rl-head` の右端グループに `btn gray sm` を1個。**`rlReset` の左**（`margin-left:auto` は「その行で最初に出る右寄せ要素」に付ける）。

```
┌─ card rl-play ───────────────────────────────────────────────┐
│ .rl-head                                                     │
│  7H  Par 4     [レッド WIN]        （←ここまで投影の主役）   │
│                          … [1ホール戻す][リセット][結果を連携]│  ← gray sm・右寄せ
│ .rl-panels   [チームA カード] [チームB カード] …             │
│ .rl-ctrl        ( STOP / START / 確定して次のホール )        │
└──────────────────────────────────────────────────────────────┘
```

- ラベル: `rlUndoKind()==='spin'` → **「抽選をやり直す」** / `'next'` → **「1ホール戻す」**（同時には出ない）。
- **`.rl-act`（チェンジ/チャレンジ）には置かない**。あちらは「競技のアクション」、こちらは「幹事の訂正」＝視覚的に分ける（フリーの引き直しが競技アクションに見えると不公平感が出る）。
- confirm は**両方あり**。リセットと隣接するので、文言で区別が付くこと（リセット＝「最初からやり直しますか？」）。
- 出現条件: `rlUndoKind(g)!==null`（＝揮発スナップショットがある間だけ）。スピン中は出さない。

**公平性の担保**: 「抽選をやり直す」はチェンジを消費しない。confirm 文に「消費したチェンジ／チャレンジも戻ります」と明記し、**誰の目にも訂正操作だと分かる**ようにする（隠し機能にしない）。

---

## 10. i18n（ja/zh/en 同時・5キー）

| キー | ja | zh | en |
|---|---|---|---|
| `rl.undoSpin` | 抽選をやり直す | 重新抽签 | Re-spin |
| `rl.undoHole` | 1ホール戻す | 退回1洞 | Undo hole |
| `confirm.rlUndoSpin` | 直前の抽選をやり直します。消費したチェンジ／チャレンジも戻ります。よろしいですか？ | 将重做上一次抽签，已消耗的换人／挑战次数也会返还。确定吗？ | Re-do the last draw? Any Change / Challenge spent will be refunded. |
| `confirm.rlUndoHole` | 1ホール戻します。このホールの結果は取り消され、取得Hの集計から外れます。よろしいですか？ | 将退回1洞。该洞的结果会被取消，并从获得洞数中扣除。确定吗？ | Go back one hole? That hole's result is cancelled and removed from the holes-won tally. |
| `toast.rlUndoStale` | 戻せませんでした（データが変わっています） | 无法撤销（数据已变更） | Can't undo — data has changed |

置き場所: `rl.*` は既存の `'rl.refundChallenge'` の隣、`confirm.*` は `'confirm.rlReset'` の隣、`toast.*` は `'toast.useChange'` の隣（3言語とも同じ位置）。

---

## 11. 受け入れ条件（機械検証できる形）と PR

**PR は1本**（`js/roulette.js` ~55行・`js/nav.js` 2行・`js/i18n.js` 15行・`tools/*` ・`index.html` の `?v=`）。コミットは ①STOPロック ②取り消し の2つに分けるとレビューしやすい。
根拠: 両方とも同じ関数群（`rlBeginSpin`/`rlStop`/`rl`）を触るので並走できず、合計70行に Issue/PR/デプロイ確認の固定費を2回払う理由がない（CLAUDE.md「まとめ出し」）。

### 受け入れ条件
| # | 条件 | 検証 |
|---|---|---|
| A1 | `node tools/verify.mjs` 全項目 OK（i18n パリティ 5キー×3言語・未使用キー0・未定義参照0） | 自動 |
| A2 | `node tools/regress.mjs` の**既存ケースの期待値が1バイトも変わらない** | `git diff tools/regress-expected.json` が**新キーの追加のみ** |
| A3 | **ラウンドトリップ**: `rlMark(g,'next')` → `rlAdvance(g)` → `rlApplyUndo(g)` の後、`JSON.stringify(g.roulette)` が**操作前と完全一致** | 新フィクスチャ（§11.1） |
| A4 | **ハーフ境界**: `cur=8`（`remChange` 全0・`remChallenge` に前半余りあり）から進めると `cur=9`・`remChange=changeN` になり、戻すと `cur=8`・`remChange` 全0・`remChallenge` の**余りまで**復元される | 同上 |
| A5 | **勝ち点**: `rlStandings().won` が advance で1ホール分増え、undo で元の配列に戻る | 同上（数値を期待値に固定） |
| A6 | **やり直しは勝ち点不変**: `cur` を変えずに `reps[cur]` を差し替えても `won` が不変 | 同上（実測値 `[3,5,6,3]`） |
| A7 | **STOPロック**: `rlBeginSpin` 直後に `rlStop()` を呼んでも `reps` が変わらない／800ms 後は変わる | ブラウザ or vm（`rl.stopLock` 直接検査） |
| A8 | **ガード**: `snap` 内の pid を `state.players` から消すと `rlApplyUndo` が `false` | 新フィクスチャ |
| A9 | **別ゲーム**: `rl.undo.gid` が現ゲームと違うと `rlUndoKind()===null`（ボタンが出ない） | 同上 |
| A10 | `cur=18` でも「1ホール戻す」が出て `cur=17` に戻る | ブラウザ1点で目視（§11.2） |
| A11 | `index.html` の `?v=` を PR 番号に一括更新 | reviewer |

### 11.1 回帰フィクスチャで固定するもの（`tools/regress.mjs`）
既存の `univ` / `peria` ブロックと同型で、ケースに `rlUndo:true` を持つものだけ追加ブロックを出力する。**DOM も `confirm` も呼ばない純関数（`rlMark`/`rlAdvance`/`rlApplyUndo`/`rlStandings`）だけを使う**（だから §5.2 で `rlNextHole` から `rlAdvance` を切り出す）。

フィクスチャ（3チーム or 4チーム・`cur=8`・`reps[0..8]` 埋め・`pool` 埋め・`remChange` 全0・`remChallenge` はチームごとに **2/0/1** のようにバラす）で、スナップショットに記録する値:
```
rlUndo: {
  before:       <g.roulette の JSON>,          // 操作前
  afterAdvance: <同・rlAdvance 後>,            // cur 8→9・pool +1・remChange 0→2・remChallenge 上書き
  afterUndo:    <同・rlApplyUndo 後>,          // ★before と完全一致すること
  roundTrip:    true,
  wonBefore:    [...], wonAfterAdvance:[...], wonAfterUndo:[...],   // rlStandings().won
  wonAfterRedrawCurrentHole: [...],            // reps[cur] 差し替え後（wonBefore と同値＝A6）
  staleGuard:   false                          // 選手を消したうえでの rlApplyUndo の戻り値
}
```
これで「pool の push を戻し忘れた」「`remChallenge` の前半余りを取りこぼした」「`cur` を戻し忘れた」「取り消しで過去ホールの勝敗が動いた」が**すべて差分として落ちる**。

### 11.2 ブラウザ実測（CLAUDE.md「ブラウザ検証の選び方」に従い最小限）
- 変更の種類は「寸法（既存 flex 行に `sm` ボタン1個追加）」。→ **最悪ケース1点だけ**: **375px × ja（ラベルが最長）× `cur=18` の画面（戻す＋リセット＋連携が同居する最も混む行）** のスクリーンショット1枚。`.rl-head` が破綻せず、主役（スタンディング）が押し出されないこと。
- **テーマは測らない**（色・トークン変更なし。`disabled` は既存スタイル）。**幅の掃引・言語の掃引はしない**（`@media` 境界も列数も触らない）。
- §3 計算は1文字も触らないので、計算の全数検証は不要（A2 の差分ゼロで担保）。

---

## 12. モックの要否
**不要。** CLAUDE.md のモック必須条件は「大きな構造変更（ナビ・画面構成・表示レイアウトの再編）」。本件は既存 `.rl-head` への `sm` ボタン1個追加と、STOP の 0.8 秒 `disabled` だけで、画面構成・情報の並び・タブは一切変わらない。代わりに **PR に §11.2 のスクリーンショット1枚**を貼る（レビューで人が見る1枚）。

---

## 13. 正本への追補（貼り付け用・**この設計では正本を編集しない**。PM 判断で `2026-07-12-golf-compe-web.md` §11.3 末尾へ）

```
- **★2026-09-20 追補（`docs/handoff/2026-09-20-roulette-undo.md`）**: ハーフ境界の再付与（`R.cur===9` での
  `remChange`/`remChallenge` 上書き）は**揮発スナップショット1件**（`rl.undo`・メモリのみ・保存しない）で
  取り消せるようになった。なお上書き直前の `remChange` は `rlCanAdvance`（`left=8-cur`）により
  **必ず全チーム0**であることが保証される＝非可逆なのは `remChallenge` の前半余りだけ。
  取り消しは進行中のコンペ（`gid` 一致・同一セッション）に限られ、過去コンペの結果は書き換えられない。
  §11.3 のルール（前半の余りは失効・使い切り必須）そのものは不変。
```
```
### 4.x（追補不要）
本件は `game.roulette` のフィールドを追加しない。localStorage キーも5つのまま。
```
