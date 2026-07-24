# docs/ 索引

このリポジトリ自身の設計記録。**配布ペイロードではない**（`.claude/manifests/workflow-kit-files.txt` に載せない）。

| ドキュメント | 内容 |
|---|---|
| [kit-push-gate.md](kit-push-gate.md) | kit への push ゲート。審査 agent・PreToolUse フック・git の pre-push・verdict と digest・フック登録の配布 |
| [kit-push-guard-ci.md](kit-push-guard-ci.md) | CI 側の検査。鮮度（base トレーラ）と禁止語 grep、ruleset `protect-main` |
| [ci-review-agent-migration.md](ci-review-agent-migration.md) | **未実装の構想。** 混入審査を CI へ移す案。フックが Claude しか縛らない非対称性と、基準文の出所・LLM を required check にする非決定性という未解決問題 |
| [template-scaffold.md](template-scaffold.md) | `template/` の骨格と scaffold スクリプト。新規プロジェクトへの core / template の導入 |
| [scaffold-onboarding.md](scaffold-onboarding.md) | `scaffold.sh` が既存プロジェクトに安全な根拠・base.txt 三方向比較のハザード・実行検証ログ |

## 置き場のルール

設計文書は、**その設計が実装されているリポジトリ**に置く。以前はすべて利用プロジェクト（実験場）の `.claude/specs/` にあったが、実装がここにある以上、記録もここに置く。

`.claude/` 配下ではなくリポジトリ直下に置いているのは、`.claude/` が配布ペイロードの領域だから。そこに非配布物を混ぜると、マニフェストにディレクトリ行を足した瞬間に設計文書まで全 consumer へ配られる事故を招く。
