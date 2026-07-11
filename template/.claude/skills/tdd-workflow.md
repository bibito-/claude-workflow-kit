# TDD ワークフロー

引数で指定した機能・ファイルを TDD（Red → Green → Refactor）で実装するための手順とパターン集。

<!--
骨格ファイル。/template-setup がプロジェクトのレイヤー構成・テストランナーで埋める。
Red → Green → Refactor と「実装は impl-agent へ委譲」「Refactor 後にレビューループ」という
骨格は方法論そのものなので変えない。可変なのはレイヤー名・テストコマンド・ボイラープレートだけ。
-->

---

## マージゲートの確認（着手時に1度）

実装に入る前に、[merge-gate.md](./merge-gate.md) の **grill ゲート適用可否**を確認する。

- `specs/proceed.md` または `steering/current.md` の「運用ゲート」に `grill-gate: 適用 / スキップ` の**記録があれば、それに従い再質問しない**
- 記録が無い場合（spec を経ず `/tdd` 直行など）だけ、ここで尋ねる。その際**事前に意図を伝える**:
  > あなたの回答を基に、spec を「あなたの今後の理解を助ける形」に追記する予定です（誤解しやすい設計判断の帰結を要点として残します）。
  ```
  A) 適用（既定・推奨）   B) スキップ（軽微変更）
  ```
- 選択結果を `steering/current.md` の「運用ゲート」に記録する
- スモーク・公式照合は grill とは別軸で、該当変更なら常に適用（選択不要）

> **注意**: このセクションは「将来 grill を実行するか」を記録するだけ。実際の grill 質問は Refactor 完了後、PR 作成前に実行する（「Refactor 完了後の仕上げ」を参照）。

## 作業ブランチの作成（着手時に必ず実施）

新規タスク開始時は **main ではなく専用ブランチで作業する**。ブランチ名は spec 名に合わせる。

```bash
git checkout -b feat/<spec名>
```

- main で作業しているまま Red フェーズに入らない
- ブランチ作成は steering/current.md 更新の直前に行う
- フィーチャーブランチは `.claude/` を直接編集・commit してはならない。`.claude/` の変更が必要なときは doc-push-agent 経由で行うこと

---

## 実装の委譲

ブランチ作成後、対象レイヤーに応じて sub-agent に実装を委譲する（[agent-delegation.md](../rules/agent-delegation.md)）。

| 対象 | 委譲先 |
|---|---|
| {{LAYER_PATH}} | `{{LAYER}}-impl-agent` |
| 複数レイヤーにまたがる | 依存の上流側から順に直列、または worktree 隔離で並行 |

<!-- {{DELEGATION_TABLE}} … レイヤーの数だけ行を増やす。tdd-workflow と agent-delegation.md の表は必ず一致させる -->

### 委譲の方法

spec の内容をブリーフとして渡し、Red → Green → Refactor を一括で委譲する。

**単一レイヤー:**

```
Agent(subagent_type: "{{LAYER}}-impl-agent", prompt: "<spec の内容>")
```

**複数レイヤー並行:**

`isolation: "worktree"` を指定することで Agent が自動的に worktree を作成・クリーンアップする。変更があった場合はブランチ名が返るので、完了後に Main がマージする。

```
# 並行起動
Agent(subagent_type: "<A>-impl-agent", isolation: "worktree", prompt: "<spec の内容>")
Agent(subagent_type: "<B>-impl-agent", isolation: "worktree", prompt: "<spec の内容>")

# 両 Agent 完了後、返却されたブランチを feature branch にマージ
# git merge --no-ff <returned-branch>
```

### ブランチの扱い

**単一レイヤー:** sub-agent はメインワーキングツリーの feature branch をそのまま引き継いで作業する。

**複数レイヤー並行:** `isolation: "worktree"` で各 sub-agent が専用 worktree で独立して作業する。`.claude/worktrees/` は `.gitignore` 登録済みのため追加設定不要。両 Agent の完了後に返却ブランチを feature branch へマージし、worktree は自動クリーンアップされる。

### 設計判断が発生した場合

sub-agent が実装中に設計判断を返してきた場合（「【設計判断が必要です】」形式）、Main が判断して再度 sub-agent を呼び出す。

---

## steering/current.md の管理

### 新規タスク開始時

`steering/current.md` の先頭（「進行中のタスクなし」を置き換える形）に以下を書く：

```markdown
# 進行中タスク

## ゴール
<機能名> の <何を達成するか>（サブエージェントが文脈なしで読んでも理解できる粒度）

## フェーズ
- [ ] Red: テスト作成（`<テストファイルパス>`）
- [ ] Green: 最小実装（`<実装ファイルパス>`）
- [ ] Refactor: 整理

## 次のステップ
Red フェーズ: テストファイルを作成する
```

### 各フェーズ完了時

| フェーズ完了 | フェーズのチェックを入れる | 「次のステップ」を更新する |
|---|---|---|
| Red 完了 | `- [x] Red: ...` | `Green フェーズ: <実装ファイルパス> に最小実装を書く` |
| Green 完了 | `- [x] Green: ...` | `Refactor フェーズ: テストが Green のままリファクタする` |
| Refactor 完了 | `- [x] Refactor: ...` | （次のステップ欄を削除） |

### タスク完了時

`current.md` からゴール・フェーズ・次のステップを削除する：

```markdown
# 進行中タスク

進行中のタスクなし。
```

完了済み一覧は `steering/history.md` の「完了済み」セクションに追記する（`current.md` には保持しない）。

> Refactor 完了は「TDD 内側ループの完了」であって「main マージ可」ではない。main マージ前に必ず [merge-gate.md](./merge-gate.md)（grill ゲート → スモーク → 公式照合）を通すこと。grill ゲートを適用する場合、合格後に誤解しやすかった設計判断の帰結を spec の「押さえるべき要点」節へ中立表現で追記する（理解の補強）。

---

## Refactor 完了後のレビューループ

Refactor 完了後、PR 作成前に必ず review-agent と型チェック Agent を起動してルール違反・型エラーがないことを確認する。

### レビューの起動

実装が完了したレイヤーから順次 review-agent を起動する。同時に `{{TYPECHECK_AGENT}}`（型チェッカーを持つスタックの場合）も並行起動する。複数レイヤーにまたがる場合は全実装の完了を待たず、先に終わった方から即レビューを開始する。

| 対象 | 起動する agent |
|---|---|
| {{LAYER_PATH}} | `{{LAYER}}-review-agent` + `{{TYPECHECK_AGENT}}`（並行） |

<!-- {{REVIEW_TABLE}} … レイヤーの数だけ行を増やす。型チェッカーを持たないスタックなら列ごと落とし、typecheck-agent.md も削除する -->

```
Agent(subagent_type: "{{LAYER}}-review-agent", ...)
Agent(subagent_type: "{{TYPECHECK_AGENT}}")
# ↑ 両方完了後に分岐判定
```

### レビュー後の分岐

review-agent と型チェック Agent の結果に基づいて処理を分岐する。

- **review-agent で違反あり** → `current.md` に「レビュー違反修正」タスクが記載される。対象 impl-agent に修正を委譲し、完了後に再度 review-agent + 型チェック Agent を並行起動する
- **impl-agent が修正を行った場合は必ず再レビュー**: TDD のどのフローから修正の impl-agent が走った場合でも（grill 後の追加修正・違反修正・型エラー修正いずれも含む）、完了後に必ず review-agent + 型チェック Agent を並行起動する。`steering/reviews/` に積まれたレビューチケットは再レビューで "違反なし" を確認するまで残り続けるため、impl-agent 完了 → review-agent 再起動は省略不可
- **型チェックでエラーあり** → 対象 impl-agent に修正を委譲し、完了後に再度 review-agent + 型チェック Agent を並行起動する
- **両方とも OK** → `current.md` が「進行中タスクなし」になる。次の「Refactor 完了後の仕上げ」へ進む

---

## Refactor 完了後の仕上げ（doc-push と並行）

Refactor が完了したら doc-push-agent への委譲と同時に以下を実施する。

### PR の作成

feature ブランチを push して PR を作成する。doc-push は `.claude/` を main に直接 push するだけで feature ブランチとは無関係なため、並行して実行できる。

```bash
git push -u origin <ブランチ名>
gh pr create --base main --head <ブランチ名> --title "..." --body "..."
```

PR body の Test plan は「実施済み」と「手動確認」を分けて記載する：

```markdown
## Test plan

**実施済み**
- [x] `{{TEST_COMMAND}}` — <N> ファイル / <N> テスト全 Green
- [x] `{{TYPECHECK_COMMAND}}` — 型エラーなし

**手動確認（マージ前）**
- [ ] <手動で確認すべき動作>
```

<!-- {{TYPECHECK_COMMAND}} … 型チェッカーを持たないスタックでは、この行ごと削除する -->

PR 作成後は必ず PR の URL をユーザーに伝える（最終行に URL のみ貼る）。マージの促しや補足説明は不要。

### 導通テスト（smoke test）がある場合

merge-gate.md にスモークテスト手順が定義されている場合は、PR 作成後にテストを実行し結果をユーザーに伝える。

### docs 昇格後の specs/proceed.md 削除

TDD 完了後に spec を docs/ に昇格させたら、`specs/proceed.md` が残っている場合は削除する。

```bash
rm -f .claude/specs/proceed.md
```

### grill の対象スコープ

- **対象**: 当該 spec に記載された実装済み決定事項のみ
- **対象外**: spec の「スコープ外」に明記された将来タスクの設計判断（それは次の spec で詰める）
- **実装中に spec で詰められなかったことが判明したとき**: 実装を止めてユーザーに質問し、合意を得てから続ける

---

## 参照すべき rules

作業前に必ず確認：

- [merge-gate.md](./merge-gate.md) … main マージ前のゲート（grill・スモーク・公式照合）。TDD の外側ループ
- [agent-delegation.md](../rules/agent-delegation.md) … 実装を impl-agent へ委譲するルール
- テスト対象のインターフェース・型定義

{{PROJECT_RULES_LINKS}}

<!--
{{PROJECT_RULES_LINKS}} … プロジェクト固有の rules（テストコメント規約・リポジトリ構成・DB ルール等）が
`.claude/docs/rules/` にあれば列挙する。無ければ削除してよい（rules を書いたときに追記する）。
-->

---

## Step 1: Red フェーズ（失敗するテストを書く）

### テストファイルの配置

{{TEST_PLACEMENT}}

<!--
{{TEST_PLACEMENT}} … テストファイルの配置規約。テスト対象と同じディレクトリに置くのか
（JS/TS で一般的）、専用のテストルート配下に置くのか（Python の tests/ など）はスタックで
異なる。ファイル名の規約（{{TEST_FILE_PATTERN}}）とあわせて書く。
-->

### ボイラープレート

{{TEST_BOILERPLATE}}

<!--
{{TEST_BOILERPLATE}} … {{TEST_RUNNER}} でのテストの雛形をレイヤーごとに書く。
プロバイダーの wrapper・モックの張り方・fixture の置き方など、毎回コピーして使うものを載せる。
机上で書かず、最初の1本を実際に通してから、そのコードを写経元として貼ること。
-->

---

## Step 2: Green フェーズ（最小限の実装で通す）

1. `{{TEST_COMMAND}} <テストファイルパス>` で Red を確認
2. テストが通る **最小限の実装** だけ書く
3. 余分な処理・最適化は一切しない

### 実装ファイルの配置

{{FILE_PLACEMENT_TABLE}}

<!--
{{FILE_PLACEMENT_TABLE}} … 「どの種類のコードをどこに置くか」の表。
`.claude/docs/repository-structure/` があればそちらを正とし、ここからは参照リンクだけにしてもよい。
-->

---

## Step 3: Refactor フェーズ

- テストが全部 Green のまま整理する
- 重複するモック定義をまとめる
- 命名規約に揃える

---

## チェックリスト

**Red:**
- [ ] テストファイルを規約どおりの場所・名前で作成した
- [ ] 各 `it()` にフェーズコメントを書いた（プロジェクトのテストコメント規約に従う）
- [ ] `{{TEST_COMMAND}}` で Red を確認した

**Green:**
- [ ] 最小限の実装で全テストが通った
- [ ] 余分な処理を追加していない

**Refactor:**
- [ ] テストが全部 Green のままリファクタした
- [ ] 命名規約に沿っている
