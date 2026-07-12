#!/usr/bin/env node
// .claude/manifests/hook-registrations.json の宣言を .claude/settings.json へマージする。
//
// なぜ必要か: フック本体（.claude/hooks/）は配布されるが、settings.json は配布できない
// （プロジェクトごとに permissions・MCP 設定が異なり、上書きすると壊れる）。その結果
// 「フックは配られているが一度も登録されておらず、一度も発火していない」状態が生まれる。
// 発火しないゲートは、無いより悪い（効いていると思い込むため）。
//
// このスクリプトは登録の「不足分だけ」を足す。既存エントリの変更・削除・並べ替えはしない。
// プロジェクト独自のフック登録（core が知らないもの）にも触れない。
//
// .cjs の理由: 配布先の package.json が "type": "module" でも、そもそも package.json が
// 無くても動く必要がある。
//
// 使い方:
//   node .claude/scripts/merge-hook-registrations.cjs           不足分を書き込む
//   node .claude/scripts/merge-hook-registrations.cjs --check   書き込まず、不足があれば exit 1
const fs = require('fs');
const path = require('path');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const manifestPath = path.join(root, '.claude', 'manifests', 'hook-registrations.json');
const settingsPath = path.join(root, '.claude', 'settings.json');
const checkOnly = process.argv.includes('--check');

if (!fs.existsSync(manifestPath)) {
  console.error(`宣言ファイルがありません: ${manifestPath}`);
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const registrations = manifest.registrations || [];

let settings = {};
if (fs.existsSync(settingsPath)) {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}
settings.hooks = settings.hooks || {};

// 登録済みかどうかは「command 文字列がそのフックのファイル名を含むか」で判定する。
// $CLAUDE_PROJECT_DIR の展開形やクォートの流儀がプロジェクトごとに違うため、
// コマンド文字列の完全一致では判定できない。
const added = [];

for (const reg of registrations) {
  const { event, matcher, hook } = reg;
  const basename = path.basename(hook);

  settings.hooks[event] = settings.hooks[event] || [];
  const group = settings.hooks[event];

  const alreadyRegistered = group.some((g) =>
    (g.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes(basename))
  );
  if (alreadyRegistered) continue;

  const entry = {
    type: 'command',
    command: `node "$CLAUDE_PROJECT_DIR/${hook}"`,
  };
  if (reg.if) entry.if = reg.if;
  if (reg.blocking) entry.blocking = true;

  // 同じ matcher のグループがあればそこへ足す。無ければグループごと作る。
  const target = group.find((g) => g.matcher === matcher);
  if (target) {
    target.hooks = target.hooks || [];
    target.hooks.push(entry);
  } else {
    group.push({ matcher, hooks: [entry] });
  }

  added.push(`${event} / ${matcher} / ${basename}`);
}

if (added.length === 0) {
  console.log('フック登録: 不足なし');
  process.exit(0);
}

if (checkOnly) {
  console.error('settings.json に未登録のフックがあります:');
  for (const a of added) console.error(`  - ${a}`);
  process.exit(1);
}

fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
console.log('settings.json に追記しました:');
for (const a of added) console.log(`  - ${a}`);
