# template-setup スキル

`scaffold-template.sh` が配置した骨格ファイル（`{{...}}` プレースホルダ入り）を、このプロジェクトのレイヤー構成・テストランナーに合わせて埋める。**一度きりの手順書**であり、完了後にこのファイル自身を削除する。

## 前提

- `scripts/scaffold.sh`（core）と `scripts/scaffold-template.sh`（骨格）の両方が実行済みであること
- core 側の `documentation-guide` / `commit-guide` / `merge-gate` / `doc-push-agent` / hooks が `.claude/` に存在すること

未実行なら先に scaffold を促して止まる。

---

## Step 1: プロジェクトを調査する

**ユーザーに聞く前にコードベースを読む。** 以下は調査で判断できる。

| 調べること | 調べ方 |
|---|---|
| レイヤー構成 | `src/` 直下のディレクトリ構成、`package.json` の workspaces、ビルド設定（複数ランタイムに分かれているか） |
| テストランナーと実行コマンド | `package.json` の `scripts` / `devDependencies`、`vitest.config.*`・`jest.config.*` 等 |
| テストファイルの命名規則 | 既存テストファイルの実物（無ければランナーの既定） |
| テストファイルの配置規約 | 既存テストの置き場所（テスト対象と同居か、専用のテストルート配下か）。無ければランナー・言語の慣習 |
| パッケージマネージャ | lockfile（`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock`） |
| 型チェックコマンド | `package.json` の `scripts`、`tsconfig.json` の有無 |
| 既存の rules | `.claude/docs/rules/` の中身 |

## Step 2: 判断できない点だけユーザーに確認する

**レイヤー分割は業務判断なので勝手に決めない。** 調査結果を提示したうえで `AskUserQuestion` で確認する。

聞くべき典型:

- **レイヤーの切り方**: 調査で見えた構成（例: `src/client/` と `src/server/`）を impl-agent の単位にしてよいか。1レイヤーで足りるか、分けるか
- **各レイヤーの技術スタック**: フレームワーク・状態管理・UI ライブラリ・DB クライアントなど、agent に持たせる前提知識
- **MCP ツール**: 各 impl-agent に渡す MCP ツール（DB・クラウドの MCP サーバーを使っているか）

調査で確定した項目（テストランナー・パッケージマネージャ等）は**聞かない**。確認のため提示するだけにとどめる。

## Step 3: agent 定義を複製して埋める

レイヤーごとに複製し、プレースホルダを埋める。

```
.claude/agents/impl-agent.md      → <レイヤー名>-impl-agent.md  （レイヤー数だけ複製）
.claude/agents/review-agent.md    → <レイヤー名>-review-agent.md（レイヤー数だけ複製）
.claude/agents/typecheck-agent.md → <型チェッカー名>-agent.md    （リネーム。1つだけ）
```

- 複製後、**骨格ファイル（`impl-agent.md` / `review-agent.md`）は削除する**。残すと Claude が実在の agent として拾ってしまう
- `typecheck-agent.md` は Step 1 で調べた型チェッカーの名前でリネームし、`{{TYPECHECK_AGENT}}` / `{{LANGUAGE}}` / `{{TYPECHECK_COMMAND}}` を埋める（TypeScript → `tsc-agent` / `pnpm tsc --noEmit`、Python → `mypy-agent` / `uv run mypy app`）。**型チェッカーを持たないスタックならファイルごと削除する**（その場合 `tdd-workflow.md` のレビュー表からも型チェック列を落とす）
- `review-agent.md` の frontmatter にある `guard-review-agent-no-test-run.js` の hooks ブロックは**消さない**（review-agent のテスト実行を意図的にブロックする core の仕組み）
- `{{LAYER_CHECKLIST}}` をレイヤーごとに埋める。コードベースを読み、そのレイヤーで守るべき構造上の約束（層をまたぐ依存の禁止・例外の漏れ・責務の置き場所など）を抽出する。判断できなければユーザーに確認する
- 埋めたあと、ファイル中の HTML コメント（`<!-- ... -->` の指示文）は削除する
- リポジトリの絶対パスをハードコードしない（`.claude/rules/agent-definition-guide.md`）

## Step 4: rules と skills を埋める

- `.claude/rules/agent-delegation.md` … 委譲表を実際のレイヤーで埋める。`{{IMPL_PATHS}}` はレイヤーのパス列挙
- `.claude/skills/tdd-workflow.md` … 委譲表・レビュー表・テストコマンドを埋める。`{{TEST_PLACEMENT}}` は Step 1 で調べたテストファイルの配置規約（と命名規則）で埋める

`{{TEST_BOILERPLATE}}` と `{{FILE_PLACEMENT_TABLE}}` は**この時点で無理に埋めない**。テストの雛形は実物を1本通してから写経するのが正しく、机上で書くと嘘のボイラープレートが残る。プロジェクトにまだテストが無ければ「（最初のテストを書いたら、その実物をここに写す）」と明記して残す。

`.claude/docs/rules/` のスタック固有 rules（React・DB・UI 等）は kit が配布しない。プロジェクトが自分で書く。書いたら impl-agent / review-agent の参照表（`{{RULES_TABLE}}`）に追記する。

## Step 5: 残ったプレースホルダを確認する

```bash
grep -rn '{{' .claude/ --exclude=template-setup.md || echo "プレースホルダなし"
```

（このスキル自身はプレースホルダ名を本文で参照しているため除外する。）

意図的に残すもの（`{{TEST_BOILERPLATE}}` 等）以外がヒットしたら埋める。

## Step 6: INDEX.md を生成する

core の [index-setup.md](./index-setup.md) に従い、`.claude/agents/`・`.claude/rules/`・`.claude/skills/`・`.claude/docs/` 配下の末端フォルダに `INDEX.md` を作成する。

## Step 7: CLAUDE.md に節を追記する

`CLAUDE.md`（無ければ作成）に以下を追記する。

```markdown
## 作業開始時の確認

- `.claude/steering/current.md` … 進行中タスクの有無
- `.claude/specs/proceed.md` … 仕様確認中の作業の有無

## 実装の agent 委譲

`.claude/rules/agent-delegation.md` に従い、実装コードの変更は必ず専任 agent に委譲する。
メイン Claude が直接 Edit / Write で実装しない。

## 使用できるスラッシュコマンド

| コマンド | 用途 |
|---|---|
| `/spec <機能名>` | 仕様書を作成しユーザーの承認を得る |
| `/tdd <対象>` | Red → Green → Refactor で実装する |
| `/doc-push <説明>` | `.claude/` の変更を main に直接 push する |
| `/workflow-kit-pull` | claude-workflow-kit の core 更新を取り込む |
| `/workflow-kit-push` | core の改善を claude-workflow-kit へ還流する |
```

`/workflow-kit-pull` / `/workflow-kit-push` は core のスキルだが、commands/ 側のエントリは各プロジェクトが作る（`.claude/commands/<name>.md` から対応スキルを読ませる）。

## Step 8: このスキルとコマンドを削除して報告する

```bash
rm .claude/skills/template-setup.md .claude/commands/template-setup.md
```

一度きりの手順書のため、完了後は残さない。スキル本体だけを消すと `/template-setup` の
コマンドファイルが実体の無いスラッシュコマンドとして残るので、2ファイルとも消すこと。

最後にユーザーへ報告する:

- 生成した agent 定義の一覧
- 意図的に空のまま残したプレースホルダ（`{{TEST_BOILERPLATE}}` 等）とその埋めどき
- 次のアクション: 内容を確認のうえ `git add` を明示列挙して commit（`git add -A` は使わない。`.claude/rules/commit-guide.md`）
