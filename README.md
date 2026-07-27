# claude-workflow-kit

Claude Code と協業する TDD・spec/docs・review の開発ワークフロー方法論。スタックに依存しない core 部分のみを収録する。

## どんなプロジェクトか

このワークフローは [ai-todo](https://github.com/bibito-/ai-todo)（Hono + React + Supabase + Cloudflare Workers のプロダクト）で実運用しながら磨いてきたものを抽出したもの。

- **ai-todo** … 実際に動かしながら仕組みを改善する実験場
- **[hono-auth-starter](https://github.com/bibito-/hono-auth-starter)** … そのスタック向けテンプレート
- **本リポジトリ（claude-workflow-kit）** … スタックを問わず再利用できる部分だけを切り出した core

## 用語

| 語 | 指すもの |
|---|---|
| **core** | スタック非依存の配布ペイロードそのもの。実体は [`.claude/manifests/workflow-kit-files.txt`](.claude/manifests/workflow-kit-files.txt) に載っているファイル群 |
| **kit** | その core を持つ正リポジトリ側。層ごとに存在する（workflow 層の kit = 本リポジトリ、stack 層の kit = 別リポジトリ） |
| **利用プロジェクト / 配布先** | kit から core を受け取る側。ここを kit とは呼ばない |
| **層（layer）** | 配布物の抽象度の区分。workflow 層（スタック非依存）・stack 層（特定スタック向け）など |
| **template** | `template/` に置く骨格。core と違い取り込みは一度きりで、以後同期しない |

pull / push の向きは kit を基準にする。`/workflow-kit-pull` は kit から配布先へ core を取り込み、`/workflow-kit-push` は配布先で書いた core 相当の変更を kit へ還流する。1つのリポジトリが配布先でありながら別の層の kit を兼ねることもある。

## 導入

対象プロジェクトの隣に本リポジトリをクローンする（場所は任意。以降は隣に置いた前提で書く）。

```sh
gh repo clone bibito-/claude-workflow-kit ../claude-workflow-kit
git -C ../claude-workflow-kit config core.hooksPath .githooks
```

2行目は本リポジトリへの push を守るフックを有効にする（詳細: [docs/kit-push-gate.md](docs/kit-push-gate.md)）。

対象プロジェクトの**リポジトリルート**でスキャフォールディングスクリプトを実行する。

```sh
../claude-workflow-kit/scripts/scaffold.sh
```

フォルダ構造・`.gitignore`・core ファイル一式を配置し、hooks を `settings.json` へ登録し（不足分だけ追記。`settings.json` 自体は配布対象外）、最後に一覧を報告する。既存ファイルは上書きせずスキップするため、**新規・既存どちらのプロジェクトに対しても安全に実行できる**（冪等・git 操作なし。実行検証の詳細は [docs/scaffold-onboarding.md](docs/scaffold-onboarding.md)）。

レポートに従い残りの手動作業を行う。

- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
- 内容確認のうえ、明示的な `git add` → commit → push（`git add -A` は使わない）

**新規プロジェクトの場合**は続けて template の骨格も取り込める。( stack-kit（Template repository）がまだ存在しない場合 )

```sh
../claude-workflow-kit/scripts/scaffold-template.sh
```

impl-agent / review-agent などレイヤー別委譲の TDD 骨格を配置し、Claude Code で `/template-setup` を実行して埋める。既存プロジェクトへの後付けはまだ実証されていない（詳細: [docs/template-scaffold.md](docs/template-scaffold.md)）。

以後の core 更新は日次 CI（pull-check）の PR と `/workflow-kit-pull` で取り込み、プロジェクト側の改善は `/workflow-kit-push` で還流する。

## 配布物

どのファイルが core として配られるかの単一の正は [`.claude/manifests/workflow-kit-files.txt`](.claude/manifests/workflow-kit-files.txt)。大まかには次の3種類に分かれる。

| 種別 | 内容 | 配布 |
|---|---|---|
| **core**（`.claude/` 配下） | フック・agent・rules・skills・`/spec` コマンドなど | される。各プロジェクトが日次 CI で差分を検知し、取り込み PR を自動発行する |
| **template**（`template/` 配下） | impl-agent / review-agent など「形は普遍・中身がスタック依存」な骨格 | 新規プロジェクト作成時に一度だけ取り込む。以後同期しない |
| **設計記録**（`docs/`・`scripts/`・`README.md` など） | このリポジトリ自身の運用・設計文書 | されない |

core と template の切り分け方針、スタック固有 rules を配らない理由などは [docs/template-scaffold.md](docs/template-scaffold.md) を参照。

## push 前の審査

kit への `git push` は `kit-push-review-agent` の clean verdict が無いとフックにブロックされる。審査が走るのは変更が**配布物**に触れたときだけで、設計記録だけの push では走らない。

- 仕組みとスコープの定義: [docs/kit-push-gate.md](docs/kit-push-gate.md)
- スコープをこう決めた経緯: [docs/ci-review-agent-migration.md](docs/ci-review-agent-migration.md)

## ドキュメント

このリポジトリ自身の設計判断・運用ルールは [docs/](docs/)（索引: [docs/INDEX.md](docs/INDEX.md)）にまとめている。

