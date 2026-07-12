# Git hooks の有効化

この kit クローンで次を一度実行する。

```bash
git config core.hooksPath .githooks
```

これにより `pre-push` が Git 自身から毎回起動され、Claude Code の Bash コマンド解析を経由しない publish も clean verdict なしでは拒否される。

この `.githooks/` は kit リポジトリのローカル保護用であり、配布ペイロードではない。配布対象は `.claude/manifests/workflow-kit-files.txt` に列挙された `.claude/` 内のファイルだけで、そこには `.githooks/` は含まれない。
