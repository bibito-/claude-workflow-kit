# claude-workflow-kit

Claude Code と協業する TDD・spec/docs・review の開発ワークフロー方法論。スタックに依存しない core 部分のみを収録する。

## 位置づけ

このワークフローは [ai-todo](https://github.com/bibito-/ai-todo)（Hono + React + Supabase + Cloudflare Workers のプロダクト）で実運用しながら磨いてきたものを抽出したもの。ai-todo は「実際に動かしながら仕組みを改善する実験場」、[hono-auth-starter](https://github.com/bibito-/hono-auth-starter) はそのスタック向けテンプレート、本リポジトリは**スタックを問わず再利用できる部分だけを切り出した core**という3段構成。

## core / template の切り分け

| 種別 | 内容 | 配布方針 |
|---|---|---|
| **core**（本リポジトリの `.claude/` に収録） | 収録一覧の単一の正は [`.claude/manifests/workflow-kit-files.txt`](.claude/manifests/workflow-kit-files.txt)。フック一式（`.claude/hooks/`）・agent（`doc-push-agent`・`kit-push-review-agent`）・rules（`agent-definition-guide`・`commit-guide`・`documentation-guide`・`grill-me`）・docs/rules（`documentation-guide` 全文・`terminology-rules`）・skills（`merge-gate`・`spec-workflow`・`doc-push`・`index-setup`・`workflow-kit-push`・`workflow-kit-pull`）・`commands/spec`・フック登録の配布（`manifests/hook-registrations.json`・`scripts/merge-hook-registrations.cjs`）・マニフェスト自身・`.github/workflows/workflow-kit-pull-check.yml` | 各利用プロジェクトが `workflow-kit-pull-check.yml`（日次 + 手動実行）で本リポジトリとの差分を検知し、自リポジトリへ反映する PR を自動発行する。マージはレビューの上で手動 |
| **template**（本リポジトリの `template/` に収録） | impl-agent / review-agent / typecheck-agent 定義・`agent-delegation`・`tdd-workflow`・`commands/tdd`。**実物ではなく `{{PLACEHOLDER}}` 入りの骨格**（「形は普遍・中身がスタック依存」なものだけ）。typecheck-agent は型チェッカー名で埋めてリネームする（TypeScript なら `tsc-agent`、Python なら `mypy-agent`。型チェッカーが無いスタックでは削除） | プロジェクト新規作成時に `scripts/scaffold-template.sh` で一度だけ取り込み、`/template-setup` でスタックに合わせて埋める。以後は同期しない（書き換えを上書きしてしまうため）。base SHA もマニフェストも書かないので、構造的に CI の走査対象外になる |
| **スタック固有 rules**（本リポジトリには非収録） | react/tanstack-query/supabase/ui 等の docs/rules・テストボイラープレートの実物 | 骨格化しても中身が全部消えて空ファイルになるだけなので template に含めない。各プロジェクトが自分のスタックに合わせて書く（kit が渡すのは「rules を `docs/rules/` に置き `INDEX.md` から引く」という置き場のルールだけ） |
| **派生物**（本リポジトリには非収録） | 各フォルダの `INDEX.md` | フォルダ内容から導出される索引のため、リポジトリごとに内容が異なる。配布せず、各プロジェクトの doc-push フローが自前で生成・更新する（ルール本体は `documentation-guide` が core として配布） |

core と template の境界は、実際に非 Hono スタックのプロジェクトを1つ以上立ち上げて検証してから固める。

### 配布しないもの

| パス | 役割 |
|---|---|
| `docs/` | 本リポジトリ自身の設計記録。索引は [docs/INDEX.md](docs/INDEX.md) |
| `.githooks/` | 本リポジトリへの push を守る Git-level のフック（`pre-push`）。kit ローカルの保護 |
| `scripts/` | scaffold スクリプト。kit クローンから直接実行する |
| `.github/workflows/kit-push-guard.yml` | 本リポジトリ自身の CI。`.github/workflows/` 配下でも `workflow-kit-pull-check.yml` は配布物なので、ディレクトリ単位では判断しない |
| `.claude/settings.json` | 本リポジトリで作業するときの設定。利用プロジェクトごとに permissions・MCP 設定が異なるため配布できない |

`docs/` を `.claude/` 配下ではなくリポジトリ直下に置いているのは、`.claude/` が配布ペイロードの領域だから。そこに非配布物を混ぜると、マニフェストにディレクトリ行を足した瞬間に設計文書まで全 consumer へ配られる。

## core の配布方式

本リポジトリから push するのではなく、**各利用プロジェクトが pull する**。どのファイルを取り込むかは利用プロジェクト側の `.claude/manifests/workflow-kit-files.txt` を単一の正とし、本リポジトリはその参照先として振る舞う。

利用プロジェクト側に必要なもの（`scripts/scaffold.sh` が自動準備する）:

- `.github/workflows/workflow-kit-pull-check.yml`
- `.claude/manifests/workflow-kit-files.txt`
- `.claude/manifests/workflow-kit-base.txt`（三方向比較の祖先）

手動設定のまま残るもの:

- シークレット `WORKFLOW_KIT_PAT`（本リポジトリが private のため）
- リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
（`.claude/settings.json` への hooks 登録は手動作業ではなくなった。settings.json 自体は配布対象外のままだが、`.claude/manifests/hook-registrations.json` の宣言をもとに `.claude/scripts/merge-hook-registrations.cjs` が pull 時に不足分だけを追記する。既存エントリには触れない）

## 導入手順

1. 対象プロジェクトの隣に本リポジトリをクローンし、Git-level のフックを有効化する

   ```sh
   gh repo clone bibito-/claude-workflow-kit ../claude-workflow-kit
   git -C ../claude-workflow-kit config core.hooksPath .githooks
   ```

   2行目は本リポジトリへの push を守る `pre-push` を有効にする（[docs/kit-push-gate.md](docs/kit-push-gate.md)）。`core.hooksPath` はクローンごとのローカル設定なので、クローンするたびに必要。同じ値を設定し直すだけなので冪等。

2. 対象プロジェクトのルートでスキャフォールディングスクリプトを実行する

   ```sh
   ../claude-workflow-kit/scripts/scaffold.sh
   ```

   フォルダ構造・`.gitignore` 追記・core ファイル一式・`workflow-kit-base.txt` の初期化を自動準備する。既存ファイルは上書きせずスキップして一覧報告する（冪等・git 操作は一切しない）。

3. レポートに従い残りの手動作業を行う

   - リポジトリ設定「Allow GitHub Actions to create and approve pull requests」の有効化
   - フック登録の追記

     ```sh
     node .claude/scripts/merge-hook-registrations.cjs
     ```

   - 内容確認のうえ明示的な `git add` → commit → push（`git add -A` は使わない）

4. **（新規プロジェクトの場合）template の骨格を取り込む**

   ```sh
   ../claude-workflow-kit/scripts/scaffold-template.sh
   ```

   impl-agent / review-agent / typecheck-agent / `agent-delegation` / `tdd-workflow` / `commands/tdd` の骨格と、穴埋め手順書 `/template-setup` を配置する。レポートの末尾に残っているプレースホルダが `ファイル:行:名前` で列挙される。

   続けて Claude Code で `/template-setup` を実行する。レイヤー構成・テストランナーをコードベースから調査し、判断できない点だけ確認したうえで、impl-agent / review-agent をレイヤー数だけ複製してプレースホルダを埋める（完了後、手順書自身は削除される）。

   スクリプトは**配置とレポートしかしない**（対話質問・プレースホルダ置換・git 操作をしない）。レイヤー分割やテスト戦略は業務判断であり、対話プロンプトの選択肢に落とせないため、決定は `/template-setup`（= Claude との対話）が担う。

5. 以後の core 更新は日次 CI（pull-check）の PR と `/workflow-kit-pull` で取り込み、プロジェクト側の改善は `/workflow-kit-push` で還流する。scaffold は一度きりの入口で、以後は既存の同期ループに引き継ぐ。**template は同期ループに乗らない**（骨格は取り込んだ時点でそのプロジェクトの資産になる）

補足:

- テンプレート（hono-auth-starter 等）由来のプロジェクトでも実行して害はない（冪等）。テンプレートに焼き込まれた core が古い場合の補完と、テンプレートに含まれない `workflow-kit-base.txt` の初期化という実益がある
- **scaffold は「差分ありスキップ」が1件でも残る間は `workflow-kit-base.txt` を書かない（重要）**。差分が残ったまま base（= kit HEAD）を置くと、三方向比較は「base と kit が同一・project だけ違う」を見て、そのファイルを「project 側の意図的な先行変更（local）」と誤分類する。実態は kit に追随できていないだけなのに、以後 kit 側の更新は pull で取り込まれず、CI は「kit へ push してください」という逆向きの notice を出し続ける（要解決として見え続けるのではなく「解決済み・project 優先」として見えなくなるのが危険）。差分を `/workflow-kit-pull` / `/workflow-kit-push` で解決してから base を設定すること
- `scripts/scaffold.sh`・`scripts/scaffold-template.sh` は kit クローンから直接実行するもので、利用プロジェクトへは配布しない（マニフェスト対象外）
- `template/` を kit 自身の `.claude/` ではなくリポジトリ直下に置いているのは、両者の区別を manifest の記載有無だけに頼らないため。同居させると pull-check が骨格を core と取り違えうる（利用プロジェクト側の同名ファイルと衝突する形の穴）

## push 前の審査スコープ

kit（= 何かを配る側のリポジトリ）への `git push` は、`kit-push-review-agent` の clean verdict が無いとフックにブロックされる（[docs/kit-push-gate.md](docs/kit-push-gate.md)）。ただし**審査が走るのは、変更が審査スコープに触れたときだけ**である。

```
審査スコープ = MANDATORY_SCOPE ∪ マニフェストの配布物 ∪ review_extra
```

| 構成要素 | 中身 | 持ち主 |
|---|---|---|
| `MANDATORY_SCOPE` | `README.md`・`CLAUDE.md`（kit の境界を定める正典）、`.github/`・`.githooks/`（ゲート定義）、`template/`・`scripts/`（scaffold で外へ出る経路）、宣言ファイル自身 | フック（`guard-kit-push-verdict.cjs`）に組み込み |
| マニフェストの配布物 | `*-kit-files.txt` に載っているもの。層は問わない | 各 kit のマニフェスト |
| `review_extra` | その kit に固有の追加パス | `.kit-push-review-scope.json` |

守っているのは「配布先で意味をなさない語彙が、外へ出るファイルに混ざらないこと」である。外へ出ないファイル（アプリのコード・設計アーカイブ）は混入のしようがなく、審査しても守るものが無い。だからスコープに触れない push では verdict を要求しない。

### 宣言ファイル（`.kit-push-review-scope.json`）

**このファイルの存在自体が「スコープを絞ってよい」という宣言**であり、無ければフックは全変更を審査する。スコープを狭めるのは、狭めてよい範囲を明示的に宣言した kit だけの特典である。

フックは配布されるが、このファイルは配布されない。「無ければマニフェストだけ見る」という設計にすると、宣言を持たない配布先の kit で `template/` や正典が無審査で外へ出る。**宣言し忘れは必ず安全側（審査過剰）に倒すこと。**

構造的なスコープをフック側の `MANDATORY_SCOPE` に持たせているのも同じ理由で、個別の kit の宣言漏れでゲートが外れないようにするためである。

### 宣言漏れの検知

スコープから漏れる新しいパスが生まれる道は2つしかなく、両方を塞いである。

| 経路 | 検知 |
|---|---|
| 新しいトップレベルのパスが増える | `kit-push-guard` CI が `review_extra` / `no_review` への理由付き分類を強制する |
| scaffold スクリプトが新しいディレクトリを配り始める | `scripts/` が `MANDATORY_SCOPE` なので審査 agent が読む |

既存のトップレベルを全部列挙させる方式は採らない。無関係な構造変更のたびに CI が赤くなり、宣言が儀式化する。**増えたときだけ**分類を強制する。

経緯と、この設計に至るまでに踏んだフェイルオープンについては [docs/ci-review-agent-migration.md](docs/ci-review-agent-migration.md) を参照。

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
