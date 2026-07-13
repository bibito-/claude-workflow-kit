# kit への push ゲート

最終更新: 2026-07-12
ステータス: 実装完了・両 kit で稼働中

kit（core / stack いずれも）への push を、**コピー元プロジェクト固有の内容が混入していないことをレビューで証明しない限り通さない**仕組み。

この文書は `ai-todo` の `.claude/specs/kit-push-review-agent/` にあった spec を、実装に追随させて kit 側へ移したもの。設計の置き場は、その設計が実装されているリポジトリ（= ここ）。

## なぜ必要か

kit は複数プロジェクトが共有するテンプレートの正であり、各プロジェクトからファイルをコピーして push される。そのときコピー元プロジェクトの都合が紛れ込むと、配布先の全プロジェクトに無意味な記述が配られる。

CI（`kit-push-guard`）は禁止語の grep で単純一致の混入を弾けるが、次の判定はできない。

- 「この手順文や構成は、スタック非依存の core として本当に汎用か。それとも特定プロジェクトの都合が混ざっているか」
- 「この rules が説明しているコードの構造は、kit 側に実在するか。ドキュメントだけが同期されていないか」

文意レベルの判定は専任の agent に委ねる。そして**その判定を無視できないようにする**。プロンプトの指示は読み飛ばせるが、フックは読み飛ばせない。

## 構成

| 層 | 実体 | 役割 | 破れ方 |
|---|---|---|---|
| 審査 | `kit-push-review-agent` | 文意レベルで混入を判定し、verdict を書く | — |
| ゲート A | `.claude/hooks/guard-kit-push-verdict.cjs`（PreToolUse / Bash） | Bash コマンドが kit への `git push` なら、clean verdict が無ければ exit 2 | コマンド文字列の解析に依存するため原理的に穴がある |
| ゲート B | `.githooks/pre-push`（git） | git が push の瞬間に必ず呼ぶ。同じ verdict を検証する | `git push --no-verify`（ゲート A が弾く） |
| 書き込み制限 | `.claude/hooks/guard-kit-verdict-write.cjs`（PreToolUse / Write\|Edit） | verdict ファイルを書けるのを審査 agent だけに限定する | — |
| CI | `.github/workflows/kit-push-guard.yml` | 鮮度（base トレーラ）と禁止語 grep。詳細は [kit-push-guard-ci.md](kit-push-guard-ci.md) | — |
| 人間 | ユーザーによる `gh pr merge` | 最終関門。Claude はマージしない | — |

**ゲート A と B は同じ検証ロジック（`guard-kit-push-verdict.cjs`）を共有する。** B は `--pre-push <repo>` モードでそれを呼ぶ。

### なぜ二層なのか

PreToolUse フックは**実行前のコマンド文字列**しか見られない。実際にシェルが何を実行するかは、展開してみるまで分からない。

初期実装はコマンドを空白で分割して `git` + `push` のトークン列を探しており、次のものをすべて取りこぼしていた。しかも `not-push` と断定して**無言で素通り**させていた（fail-open）。

```
bash -c 'git push origin main'                              シェルで包むとトークンが崩れる
p=push; git $p                                              展開前なので push という語が存在しない
git -C ../kit -c credential.helper='!gh ...' push origin b  -c の値に空白があり位置がずれる
```

3番目は実運用の主経路だった。**kit への push は一度もゲートを通っていなかった。**

現在の分類器はこれらをすべて捕捉する（`push` または `ambiguous` に分類し、いずれもゲートにかける）。しかしそれは「今ある回避形を塞いだ」だけであり、**シェルは Turing 完全なので、文字列マッチの網羅性は原理的に証明できない**。塞いだつもりの穴が残っていないことを示す手段がない。

git の `pre-push` は push が起きる瞬間に git 自身が呼ぶ。コマンドの綴り方に一切依存せず、シェル解析という攻撃面がまるごと消える。これがゲート B を置く理由。

ゲート A を残す理由は、フィードバックが早いことと、`--no-verify`（B を迂回する唯一のフラグ）を文字列として確実に弾けること。

### fail-closed

ゲート A はコマンドを3分類する。

- **push と断定できる** → verdict を検証する
- **push でないと断定できる** → 通す
- **どちらとも断定できない**（シェルのラッパー・変数展開・判別できないクォート） → **exit 2 で止める**

曖昧なものを通すと、無言で素通りする（fail-open）。ゲートが黙って発火しない状態は、ゲートが無いより悪い。効いていると思い込むため。

> ブランチ命名規約が `kit-push/...` であるため、`push` の部分文字列一致で判定してはならない。`git -C <kit> switch -c kit-push/20260712-x` のような push でないコマンドが恒常的にブロックされる。git のサブコマンドとして `push` かどうかをトークン単位で見ること。

## 審査スコープ

審査が走るのは、変更が**スコープに触れたときだけ**である。

```
審査スコープ = MANDATORY_SCOPE ∪ マニフェストの配布物 ∪ review_extra
```

| 構成要素 | 中身 | 持ち主 |
|---|---|---|
| `MANDATORY_SCOPE` | `template/`・`scripts/`（scaffold で外へ出る経路）、宣言ファイル自身 | フック（`guard-kit-push-verdict.cjs`）に組み込み |
| マニフェストの配布物 | `*-kit-files.txt` に載っているもの。層は問わない | 各 kit のマニフェスト |
| `review_extra` | その kit に固有の追加パス | `.kit-push-review-scope.json` |

### 審査するのは外へ出るものだけ

守っているのは「配布先で意味をなさない語彙が、外へ出るファイルに混ざらないこと」である。外へ出ないファイルには、そもそも混ざる先が無い。

**審査1回はエージェント起動ぶんの金と時間である。** 守るものが無い push には払わない。

したがって以下は**一切審査しない**。

| 対象 | 理由 |
|---|---|
| アプリのコード・設定 | 配布されない |
| `docs/`（設計記録） | 配布されない |
| `README.md` | 配布されない。概要と最小限の用法に留めるものであり、審査を通さずとも誤りが分かる程度にコンパクトに保つ。中身を書くなら `docs/` に置いて README からは参照する |
| `CLAUDE.md` | 配布されない |
| `.github/`・`.githooks/`（ゲート定義） | 配布されない |

ゲート定義や正典の誤りは、PR の人間レビューと main の保護（ruleset・CI）で受け止める。自動審査を二重にかけるコストに見合わない。

唯一の例外が**宣言ファイル自身**である。これを外すと「スコープを空にする変更」が無審査で通り、ゲートを自分で消せてしまう。

### 宣言ファイル（`.kit-push-review-scope.json`）

**このファイルの存在自体が「スコープを絞ってよい」という宣言**であり、無ければフックは全変更を審査する。スコープを狭めるのは、狭めてよい範囲を明示的に宣言した kit だけの特典である。

フックは配布されるが、このファイルは配布されない。「無ければマニフェストだけ見る」という設計にすると、宣言を持たない配布先の kit で `template/` が無審査で外へ出る。**宣言し忘れは必ず安全側（審査過剰）に倒すこと。**

### 宣言漏れの検知

スコープから漏れる新しいパスが生まれる道は2つしかなく、両方を塞いである。

| 経路 | 検知 |
|---|---|
| 新しいトップレベルのパスが増える | `kit-push-guard` CI が `review_extra` / `no_review` への理由付き分類を強制する（`reason` が空なら落ちる） |
| scaffold スクリプトが新しいディレクトリを配り始める | `scripts/` が `MANDATORY_SCOPE` なので審査 agent が読む |

既存のトップレベルを全部列挙させる方式は採らない。無関係な構造変更のたびに CI が赤くなり、宣言が儀式化する。**増えたときだけ**分類を強制する。

## verdict

審査 agent が `<kit>/.claude/steering/reviews/<YYYY-MM-DD>-<HHmm>-kit-push-<layer>.md` に書く。frontmatter に機械可読フィールド、本文に人間可読の指摘。

```yaml
---
verdict: clean | contaminated
layer: workflow | stack
target_repo: <kit のディレクトリ名>
digest: <差分の sha256>
---
```

### 置き場が kit クローンの中である理由

`CLAUDE_PROJECT_DIR` は Claude Code がフックプロセスを起動するときだけ環境に入り、**Bash ツールが起動する子プロセス（= git、= git が起動する pre-push）には渡らない**。verdict をセッションのプロジェクトディレクトリに置くと、ゲート A とゲート B が別のディレクトリを見ることになり、verdict があるのに pre-push が誤ブロックする。

verdict は kit の作業ツリーの状態を証明するものなので、その隣に置くのが素直でもある。`.gitignore` で `.claude/steering/` を除外しているため、コミットされない。

### digest

verdict を差分の内容に束縛する。レビュー後に1文字でも変えれば digest が変わり、verdict は無効になる。

パス集合は**審査したパス（review_paths）**であって、変更したパス全部ではない。範囲を揃えないと、審査を受けたあとに配布物でないファイル（アプリのコードなど）を1行触っただけで digest が変わり、verdict が無効化されて再審査になる。審査していないものを digest に含めない。

`review_paths` = (`git diff --name-only origin/main` ∪ `git ls-files --others --exclude-standard`) ∩ 審査スコープ。各パスについて作業ツリーの内容の sha256（削除済みは文字列 `deleted`）を取り、`<hash>  <path>` 行をパス昇順ソートして連結し、その全体の sha256。

> **`git status --porcelain` を使ってはならない。** agent はコピー後・**コミット前**に走る（作業ツリーが dirty）。フックは push 時・**コミット後**に走る（作業ツリーが clean）。`git status` ではコミット後にパス集合が空になり、digest が空文字列の sha256 に潰れる。`origin/main` 差分ならコミット前後で同一の集合が得られる。

### 層の判定

リポジトリ名をハードコードせず、マーカー規則で導く。

> `.claude/manifests/<L>-kit-files.txt` が存在し、かつ `<L>-kit-base.txt` が**存在しない**なら、そのリポジトリは層 L の kit（正）である。

consumer は両方を持つ（配布ファイル一覧と、自分の同期状態）。kit は自分の層の base を持たない（比較相手が存在しないため）。この規則により、層名は `workflow` / `stack` として自動的に導出される。

agent が層名を自分で判断すると必ず取り違えるので、`guard-kit-push-verdict.cjs --context <kit>` が `layer` / `target_repo` / `digest` を JSON で返し、agent はそれを verdict にそのまま転記する。

### 書き込み制限

`guard-kit-verdict-write.cjs` が `.claude/steering/reviews/` 配下の `kit-push` を含むパスへの Write / Edit を、`agent_type === 'kit-push-review-agent'` のときだけ許す。`agent_type` はハーネスがサブエージェント実行時にだけ注入するフィールドで、メイン Claude は偽装できない。

裁定者は常に審査 agent である。ゲートに阻まれたメイン Claude が「push を通したいから」verdict を自作する経路を塞ぐ。

誤検知だと考える場合は、**反論理由を添えて agent を再起動する**。CI の `Kit-Grep-Mention` トレーラと同じ思想で、例外を通す口ではなく理由の表明を強制する。

## この仕組みが防がないもの

- **メイン Claude による能動的・網羅的な偽造。** ローカルでは原理的に塞げない。バイパス不能な最終層は kit 側 CI とユーザーの手動マージ
- **`core.hooksPath` を設定していないクローン。** ゲート B はローカル設定でしか有効にならない。push / pull スキルのクローン確認手順に設定を組み込んでいるが、構造的にゼロにはならない

防いでいるのは「読み飛ばす・忘れる・些細だと判断する・ゲートに阻まれた LLM が善意で verdict を自作する」という誤動作である。

## 有効化

### kit クローン側

```bash
git config core.hooksPath .githooks
```

push / pull スキルのクローン確認手順に含まれている（冪等）。`.githooks/` はマニフェスト非掲載であり、配布ペイロードではない（kit ローカルの保護）。

### consumer 側

フック本体は core が配るが、`.claude/settings.json` は配布できない（プロジェクトごとに permissions・MCP 設定が異なり、上書きすると壊れる）。

登録が無ければフックは一度も発火しない。**発火しないゲートは、無いより悪い。** そのため登録情報を配布物にしている。

- `.claude/manifests/hook-registrations.json` — どのフックをどの event / matcher に登録するかの宣言
- `.claude/scripts/merge-hook-registrations.cjs` — 宣言を読み、`settings.json` に**不足分だけ**を追記する

pull 経路（`/workflow-kit-pull` スキルと自動 pull の CI）の両方から呼ばれる。既存エントリ・`permissions`・プロジェクト独自のフック登録には触れない。冪等。

登録済みかどうかは「フックが `node` の**独立した引数**として渡るか」で判定する。単なるパス部分一致では `echo '.claude/hooks/guard-rm-rf.js'` のような表示専用コマンドまで登録済みと誤認する。

判別できない形は**未登録扱い**にする。失敗の向きが非対称だからである。取りこぼし（登録済みを未登録と判定）は重複登録になるだけでフックが2回発火しても判定は変わらない。誤検出（未登録を登録済みと判定）は**ゲートが1本も入らないまま「不足なし」と報告する**ことになり、この機能が防ごうとしている「効いていると思い込む」状態そのものを作る。

## 実運用で踏んだ落とし穴

| 症状 | 原因 |
|---|---|
| ゲートが一度も発火していなかった | フックを `.js` で書いたが `package.json` に `"type": "module"` があり `require` が使えず落ちていた。Claude Code は **exit 2 だけをブロック**とみなし、exit 1 は非ブロッキングエラーとして扱うため、無言で素通りしていた。`.cjs` 固定で解決 |
| digest がコミット後に空 sha256 に潰れる | パス集合を `git status --porcelain` から取っていた |
| 実運用の push が一度もゲートを通っていなかった | `-c credential.helper='!gh auth git-credential' push` の形で、`-c` のオプション値がクォート内に空白を含むためトークン位置がずれ、実 push が **`not-push` と誤判定**されていた |
| フックが consumer に一度も配られていなかった | 自動 pull がマニフェストのディレクトリ行を `find -name '*.js'` で展開しており、`.cjs` が落ちていた |
| stack kit で push ゲートが1本も動いていなかった | フック本体は配られたが `settings.json` に登録されていなかった |
| PR が「トレーラ欠落」で落ちる | git はコミットメッセージの**最後の段落**だけをトレーラブロックとして解釈する。base トレーラと `Co-Authored-By` を空行で分けると base トレーラが認識されない |

いずれも「効いていると思い込んでいたが実際は動いていなかった」類であり、実地に走らせるまで見えなかった。**この種の仕組みは、必ず「壊れていることを確認するテスト」（改ざんして push が止まるか）まで実行すること。**

## 関連

- [kit-push-guard-ci.md](kit-push-guard-ci.md) — CI 側の検査（鮮度・禁止語）
- `.claude/rules/agent-definition-guide.md` — kit 配布対象の agent 定義に特定スタック・ツール・サービス名を書かない規約
