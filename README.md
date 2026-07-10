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

利用プロジェクト側に必要なもの（`scripts/scaffold.sh` が自動準備する）:

- `.github/workflows/workflow-kit-pull-check.yml`
- `.claude/manifests/workflow-kit-files.txt`
- `.claude/manifests/workflow-kit-base.txt`（三方向比較の祖先）

手動設定のまま残るもの:

- シークレット `WORKFLOW_KIT_PAT`（本リポジトリが private のため）
- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
- `.claude/settings.json` への hooks 登録（settings.json は core 配布対象外）

## 導入手順

1. 対象プロジェクトの隣に本リポジトリをクローンする

   ```sh
   gh repo clone bibito-/claude-workflow-kit ../claude-workflow-kit
   ```

2. 対象プロジェクトのルートでスキャフォールディングスクリプトを実行する

   ```sh
   ../claude-workflow-kit/scripts/scaffold.sh
   ```

   フォルダ構造・`.gitignore` 追記・core ファイル一式・`workflow-kit-base.txt` の初期化を自動準備する。既存ファイルは上書きせずスキップして一覧報告する（冪等・git 操作は一切しない）。

3. レポートに従い残りの手動作業を行う: `.claude/settings.json` への hooks 登録・リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化・内容確認のうえ明示的な `git add` → commit → push

4. 以後の core 更新は日次 CI（pull-check）の PR と `/workflow-kit-pull` で取り込み、プロジェクト側の改善は `/workflow-kit-push` で還流する。scaffold は一度きりの入口で、以後は既存の同期ループに引き継ぐ

補足:

- テンプレート（hono-auth-starter 等）由来のプロジェクトでも実行して害はない（冪等）。テンプレートに焼き込まれた core が古い場合の補完と、テンプレートに含まれない `workflow-kit-base.txt` の初期化という実益がある
- **scaffold は「差分ありスキップ」が1件でも残る間は `workflow-kit-base.txt` を書かない（重要）**。差分が残ったまま base（= kit HEAD）を置くと、三方向比較は「base と kit が同一・project だけ違う」を見て、そのファイルを「project 側の意図的な先行変更（local）」と誤分類する。実態は kit に追随できていないだけなのに、以後 kit 側の更新は pull で取り込まれず、CI は「kit へ push してください」という逆向きの notice を出し続ける（要解決として見え続けるのではなく「解決済み・project 優先」として見えなくなるのが危険）。差分を `/workflow-kit-pull` / `/workflow-kit-push` で解決してから base を設定すること
- `scripts/scaffold.sh` は kit クローンから直接実行するもので、利用プロジェクトへは配布しない（マニフェスト対象外）

## 現状（TODO）

- [x] core ファイルの移設
- [x] core の CI/PR 自動配布（pull 型・`workflow-kit-pull-check.yml`）
- [x] スキャフォールディングスクリプト（core 前提条件の準備・`scripts/scaffold.sh`）
- [ ] スキャフォールディングスクリプト（template 取り込み用）
