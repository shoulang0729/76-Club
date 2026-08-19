76-Club の 設計→実装→レビュー パイプラインを次のお題で回す: $ARGUMENTS

手順（各ステップは対応するサブエージェントに委譲する）:
1. **architect** サブエージェントで設計する。docs/handoff/ を更新し GitHub Issue を起票。Issue番号と設計正本の節を報告させる。仕様に流派/曖昧があり既定で決め切れない場合はここで停止してユーザーに確認する。
2. **implementer** サブエージェントで、その Issue を feature ブランチで実装する。`node tools/verify.mjs` を PASS させ、PR を出す。
3. **reviewer** サブエージェントで PR を検証する（`node tools/verify.mjs` ＋ 差分精査）。全 PASS かつ load-bearing 逸脱なしなら承認コメント→ squash マージ→ 公開反映確認。FAIL や逸脱があれば implementer に差し戻す。

停止条件: architect が product decision を要する / reviewer が load-bearing 違反を検出 / verify.mjs が FAIL。いずれもユーザーに要点を報告して指示を仰ぐ。
