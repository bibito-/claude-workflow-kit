# kit-push-guard-ci 実装仕様書

最終更新: 2026-07-12
ステータス: **実装完了（2026-07-12）**
実装対象リポジトリ: **claude-workflow-kit**（core の正）と **hono-auth-starter**（スタックの正）、および ai-todo（push スキル2本の編集元）

> この文書は利用プロジェクト側の `.claude/specs/` にあった spec を、実装されているリポジトリ（= ここ）へ移したもの。設計の置き場は、その設計が実装されているリポジトリとする。

## 概要

kit への反映を直 push から **PR 経路**に統一し、kit 側 CI で「古い base からの上書き（ロストアップデート）」と「コピー元プロジェクト固有の内容の混入」を機械検査する。

## 背景

現状の同期ガード（`base.txt` と kit の `origin/main` の照合）は **push する側が自分で自分を検査する**形であり、`base.txt` を書き換えるか、そもそも push スキルを踏まずに `cp` + `git push origin main` すれば素通りする。`workflow-kit-push.md` 自身が「誤操作を防ぐガードであり不正を防ぐものではない」と明言している。強制は kit 側にしか置けない。

具体的な事故の形: hono-user-point（2026-07-01 の template 複製以降、一度も同期していない）が starter の最新 main からブランチを切り、7/01 時点の古いファイルを載せて push すると、**祖先関係は最新のまま内容だけが巻き戻る**。starter は Template repo を兼ねるため、以降 template から作られる新規プロジェクト全部が巻き戻った内容を初期状態として受け取り、さらに ai-todo が次に pull すると巻き戻りが逆流する。

前提（2026-07-12 に完了済み）:

- hono-auth-starter を **public 化**（履歴監査済み。シークレット・固有識別子の混入なし。ai-todo のセキュリティスコア表は削除済み `972cace`）
- hono-auth-starter に ruleset `protect-main` を **Active** で設定（bypass 空・PR 必須・force push 禁止・削除禁止）
- claude-workflow-kit にも同じ ruleset を設定（ユーザー作業）

## 設計方針

| 項目 | 決定内容 | 理由 |
|---|---|---|
| PR のマージ操作 | CI green を Claude が確認したうえで、**マージはユーザーが実行**（`gh pr merge`） | 事故の最終的な検知手段は「他人の変更を消す hunk が diff に見える」こと。自動マージするとその diff を誰も見ず、branch protection を入れた意味が薄れる |
| 鮮度チェック | push スキルがコミットに **`Stack-Kit-Base:` / `Workflow-Kit-Base:` トレーラ**（= 押す側の `base.txt` の値）を埋め、kit 側 CI が kit の main HEAD と照合。不一致・トレーラ欠落は落とす | 「PR ブランチが main に追随しているか」だけでは事故を検知できない。最新 main から切ったブランチに古いファイルを載せても祖先関係は最新のまま。「押す側がどの時点の kit を取り込んだ状態でコピーしたか」はトレーラでしか表明できない。トレーラ欠落 = スキルを踏んでいない、も同時に弾ける |
| CI の置き場 | **各 kit に個別の YAML を直接置く**（マニフェストに載せない＝ consumer に配らない） | 配ると、実際に走るのは kit 2個だけなのに consumer 全部が「自分では絶対に使わないワークフロー」を持つ。加えて repo 名 → トレーラ名の対応表を YAML に持つ必要が出る。2ファイルの差は定数2つのみ |
| 固有名 grep | **PR の追加行のみ**を対象。`Kit-Grep-Mention: <理由>` トレーラがあれば警告に降格。理由が空なら落とす | ファイル全体の grep は初回から誤検知で赤くなる（現行 core に正当なヒットが6件ある）。追加行に絞れば既存の正当な記述は無視される。それでも正当な追加（禁止語パターンの定義そのもの・位置づけ図での consumer 列挙）はあるため宣言の口を用意する。**「例外を通す」ではなく「この語は言及であって依存ではない、と宣言する」もの**なので `Ack` ではなく `Mention` と名付ける |
| Required status checks | CI を ruleset の必須チェックに**登録する** | 登録しないと Required approvals = 0 のため CI が赤でも自分でマージでき、ガードが助言に留まる |
| PAT 依存の除去 | `stack-kit-pull-check.yml` の `secrets.STACK_KIT_PAT` を外す（今回のスコープに含める） | starter が public になり token なしで checkout できる |

### 実装時の変更: 鮮度チェックの適用範囲（2026-07-12・ユーザー承認）

鮮度チェック（トレーラ照合）は **マニフェスト掲載ファイルに触れる PR のみ**に適用する。spec 当初の「全 PR にトレーラを要求」では、hono-auth-starter が core の消費側として毎日受け取る `workflow-kit-pull/auto` の自動 PR（bot コミット・トレーラを付けられない）が永久にマージ不能になり、starter が core の更新を一切受け取れなくなる。starter 自身の `src/` や `ci.yml` を触るだけの通常 PR にトレーラを課すのも無意味な摩擦になる。

丸ごとコピーされる経路を持つのはマニフェスト掲載ファイルだけであり、ロストアップデートが起きうるのもそこだけ。stack と core のマニフェストが排他であることは実データで確認済み（`comm -12` で重複ゼロ）。

混入 grep は当初どおり全 PR の追加行に適用する。

### 了解済みの帰結

- **CI がバグって落ち続けると、kit に対して誰も何も反映できなくなる**（bypass 空・admin バイパスも無い）。復旧は ruleset を一時 Evaluate に落とすか、当該チェックを required から外す（どちらも GitHub UI でのユーザー操作）
- トレーラの詐称（手で書く）は防げない。防ぎたいのは誤操作であり、不正防止とは切り分ける
- PR オープン中に kit の main が進むと鮮度チェックが不一致になる。ブランチを作り直して再 push する（1人運用では稀）

## 検査の仕様（両 kit 共通）

ジョブ名は **`kit-push-guard`** に固定する（ruleset の required status check 名として参照するため）。

トリガ: `pull_request`（target: main）

| 検査 | 内容 | 失敗条件 |
|---|---|---|
| 鮮度 | マニフェスト掲載ファイルに触れる PR に対してのみ：PR ブランチの HEAD コミットのトレーラ `<Kit>-Base:` を読み、kit の `origin/main` HEAD と比較 | 対象 PR でトレーラが無い / SHA が main HEAD と不一致 |
| 混入 | `git diff origin/main...HEAD` の追加行（`+`）を禁止語で grep | ヒットあり、かつ HEAD コミットに `Kit-Grep-Mention: <理由>` が無い（理由が空文字も不可）。ヒットあり + 理由ありなら `::warning::` で通す |

| kit | トレーラ名 | 禁止語 |
|---|---|---|
| claude-workflow-kit | `Workflow-Kit-Base` | `wrangler\|cloudflare\|supabase\|\bhono\b`（スタック用語の core への漏れ） |
| hono-auth-starter | `Stack-Kit-Base` | `ai-todo\|hono-user-point\|cloudflare-actions`（プロジェクト固有名） |

> **自己適用の注意**: このワークフローを追加する PR 自身も検査対象になる。YAML の中に禁止語リストを書くため、追加行 grep に自分でヒットする。当該コミットに `Kit-Grep-Mention: 禁止語パターンの定義そのもの` を付ける（仕組みの初回動作確認を兼ねる）。

## 実装ステップ

### Step 1 — claude-workflow-kit に `kit-push-guard.yml` を追加

対象: `claude-workflow-kit/.github/workflows/kit-push-guard.yml`（新規）

ブランチを切って PR を作る（ruleset により直 push 不可）。コミットには `Workflow-Kit-Base:`（現 main HEAD）と `Kit-Grep-Mention:` を付ける。マージはユーザー。

✅ 完了: claude-workflow-kit PR #1

### Step 2 — hono-auth-starter に `kit-push-guard.yml` を追加

対象: `hono-auth-starter/.github/workflows/kit-push-guard.yml`（新規）

Step 1 と同内容で、トレーラ名と禁止語のみ差し替える。**マニフェスト（`stack-kit-files.txt`）には追加しない。**

✅ 完了: hono-auth-starter PR #8

### Step 3 — ruleset に required status check を登録（ユーザー作業）

両 kit の `protect-main` ruleset で **Require status checks to pass** を有効にし、`kit-push-guard` を追加する。

✅ 完了: 両 kit の ruleset に required status check `kit-push-guard` を登録済み

### Step 4 — push スキル2本を PR 経路に書き換え

対象: `.claude/skills/stack-kit-push.md` / `.claude/skills/workflow-kit-push.md`（ai-todo で編集 → doc-push → 各 kit へ PR で反映）

Step 6（コミットして push する）を次の形に置き換える。

1. `git switch -c kit-push/<yyyymmdd>-<要約>`
2. 対象ファイルのみ `git add` → コミット（トレーラ `<Kit>-Base: <base.txt の値>` を必ず含める。必要なら `Kit-Grep-Mention:` も）
3. `git push -u origin <branch>` → `gh pr create`
4. CI（`kit-push-guard`）green を確認して報告し、**マージはユーザーに依頼**する（`gh pr merge <n> --squash`）
5. マージ後、Step 7（base SHA 更新）へ

Step 3（base SHA 検証）は残す。push 側の自己検査を消すのではなく、kit 側の強制を上に重ねる。

✅ 完了: ai-todo main `70f50eb` で編集・doc-push で両 kit へ配布 → PR #2・#9

### Step 5 — PAT 依存の除去

対象: `.github/workflows/stack-kit-pull-check.yml`（40行目 `token: ${{ secrets.STACK_KIT_PAT }}` と、private 前提を説明するコメント）

starter が public になったため不要。マニフェスト対象ファイルなので、ai-todo で編集 → `/stack-kit-push`（PR 経路）→ 各 consumer へ pull で配布される。

> consumer repo に登録済みの `STACK_KIT_PAT` シークレット自体の削除は、必要ならユーザーが GitHub UI で行う（Claude は実行しない）。

✅ 完了: ai-todo PR #83 で編集・PR #2・#9 で配布

### Step 6 — base SHA 更新と検証

マージ後の kit の main HEAD を `.claude/manifests/*-base.txt` に書き戻す（doc-push-agent へ委譲）。

✅ 完了: ai-todo `6cce331`（base = workflow-kit `8ebb2b95b010e09678136c5bce1360d1b3f63cfa` / stack `d6e29b1d2ac8597df8f64a6b2ba490d7ffbc2856`）

### 実装時に見つかった不具合

追加行の抽出に使っていた `grep -v '^\+\+\+'` は BRE として不正で grep が exit 2 で異常終了し、それを `|| true` が飲み込むため、混入チェックが常に「禁止語なし」を返して素通りしていた。抽出は awk に置き換え、grep は照合だけに使って exit 2 を明示的に落とすようにした。ローカルで CI と同一ロジックを空回ししなければ、green のまま検査が無効化されていたことに気づけなかった。

## 検証

1. **鮮度チェックが落ちること**: ✅ CI と同一ロジックをローカルで空回しして全経路確認
2. **トレーラ欠落が落ちること**: ✅ CI と同一ロジックをローカルで空回しして全経路確認
3. **grep が追加行だけを見ていること**: ✅ CI と同一ロジックをローカルで空回しして全経路確認
4. **`Kit-Grep-Mention` が効くこと**: ✅ claude-workflow-kit PR #1・hono-auth-starter PR #8 の実 CI で warning 降格を確認
5. **正常系**: ✅ claude-workflow-kit PR #2・hono-auth-starter PR #9 で鮮度チェック発火・green を確認

## 関連ファイル

```
claude-workflow-kit/
└── .github/workflows/kit-push-guard.yml   （新規・配布しない）

hono-auth-starter/
└── .github/workflows/kit-push-guard.yml   （新規・配布しない）

ai-todo/
├── .claude/skills/stack-kit-push.md       （Step 6 を PR 経路へ）
├── .claude/skills/workflow-kit-push.md    （同上）
├── .github/workflows/stack-kit-pull-check.yml  （PAT 依存の除去）
└── .claude/manifests/{stack,workflow}-kit-base.txt  （マージ後に更新）
```

## 押さえるべき要点

### トレーラは PR の HEAD コミットにしか効かない

`kit-push-guard` は `git log -1` で HEAD コミットのトレーラを読む。したがって CI が赤くて修正コミットを積むと、新しい HEAD にトレーラが無くなり、今度は「トレーラ欠落」で落ちる。同じ PR 内で直す限り赤いままになる。

修正は `git commit --amend --no-edit` + `git push --force-with-lease` で HEAD を差し替える（push スキルの Step 7 に明記済み）。

「PR 内の全コミットを走査してどれか1つにトレーラがあれば可」とする案は採らなかった。古いトレーラを持つコミットが1つ紛れているだけで通ってしまい、鮮度チェックの意味が弱まるため。1コミット = 1回の同期、という単位を保つ。

### 赤くなる条件は4つ

| # | 条件 | 検査 |
|---|---|---|
| 1 | マニフェスト掲載ファイルに触れる PR なのに HEAD コミットに `<Kit>-Base:` トレーラが無い | 鮮度 |
| 2 | トレーラの SHA が kit の main HEAD と一致しない（古い base からのコピー、または PR を開いている間に main が進んだ） | 鮮度 |
| 3 | 追加行が禁止語にヒットし、HEAD コミットに `Kit-Grep-Mention:` トレーラが無い | 混入 |
| 4 | マニフェストファイルが見つからない / grep が異常終了した | 検査の自己防衛 |

トレーラが要るのは **kit へ向けた PR だけ**。ai-todo 側の PR には `kit-push-guard` を入れていないためトレーラは不要。

## 運用ゲート

- grill-gate: **適用**（2026-07-12 にユーザー選択）
