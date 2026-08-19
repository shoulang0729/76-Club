# Claude Code サブエージェント（設計／実装／レビューの分離）

76-Club の開発を **Claude Code だけ**で「設計と実装を分けて」回すための一式。役割ごとにコンテキストを分離する（＝これまでの「設計=MulmoClaude／実装=別Claude Code」を1ツールに寄せた形）。

## 中身
| ファイル | 役割 | ツール権限 |
|---|---|---|
| `architect.md` | 設計。docs/handoff 更新＋Issue起票。**アプリのコードは書かない** | Read/Grep/Glob/Bash/Web/Write/Edit（docsのみ書く運用） |
| `implementer.md` | 実装。1タスク=1ブランチ=1PR。**設計書は変えない** | Read/Grep/Glob/Bash/Write/Edit |
| `reviewer.md` | 検証＋マージ。`node tools/verify.mjs`＋差分精査→承認→squash→公開確認 | Read/Grep/Glob/Bash/WebFetch（コード編集なし） |
| `feature.md` | `/feature "<お題>"` で 設計→実装→レビュー を一括 | （スラッシュコマンド） |

## インストール
```bash
bash docs/claude-agents/install.sh   # → .claude/agents/ と .claude/commands/ に配置
```
（`.claude/` は各自のマシンで生成する前提。リポにコミットしてチーム共有してもよい。）

## 使い方
- 一括: Claude Code で `/feature "ルーレットの勝敗色を色覚配慮に見直す"`
- 個別: 「architect で〜を設計して」「reviewer で PR #NN を見て」等、サブエージェント指名で呼ぶ。

## ガバナンス（要点は CLAUDE.md が正本）
- **一方通行**: architect→(Issue)→implementer→(PR)→reviewer→(merge)。設計は実装せず、実装は設計書を変えない。
- **load-bearing**: §3 計算式／localStorageキー／i18n ja=zh=en 一致／ESM化しない／機能色の意味。逸脱は reviewer が止める。
- **検証は必須**: `node tools/verify.mjs`（構文・i18nパリティ・未定義参照・CSS孤立var()・計算回帰）。

## 任意: 権限で一方通行を"強制"したい場合
`.claude/settings.json` の permissions/hook で、architect セッションからの `index.html`/`js/**`/`styles.css` 編集を deny、implementer からの `docs/handoff/**` 編集を deny 等を足せる（サブエージェントの `tools:` だけでは Bash 経由の書込みは塞げないため、ハード強制はフック推奨）。まずは本運用（システムプロンプトの規律＋reviewer の関門）で十分機能する。
