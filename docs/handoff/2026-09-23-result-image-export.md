# コンペ結果の1枚画像エクスポート（結果表PNG）設計（2026-09-23）

**区分: 確定**（§1.2 のユーザー確定事項を前提とする。§10 の PM 確認事項のみ未決＝既定案で進めてよい）
**関連正本**: `docs/handoff/2026-07-12-golf-compe-web.md` §3（計算・**非接触**）／§4（データモデル・**非接触**）／§11.14（投影原則）
**関連設計**: `2026-09-12-result-share.md`（**一部を本設計が上書き**・§1.3）／`2026-09-19-provisional-hdcp.md`（暫定HDCP）／`2026-08-30-winpoints-reveal.md`（連携＝announced ゲート）
**サイズ判定**: **M × 2本**（PR-1＝純データモデル／PR-2＝canvas 描画＋UI）。**PR-2 はモック承認必須**（§11）

> **結論を先に（「できる？」への答え）**
> - **できる。実測で余裕がある。** 参加者 12名＝**1080×3,784px（4.1M px）**、31名＝**1080×4,968px（5.4M px）**、31名×採用種目14個（最悪系）でも **1080×8,104px（8.8M px）**。iOS Safari の canvas 上限（**面積 16,777,216px**・iOS 18 以降は 67,108,864px）に対し **約半分**。**48名でも等倍（11.9M px）で収まる**（§4）。
> - 縮尺を落とす必要が出るのは **約72名超**。設計には自動縮尺（`k`）を入れるが、**現実の運用では常に k=1**。**2枚に割る必要はない。**
> - **Web フォントは実測で落とし穴が確認できた**: 読込前に canvas へ描くと**別フォントの字幅**になる（同じ文字列で 497.9px → 467.4px、**6.5% ずれ**）。`document.fonts.load()` を待ってから描く（§5）。待つのは「画像を作成」ボタン側だけで、**共有ボタン側は完全同期を保つ**（iOS 制約・§7）。
> - **プロトタイプを実際に描いて確認済み**（本文の数値はすべて実測）。生成見本: `/tmp/claude-0/-home-user-76-Club/852799cf-e353-5a31-8eeb-8eaf639e6865/scratchpad/sheet-p2all.png`（12名）・`sheet-p3.png`（31名）。**PM のモックはこの2枚をそのまま使える**（§11）。

---

## 1. 要件と、過去の設計との関係

### 1.1 ユーザー原文（2026-09-23）

> 結果エクスポート機能が欲しい／画像ファイルで基礎スコアと一連のゲーム結果をDLしたい／できる？

### 1.2 ★ユーザー確定事項（再議論しない）

| # | 確定内容 |
|---|---|
| U1 | **用途＝参加者に配る**。幹事会社の Excel に近い「結果表」 |
| U2 | **個人名・個人スコア・賞金額をすべて入れる** |
| U3 | **1枚の縦長画像**（セクション分割の複数枚にしない） |

### 1.3 ★`2026-09-12-result-share.md` のどこが生きて、どこが上書きされたか

本件は**過去の決定を意図的に上書きする**。実装・レビュー時に「設計が食い違う」と差し戻さないこと。

| 節 | 内容 | 本設計での扱い |
|---|---|---|
| §3.3 | 「総合タブにも**共有画像にも、個人名・個人成績・賞金額を入れない**」 | **★上書き（廃止）**。U1/U2 により、画像には**全部入れる**。理由も無効化される（配る相手＝参加者本人なので「転送されても漏れない」設計目標自体が要件と合っていなかった） |
| §5 Q1／Q2 | 個人情報・賞金額を「入れない」既定案 | **★上書き（廃止）**。U2 が正 |
| §6 | プライバシー（「写らないもの＝個人名・賞金額」） | **★上書き**。§9 で書き直す（生年月日・性別は引き続き**出さない**） |
| §4.6〜§4.8 | 総合カード専用の共有画像（PR-B）とその UI 配置 | **★統合して置き換え**。総合カードだけの画像は作らない。**本設計の「結果表1枚」に一本化**する（画像が2種類あると幹事が迷う） |
| §7 | 将来拡張（種目ごとの画像） | **不要になった**（1枚に全部入るため）。削除ではなく「実施しない」 |
| **§4.1〜§4.5** | **手段の比較（CDN／同梱ライブラリ／自前 canvas／SVG foreignObject／印刷CSS／スクショ）** | **★そのまま生きる。** 再検討しない。**(c) 自前 canvas 描画**が本設計の前提 |
| **§4.6 の「二重管理をどう防ぐか」** | モデル → 画面／画像 の分岐図。画像側は DOM も計算も読まない | **★そのまま生きる**（§6 で同じ規律を結果表全体に広げる） |
| **§4.6 の出力仕様**（幅 1080 固定・PNG・**ライト固定**・生成時の表示言語） | | **★そのまま生きる**（幅 1080 は §4.2 で実測再確認した） |
| **§4.7 iOS の同期パス** | `toBlob` を使わない・`toDataURL`→`atob`→`File`→`share` は全同期 | **★そのまま生きる**（§7。ただし Blob 経由の保存を1本足す＝§7.2） |
| §3.1〜§3.2・§3.8 | `？` マスク（announced ゲート）・`tpShareModel(g)` | **★そのまま生きる**（#191 でマージ済み。本設計はこれを**再利用**する・§6.3） |
| §10 | 触らない範囲（calc.js 不変・localStorage キー5つ・i18n 3言語同時・非ESM・外部依存ゼロ） | **★そのまま生きる** |

---

## 2. 画像に載せる内容と順序【決定】

**採用している種目だけ**を出す。判定は `chFormats(g)`（α/β チャネルを反映済み）＋「データが存在するか」。

| # | セクション | 出す条件 | 中身 |
|---|---|---|---|
| 1 | **タイトル** | 常時 | コンペ名（大）／開催日 ・ コース名 ・ 参加者数 |
| 2 | **スコア表**（＝基礎スコア） | 常時 | 全員 × 18ホール（エブリ適用後 `adjArr`）＋ OUT／IN／G（`effGross`）／HD（`periaHdcp`）／Net（`netScore`）。Par 行つき。チーム設定があればチームごとにグループ化（チーム名行＋チームカラー） |
| 3 | **個人戦 順位**（採用種目ごとに1表） | `F.gross` / `F.net` / `F.stableford` / `F.olympic` / `F.callaway` / `F.nassau` の真のものだけ | 順位・選手名（チーム名併記）・値。**全員分**（上位打ち切りなし）。17行以上は**2段組**（左列に前半・右列に後半） |
| 4 | **ニアピン／ドラコン** | `F.niadoraInd \|\| F.niadoraTeam` かつ対象ホールあり | 旗ごとのカード（`NP 3H` / `DC 4H`＋2セット時は `OUT`/`IN`）＋勝者名。4列グリッド |
| 5 | **チーム戦 総合** | `teamsOf(g).length && tpShareModel(g)` が非 null | ①ヒーロー（順位・チーム名・勝ち点・配分pt）②種目別勝ち点表（実値＋勝ち点。**未連携行は `？`**・§3） |
| 6 | **ポイント配分** | 常時 | 順位・選手名・pt・配分額（`prizePool>0` のときのみ ¥ 列）。全員分・17行以上は2段組 |
| 7 | **フッタ** | 常時 | 左＝注記（暫定HDCP・未連携がある旨）／右＝`76-Club` |

### 2.1 v1 で**出さない**もの【決定・スコープ】

- **1 on 1 の組別結果 / 大学対抗の校別明細 / 任意対決の明細 / ルーレットのホール別 / HBH・ベスト2・ラスベガスのホール別**。
  理由: これらの**結論値はセクション5の種目別勝ち点表に1行ずつ載る**（`teamWinPoints(g).events[].vals`）。明細まで入れると縦が倍近くなり、しかも「明細が要るのは幹事であって参加者ではない」。**必要になったら別Issueで追加**（モデルにセクションを足すだけで済む構造にしてある・§6）。
- **生年月日・性別**（§9）。

---

## 3. 未開封・目隠し中の扱い【決定＝画像は"常に全部"。ただし `announced` だけは従う】

| 状態 | 種類 | 画像での扱い | 根拠 |
|---|---|---|---|
| `revealHoles < 18`（ホール開封途中） | **揮発の表示状態**（`js/nav.js:4`） | **無視して18ホール全部を出す**（`viewGame(g)` を通さず `g0` を使う） | ① |
| `show.totals === false`（合計値トグル OFF） | 揮発（`js/nav.js:22`） | **無視して合計値を出す** | ① |
| `nsMode/nsExcept`（グロス・ネットの行目隠し） | 揮発（`js/nav.js:25-27`） | **無視して名前とスコアを出す** | ① |
| `pzMode/pzExcept`（ニアドラの旗の伏せ） | 揮発（`js/results.js:8`） | **無視して勝者名を出す** | ① |
| `tpEvPtsOpen` 等の開閉 | 揮発 | 無関係 | — |
| **`g.announced[key]`（種目の連携＝発表済みフラグ）** | **データ**（`golfCompe_v1` に保存・`js/results-team.js:47`） | **★従う。未連携の種目は `？` のまま**（値も勝ち点も勝者も描かない） | ② |

**根拠①**: 開封・目隠し・伏せは「いま幹事の端末で表彰式をどこまで進めたか」という**演出の途中状態**であって、コンペの結果ではない。これを画像に反映すると、**同じコンペから作った画像が、押したボタンの履歴で中身が変わる**（画面をスクロールしただけ・別タブを見ただけで内容が変わりうる）。配布物としては事故。正本 §11.14-4 が「演出の進行状態は揮発にし保存しない」と決めているのと同じ理由で、**保存物にも載せない**。

**根拠②**: `announced` だけは**幹事が明示的に押した宣言**であり、`golfCompe_v1` に保存される**データ**。`tpShareModel` は未連携行を**モデルの段階で落としている**（値が載らない）ので、画像側で判定し直さない限り構造的にネタバレしない（`2026-09-12-result-share.md` §3.1・load-bearing）。**この規律を画像でも壊さない。**

**誤爆（発表前に作ってしまう）の防止**:
1. UI を**「ポイント（配分）」タブの最下部の `<details>`（既定＝閉）**に置く（§8）。表彰式で投影している個人戦・チーム戦タブからは触れない。
2. `<details>` の中に常設注記（`img.note`）: 「**この画像には全選手の氏名・スコア・配分額が入ります。まだ発表していない結果も含まれます。**」
3. 未連携の種目があるときだけ、注記の下に警告行（`img.warnPending`・`team.annProg` の n/N を併記）。**生成はブロックしない**（`2026-09-12-result-share.md` §5 Q3 の決定を踏襲）。
4. 生成された画像は**必ずその場にプレビュー表示**される＝幹事が中身を見てから配れる（§7.2）。

---

## 4. ★実現性の検証 1: canvas サイズ（本件の生死）

### 4.1 上限の事実

| 環境 | 面積上限 | 辺の上限 | 超えたときの挙動 |
|---|---|---|---|
| **iOS Safari（〜iOS 17）** | **16,777,216 px**（4096×4096 相当） | 実質問題にならない（数万px） | **例外なく黙って空 / 真っ白**。`toDataURL()` / `toBlob()` が空を返す |
| **iOS Safari（iOS 18〜）** | 67,108,864 px（8192×8192 相当） | 同上 | 同上 |
| Chrome | 268,435,456 px（16,384×16,384） | 65,535 | 同上 |
| Firefox | 124,992,400 px | 32,767 | 同上 |

出典: [pqina: Canvas Area Exceeds The Maximum Limit](https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/)・[Lion Puro: Canvas is finally usable on Safari](https://lionpuro.com/posts/canvas-is-finally-usable-on-safari/)・[react-pdf #1149](https://github.com/wojtekmaj/react-pdf/issues/1149)。
**制約は「辺」ではなく「面積」**（4096 を超える辺でも面積が収まれば通る）。iOS の canvas 合計メモリ上限（384MB）も別途あるが、後述のとおり最悪でも 64MB で収まる。

### 4.2 必要な高さ（★実測・幅 1080px 固定・プロトタイプを実際に描いて計測）

| ケース | 参加者 | 採用種目 | **出力サイズ** | **面積** | iOS 17 上限比 | 縮尺 `k` | 描画時間 | PNG dataURL |
|---|---|---|---|---|---|---|---|---|
| テストデータ p1 | 12 | 3 | 1080 × 3,004 | 3.24M | **19%** | 1.0 | — | — |
| テストデータ p2（チーム戦フル） | 12 | 7 | 1080 × 3,672 | 3.97M | **24%** | 1.0 | — | 0.83MB |
| p2＋α全種目 | 12 | 9 | 1080 × 3,784 | 4.09M | **24%** | 1.0 | — | — |
| **テストデータ p3（大学対抗）** | **31** | 3 | **1080 × 4,466** | **4.82M** | **29%** | 1.0 | — | 1.37MB |
| p3＋α全種目 | 31 | 9 | 1080 × 4,968 | 5.37M | 32% | 1.0 | — | — |
| **★最悪系: 31名 × β含む全14種目** | **31** | **14** | **1080 × 8,104** | **8.75M** | **52%** | **1.0** | 591ms | 2.61MB |
| 48名 × 全14種目 | 48 | 14 | 1080 × 10,990 | 11.87M | 71% | 1.0 | 629ms | 3.82MB |
| 80名 × 全14種目 | 80 | 14 | 1018 × 15,723 | 16.00M | 95% | **0.94** | 415ms | 6.08MB |
| 120名 × 全14種目 | 120 | 14 | 743 × 16,384 | 12.17M | 73% | 0.69 | 442ms | 5.84MB |

**結論**:
- **要件（12名・31名）は等倍で余裕をもって収まる**（上限の 24%・29%）。縮小も分割も要らない。
- **現実的な上限は「48名 × 全種目」まで等倍**。76会のコンペ規模（〜40名）は完全に射程内。
- **2枚に割る必要はない。** 80名を超えるような運用が来たら、自動縮尺 `k` が働いて1枚のまま解像度だけ落ちる（読めなくはならない）。
- iOS 18 以降なら上限が4倍なので、最悪系でも 13%。

### 4.3 自動縮尺の式【実装仕様・load-bearing】

```js
const IMG_AREA_MAX = 16000000;   // 16,777,216 に 5% の安全マージン（iOS 17 以前が基準）
const IMG_SIDE_MAX = 16384;      // Chrome の辺上限に合わせた保険
// 論理レイアウトは常に幅 1080 単位で組む。H は積み上げた論理高さ。
const k = Math.min(1, Math.sqrt(IMG_AREA_MAX/(1080*H)), IMG_SIDE_MAX/H);
cv.width = Math.round(1080*k); cv.height = Math.round(H*k);
ctx.scale(k, k);   // 以降の描画コードは k を意識しない
```

- `k` は **1 を超えない**（高解像度化はしない＝ファイルサイズを無駄に増やさない）。
- `k < 1` になったときは UI に注記を出す（`img.scaled`・「参加者が多いため画質を落としました」）。**§10 Q3 で既定＝出す**。
- **単位面積あたりのメモリ**: 16.0M px × 4byte = 64MB（iOS の 384MB 上限に対し 17%）。生成直後に `cv.width=cv.height=0` で解放する。

---

## 5. ★実現性の検証 2: Web フォント（実測で問題を再現済み）

### 5.1 何が起きるか（実測）

ローカル `@font-face`（1.5秒遅延）を仕込んで、canvas に同じ文字列を描いたときの `measureText().width`:

| タイミング | `document.fonts.status` | `document.fonts.check(...)` | 字幅 |
|---|---|---|---|
| 読込前に描く | `loading` | **false** | **497.93px**（フォールバック） |
| `await document.fonts.load(font)` 後 | `loaded` | true | **467.40px**（本来） |

**6.5% ずれる。** レイアウトを字幅で詰めている箇所（選手名の `…` 省略・列幅）が全部ずれるので、**読込前に描いてはいけない**。

### 5.2 もう1つの実測: `document.fonts.check()` は当てにならない

本アプリを**Google Fonts に到達できない環境**（このサンドボックスは egress でブロックされる＝オフラインのゴルフ場と同じ状況）で開くと:

```
fonts.status = "loaded"   ← @font-face 自体が存在しないので最初から完了扱い
fonts.check('800 44px "Noto Sans JP"') = true   ← ★取得に失敗しているのに true
```

`check()` は「その family が使える（＝system にあるか、web font が読み込み済み）」を返す仕様で、**「web font が無いのでフォールバックする」場合も true** になる。したがって **`check()` の結果で分岐してはいけない**。

### 5.3 設計【決定】

```js
/* 「画像を作成」ボタン（★ここは async でよい＝navigator.share を呼ばない） */
async function sheetImgMake(){
  const FF = getComputedStyle(document.body).fontFamily;   // 画面と同じフォントスタックをそのまま使う
  try{
    await Promise.race([
      Promise.all(['400 24px','600 22px','700 30px','800 46px'].map(s=>document.fonts.load(s+' '+FF))),
      new Promise(r=>setTimeout(r, 1500))                   // ★1.5秒で打ち切る（オフライン・取得失敗でも必ず進む）
    ]);
  }catch(e){ /* 握りつぶす＝フォントが無くても画像は作る */ }
  await document.fonts.ready.catch(()=>{});                 // 既に resolve 済みなら即時
  /* … 描画 … */
}
```

- **フォント指定は `getComputedStyle(document.body).fontFamily` をそのまま使う**（`2026-09-12-result-share.md` §4.6 の結論を踏襲）。`html[lang="zh-CN"] body` の `"Noto Sans SC"` にも自動追従する。
- **オフライン／取得失敗時**: 1.5秒でタイムアウトし、`Hiragino Kaku Gothic ProN` / `Meiryo` / system へフォールバックして描く。**画面側も同じフォールバックをしている**ので、画像と画面の見えが一致する（これは自前 canvas 方式だけが持つ性質）。
- **`await` を入れてよいのは「画像を作成」だけ。**「共有・保存」ボタンは §7 のとおり**完全同期**を維持する（iOS の user activation）。2ボタン構成はこの制約のために必要（1ボタンにまとめてはいけない）。
- ウェイト `800` を使うのは canvas では効かない環境がありうるので、**見出しは `700`＋必要なら 2回描き（0.4px ずらし）で太らせない**＝素直に `700`/`800` を指定し、当たらなければ細いまま（**内容は読める**・レイアウトは §5.1 のとおり読込後の実測幅で詰めるので破綻しない）。

---

## 6. データモデル【#157 の教訓＝画面と画像で数字がズレない構造】

### 6.1 レイヤ図

```
   js/calc.js（§3 計算の正・★1文字も変えない）
        │  effGross / periaHdcp / netScore / adjArr / ranked / computePayout / teamWinPoints …
        ├──────────────┬──────────────────┐
        │                              │
  js/results*.js（画面）        js/sheet-model.js（新規・純データ）   js/results-team.js
    renderScorecard 等            sheetModel(g)                     tpShareModel(g)  ← #191 済
                                       └──────┬─────────────┘
                                                  │ {…sheetModel(g), tp: tpShareModel(g)}
                                           js/share.js（新規・canvas 描画）
```

### 6.2 `js/sheet-model.js` の契約【load-bearing】

```js
/* 結果表画像の表示モデル（純データ）。
   ★依存は js/calc.js + js/state.js の関数と state.players だけ。
   ★DOM を読まない・t() を呼ばない・tmColor() を呼ばない・esc() を通さない・localStorage を触らない。
   → 言語にもテーマにも依存しない＝vm で丸ごとスナップショット比較できる（§12）。 */
function sheetModel(g){ return {
  meta:{ name, date, course, n, prov },                       // prov = periaProv(g,parts)
  sc:{ par:[18], parOut, parIn, hidden:[18],
       groups:[{ team:'<生のチーム名 or "">',
                 rows:[{ name, holes:[18], out, inn, gross, hd, net }] }] },
  ind:[{ labelKey:'term.gross', rows:[{rank, name, team, val:'88'}] }],   // ★i18n キーで返す（訳語は描画側）
  flags:[{ kind:'np'|'dc', hole:3, set:''|'OUT'|'IN', name, team }],
  pay:{ pool, total, rows:[{rank, name, team, pt, yen}] }
}; }
```

- **ラベルは i18n キー（`labelKey`）で返し、訳語は描画側で `t()` する。** こうすると同じモデルから ja/zh/en の3枚が作れ、**モデルのスナップショットが言語に依存しない**（回帰が安定する）。
- **色は返さない。** 生のチーム名を返し、描画側が `tmColor(name)` を引く。
- **選手名・チーム名・コンペ名は生（esc なし）。** canvas に `esc` 済み文字列を描くと `&amp;` がそのまま見えるため（`tpShareModel` が `label`/`labelRaw` を分けているのと同じ理由・`2026-09-12-result-share.md` §3.8）。
- **開封・目隠し・伏せの揮発変数を読まない**（§3）。`revealHoles` / `show` / `nsMode` / `pzMode` は `sheetModel` の中に**現れてはならない**（§12 の grep 条件）。

### 6.3 既存関数の使い分け（新設は最小に）

| 画像のセクション | **使う既存関数（そのまま）** | 新設 |
|---|---|---|
| スコア表の各セル | `adjArr(g,pid)` / `sum()` / `effGross` / `periaHdcp` / `netScore` / `teamsOf` / `teamMembers` | なし（`sheetModel` が並べるだけ） |
| 暫定HDCP 判定 | **`periaProv(g,parts)`**（`js/calc.js:35`） | なし |
| 個人戦の順位 | **`ranked(pids, valFn, dir)`**（`js/calc.js:84`。`tieBreak` 込み＝画面と同じ順） | なし |
| 個人戦の値 | `effGross` / `netScore` / `stablefordPts` / `olympicPts` / `callawayNet` / `nassauTotalNet` | なし |
| 採用種目の判定 | **`chFormats(g)`**（`js/nav.js:50`・α/β 反映済み） | なし |
| ニアドラ旗 | `niapinHolesOf` / `draconHolesOf` / `prizeSetCount` / `prizeWinnerOf` / `prizeSetLabel` | なし |
| チーム総合 | **`tpShareModel(g)`（#191 でマージ済み・そのまま呼ぶ）** | なし |
| ポイント配分 | **`computePayout(g)`**（`js/calc.js:404`） | なし |

**→ 新しい計算は1つもない。`js/calc.js` は1バイトも触らない。**

### 6.4 数字がズレないことの担保

- 個人戦の並びは `ranked()`＝`rankCardNS` と**同じ関数**（表示側でソートし直さない）。
- チーム総合は `tpShareModel`＝総合タブと**同じモデル**（`js/results-team.js:105`）。
- 配分は `computePayout`＝配分タブと**同じ関数**。
- **唯一の意図的な差は §3（開封・目隠しを無視する）だけ**で、これはモデルに `g0`（生ゲーム）を渡すことで表現する。`sheetModel` の中に分岐は置かない。

---

## 7. 保存の3段構え

### 7.1 端末別に何が起きるか

| 端末 / ブラウザ | ①`navigator.share({files})` | ②`<a download>` | ③プレビュー長押し | 実際に起きること |
|---|---|---|---|---|
| **iPhone / iPad Safari** | **◎ 共有シート**（写真に保存・LINE・AirDrop） | △ Safari は download 属性を尊重するが保存先が分かりにくい | ◎ | ①が出る。押さずに閉じても画像は残る |
| Android Chrome | ◎ 共有シート | ○ | ◎ | ①が出る |
| PC Chrome / Edge | ✗（`navigator.canShare({files})` が false） | **◎ ダウンロード** | ◎ 右クリック保存 | ②でダウンロード |
| PC Safari（macOS） | ○（Ventura 以降 files 対応） | ◎ | ◎ | ①または② |
| PC Firefox | ✗ | ◎ | ◎ | ② |
| 古い端末 / 何も効かない | ✗ | ✗ | **◎** | ③で必ず持ち出せる |

**このサンドボックスで実測できた範囲**（Chromium headless・`navigator.share` は `undefined`）:
- ② `<a download>` は **Blob(objectURL) / dataURL のどちらでも成功**（1080×8104 の 2.2MB PNG で確認）。
- `toDataURL('image/png')` = **295ms**、`atob`＋`Uint8Array` 化 = **18ms**（全同期）。
- **`navigator.share` は Chromium に無いため実機確認できない。**`2026-09-12-result-share.md` §4.6 の結論（iOS は同期パス必須）を**踏襲する**。裏取りは実機 iPhone でのレビュー時に行う（§12 の手動確認）。

### 7.2 実装【load-bearing・iOS 同期制約】

```js
let sheetImg = null;   // {bytes:Uint8Array, url:string(objectURL), w, h, k}  ★揮発（localStorage に入れない）

/* ① 作成（async 可・§5） */
async function sheetImgMake(){ /* fonts 待ち → drawSheet() → */
  const dataUrl = cv.toDataURL('image/png');                 // 同期
  const bin = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
  if(sheetImg) URL.revokeObjectURL(sheetImg.url);            // 前回ぶんを解放
  sheetImg = {bytes, url:URL.createObjectURL(new Blob([bytes],{type:'image/png'})), w:cv.width, h:cv.height, k};
  cv.width=cv.height=0;                                       // canvas メモリを即解放（iOS 384MB 対策）
  renderResult(); toast(t('img.done'));
}

/* ② 共有・保存（★onclick から呼ばれてから return するまで await を1つも挟まない） */
function sheetImgSave(){ if(!sheetImg) return;
  const f = new File([sheetImg.bytes], sheetImgName(), {type:'image/png'});
  if(navigator.canShare && navigator.canShare({files:[f]})){
    navigator.share({files:[f], title:(curGame()||{}).name||'76-Club'}).catch(()=>{});   // 中断は無視
    return; }
  const a=document.createElement('a'); a.href=sheetImg.url; a.download=sheetImgName(); a.click();
}
```

- **`canvas.toBlob()` を使わない**（非同期＝iOS が transient activation を失い共有シートが黙って出ない）。
- **ダウンロードは dataURL ではなく objectURL を使う**（3〜6MB の dataURL 文字列を `<a href>` と `<img src>` に置くのを避ける。`js/backup.js` の `exportData()` と同じ流儀）。
- **③プレビューは常設**: 生成後、`<details>` 内に `<img src="{objectURL}" class="sheet-prev">` を必ず表示する。
- **揮発の破棄**: `setResGrp` / `setResGame` / ゲーム切替 / `tpAnnounce` / スコア保存 で `sheetImg=null`＋`revokeObjectURL`（**古い画像を配らせない**）。

### 7.3 ファイル名【★実測で方針を変更】

**実測（Chromium headless）**: `<a download>` に**非ASCII を含む名前を渡すと、ファイル名が丸ごと捨てられて `download`（拡張子なし）になる**。

| 渡した名前 | 実際のファイル名 |
|---|---|
| `76club-テストコンペ2-20260902.png` | **`download`** ← 拡張子まで消える |
| `76club-テスト_コンペ2-20260902.png` | **`download`** |
| `76club-ab cd-20260902.png` | `76club-ab cd-20260902.png`（空白は可） |

> この挙動は headless Chromium のものなので、実機 Chrome/Safari では通る可能性がある。しかし**失敗したときの損害（拡張子が消えて画像として開けない）が大きく、回避コストがゼロ**なので、**ASCII 安全形を採る**。

```js
function sheetImgName(){ const g=curGame()||{};
  const d=(g.date||new Date().toISOString().slice(0,10)).replace(/-/g,'');     // 20260902
  const s=(g.name||'').normalize('NFKC').replace(/[^\w]+/g,'-')               // ★\w は ASCII のみ
          .replace(/^-+|-+$/g,'').slice(0,24);
  return '76club-' + (s || 'result') + '-' + d + '.png';
}
```

- 日本語のコンペ名 → `76club-result-20260902.png`
- `2026 Autumn Cup` → `76club-2026-Autumn-Cup-20260902.png`
- **コンペ名は画像の一番上に大きく描かれている**（§2 セクション1）ので、ファイル名から落ちても identification は失われない。
- `navigator.share` に渡す `File` も**同じ名前**にする（OS 側は非ASCII でも平気だが、2経路で名前が違うと混乱する）。

---

## 8. UI の置き場所【投影原則 §11.14-3「幹事の操作UIは控えめ配置」】

**結果発表 ＞ グループタブ「ポイント（配分）」の最下部**に `<details>`（既定＝閉）を1つ足す。
`js/results.js` の `renderStanding(g, parts)` が返す最後（チーム別合計カード `teamCard` の後）に追加する。

```
結果発表 ＞ [個人戦] [チーム戦] [▣ポイント]
  ┌ カード: 配分表（順位・チーム・選手・pt・¥）        ← 既存・不変
  ├ カード: チーム別合計                               ← 既存・不変
  └ ▸ 結果表を画像で保存                               ← ★新規 details（既定=閉・summary は 1行）
       ┌ 注記（muted・常設）────────────────────────┐
       │ この画像には全選手の氏名・スコア・配分額が入ります。 │  img.note
       │ まだ発表していない結果も含まれます。               │
       │ ⚠ 未連携の種目が 2 件あります（？のまま出力されます） │  img.warnPending（該当時のみ）
       └──────────────────────────────────────┘
       [ 画像を作成 ]          ← btn gold sm        img.make
       ┌ プレビュー（生成後のみ）──────────────┐
       │  <img class="sheet-prev">  幅100%・角丸・枠線 │
       └──────────────────────────────┘
       1080 × 4,968 px ・ 長押し（右クリック）でも保存できます   img.hint
       [ 共有・保存 ]          ← btn sec sm（生成後のみ）  img.save
```

**なぜ「ポイント」タブか**:
1. 画像の中身は**コンペ全体**であって特定種目ではない。個人戦/チーム戦のどのゲームタブに置いても「なぜここに？」になる。
2. 「ポイント」は**表彰式の最後に開くタブ**＝幹事が配布を考えるタイミングとUIが一致する。
3. **投影中の画面（個人戦・チーム戦）にボタンが増えない**（§11.14-3）。
4. 配分額が画像に載る以上、**配分表と同じ場所**にあるのが説明として自然（プライバシー注記も1箇所で済む）。

**`<details>` の開閉は揮発**（`sheetImgOpen`・`tpEvPtsOpen` と同方式。`localStorage` に入れない）。

---

## 9. プライバシー（`2026-09-12-result-share.md` §6 を置き換え）

**画像に写るもの**: コンペ名・開催日・コース名・参加者数／**全選手の氏名**・18ホールのスコア・OUT/IN・グロス・HDCP・ネット／個人戦の順位と値／ニアドラ勝者名／チーム名・チームカラー・チーム総合順位・勝ち点・種目別実値／**全選手のポイントと配分額（¥）**。

**写らないもの（明示的に出さない）**:

| 項目 | 理由 |
|---|---|
| **生年月日** | タイブレーク（`tieBreak`）に使うだけで、結果表に必要な情報ではない。`sheetModel` は `player.birth` を**参照しない** |
| **性別** | 大学対抗の HDCP 上限（`uvHdcpA`）とエブリ区分に使うだけ。`player.gender` を**参照しない**（エブリは `adjArr` の結果として数値に溶けている） |
| 退会フラグ・選手マスタ全体 | 参加者（`g.participants`）だけを走査する |
| `golfCompe_v1` の全量 | モデルが返した値しか描かない |

**流出経路**: 画像は端末内で生成され、`navigator.share` は**OS の共有シートに渡すだけ**。サーバー送信・外部通信はゼロ（`js/share.js` に `fetch`／`http` を1つも書かない＝§12 の grep で機械検証）。

**運用上の注意（UI 注記で明示する）**: 配布先は参加者本人を想定している。転送されると氏名・スコア・金額が第三者に渡るため、`img.note` で必ず注意喚起する。

---

## 10. PM 確認事項（既定案で進めてよい）

| # | 論点 | **既定案** | 変えたい場合の影響 |
|---|---|---|---|
| **Q1** | 画像の**言語** | **生成時の表示言語で1枚**（`t()` をそのまま使う） | 3言語ぶん欲しい → 言語を切り替えて3回作る運用。モデルは言語非依存（§6.2）なので実装変更は不要 |
| **Q2** | **配分額（¥）を出すか** | **出す**（U2 で確定済み）。ただし `prizePool===0` のときは ¥ 列ごと出さない | — |
| **Q3** | `k<1`（80名超）のときの注記 | **出す**（`img.scaled`） | 出さないなら i18n キーが1つ減る |
| **Q4** | 1on1・大学対抗・任意対決の**明細**を入れるか | **入れない**（結論値は種目別勝ち点表にある・§2.1） | 入れる → +1セクション／PR-3 として後日 |
| **Q5** | 個人戦の順位表を**全員分**出すか | **全員分**（17行以上は2段組） | 上位10名までにすると 31名で約 1,200px 短くなるが、「参加者に配る」用途では自分の順位が載らないのは致命的 |
| **Q6** | 未連携の種目があるときの**生成ブロック** | **ブロックしない**（`？` のまま出力・警告行のみ） | ブロックすると途中経過を配れない |
| **Q7** | ファイル名にコンペ名（日本語）を入れるか | **入れない**（ASCII 安全形・§7.3。実測でファイル名が消えたため） | 入れる → 一部端末で `download`（拡張子なし）になるリスク |

---

## 11. モック【必要・PM が作る】

**必要**（新規ビジュアルのため。`/feature` 手順 1.5）。ただし**作り直す必要はない**: 本設計の実測でプロトタイプを実際に描画済みで、そのまま承認用に使える。

| ファイル | 中身 | 何を承認してもらうか |
|---|---|---|
| `…/scratchpad/sheet-p2all.png`（1080×3,784） | **12名・3チーム・チーム戦フル**（スコア表／グロス／ネット／ニアドラ／総合／ポイント） | セクションの**順序**・文字の大きさ・勝ちセルの色・全体の密度 |
| `…/scratchpad/sheet-p3.png`（1080×4,466） | **31名・4チーム・大学対抗**（2段組の順位表・チーム別スコア表） | **多人数のときの2段組**と、スコア表がチームごとに割れる見え方 |

（フルパス: `/tmp/claude-0/-home-user-76-Club/852799cf-e353-5a31-8eeb-8eaf639e6865/scratchpad/sheet-p2all.png` / `sheet-p3.png`）

**モックで特に見てほしい点**（PM がユーザーに聞く）:
1. **セクションの順序**（スコア表が2番目でよいか。順位表を先に見たい人もいる）
2. **スコア表の文字サイズ**（数字 19px / 1080幅＝スマホでピンチしないと読めない。列を削る／2段（OUT・IN）に折る選択肢もある）
3. **ニアドラのカード4列**
4. 余白と罫線の量（印刷して配る想定があるか）

> プロトタイプはあくまで**寸法の実証**であり実装の正ではない。実装は本設計 §12 の受け入れ条件に従うこと。

### 11.1 レイアウト仕様（論理px・幅 1080・実測値）

```
  ┌ 1080 × H ────────────────────────── 背景 = --bg（ライト固定） ─┐
40│                                                                      │40
  │  コンペ名                                          46px/800 --strong │  70
  │  2026-09-02 ・ 霞ヶ関CC ・ 選手 12                  24px/400 --sub   │  40
  │ ───────────────────────────────── --line │  18
  │                                                              GAP 24  │
  │  スコア表                                          30px/700 --strong │  62（見出し＋罫線）
  │  ┌選手 200│1..9 各27.6│OUT 56│10..18 各27.6│IN 56│G 64│HD 64│Net 64┐│  44（ヘッダ行・--card 地）
  │  │Par      4 4 3 …      36     4 4 3 …      36    -    -     -     ││  38
  │  │チームレッド                          21px/700 チームカラー      ││  38
  │  │井上 美穂  3 4 3 …    32     2 3 1 …     28    60   0    60      ││  38 × 人数
  │  └────────────────────────────────────┘│
  │  グロス                                            30px/700         │  62
  │   1 井上 美穂 (チームレッド)                            60          │  40 × 行（1位=--win-bg）
  │     ↑22px/700  ↑22px/600 --ink                    ↑24px/800 右寄せ  │
  │  （17行以上は CW/2 の2段組・左列に前半）                            │
  │  ニアドラ                                                           │  62
  │  ┌NP 3H ───┐┌NP 7H ───┐┌DC 4H ───┐┌DC 9H ───┐  4列 × 96px高  │
  │  │井上 美穂 ││木村 健一 ││清水 真由美││山崎 亮  │  区分19/700 名26/700│
  │  └─────┘└─────┘└─────┘└─────┘              │
  │  総合                                                               │  62
  │    1位          2位          3位            22px/600 --sub         │ 200
  │  チームブルー  チームレッド  チームグリーン  34px/700 チームカラー   │
  │    3.5           1.5           0            56px/800 チームカラー   │
  │  1位 +10pt/人  2位 +6pt/人  3位 +3pt/人      20px/400 --sub        │
  │  種目別勝ち点│ﾚｯﾄﾞ│ﾌﾞﾙｰ│ｸﾞﾘｰﾝ│ ラベル列260・値列(1000-260)/n  │  44
  │  ニアドラ     │3 +1.5│3 +1.5│  2  │ 26px/700・勝=--win-bg 角丸    │  56 × 種目数
  │  ネット対抗(未確定)│ ？ │ ？ │ ？ │ ★未連携は値を描かない          │
  │  ポイント                                                           │  62
  │   1 井上 美穂                          18pt      ¥4,909            │  40 × 行（2段組同上）
  │  暫定HD …（該当時）                              76-Club   18px    │  40
40│                                                                      │40
  └──────────────────────────────────────┘
```

**実測の裏づけ**（幅 1080・左右余白 40 → 内容幅 1000）:
- スコア表のホール列 = `(1000 − 200 − 64×3 − 56×2) / 18` = **27.6px**。`19px` の 2桁数字の実測幅 = **21px** → **収まる**（余白 6.6px）。
- 選手名列 200px に収まらない名前は `…` で省略（`measureText` で判定）。p1〜p6 の全選手名（5〜6文字）は**全て収まった**（溢れ 0 件）。

---

## 12. 受け入れ条件（機械検証できる形）

### 12.1 共通

```bash
node tools/verify.mjs                        # 全PASS（i18n パリティ・未定義参照・未使用キー0・CSS孤立var()）
node tools/regress.mjs                       # 無差分（--update 禁止＝§3 計算非接触の証明）
git diff --stat origin/main -- js/calc.js    # → 空（calc.js に1バイトも触れない）
grep -oh 'golfCompe_[A-Za-z0-9_]*' js/*.js | sort -u | wc -l   # → 5（localStorage キーは増えない）
grep -c '?v=<PR番号>' index.html             # → PR-1:19 / PR-2:20（styles.css＋全script）
```

### 12.2 PR-1（`js/sheet-model.js`）固有 — **画像の中身の機械検証はここで行う**

```bash
# ① 純データであることの構造チェック（§6.2 の契約）
grep -nE 'document\.|innerHTML|getElementById|\bt\(|esc\(|tmColor|localStorage' js/sheet-model.js   # → 0件
grep -nE 'revealHoles|show\.totals|nsMode|nsExcept|pzMode|pzExcept|viewGame' js/sheet-model.js       # → 0件（§3）
# ② スナップショット回帰（新設ハーネス）
node tools/regress-sheet.mjs                 # → 無差分
```

**`tools/regress-sheet.mjs`（新設）**: `tools/regress.mjs` と同じ方式で `js/state.js + js/nav.js + js/score.js + js/roulette.js + js/calc.js + js/sheet-model.js` を vm に読み、**`js/testdata.js` の p1〜p6 全パターン**について `JSON.stringify(sheetModel(g))` を `tools/regress-sheet-expected.json` と比較する。
→ **「画像の中身」＝モデルの値が、以後の改修で1文字も変わらないことを機械で固定できる。**（`sheetModel` が言語・テーマ・DOM に依存しないからこれが可能。§6.2 がそのための設計）
→ `tp`（チーム総合）は `tpShareModel`（i18n/DOM 依存）なのでこのハーネスの対象外。その値の回帰は**既存 `tools/regress.mjs` の `teamWinPoints` スナップショットが既に担保**している。

### 12.3 PR-2（`js/share.js`＋UI）固有

```bash
grep -nE 'https?://|fetch\(|XMLHttpRequest'  js/share.js   # → 0件（外部通信ゼロ）
grep -nE 'curGame|computePayout|teamWinPoints|ranked\(|effGross|netScore' js/share.js  # → 0件（計算しない・モデルだけ描く）
grep -nE 'getElementById|innerHTML|querySelector' js/share.js  # → 0件（DOM を読まない。プレビューの HTML は results.js 側）
grep -n 'toBlob' js/share.js                                # → 0件（iOS 同期制約・§7.2）
grep -n 'setTheme\|golfCompe_theme' js/share.js             # → 0件（テーマ設定を汚さない）
git diff origin/main -- styles.css | grep -E '^\+\s*--[a-z]' # → 空（新規 CSS トークンなし）
```

**描画関数は検査可能な値を返す**（設計の要求）:

```js
drawSheet(model, {probe:true})
  // → {W, H, k, sections:[{id:'sc', y:152, h:738}, …], overflow:[{kind:'scname', text, w}]}
```

- `{probe:true}` では canvas を作らず**レイアウト情報だけ**返す。これを使って以下を自動テストできる（Playwright 1回）:
  - `p3（31名）× 全14種目` で **`W*H <= 16,000,000` かつ `k === 1`**
  - `overflow.length === 0`（全選手名が列幅に収まる）
  - `sections` の **id の並びが §2 の順序と一致**

### 12.4 手動確認（機械にできないものだけ・CLAUDE.md「ブラウザ検証の選び方」に従う）

| # | 確認 | 理由（何が壊れうるか） |
|---|---|---|
| 1 | ダークテーマの画面で生成 → **画像が白地**で、生成後も `data-theme` と `localStorage.golfCompe_theme` が **dark のまま** | テーマ一時切替の副作用（**実測済み: 白地 (255,255,255)・ls は dark のまま**） |
| 2 | **オフライン**（DevTools Network=Offline / 機内モード）で生成 → プレビューが出て、日本語が**画面と同じフォント**で描かれる | 外部依存ゼロの証明（§5.3） |
| 3 | **日本語 / 中文 / English** で1枚ずつ生成 → 見出し・列名が追従し、**溢れない** | 文字長が一番効くのは区分ラベル（en が最長）。3言語とも回すのはここだけ |
| 4 | **実機 iPhone Safari** で「共有・保存」→ **共有シートが出る** | §7 の iOS 同期パス。**Chromium では検証不能**（`navigator.share` が無い） |
| 5 | 生成 → 連携トグル / ゲーム切替 → **プレビューが消える** | 古い画像を配らせない（§7.2） |
| 6 | レビュー用スクショ **1枚**（12名・ja・ライト・全景） | 人が見て方向が合っているかだけ |

---

## 13. PR 分割・並走

| | 内容 | 触るファイル | 規模 | サイズ | モック |
|---|---|---|---|---|---|
| **PR-1** | `js/sheet-model.js`（新規・純データ）＋`tools/regress-sheet.mjs`＋期待値 JSON＋`index.html`(script 追加・`?v=`) | `js/sheet-model.js`(新)・`tools/*`(新)・`index.html` | 約 90行＋ハーネス | **M** | 不要（画面に何も出ない） |
| **PR-2** | `js/share.js`（canvas 描画＋保存3段構え）＋ UI `<details>`（`js/results.js` の `renderStanding` 末尾）＋ i18n 8キー×3言語＋ `styles.css`（プレビュー枠1クラス）＋`index.html` | `js/share.js`(新)・`js/results.js`・`js/i18n.js`・`styles.css`・`index.html` | 約 320行 | **M** | **必須**（§11） |

- **PR-1 → PR-2 の順（直列）**。PR-2 は `sheetModel` に依存する。
- **`index.html` の読込順**: `roulette.js` の後・`backup.js` の前に `js/sheet-model.js` → `js/share.js` の順で挿入（実行時依存のみなので厳密ではないが、参照方向に沿える）。`verify.mjs` は `index.html` の並びから連結するので自動追従する。
- **新規ファイルが中心**なので、他PRとほぼ衝突しない。`js/results.js` に触るのは `renderStanding` 末尾の数行だけ。

### 13.1 i18n 追加キー（**ja / zh / en の3言語同時**・計 8キー）

| キー | ja | zh | en |
|---|---|---|---|
| `img.title` | 結果表を画像で保存 | 将成绩表保存为图片 | Save results as image |
| `img.make` | 画像を作成 | 生成图片 | Create image |
| `img.save` | 共有・保存 | 分享 / 保存 | Share / Save |
| `img.note` | この画像には全選手の氏名・スコア・配分額が入ります。まだ発表していない結果も含まれます。 | 图片中包含全部选手的姓名、成绩与分配金额，也包含尚未公布的结果。 | The image includes every player's name, score and payout, including results not yet announced. |
| `img.warnPending` | 未連携の種目が {n} 件あります（？のまま出力されます） | 有 {n} 个项目尚未关联（将以 ？ 输出） | {n} event(s) not yet linked (exported as ?) |
| `img.hint` | {w} × {h} px ・ 長押し（右クリック）でも保存できます | {w} × {h} px ・ 长按（右键）也可保存 | {w} × {h} px — long-press (right-click) to save |
| `img.done` | 画像を作成しました | 图片已生成 | Image created |
| `img.scaled` | 参加者が多いため画質を落としました | 因参加人数较多，已降低画质 | Reduced resolution due to the number of players |

**画像の中の文字列は全て既存キーを再利用する**（新規キーを画像専用に増やさない）:
`sc.title` / `col.player` / `col.hd` / `col.net` / `col.rank` / `col.points` / `col.payout` / `col.team` / `term.gross` / `term.net` / `term.stableford` / `term.olympic` / `term.callaway` / `pts.nassauTotal` / `term.niadora` / `result.sub.overall` / `result.sub.pts` / `team.matrixTitle` / `team.pending` / `team.rankTag` / `hd.prov` / `sc.noteProvHd` / `status.fixed`。
`Par` / `OUT` / `IN` / `G` / `NP` / `DC` / `H` / `pt` / `¥` は**言語非依存のリテラル**（既存の規律どおり＝i18n キーを作らない）。

---

## 14. 暫定HDCP（#200）との関係【決定】

画像は**常に18ホール分**で作る（§3）ので、`revealHoles` 由来の暫定は消える。残るのは「**18ホール入力していない選手が居る**」ケースだけ。

- **判定は `periaProv(g, parts)`**（`js/calc.js:35`・画面のネットタブと同じ関数。表示側で `partial` を書き直さない＝#157 型の二重管理を作らない）。
- **真のとき**: フッタ左に `t('hd.prov')` タグ＋`t('sc.noteProvHd')` を1行。**`n/18H` の数字は併記しない**（画像は常に18H基準なので「暫定HD 18/18H」が矛盾して読める。`2026-09-19-provisional-hdcp.md` §3.6 A案と同じ判断）。
- **偽のとき**: 注記なし（＝確定した結果表）。
- 個々の HD 値には印を付けない（列が狭い・`periaProv` は「誰かが暫定」しか判定しない）。

---

## 15. 触らない範囲（load-bearing）

- **`js/calc.js` は1バイトも変更しない。** 本機能は既存関数を**呼ぶだけ**（§6.3）。新しい計算を一切作らない。
- **`tpShareModel(g)` の返り値・`？` マスクの規律を変えない**（未連携＝値・勝ち点・勝者をモデルに載せない）。画像でもこれに従う（§3）。
- **`renderTeamOverall` / `renderStanding` / `renderScorecard` の既存出力を変えない**（PR-2 が足すのは `renderStanding` 末尾の `<details>` 1つだけ）。
- **localStorage キーは 5つのまま**。生成画像・プレビュー・`<details>` の開閉は**全て揮発**。
- **i18n は ja/zh/en 同時追加・キー集合完全一致・未使用キー 0。**
- **inline `onclick` 方式／非 ESM**（`js/sheet-model.js` / `js/share.js` も通常 `<script src>`・グローバル関数）。
- **新規 CSS トークン（カスタムプロパティ）を足さない。** 追加するのはプレビュー用クラス `.sheet-prev` 1つ（既存トークンの参照のみ）。
- **外部ネットワークに依存しない**（CDN・API・追加フォント取得を入れない）。

---

## 16. 正本への追補（**貼り付け用テキスト。本設計では正本を編集しない**）

§3（計算）・§4（データモデル）に触れないため、**正本 `2026-07-12-golf-compe-web.md` への追記は不要**。
ただし §11.14（投影原則）に1文だけ足すのが望ましい場合は、以下をそのまま貼れる。**PM が判断して貼る**。

> **§11.14-5 追補（2026-09-23・結果表画像）**: 配布用に生成する画像（`js/share.js`）は、**投影用の揮発状態（`revealHoles` / `show.totals` / `nsMode` / `pzMode`）を一切参照せず常に全内容を描く**。演出の途中状態を保存物に持ち込まない。ただし `g.announced`（連携）は**データ**なので画像も従い、未連携の種目は `？` のまま出力する。画像は**常にライト固定**（テーマ設定を書き換えない）。
