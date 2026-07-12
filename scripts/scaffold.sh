#!/usr/bin/env bash
# claude-workflow-kit を未導入プロジェクトに導入するスキャフォールディングスクリプト。
#
# 使い方: 対象プロジェクトのルートで実行する
#   ../claude-workflow-kit/scripts/scaffold.sh
#
# ファイル配置とレポートのみを行い、git 操作（add/commit/push）は一切しない。
# 既存ファイルは上書きせずスキップし、最後に一覧報告する（再実行しても安全）。
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST_REL=".claude/manifests/workflow-kit-files.txt"
MANIFEST="$KIT_ROOT/$MANIFEST_REL"
BASE_FILE=".claude/manifests/workflow-kit-base.txt"

created=()
skipped_same=()
skipped_diff=()
gitignore_added=()
notes=()

# --- Step 1: 前提チェック ---

if ! toplevel="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "エラー: git リポジトリ内で実行してください（対象プロジェクトのルートで実行する）" >&2
  exit 1
fi
if [ "$toplevel" != "$(pwd -P)" ] && [ "$toplevel" != "$(pwd)" ]; then
  echo "エラー: リポジトリのルート（$toplevel）で実行してください" >&2
  exit 1
fi
if [ "$(pwd)" = "$KIT_ROOT" ]; then
  echo "エラー: kit リポジトリ自身には実行できません。対象プロジェクトのルートで実行してください" >&2
  exit 1
fi
if [ ! -f "$MANIFEST" ]; then
  echo "エラー: マニフェストが見つかりません: $MANIFEST" >&2
  exit 1
fi

echo "kit:    $KIT_ROOT"
echo "target: $(pwd)"
echo

# --- Step 2: ディレクトリ作成（冪等） ---

mkdir -p \
  .claude/agents \
  .claude/commands \
  .claude/docs/rules \
  .claude/hooks \
  .claude/manifests \
  .claude/rules \
  .claude/skills \
  .claude/specs \
  .claude/steering \
  .github/workflows

# --- Step 3: .gitignore 追記（行単位で冪等） ---

ensure_gitignore_line() {
  local line="$1"
  if ! grep -qxF "$line" .gitignore 2>/dev/null; then
    echo "$line" >>.gitignore
    gitignore_added+=("$line")
  fi
}

ensure_gitignore_line ".claude/steering/"
ensure_gitignore_line ".claude/worktrees/"
ensure_gitignore_line "/docs/"

# --- Step 4: core ファイルコピー ---

copy_file() {
  local rel="$1"
  local src="$KIT_ROOT/$rel"
  local dst="./$rel"
  if [ -e "$dst" ]; then
    if cmp -s "$src" "$dst"; then
      skipped_same+=("$rel")
    else
      skipped_diff+=("$rel")
    fi
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    created+=("$rel")
  fi
}

while IFS= read -r line; do
  # 空行・コメント行はスキップ
  [ -z "$line" ] && continue
  case "$line" in \#*) continue ;; esac

  if [[ "$line" == */ ]]; then
    # ディレクトリ行: 配下の全ファイルを個別に同ロジックでコピー
    if [ ! -d "$KIT_ROOT/$line" ]; then
      notes+=("マニフェスト記載のディレクトリが kit に存在しません: $line")
      continue
    fi
    while IFS= read -r f; do
      copy_file "${f#"$KIT_ROOT"/}"
    done < <(find "$KIT_ROOT/$line" -type f | sort)
  else
    if [ ! -f "$KIT_ROOT/$line" ]; then
      notes+=("マニフェスト記載のファイルが kit に存在しません: $line")
      continue
    fi
    copy_file "$line"
  fi
done <"$MANIFEST"

# --- Step 5: steering/ 初期ファイル生成（既存あればスキップ） ---

if [ ! -e .claude/steering/current.md ]; then
  cat >.claude/steering/current.md <<'EOF'
# 進行中タスク

進行中のタスクなし。

## 完了履歴

過去の完了ログは [history.md](history.md) を参照。
EOF
  created+=(".claude/steering/current.md（gitignore 対象・コミット対象外）")
fi

if [ ! -e .claude/steering/history.md ]; then
  cat >.claude/steering/history.md <<'EOF'
# 完了履歴

（まだ記録なし）
EOF
  created+=(".claude/steering/history.md（gitignore 対象・コミット対象外）")
fi

# --- Step 6: base.txt 初期化 ---

if [ ${#skipped_diff[@]} -gt 0 ]; then
  notes+=("kit と差分のある既存ファイルがあるため $BASE_FILE を書きません。/workflow-kit-pull または /workflow-kit-push で差分を解決してから base を設定してください")
elif [ -f "$BASE_FILE" ]; then
  notes+=("$BASE_FILE は既に存在するため上書きしません")
else
  git -C "$KIT_ROOT" rev-parse HEAD >"$BASE_FILE"
  created+=("$BASE_FILE（kit HEAD: $(git -C "$KIT_ROOT" rev-parse --short HEAD)）")
fi

# --- Step 7: 最終レポート ---

report_list() {
  local title="$1"
  shift
  echo "## $title ($#)"
  local item
  for item in "$@"; do
    echo "  - $item"
  done
  [ $# -eq 0 ] && echo "  （なし）"
  echo
}

echo "==== scaffold 結果 ===="
echo
report_list "作成" ${created[@]+"${created[@]}"}
report_list ".gitignore 追記" ${gitignore_added[@]+"${gitignore_added[@]}"}
report_list "スキップ（kit と同一）" ${skipped_same[@]+"${skipped_same[@]}"}
report_list "スキップ（差分あり・要手動解決）" ${skipped_diff[@]+"${skipped_diff[@]}"}
report_list "補足" ${notes[@]+"${notes[@]}"}

cat <<'EOF'
==== 残りの手動作業 ====

1. リポジトリ設定「Allow GitHub Actions to create and approve pull requests」を有効化する
   （Settings → Actions → General → Workflow permissions）

2. hooks を発火させるため settings.json に登録する

     node .claude/scripts/merge-hook-registrations.cjs

   settings.json は core 配布対象外（プロジェクトごとに permissions・MCP 設定が
   異なり、上書きすると壊れる）。しかし登録が無ければフックは一度も発火しない。
   発火しないゲートは、無いより悪い。

   このスクリプトが hook-registrations.json の宣言を読み、不足している登録だけを
   settings.json に追記する。既存エントリ・permissions・プロジェクト独自のフック
   登録には触れない。冪等。

   手で書く必要はない。--check を付けると書き込まず、不足があれば報告する。

3. 配置されたファイルの内容を確認のうえ、コミット対象を明示列挙して git add → commit する
   （git add -A は使わない）
EOF
