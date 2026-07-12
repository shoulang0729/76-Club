# 設計書：76-Club ゴルフコンペ集計＆運営Webアプリ

- 作成: 2026-07-12（Mulmo 設計）
- 対象リポジトリ: `shoulang0729/76-Club`
- 公開: GitHub Pages（`https://shoulang0729.github.io/76-Club/`）
- 実装担当: VS Code（Claude Code）
- 視覚/機能リファレンス: [`assets/2026-07-12-phase1-reference.html`](assets/2026-07-12-phase1-reference.html)（＝リポジトリ直下 `index.html` と同一の Phase 1 実働プロトタイプ）

---

## 1. 背景 / ゴール

ゴルフコンペの集計・運営をスマホから行う。既存OSSに日本式コンペ（ダブルペリア・ニアピン/ドラコン・チーム対抗・女性エブリハンデ）を満たすものが無かったため新規開発する。段階導入：

- **Phase 1（公開済）**: 幹事1台完結。端末内 `localStorage` にデータを保存し、全機能を提供。JSONで書き出し/読み込み。
  → **この設計書の「§3 計算仕様」「§4 データモデル」は Phase 1 で実装済みの正本**。Phase 2 でもロジックを変えずに再利用する。
- **Phase 2（本タスク）**: Firebase を追加し、**参加者全員が各自のスマホからスコア/名前を入力**、幹事の画面と全員の画面がリアルタイム同期。QRコード/リンクで「部屋（コンペ）」に入室。

Phase 1 は既に動くので、Phase 2 の実装は「①Phase 1 を素直な複数ファイル構成へリファクタ」→「②Firebase 同期レイヤーを被せる」の2段。

---

## 2. 現状 Phase 1 の構成（リファクタ対象）

現状は `index.html` 単一ファイル（HTML+CSS+JS 全部入り、`localStorage` キー `golfCompe_v1`）。**まず素直な構成に分割**する（機能・見た目・計算結果を1ミリも変えないこと）：

```
index.html          # マークアップ + <link>/<script src> のみ
assets/style.css    # 現 <style> をそのまま移設
src/state.js        # state のロード/保存/uid/toast、データモデル定義（newGame 等）
src/calc.js         # §3 の計算関数群（純粋関数・副作用なし）
src/players.js      # 選手タブ
src/game.js         # ゲーム設定タブ
src/score.js        # スコア入力タブ
src/result.js       # 結果タブ
src/app.js          # タブ切替 / render() エントリ
```

- モジュールは ES Modules（`<script type="module">`）でよい。バンドラは不要（GitHub Pages 直配信）。
- **リファクタPRでは挙動を変えない**こと。計算結果・画面・localStorage スキーマは完全一致を保つ（リグレッションは Phase 1 プロトタイプとの目視/数値比較で確認）。

---

## 3. 計算仕様（★正本・ロジックを変えないこと）

すべて `src/calc.js` の純粋関数として持つ。`par[i]`（0..17）、`scores[pid][i]`（打数 or null）、`hidden[i]`（真偽・隠しホール）を入力にとる。

### 3.1 ダブルペリア（新ペリア）ネットHDCP
```
規定打数 parTotal = Σ par[i]                        （通常72）
隠し合計 H       = Σ (i が隠しホールのときの scores[pid][i])
HDCP           = (H × 1.5 − parTotal) × periaCoef
HDCP < 0 なら 0、HDCP > periaCap（設定時）なら periaCap でクリップ
HDCP は小数第1位に丸め
```
- `periaCoef`（既定 0.8）、`periaCap`（既定なし=null）は**ゲームごとに設定**。隠しホールは12ホール選ぶ（ランダム選択ボタンあり）。

### 3.2 女性エブリハンデ
- ゲーム設定で「適用ON/OFF」＋「エブリワン(−18) / エブリツー(−36)」を切替。
- 対象は `gender === 'F'` の選手のみ。
```
womenEvery(pid) = (適用ON かつ 女性) ? (type===1 ? 18 : 36) : 0
```

### 3.3 グロス個人戦 / ネット個人戦
```
gross(pid)    = Σ scores[pid][i]
effGross(pid) = gross(pid) − womenEvery(pid)      # ← グロス個人戦のランキングに使う（女性エブリ反映）
net(pid)      = effGross(pid) − periaHdcp(pid)     # ← ネット個人戦。女性エブリはネットにも波及
```
- グロス個人戦・ネット個人戦とも**小さいほど上位**。同スコアは同順位。

### 3.4 追加ゲーム（各ゲームの ON/OFF はゲーム設定）
- **ステーブルフォード**（グロス基準・高いほど良い）: 各ホール `d = 打数 − par`。`d≤−3:5, −2:4, −1:3, 0:2, 1:1, それ以上:0` を合計。
- **オリンピック（陣取り・高いほど良い）**: 各ホール `d≤−3:10, −2:6, −1:4, 0:1, それ以上:0` を合計。
- **キャロウェイ方式**（18H入力完了者のみ・ネット＝小さいほど良い）: グロスから控除ホール数テーブルで最悪ホール（**17・18番を除く**1〜16番から）を控除＋補正。実装はプロトタイプ `callawayHdcp()` を踏襲。
- **握り/ナッソー**（前半OUT/後半IN/トータルのネット・各9H）: 各9Hのネット = 9H素点 − periaHdcp/2 − womenEvery/2。3セクションそれぞれ小さいほど良い。
- **ベスト2ボール**（チーム内ネット上位2名の合計・小さいほど良い）。

### 3.5 チーム対抗
- **グロス対抗** = Σ effGross（メンバー）。小さいほど良い。
- **ネット対抗** = Σ net（メンバー）。小さいほど良い。
- **ホールバイホール**: 各ホールでチーム合計打数（そのホールを入力済みのメンバーの和）が**最少のチームがそのホールを取る**。同点は山分け（`1/同点チーム数`）。取ったホール数の合計で勝敗。

### 3.6 ニアピン / ドラコン（個人賞）
- ゲーム設定で対象ホールを指定（青=ニアピン / 赤=ドラコン、トグルで none→NP→DC→none）。
- 結果タブで各対象ホールの勝者を選択して記録。
- ローカルルール注記：**女性はニアピン/ドラコンとも2打目を計測対象にできる**（計算ではなく運用注記として画面表示）。この判定に選手の性別（男/女）を使うため、選手マスターに性別が必須。

---

## 4. データモデル（Phase 1・localStorage `golfCompe_v1`）

```jsonc
{
  "players": [ { "id": "xxx", "name": "山田", "gender": "M" } ],   // gender: "M" | "F"
  "games": [ {
    "id": "g1", "name": "第1回コンペ", "date": "2026-07-12", "course": "○○CC",
    "par":    [4,4,3,...],            // length 18
    "hidden": [false,true,...],       // length 18（12個 true）
    "periaCoef": 0.8, "periaCap": null,
    "womenEvery": { "enabled": false, "type": 2 },   // type: 1|2
    "teams": [ { "id":"t1", "name":"チームレッド", "memberIds":["xxx"] } ],
    "participants": ["xxx"],
    "scores": { "xxx": [4,5,null,...] },   // length 18, null=未入力
    "prizes": {
      "niapinHoles":[2], "draconHoles":[4],
      "niapinWinner": { "2":"xxx" }, "draconWinner": { "4":"yyy" }
    },
    "formats": { "gross":true,"net":true,"teamGross":true,"teamNet":true,
      "holeByHole":true,"stableford":true,"nassau":true,"olympic":true,
      "callaway":false,"best2ball":false }
  } ],
  "currentGameId": "g1"
}
```

---

## 5. Phase 2：全員同時入力（Firebase・本タスクの主眼）

### 5.1 目標
1. 幹事が「部屋（コンペ）」を作成 → **QRコード/共有リンク**が出る。
2. 参加者は QR/リンクを開き、**名前を入力してすぐ参加**（アカウント登録なし）。
3. 各自が自分（や同組）のスコアを入力 → **全員の画面がリアルタイムに同期**。
4. オフラインでも入力でき、復帰時に自動同期（Firestore のオフライン永続化）。

### 5.2 技術選定
- **Firebase Firestore**（リアルタイム同期・無料 Spark プランで十分）＋ **Firebase Anonymous Auth**（匿名サインインで書き込み主体を識別）。
- 静的フロントは GitHub Pages のまま。Firebase SDK は CDN（`https://www.gstatic.com/firebasejs/…`）から読む（バンドラ不要）。
- Firebase 設定値（apiKey 等）はフロントに埋め込む公開情報で問題なし。**書き込み制御は Firestore セキュリティルールで行う**（§5.5）。
  - ⚠ Firebaseプロジェクト作成（無料）＋ウェブアプリ登録＝**ユーザー（shoulang0729 の Google アカウント）が Firebase コンソールで一度だけ行う作業**。実装者は config の受け口だけ用意し、値は環境に応じ差し込む（`src/firebase-config.js` に公開config、または `?` なしで直書き）。

### 5.3 Firestore データモデル
Phase 1 の `game` オブジェクトを「部屋 = room」に対応させる。ルームコード（6桁英数字・大文字）をドキュメントIDに。

```
rooms/{roomCode}                      // 1コンペ=1ルーム
  meta: { name, date, course, hostUid, createdAt, locked:false }
  config: { par[18], hidden[18], periaCoef, periaCap, womenEvery, formats }
  players/{playerId}: { name, gender, claimedByUid|null }   // 参加者（=選手）
  teams/{teamId}:     { name, memberIds[] }
  scores/{playerId}:  { holes:[18], updatedBy, updatedAt }  // スコアはプレイヤー単位ドキュメント
  prizes/meta:        { niapinHoles[], draconHoles[], niapinWinner{}, draconWinner{} }
```
- **購読単位**: フロントは `rooms/{code}/players`, `/teams`, `/scores`, `config`, `prizes` を `onSnapshot` で購読 → 変更が来たら §3 の計算を再実行して結果を再描画。
- 計算（§3）は**クライアント側**でそのまま実施（サーバー不要）。Firestore は素点と設定の共有だけを担う。

### 5.4 入室フロー（QR / リンク）
- ルーム作成時に共有URL `https://shoulang0729.github.io/76-Club/?room=ABC123` を生成し、**QRコード表示**（QR生成は軽量ライブラリ CDN、例：`qrcode` / `qrcodejs`）。
- URLを開くと匿名サインイン → `?room=` を読んでルーム購読 → **名前入力モーダル**。既存の未claim playerを選ぶ or 新規追加 → その player を自分（uid）に紐付け（`claimedByUid`）。
- ロビー画面：参加者一覧・自分の担当プレイヤー・「スコア入力」導線。

### 5.5 セキュリティルール（Firestore Rules・要点）
- 誰でも匿名サインイン可。**ルームコードを知っている人だけ**そのルームを読み書きできる（コードが実質の合言葉）。
- 書き込みは匿名認証済み（`request.auth != null`）に限定。
- `meta.hostUid` のみ `meta.locked`（締切）・`config`・`prizes` を変更可。締切後（`locked==true`）は一般ユーザーの `scores` 書き込み禁止。
- スコア改ざん抑止：一般ユーザーは**自分が claim した player の `scores` のみ**書き込み可（`resource`/`request` で playerId と claim を突合）。幹事は全 player 可。
- 具体ルールは実装時に `firestore.rules` として起こし、handoff にレビュー観点を追記（本タスクのPRに含める）。

### 5.6 Phase 1 との両立
- **URLに `?room=` が無ければ Phase 1（ローカル単独）モードで従来どおり動く**こと。Firebase 初期化はルームモード時のみ。
- 幹事は「この端末のローカルゲームを部屋として公開」ボタンで Phase 1 の game を room に書き出せると理想（任意・時間があれば）。

### 5.7 くじ引き（将来拡張・今回スコープ外）
今回ユーザーは選択なし。将来 `rooms/{code}/draws` に「組み合わせ抽選 / チーム分け / スタート順」を置き、参加者リストをシャッフルして結果を全員に共有する設計余地を残す。実装は別タスク。

---

## 6. 対象ファイル

**リファクタPR（Phase 2-a）**
- 変更: `index.html`（`<link>`/`<script src>` 化）
- 新規: `assets/style.css`, `src/{state,calc,players,game,score,result,app}.js`

**Firebase同期PR（Phase 2-b）**
- 新規: `src/firebase-config.js`, `src/room.js`（サインイン/購読/書込）, `src/qr.js`（QR表示）, `firestore.rules`
- 変更: `src/app.js`（`?room=` 判定でローカル/ルーム分岐）, `src/score.js`・`src/game.js`（書込先を state→room に切替可能に）, `index.html`（Firebase/QR SDK の CDN 追加、入室モーダル）

---

## 7. 受け入れ条件（チェックリスト）

**Phase 2-a（リファクタ）**
- [ ] `index.html` を分割後も、Phase 1 プロトタイプと**画面・計算結果・localStorageスキーマが完全一致**（隠しホール12選択→ペリアHDCP→ネット順位、女性エブリON/OFF、チーム対抗、各ゲームで数値が一致）。
- [ ] GitHub Pages で `https://shoulang0729.github.io/76-Club/` が正常表示。コンソールエラー0。
- [ ] モバイル（iOS Safari / Android Chrome）で横スクロールのスコアグリッドが操作可能。

**Phase 2-b（Firebase）**
- [ ] `?room=CODE` 無し＝従来のローカル単独モードが**無改変で動作**。
- [ ] 幹事が部屋作成→QR/リンク発行。別端末でリンクを開き名前を入れて参加できる。
- [ ] 2台以上でスコアを入れると**双方の画面が数秒以内に同期**し、結果集計（§3）が全端末で一致。
- [ ] 締切（locked）後は一般ユーザーがスコアを書けない。
- [ ] Firestore ルールで、ルームコードを知らない/未認証のアクセスを拒否。
- [ ] オフラインで入力→復帰で同期（Firestore 永続化有効）。

---

## 8. 触ってはいけない範囲（load-bearing）

- **§3 の計算式**（ダブルペリア係数・上限クリップ、女性エブリの符号と波及、ステーブルフォード/オリンピックの配点、キャロウェイの17・18番除外、ホールバイホールの山分け）は**仕様の正本**。改善提案がある場合は Mulmo に戻して設計を更新してから変更（実装で勝手に変えない）。
- **localStorage キー `golfCompe_v1` とデータモデルのフィールド名**（`par/hidden/periaCoef/periaCap/womenEvery/participants/scores/prizes/formats` 等）は互換維持。名称変更は既存データを壊す。
- **`gender` の値は `"M"|"F"`**（女性判定・エブリハンデ・2打目注記の分岐に使う load-bearing）。
- Firebase の apiKey 等はフロント公開前提で問題ないが、**書き込み権限は必ず Firestore ルールで縛る**（クライアント信頼で済ませない）。

---

## 9. 運用（ブランチ / PR / Issue）

- 1タスク=1ブランチ=1PR。ベースは `main`。
- 推奨分割：
  - Issue A / `refactor/split-phase1` … §6 リファクタPR（Phase 2-a）
  - Issue B / `feat/firebase-rooms` … §6 Firebase同期PR（Phase 2-b）。**Firebaseプロジェクト作成はユーザー作業**（前提）。
- GitHub Pages は既に `main` / ルート（`/`）配信で有効化済み。`index.html` はルート維持。
- 設計変更が必要になったら口頭パッチせず Mulmo に戻し、本 handoff を更新して新版を渡す。

---

## 付録：Firebaseプロジェクト作成手順（ユーザー向け・一度だけ）
1. https://console.firebase.google.com で新規プロジェクト作成（無料 Spark）。
2. Build → Firestore Database を作成（本番モード）。
3. Authentication → Sign-in method → **Anonymous** を有効化。
4. プロジェクト設定 → マイアプリ → ウェブアプリ追加 → `firebaseConfig`（apiKey 等）をコピー → 実装者に渡す（`src/firebase-config.js` に設定）。
5. Firestore Rules は実装PRの `firestore.rules` を貼り付けて公開。
