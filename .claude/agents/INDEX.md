# agents/ 索引

| ドキュメント | 役割 |
|---|---|
| doc-push-agent | `.claude/` 配下（rules / skills / docs / CLAUDE.md）を更新して main に直接 push する専任エージェント |
| tsc-agent | TypeScript の型チェック専任エージェント（`pnpm tsc --noEmit` 実行） |

## スタック依存で未収録の agent

impl-agent（サーバー/クライアント実装専任）・review-agent（サーバー/クライアント静的レビュー専任）は、担当スコープ・使用ツール・テストパターンが各プロジェクトの技術スタックに強く依存するため、この repo にはひな形として収録していない。新規プロジェクトのブートストラップ時にスキャフォールディングスクリプトで生成する想定（未実装、TODO）。
