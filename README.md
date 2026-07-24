# claude-workflow-kit

Claude Code と協業する TDD・spec/docs・review の開発ワークフロー方法論。スタックに依存しない core 部分のみを収録する。

## これは何か

このワークフローは [ai-todo](https://github.com/bibito-/ai-todo)（Hono + React + Supabase + Cloudflare Workers のプロダクト）で実運用しながら磨いてきたものを抽出したもの。

- **ai-todo** … 実際に動かしながら仕組みを改善する実験場
- **[hono-auth-starter](https://github.com/bibito-/hono-auth-starter)** … そのスタック向けテンプレート
- **本リポジトリ（claude-workflow-kit）** … スタックを問わず再利用できる部分だけを切り出した core

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

フォルダ構造・`.gitignore`・core ファイル一式を配置し、最後に一覧を報告する。既存ファイルは上書きせずスキップするため、**新規・既存どちらのプロジェクトに対しても安全に実行できる**（冪等・git 操作なし。実行検証の詳細は [docs/scaffold-onboarding.md](docs/scaffold-onboarding.md)）。

レポートに従い残りの手動作業を行う。

- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
- `node .claude/scripts/merge-hook-registrations.cjs` でフックを `settings.json` に登録する（`settings.json` はプロジェクトごとに異なるため配布対象外。不足分だけ追記される）
- 内容確認のうえ、明示的な `git add` → commit → push（`git add -A` は使わない）

**新規プロジェクトの場合**は続けて template の骨格も取り込める。

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

## 現状（TODO）

- [x] core ファイルの移設
- [x] core の CI/PR 自動配布（pull 型・`workflow-kit-pull-check.yml`）
- [x] スキャフォールディングスクリプト（core 前提条件の準備・`scripts/scaffold.sh`）
- [x] スキャフォールディングスクリプト（template 取り込み用・`scripts/scaffold-template.sh` + `/template-setup`）
- [x] 本リポジトリへの push を PR 経路へ統一し、CI で鮮度（base トレーラ）と混入を検査する（[docs/kit-push-guard-ci.md](docs/kit-push-guard-ci.md)）
- [x] push 前の混入審査を専任 agent に委譲し、フックで強制する（[docs/kit-push-gate.md](docs/kit-push-gate.md)）
- [x] フック登録を配布物にして、pull 時に `settings.json` へマージする
- [x] 審査対象を「変更 ∩ 審査スコープ」に絞り、配布物に触れない push から審査を外す
- [ ] 非 Hono スタックのプロジェクトで core / template の境界を実地検証する
