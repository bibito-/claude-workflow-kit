#!/usr/bin/env bash
# claude-workflow-kit の template（骨格ファイル群）を新規プロジェクトへ一度だけ取り込むスクリプト。
#
# 使い方: 対象プロジェクトのルートで実行する
#   ../claude-workflow-kit/scripts/scaffold-template.sh
#
# scaffold.sh（core）との違い:
#   core     … base.txt を書き、以後 CI（pull-check）が kit との差分を追い続ける
#   template … base.txt もマニフェストも書かない。取り込んだ骨格はプロジェクトが
#              自分のスタックに合わせて書き換えるものであり、以後 kit から同期しない
#              （＝ CI の走査対象外であることが構造的に担保される）
#
# ファイル配置とレポートのみを行い、対話質問・プレースホルダ置換・git 操作は一切しない。
# 骨格の穴埋めは、このスクリプトが一緒に配置する /template-setup スキルが担う。
# 既存ファイルは上書きせずスキップし、最後に一覧報告する（再実行しても安全）。
set -euo pipefail

KIT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_ROOT="$KIT_ROOT/template"
CORE_MANIFEST=".claude/manifests/workflow-kit-files.txt"
# 穴埋め手順書。プレースホルダ名を本文で参照しているため、残存プレースホルダ走査からは除く。
SETUP_SKILL=".claude/skills/template-setup.md"

created=()
skipped_same=()
skipped_diff=()
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
if [ ! -d "$TEMPLATE_ROOT" ]; then
  echo "エラー: template ツリーが見つかりません: $TEMPLATE_ROOT" >&2
  exit 1
fi

echo "kit:      $KIT_ROOT"
echo "template: $TEMPLATE_ROOT"
echo "target:   $(pwd)"
echo

# core 未導入でも配置自体はできるが、骨格は core（merge-gate・doc-push-agent・
# guard-review-agent-no-test-run.js）を参照するため、そのままでは参照切れになる。
if [ ! -f "$CORE_MANIFEST" ]; then
  notes+=("core が未導入です（$CORE_MANIFEST が無い）。骨格は core の merge-gate / doc-push-agent / hooks を参照するため、先に scaffold.sh を実行してください")
fi

# --- Step 2: template 配下をコピー ---
#
# マニフェストは持たない。template/ ディレクトリの存在自体が対象定義であり、
# 二重管理（ツリーと一覧の不一致）を作らない。

copy_file() {
  local rel="$1"
  local src="$TEMPLATE_ROOT/$rel"
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

while IFS= read -r f; do
  copy_file "${f#"$TEMPLATE_ROOT"/}"
done < <(find "$TEMPLATE_ROOT" -type f | sort)

# --- Step 3: 残存プレースホルダの走査 ---
#
# 「作成」だけでなく「スキップ（同一）」「スキップ（差分あり）」も走査する。
# 同一 = 骨格のまま未着手、差分あり = 部分的に埋めた可能性があり、どちらも穴が残りうる。

placeholders=()
scan_placeholders() {
  local rel="$1"
  [ "$rel" = "$SETUP_SKILL" ] && return
  [ -f "./$rel" ] || return
  while IFS= read -r hit; do
    placeholders+=("$rel:$hit")
  done < <(grep -no '{{[A-Z_][A-Z0-9_]*}}' "./$rel" || true)
}

for rel in ${created[@]+"${created[@]}"} ${skipped_same[@]+"${skipped_same[@]}"} ${skipped_diff[@]+"${skipped_diff[@]}"}; do
  scan_placeholders "$rel"
done

# --- Step 4: 最終レポート ---

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

echo "==== scaffold-template 結果 ===="
echo
report_list "作成" ${created[@]+"${created[@]}"}
report_list "スキップ（kit と同一）" ${skipped_same[@]+"${skipped_same[@]}"}
report_list "スキップ（差分あり・手動で確認）" ${skipped_diff[@]+"${skipped_diff[@]}"}
report_list "残っているプレースホルダ" ${placeholders[@]+"${placeholders[@]}"}
report_list "補足" ${notes[@]+"${notes[@]}"}

cat <<'EOF'
==== 次のアクション ====

1. Claude Code で `/template-setup` を実行して骨格を埋める
   （レイヤー構成・テストランナーを調査し、impl-agent / review-agent をレイヤーごとに複製する。
     完了後 template-setup.md 自身は削除される）

2. 内容を確認のうえ、コミット対象を明示列挙して git add → commit する
   （git add -A は使わない）

注意: template は core と違い、以後 kit から同期されない（base.txt もマニフェストも書かない）。
      取り込んだ骨格はこのプロジェクトの資産として自由に書き換えてよい。
EOF
