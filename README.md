# claude-workflow-kit

Claude Code と協業する TDD・spec/docs・review の開発ワークフロー方法論。スタックに依存しない core 部分のみを収録する。

## 位置づけ

このワークフローは [ai-todo](https://github.com/bibito-/ai-todo)（Hono + React + Supabase + Cloudflare Workers のプロダクト）で実運用しながら磨いてきたものを抽出したもの。ai-todo は「実際に動かしながら仕組みを改善する実験場」、[hono-auth-starter](https://github.com/bibito-/hono-auth-starter) はそのスタック向けテンプレート、本リポジトリは**スタックを問わず再利用できる部分だけを切り出した core**という3段構成。

## core / template の切り分け

| 種別 | 内容 | 配布方針 |
|---|---|---|
| **core**（本リポジトリに収録） | `.claude/hooks/`・`doc-push-agent`・`tsc-agent`・`agent-definition-guide`・`commit-guide`・`documentation-guide`・`grill-me`・`merge-gate`・`terminology-rules` | 各利用プロジェクトが `workflow-kit-pull-check.yml`（日次 + 手動実行）で本リポジトリとの差分を検知し、自リポジトリへ反映する PR を自動発行する。マージはレビューの上で手動 |
| **template**（本リポジトリには非収録） | impl-agent / review-agent 定義・TDD のテストボイラープレート・react/tanstack-query/supabase 等スタック依存の docs/rules | プロジェクト新規作成時にスキャフォールディングスクリプトで一度だけ取り込み、その場でスタックに合わせて書き換える。以後の自動 push はしない（書き換えを上書きしてしまうため）（未実装） |
| **派生物**（本リポジトリには非収録） | 各フォルダの `INDEX.md` | フォルダ内容から導出される索引のため、リポジトリごとに内容が異なる。配布せず、各プロジェクトの doc-push フローが自前で生成・更新する（ルール本体は `documentation-guide` が core として配布） |

core と template の境界は、実際に非 Hono スタックのプロジェクトを1つ以上立ち上げて検証してから固める。

## core の配布方式

本リポジトリから push するのではなく、**各利用プロジェクトが pull する**。どのファイルを取り込むかは利用プロジェクト側の `.claude/manifests/workflow-kit-files.txt` を単一の正とし、本リポジトリはその参照先として振る舞う。

利用プロジェクト側に必要なもの:

- `.github/workflows/workflow-kit-pull-check.yml`
- `.claude/manifests/workflow-kit-files.txt`
- シークレット `WORKFLOW_KIT_PAT`（本リポジトリが private のため）
- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化

## 現状（TODO）

- [x] core ファイルの移設
- [x] core の CI/PR 自動配布（pull 型・`workflow-kit-pull-check.yml`）
- [ ] スキャフォールディングスクリプト（template 取り込み用）
