# workflow-kit-template-scaffold 実装仕様書

最終更新: 2026-07-11
ステータス: **実装完了・試運転中**（claude-workflow-kit の main へ push 済み）
実装対象リポジトリ: **claude-workflow-kit**（ai-todo ではない。spec のみ ai-todo で管理）

docs/ へは昇格させず specs/ に残す（ユーザー判断）。後続タスク（stack-kit scaffold）が本 spec の導入フローを前提に設計されるため、それが片付くまでは仕様書として参照され続ける。

## 実装結果

Step 1〜5 をすべて実施。claude-workflow-kit 側のコミット:

| コミット | 内容 |
|---|---|
| `85ed5b1` | Step 1: 4ファイルを core 昇格（+ `scaffold.sh` に `.claude/commands` を追加） |
| `e10aa49` | Step 2: `template/` ツリー新設（骨格 + `/template-setup`） |
| `4706c13` | Step 3・4: `scripts/scaffold-template.sh` |
| `fd33d6d` | Step 5: README 更新 |

仕様からの差分・実装時の判断:

- `template-setup.md` は本文でプレースホルダ名を参照するため、スクリプトの残存プレースホルダ走査およびスキル自身の `grep` から除外した（除外しないと手順書自身の `{{...}}` でレポートが埋まる）
- `{{TEST_BOILERPLATE}}` / `{{FILE_PLACEMENT_TABLE}}` は `/template-setup` の時点で埋めない方針とした（テストの雛形は実物を1本通してから写経すべきで、机上で書くと嘘のボイラープレートが残るため）
- core 昇格した4件のうち、内容を書き換えたのは `spec-workflow.md` のみ。他3件は ai-todo と逐語同一にした。pull-check は同一なら `same` 判定で何もしないが、差分があると祖先に無いファイルのため `conflict` 判定になり手動解消が要るため、書き換えは必要最小限にとどめた
- **ai-todo 側の残作業**: `spec-workflow.md` は上記の書き換えにより `conflict` 判定になる。CI は警告を出して `base.txt` を進めないため、`/workflow-kit-pull` で解消すること

## kit の階層と導入フロー

kit は2階層ある。**workflow-kit（方法論）の下に stack-kit が複数ぶら下がる**構図で、stack-kit は Hono 系（hono-auth-starter ⇄ ai-todo）が現状唯一だが、FastAPI 系など後から増えうる。

```
claude-workflow-kit
├── core     … スタック非依存。継続同期（pull-check が差分を追う）
└── template … 「形は普遍・中身がスタック依存」の骨格。一度きり配布・以後同期しない

        ↓ 骨格を埋めて実物にする / あるいは実物を直接もらう

stack-kit（hono-auth-starter, 将来: fastapi-* など）
    … スタック固有の実物。継続同期
```

### 新規プロジェクトの導入フロー

> **改訂（2026-07-11）**: 当初この表は Hono 系を「`scaffold.sh`（core）→ template scaffold はスキップ → stack-kit の実物を導入」としていたが、[stack-kit-scaffold spec](../stack-kit-scaffold/stack-kit-scaffold-spec-01.md) の調査で**誤りと判明**した。hono-auth-starter は GitHub Template repository であり、Hono 系新規プロジェクトは**リポジトリ複製で core・stack・実物コードのすべてを受け取る**。core scaffold を走らせる場面は無い。

**2本のフローがあり、交わらない。**

**A. Hono+Supabase の新規プロジェクト**

1. hono-auth-starter を Template repository として複製する（core・stack・`src/` の実物がすべて入った状態で始まる）
2. `../hono-auth-starter/scripts/stack-kit-scaffold.sh` を実行する → `stack-kit-base.txt` を生成して同期ループに結線し、`secrets.STACK_KIT_PAT` の登録と `.claude/settings.json` のフック登録を案内する
3. README の手順（Supabase / Vercel プロジェクト作成、`cors.ts` の値差し替え、`pnpm cf-typegen`）

**B. それ以外のスタック（FastAPI 等・対応する stack-kit が無い）**

1. `../claude-workflow-kit/scripts/scaffold.sh`（core）
2. `../claude-workflow-kit/scripts/scaffold-template.sh`（骨格）
3. `/template-setup` で骨格の穴を埋める

**発生しない分岐**（当初の表にあったが、調査で成立しないと判明した）:

- 「Hono プロジェクトで template scaffold をスキップする」… Template 複製なのでそもそも scaffold を通らない
- 「既存プロジェクトへ後から stack-kit を載せる」… stack-kit が配るのはルールと agent 定義だけで、`src/` の実物は Template 複製でしか渡らない。既存アプリに `src/client/`・`src/server/` を丸ごと注ぎ込むことはできない

### 同じパスを両 kit が持つことについて

`agent-delegation.md` / `*-impl-agent.md` / `*-review-agent.md` は stack-kit の同期対象であり、workflow-kit template も同名の骨格を配る。二重管理には**ならない**。template は正ではなく、一度置いたら kit との縁が切れる（base.txt もマニフェストも書かない）ため、そのファイルの正は常に1つに定まる — 骨格由来ならプロジェクト自身、stack-kit を入れたなら stack-kit。

## 概要

claude-workflow-kit に **template 階層**（スタック名を差し替える前提の骨格ファイル群）を新設し、新規プロジェクトへ一度きり取り込む `scripts/scaffold-template.sh` と、取り込み後に骨格を埋める `/template-setup` スキルを整備する。あわせて、現状 core にも template にも属していないスタック非依存ファイル4件を core へ昇格させ、scaffold 直後のプロジェクトで `/spec`〜`/tdd`〜doc-push のワークフローが完結する状態にする。

README の TODO 最終項目「スキャフォールディングスクリプト（template 取り込み用）」に対応する。

## 現状の課題

| 課題 | 内容 |
|---|---|
| template 階層の実体が無い | README の core/template 表で template は「本リポジトリには非収録」。取り込み元が存在しないため取り込みスクリプトが書けない |
| 宙に浮いたファイル | `spec-workflow.md`・`commands/spec.md`・`doc-push.md`・`index-setup.md` は core マニフェストにも template にも無い。scaffold 直後のプロジェクトは `/spec` が使えない |
| 二重管理のリスク | impl/review-agent・react-rules 等は stack-kit（ai-todo ⇄ hono-auth-starter）の同期対象。同じ実物を kit の template にも置くと source of truth が2つになる |

## 設計方針

| 項目 | 決定内容 | 理由 |
|---|---|---|
| template 資産の正 | claude-workflow-kit 内に新設する `template/` ツリー | scaffold が「隣にクローンした kit 1つ」だけを参照して完結する現在の設計（`KIT_ROOT` 相対コピー）を維持する。別リポジトリを立てない |
| 置き場所 | kit 自身の `.claude/` ではなく**リポジトリ直下の `template/`** | kit の `.claude/` は core の配布実体であり `workflow-kit-files.txt` / `pull-check.yml` の走査対象。同居させると core と template の区別が manifest 記載有無だけになり、pull-check が骨格を core と取り違える（`345a3f9` で塞いだ「祖先に無い同名ファイルの衝突」と同種の穴） |
| template の中身 | 実物ではなく**プレースホルダ入りの骨格** | 実物を置くと stack-kit と二重管理になり、非 Hono プロジェクトに Hono 前提の rules を流し込むことになる |
| 骨格に含めるもの | 「形は普遍・中身がスタック依存」なもののみ（impl-agent / review-agent / agent-delegation / tdd-workflow + commands/tdd） | 方法論（レイヤー別委譲・Red→Green→Refactor）自体が本体で、スタック名だけが可変 |
| 骨格に含めないもの | `react-rules`・`tanstack-query-rules`・`supabase-*-rules`・`ui-rules`・`agents-sdk-rules` 等の純スタック固有 rules | 骨格化すると中身が全部消えて空ファイルになるだけで取り込む実益がない。新規プロジェクトが自分のスタックに合わせて書く。kit が渡すのは「rules を `docs/rules/` に置き `INDEX.md` から引く」という置き場のルール（既に core の `documentation-guide` が担う） |
| スクリプトの形 | 既存 `scaffold.sh` へのフラグ追加ではなく**独立した `scripts/scaffold-template.sh`** | 両者は「同期ループへの入口かどうか」で性質が正反対。core は base を書いて CI 同期に接続する／template は base も manifest も書かない（＝ CI の走査対象外になり「以後同期しない」が構造的に担保される） |
| スクリプトの責務 | **配置とレポートのみ**。対話質問・プレースホルダ置換・git 操作は一切しない | レイヤー分割やテスト戦略は業務判断で、対話プロンプトの選択肢に落とせない。`scaffold.sh` の設計思想（配置とレポートのみ）と一貫させる |
| 穴埋めの担い手 | スクリプトが一緒に配置する `/template-setup` スキル | 決定はスキル（＝ Claude との対話）が担い、スクリプトは決定しない。穴埋め完了後にスキル自身を削除する |
| 既存ファイルの扱い | 上書きせずスキップし、「同一」「差分あり」を分けて一覧報告 | `scaffold.sh` と挙動を揃える。再実行しても破壊しない |
| core 昇格 | `spec-workflow.md`・`commands/spec.md`・`doc-push.md`・`index-setup.md` の4件 | スタック非依存。含めないと scaffold 直後のプロジェクトは `/tdd` はあるのに `/spec` が無い歪な状態になり、README が謳う「TDD・spec/docs・review のワークフロー方法論」が完結しない |

## プレースホルダ記法

`{{PLACEHOLDER_NAME}}` 形式。理由: markdown 本文に自然出現せず `grep -n '{{'` で機械的に列挙できるため、スクリプトの最終レポートと `/template-setup` スキルの両方が「残っている穴」を確実に検出できる。

想定する主なプレースホルダ:

| 名前 | 埋める内容 | 例（ai-todo の場合） |
|---|---|---|
| `{{LAYER}}` | 実装レイヤー名 | `client` / `server` |
| `{{LAYER_PATH}}` | レイヤーに対応するディレクトリ | `src/client/` / `src/server/` |
| `{{STACK}}` | レイヤーの技術スタック | `React / Vite` / `Hono / Cloudflare Workers` |
| `{{TEST_RUNNER}}` | テストランナーと実行コマンド | `vitest`（`pnpm exec vitest run`） |
| `{{TEST_FILE_PATTERN}}` | テストファイルの命名規則 | `*.test.ts` / `*.test.tsx` |
| `{{PACKAGE_MANAGER}}` | パッケージマネージャ | `pnpm` |

## 実装ステップ

### Step 1 — core 昇格（4ファイル）

対象リポジトリ: `claude-workflow-kit`

- ai-todo から以下を kit の `.claude/` へ移設する
  - `.claude/skills/spec-workflow.md`
  - `.claude/skills/doc-push.md`
  - `.claude/skills/index-setup.md`
  - `.claude/commands/spec.md`
- `spec-workflow.md` の Step 3-new「ドラフト前コンテキスト収集」にある `supabase/migrations/` への言及を、スタック非依存な表現（「DB が絡む場合はマイグレーション定義とその設計ドキュメント」）へ書き換える
- `.claude/manifests/workflow-kit-files.txt` に4エントリを追加する
- **注意:** core 化した瞬間からこの4ファイルは pull-check の対象になる。ai-todo・hono-auth-starter・hono-user-point の3リポジトリに pull PR が飛ぶ（`spec-workflow.md` は上記書き換えの分だけ差分が出る）

### Step 2 — template ツリー新設

対象リポジトリ: `claude-workflow-kit`

```
template/
└── .claude/
    ├── agents/
    │   ├── impl-agent.md        （骨格。レイヤーごとに複製する前提）
    │   └── review-agent.md      （骨格）
    ├── rules/
    │   └── agent-delegation.md  （骨格。委譲表が空でプレースホルダ）
    ├── skills/
    │   ├── tdd-workflow.md      （骨格）
    │   └── template-setup.md    （穴埋め手順書。完了後に削除される）
    └── commands/
        └── tdd.md
```

- `impl-agent.md` / `review-agent.md` は ai-todo の `client-impl-agent.md`・`client-review-agent.md` を出発点に、React/Hono 固有の記述をプレースホルダへ置き換えて骨格化する
- `review-agent.md` には「core の `guard-review-agent-no-test-run.js` フックによりテスト実行がブロックされる（意図的）」旨を残す
- `agent-delegation.md` は「レイヤー別に専任 agent へ委譲する」という方法論と `bypassPermissions` の理由だけを残し、委譲表の中身をプレースホルダにする
- `tdd-workflow.md` は Red→Green→Refactor の手順を残し、テストランナー・ボイラープレート・ファイル配置をプレースホルダにする
- `template/` 配下は `workflow-kit-files.txt` に**記載しない**（core 配布対象外）

### Step 3 — `scripts/scaffold-template.sh`

対象リポジトリ: `claude-workflow-kit`

- 前提チェックは `scaffold.sh` と同一（git リポジトリのルートで実行・kit 自身では実行不可）
- `TEMPLATE_ROOT="$KIT_ROOT/template"` 配下を `find` で全走査し、`template/` を剥がした相対パスで対象プロジェクトへコピーする（**マニフェストは持たない**。ディレクトリの存在自体が対象定義）
- 既存ファイルは上書きせずスキップし、`cmp` で「同一」「差分あり」を分けて集計する
- `workflow-kit-base.txt` は**書かない**。core マニフェストにも触らない
- git 操作（add / commit / push）は一切しない
- 最終レポート:
  - 作成したファイル一覧
  - スキップ一覧（同一 / 差分あり）
  - **残っているプレースホルダ一覧**（配置後のファイルを `grep -n '{{'` で走査し、`ファイル:行番号:プレースホルダ名` で列挙）
  - 次のアクション: 「`/template-setup` を実行して骨格を埋めてください」

### Step 4 — `/template-setup` スキル

対象リポジトリ: `claude-workflow-kit`（実体は `template/.claude/skills/template-setup.md`）

取り込み先プロジェクトの `.claude/skills/` に着地し、Claude が読んで実行する手順書。

- プロジェクトのレイヤー構成・テストランナー・パッケージマネージャをコードベースから調査し、判断できない点だけユーザーに確認する
- `impl-agent.md` をレイヤー数だけ複製し（例: `client-impl-agent.md` / `server-impl-agent.md`）、プレースホルダを埋める。`review-agent.md` も同様
- `agent-delegation.md` の委譲表を実際のレイヤーで埋める
- `tdd-workflow.md` のテスト関連プレースホルダを埋める
- 各フォルダの `INDEX.md` を生成する（core の `index-setup.md` に従う）
- `CLAUDE.md` に「作業開始時の確認」「実装の agent 委譲」「使用できるスラッシュコマンド」の節を追記する
- 完了後、`.claude/skills/template-setup.md` 自身を削除する（一度きりの手順書のため）

### Step 5 — README 更新

対象リポジトリ: `claude-workflow-kit`

- core / template 表の template 行から「（未実装）」を外し、`template/` ツリーと `scaffold-template.sh` を参照するよう書き換える
- 「導入手順」に template 取り込みの手順を追加する（core scaffold → template scaffold → `/template-setup`）
- TODO の最終項目 `- [ ] スキャフォールディングスクリプト（template 取り込み用）` にチェックを入れる
- core 昇格した4ファイルを core の内容一覧に追記する

## 実装の進め方

- `src/` 配下のコードを触らないため `/tdd` は使わない
- 実装は **claude-workflow-kit を開いた別セッション**で行う（ai-todo からの cross-repo 編集はしない）
- ai-todo 側でやることは Step 1 の移設元ファイルの提供のみで、`spec-workflow.md` 等の削除は行わない（core 昇格後に pull で同期される）

## 試運転（2026-07-11・kit-smoke-fastapi）

`/workspaces/cloudflare-actions/kit-smoke-fastapi`（FastAPI + pytest + uv の捨てプロジェクト）で core → template → `/template-setup` を通して**完走**した。非 Hono スタックを選んだのは、README が「境界は非 Hono スタックを1つ立ち上げて検証してから固める」としているため。

結果: レイヤーは `api`（`app/api/`）/ `domain`（`app/services/`・`app/models/`）の2分割。`api-impl-agent` / `api-review-agent` / `domain-impl-agent` / `domain-review-agent` / `mypy-agent` を生成。mypy(strict) と pytest のベースラインが緑であることを確認済み。

スクリプト2本の挙動は設計どおり（core 23件配置、template 6件配置、プレースホルダ58件検出、再実行時は「作成 / 同一でスキップ / 差分ありでスキップ」を正しく分類）。

### 所見

| # | 内容 | 状態 |
|---|---|---|
| 1 | `/template-setup` が起動できない。`template/.claude/commands/template-setup.md` が無く、スキル本体だけ配置されていた | **修正済み**（kit `12a2524`。後始末で skill と command の2ファイルを消すよう合わせて修正） |
| 2 | `tsc-agent.md` が core に入っている。`tsc --noEmit` は TypeScript 固有なのに、スタック非依存であるはずの core から Python プロジェクトへ配布された | **未対応**（下記） |
| 3 | 骨格の `tdd-workflow.md` がテスト同居配置・型チェック存在を前提にしている（`{{TEST_FILE_PATTERN}}` だけでは「テストは `tests/` 配下」を表現できない） | 未対応 |
| 4 | review-agent の骨格は `docs/rules/` を読む前提だが、新規プロジェクトには rules が無い（core が配るのは `terminology-rules` と `documentation-guide` のみ）。読むものが無く空回りする | 未対応（下記） |

所見2 の実害は実証された。Python プロジェクトなのに `tsc-agent.md` を削除できず（core マニフェストに載っているため消すと pull-check が差分を報告し続ける）、INDEX.md に「Python プロジェクトのため未使用」と注記して抱え続ける状態になった。**スタック非依存であるはずの core が、TS を使わないプロジェクトに TS 専用 agent の保持を強制している。**

### 所見2 の対処方針

型チェック agent は「形は普遍・中身がスタック依存」に該当するため、core ではなく template と stack-kit に分ける。

- workflow-kit core から `.claude/agents/tsc-agent.md` を外す（マニフェストから削除）
- `template/.claude/agents/typecheck-agent.md` を骨格として新設（`{{TYPECHECK_AGENT}}` / `{{TYPECHECK_COMMAND}}` / `{{LANGUAGE}}`）。`template/.claude/skills/tdd-workflow.md` に直書きされている `tsc-agent` 4箇所も `{{TYPECHECK_AGENT}}` へ置換する
- 実物の `tsc-agent.md` は **stack-kit のマニフェスト**へ移す（TS スタックの資産として ai-todo ⇄ hono-auth-starter で同期）

既存プロジェクトへの影響はほぼ無い。core マニフェストから外れてもファイルは残る（pull は削除しない）。各プロジェクトの `tdd-workflow.md` は core ではないため `tsc-agent` の参照もそのままでよい。

### 所見4 の対処方針（案）

スタック固有 rules は template に含めない（spec の設計方針どおり。骨格化しても中身が消えるだけ）。したがって新規プロジェクトでは rules が無い期間が必ず発生し、その間 review-agent は読むものを持たない。

試運転では暫定策として、各 review-agent に「レイヤー観点」チェックリスト（ルーターに ORM を直書きしていないか、service が HTTP 例外を投げていないか等）をインラインで持たせた。これを template 側に構造化して取り込む:

- `review-agent.md` の骨格に「`docs/rules/` が未整備の間はインラインのチェックリストで代替する」節を設け、`{{LAYER_CHECKLIST}}` プレースホルダを置く
- `/template-setup` の手順に「レイヤーごとの観点チェックリストを起こす」ステップを追加し、rules を書いたらそちらへ移すよう促す

### 想定内だったもの（kit の欠陥ではない）

- `{{TEST_BOILERPLATE}}` を空のまま残した — spec の「実装時の判断」どおり。実物のテストを1本通してから写経する方針
- `tests/` をメイン Claude が直接編集した — 委譲ルール自体を生成している最中で委譲先が存在しない。`/template-setup` の構造上避けられないブートストラップ

## 機能実装スモーク（2026-07-11・kit-smoke-fastapi）

`/template-setup` で生成した agent 委譲フローが実際に回るかを見るため、捨てプロジェクトで1機能（`DELETE /api/todos/{todo_id}`）を `/spec` → `/tdd` のフルフローで実装した。結果は kit-smoke-fastapi の README に記録。

**フローは回った**（pytest 8 passed / mypy strict green）。そのうえで core のバグが2件出た。

### core のバグ2件（kit へ還流済み・ai-todo にも反映済み）

| # | 内容 | kit | ai-todo |
|---|---|---|---|
| 5 | `guard-review-agent-no-test-run.js` の禁止パターンが `vitest\|tsc\|pnpm test` しか見ておらず、`pytest` / `mypy` を素通りさせていた。実際に review-agent 2体がテストを実行し、「レビューは静的解析に徹する」という core の設計意図が Python では機能していなかった | `442e517` | `6edae8b` |
| 6 | `workflow-kit-pull.md` / `push.md` の `<path>` 連結が `.claude/` を二重にしていた（マニフェストの行は既に `.claude/` を含み、core には `.github/workflows/` 配下も含まれる）。手順どおりに実行すると動かない | `9159246` | `82b2d88` |

所見5 の根は所見2 と同じ（**core が JS/TS を暗黙の前提にしている**）。TS 専用 agent を配るだけでなく、ガードの禁止パターンまで JS のコマンド名で書かれていた。所見2 の対処だけでは足りず、「core に JS/TS 前提が残っていないか」を一度洗う必要がある。

同期機構そのものは正しく働いた。`/workflow-kit-pull` の三方向比較が捨てプロジェクト側の修正を「project のみ変更 → 取り込まない・push 対象」と分類し、kit で上書きして修正を巻き戻す事故を防いだ。

### 所見7 — merge-gate / doc-push が remote + `main` ブランチを前提にしている

捨てプロジェクトは remote 無し・trunk が `master` のため、`gh pr create --base main` と doc-push-agent の push フローが実行できず、ローカルマージと手動コミットで代替した。`/workflow-kit-pull` / `/workflow-kit-push` も最終ステップを doc-push-agent に委譲する設計のため同様。

実運用のプロジェクトでは remote があり trunk も `main` なので実害は無いが、core が暗黙に置いている前提として記録する。対処するなら trunk 名を固定で書かず解決する（`git symbolic-ref refs/remotes/origin/HEAD` 等）か、前提として README に明記する。優先度は低い。

## 後続タスク

| タスク | 状態 |
|---|---|
| 所見2 の kit 反映（`tsc-agent` を core から外し、template の骨格 + stack-kit の実物に分ける） | **完了**（kit `c99f46a`・`d1ab549` / ai-todo `5c1764d`・`fe5a2ff` / hono-auth-starter `184cc7c`） |
| core の JS/TS 前提の洗い出し | **完了**（下記） |
| 所見3・4 の kit 反映（`tdd-workflow.md` の `{{TEST_PLACEMENT}}`、`review-agent.md` の `{{LAYER_CHECKLIST}}`、`template-setup.md` の穴埋め手順） | **完了**（kit `594afa4`・`2b08013`・`6d0b5e9`。template のみの変更のため ai-todo は base を `6d0b5e9` に進めるだけ・`f35f0fa`） |
| `stack-kit-push.md` / `stack-kit-pull.md` の `<path>` 二重化バグ（所見6 と同じ誤り） | **完了**（hono-auth-starter `1058166` / ai-todo `cf5007f`）。これで両 kit の pull/push スキルが手順どおり実行できる |
| stack-kit scaffold スクリプト | **完了**（hono-auth-starter `63718ef` / PR #7）。ただし役割は本 spec の想定（実物コードの配布）ではなく「同期ループへの結線」だった。詳細は [stack-kit-scaffold spec](../stack-kit-scaffold/stack-kit-scaffold-spec-01.md) |
| kit への push を kit 側で強制する（別 spec 候補） | 未着手。下記 |
| 所見7（remote + `main` 前提） | 優先度低。README に「core は remote origin があり trunk が `main` であることを前提とする」と明記して閉じる方針（動的解決は可読性を損なう割に実利が無い） |

### core の JS/TS 前提の洗い出し（完了）

core 17ファイル + hooks 3本を走査した。残っていたのは2件のみで、いずれも kit と ai-todo の双方に反映済み。

| 内容 | kit | ai-todo |
|---|---|---|
| テスト実行ガードの禁止パターンに Go・Rust・Java・.NET・Ruby・PHP を先回りで追加 | `745d27b` | `67410ea` |
| `documentation-guide` の修正履歴テンプレートの記述例が `src/client/hooks/useAddTodo.ts`（ai-todo の実ファイル）だったため中立な例に差し替え | `8215851` | `8b478fb` |

ガードの禁止パターンは**言語ごとの列挙を core が持ち続ける**方針とした。プロジェクト側で追加・上書きできる形にすると、ガードを緩める抜け道になるため。スタックを増やしたら core に足す。

`merge-gate` / `spec-workflow` / `pull-check.yml` に pnpm・vitest の直書きは無し。hooks が node 実装である点は、Claude Code 自体が node で動くため実行環境が保証され問題なしと判断した。

### kit への push を kit 側で強制する（別 spec 候補）

現状の `base.txt` による同期ガードは、**push する側が自分で自分をチェックする**形であり、`base.txt` を書き換えれば素通りする（`workflow-kit-push.md` 自身が「誤操作を防ぐガードであり不正を防ぐものではない」と明言）。強制は kit 側にしか置けない。

閉じ方:

1. **kit の main を branch protection で直接 push 禁止にする** — `git push origin main` を不可能にすれば、ガードを迂回する経路が消える。設定は GitHub UI で行う（Claude からの repo settings API 操作は分類器にブロックされる）
2. **push スキルを PR 経路に変える** — ブランチを切って PR を作る。「PR ブランチが main に追随していること」を必須にすれば、古い内容での上書きは「他人の変更を消す hunk」として diff に現れ、目視で捕まる。現状は直接 push なのでその diff を誰も見ない
3. **kit 側 CI で機械チェック** — マニフェストの整合性、プロジェクト固有名の混入（現在は push スキル Step 5 の目視）、コミットトレーラ `Workflow-Kit-Base: <sha>` と main HEAD の照合による鮮度チェック

残る穴: write 権限保持者による意図的な迂回（admin bypass・トレーラの詐称）は止められない。ただし防ぎたいのは誤操作によるロストアップデートであり、不正防止とは切り分けてよい。

2・3 は core ファイルのため、直せば全プロジェクトへ配布される。

## スコープ外

| 項目 | 理由 |
|---|---|
| hono-auth-starter 側のスキャフォールディングスクリプト | 別タスク。Hono/React/Supabase の実物コードと純スタック rules（Q4 で template から外したもの）を渡す役割を担う |
| 純スタック固有 rules の骨格化 | 中身が消えて空になるだけで実益がない |
| 非 Hono スタックでの実地検証 | README が「core と template の境界は、実際に非 Hono スタックのプロジェクトを1つ以上立ち上げて検証してから固める」としている通り、境界の確定は別途 |

## 関連ファイル

```
claude-workflow-kit/
├── README.md                                    （更新）
├── scripts/
│   ├── scaffold.sh                              （変更なし）
│   └── scaffold-template.sh                     （新規）
├── template/                                    （新規ツリー）
│   └── .claude/
│       ├── agents/{impl-agent,review-agent}.md
│       ├── rules/agent-delegation.md
│       ├── skills/{tdd-workflow,template-setup}.md
│       └── commands/tdd.md
└── .claude/
    ├── manifests/workflow-kit-files.txt         （4エントリ追加）
    ├── skills/{spec-workflow,doc-push,index-setup}.md  （新規・core 昇格）
    └── commands/spec.md                         （新規・core 昇格）
```
