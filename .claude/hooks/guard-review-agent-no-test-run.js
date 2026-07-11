let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  const o = JSON.parse(d);
  const cmd = (o.tool_input || {}).command || '';
  // review-agent は静的レビュー専任のため、テスト実行・型チェックは
  // impl-agent / 型チェック agent(tsc-agent・mypy-agent) の担当領域であり
  // review-agent 側での実行を禁止する。
  // JS/TS: vitest・jest・tsc・pnpm test / Python: pytest・mypy・pyright
  const forbidden = /\b(vitest|jest|tsc|pytest|mypy|pyright)\b|\b(pnpm|npm|yarn|uv)\s+(run\s+)?test\b/i;
  if (forbidden.test(cmd)) {
    console.error('禁止: review-agentはテスト・型チェックを実行しない（静的レビュー専任。テストはimpl-agent、型チェックはtsc-agent/mypy-agentが担当）');
    process.exit(2);
  }
});
