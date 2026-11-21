# 共通隠し12Hルーレット（2026-11-21・確定）

M/L・§3/§4追補。ユーザー確定：12枠同時回転、STOPごと1穴確定・保存・暫定計算、コース設定と通常DP/大学対抗で同じ `g.hidden` を使う。
大学対抗ヒーローの下・スコア表の直前に開閉sectionを追加。既存HJカードの操作・テーマを流用し、ナビ再編なし。
マスタはParのコピー元のまま。本機能の抽選結果・進行をマスタへ書かない。

## 1. データ/APIと互換性

```js
g.hidden12Draw = {
  version: 1,
  order: [],                    // STOP済みの0始まりholeIndex、最大12・重複なし
  sourcePar: g.par.slice(),
  sourceCourseRef: copy(g.courseRef || null)
};
hidden12Status(g); // {active, valid, count, complete, provisional}
hidden12CanPublish(g); // !status.active || status.complete
```

- metadataは本ルーレットの開始／リセット時だけ作成する。`newGame`／`migrate`で旧ゲームに補完しない。
- `active` はmetadata存在。`valid` はversion/shape・order/hidden集合一致・抽選条件・source一致を検証した値。
- `count` は現在のhidden true数。`complete` はvalidかつ12穴。`provisional` はactiveかつ未complete。
- source比較はPar18配列とcourseRefのID3項。マスタの名前変更だけで失効させない。参照を共有しない。
- 回転候補・timer・実行世代・section開閉は揮発状態。保存するのはSTOP済みorderと実際の `g.hidden`。
- 既存0〜18穴の手動hiddenはmetadataなし＝従来式・従来成立条件のまま。過去の結果を変更しない。
- export/import・複製でmetadataを保持。途中再読込は保存済み穴から再開、完成済みなら結果を表示する。
- malformed metadata／order不一致は再開・連携不可と明示し、自動修復や無言の新抽選を行わない。

## 2. 抽選と操作

- 既存 `pickHidden12` の分布と条件を保持：前後半各6、各半P3×1/P4×4/P5×1。
- P5帯はPar>=5。不足時は同半分の残P4→P5→P3→未設定の順に補充する既存fallbackも維持。
- 枠はOUT6・IN6。各帯の採用枠数を既存規則から定め、残枠は対応帯の未確定候補を一様に重複なく回す。
- 毎フレームの12候補全体も条件を満たす。STOPは表示中の左端未確定候補を確定し、残りを回し続ける。
- 枠世代・確定数でSTOP連打／古いボタンを拒否する。12回目で停止。残1〜11枠から再開できる。
- STARTが既存hiddenを置換する場合は同カード内で「既存の隠し穴を消して開始」を明示する。
- 開始／やり直しは実hiddenをゼロ化し、orderも空にする。旧結果を残したまま抽選する方式ではない。
- 新しいhiddenは毎STOP直後に保存し、大学結果と共通NET値を再描画する。回転候補は計算へ入れない。
- ラベルは `OUT 中1`／`IN 東1` 等、前後半・ナイン名・ナイン内番号。未リンク時はOUT/INと通算番号を表示。

## 3. 暫定HDCP（load-bearing・新metadata運用だけ）

- 新抽選の選択数0〜11を、既存「隠し12穴の入力不足」と同じ外挿で扱う。旧手動部分hiddenは対象外。
- `H`=確定済みかつ入力/開封済みの隠し穴スコア合計、`k`=その穴数、`n`=入力/開封済み全穴数。
- 一般DPのHは既存 `adjHole` と任意Wパーカット。大学Hは `uvHole` と必須Wパーカットを使用。
- `k>0` なら **`hEst = H * 12 / k`**。そこから既存 `(hEst*1.5 - parTotal(g))*coef` を計算する。
- 一般DPの係数・負HDCP設定・上限、大学の0.8固定・capMode・every独立設定はそのまま。
- 上下限処理→消化率 `n/18` →既存小数1桁丸めの順を維持。途中選択は18H入力済みでも暫定表示。
- `k===0` はHDCP0としてNET=実効グロスを表示し「抽選前／暫定」を明示。負HDCP許可でも大きな負値を生成しない。
- **12穴完成時は既存関数の従来経路へ戻す**。入力不足時の既存按分も含め、同じhiddenの旧ゲームと全値一致。
- Parは従来の全18H `parTotal(g)` を使う。途中の選択Par合計へ差し替えたり、別のPar比率補正を導入しない。
- 理由：既存の暫定HDCP（2026-09-19）と同一推定方式を使い、完成時の大学規定・DPオプションを保つため。
- 例：Par72・係数0.8・上限なし・n18で、k2/H10→推定60→HDCP14.4。次に4打を確定するとk3/H14→推定56→HDCP9.6。
- 暫定値は引いたPar帯によって大きく動き得る。勝者の確定を意味しない。非標準Parでも既存1.5式は変えない。
- `periaParts/periaHdcp/periaProv` と `uvHdcpA` で共有し、個人NET・チームNET・Nassau・次回幹事・配分へ同じ推定を伝える。
- 隠し穴開示演出の `revealPeria` も途中抽選時に別のK推定へ戻さず同じ12穴目標を使う。完成後の既存開示挙動は不変。
- 原スコアとviewGameの開封マスクは維持し、未開封スコアを計算へ持ち込まない。

## 4. 連携・帳票・変更の同期

- hidden実値変更時は `announced.univMatch` と `announced.teamNet` を解除する。他種目の連携を一括解除しない。
- 新metadataが未completeなら大学／teamNETの連携ボタンは無効。保存済みtrueがあっても総合算入不可。
- 個人NET/Nassauの点・配分・次回幹事は従来のライブ計算を続け、画面に共通の「隠し穴抽選中・暫定」を表示する。
- 新抽選中／invalid時は正式な結果画像全体の作成・共有を不可にする。HJ等を含む画像全体が対象である理由として「隠し12穴抽選中のため正式画像は12穴確定後」を画面・書出操作に明示する。JSONバックアップは常に可能。
- 表モデルには暫定状態を伝え、画像生成入口だけでなく実描画／共有経路でも完了ゲートを確認する。
- metadataなしの旧大会・既存手動運用には新ゲートを適用しない。完成後は通常の連携操作・帳票条件へ復帰。
- コース設定の手動toggle／通常random12／clearは新抽選を終了（metadata削除）し、既存の手動運用へ戻す。
- 上記操作で実hiddenが変わると関連2種目の連携を解除。既存手動穴数や抽選分布を新たに制限しない。
- コース読込／Par変更は既存どおりhiddenを保持するが、metadataとのsource不一致で回転停止・継続禁止とする。
- この場合も途中抽選の数値は現在のParによる暫定値。正式連携・帳票は禁止し「コース変更のため再抽選」を示す。
- コースマスタだけの編集／削除はコピー済みゲームのParを変えず、既存copy semanticsを守る。
- 署名監視はmetadata/hidden/Par/courseRefを対象にし、ゲーム変更・import・外部入力で古いコールバックを書込ませない。
- details閉・画面/種目/ゲーム切替・visibility hiddenではtimer停止、STOP済み穴は保持。再開は明示START。

## 5. 実装境界と検証

- 純粋 `hidden12Status/hidden12CanPublish` と暫定式は `calc.js`、UI・抽選・同期は `course.js` に置く。新script不要。
- `course.js` の公開APIは `renderHidden12Roulette(g0)`／`hidden12StopSpin()`／`hidden12BeforeSave(state)`。保存前フック・画面遷移から呼ぶ。
- `results-team`配置/連携、`share/sheet-model`ゲート、3言語を更新する。calcのVMテストはUI engineをロードせず動かせる構成を維持する。
- HJのhidden4・抽選状態は参照しない。gross/best2/HBH/m1/roulette/niadora/customの式も変えない。
- `verify`／`regress`全実行。旧metadataなしの全期待値、完成metadata付きとの同値、旧部分hidden不変を確認。
- 0/1/11/12穴×入力欠損×開封マスク、every/係数/上限/負許可/Wパーカット、大学cap2種で式と成立を検算。
- 通常・変則Parで各半6/重複なし/既存配分を確認。手動部分状態を自動でルーレット途中扱いしないことを検証。
- 保存再読込・残枠再開・reset実hiddenゼロ・共有コース表同期・関連2連携取消・未完成の帳票禁止を確認。
- STOP連打・details閉・別ゲーム・非表示・import・Par/ナイン変更で古いSTOPが保存されないことを確認。
- ブラウザは指定位置の折りたたみ、OUT中/IN東ラベル、12STOPで逐次暫定→完成、再読込再開を最小実測。
