// .cjs 拡張子の理由: このファイルは core kit 経由で他プロジェクト（"type": "module" のもの・
// そうでないもの・package.json を持たない環境）へ配布される。ESM と CommonJS 両環境で
// require() 構文を動作させるには .cjs 拡張子で CommonJS として固定するのが必須。
//
// --context モードについて: kit-push-review-agent は --context でこのスクリプトを呼び出し、
// 返される JSON（layer・target_repo・digest）を verdict frontmatter にそのまま転記する。
// 層名の判定をこのスクリプト側に一元化することで、agent が層名を誤判定する余地を無くす。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// マーカー規則で層を判定する関数。kit かどうかの判定も含む。
// 層が判定できたら層名を返す、できなければ null を返す。
function resolveLayer(kitPath) {
  const manifestDir = path.join(kitPath, '.claude', 'manifests');

  if (fs.existsSync(manifestDir)) {
    const files = fs.readdirSync(manifestDir);
    for (const file of files) {
      // ファイル名が "<L>-kit-files.txt" にマッチしたら層名を捕捉
      const match = file.match(/^(.+)-kit-files\.txt$/);
      if (match) {
        const layer = match[1];
        const baseFile = path.join(manifestDir, `${layer}-kit-base.txt`);

        // base.txt が存在しなければこのリポジトリは層 L の kit（正）
        // （consumer リポジトリは files.txt も base.txt も両方持つため、
        //   base.txt なし = kit クローンの証）
        if (!fs.existsSync(baseFile)) {
          return layer;
        }
      }
    }
  }

  return null;
}

// digest 計算関数。agent とフックで同一ロジックを保証するため
// 関数化し、--context モードと通常モード双方で使用する。
function calculateDigest(kitPath) {
  const sh = (c) => execSync(c, { cwd: kitPath, encoding: 'utf8' });

  // origin/main との差分（作業ツリー比較）。tracked ファイルの変更・削除を拾う。
  // コミット前（未コミットの変更）とコミット後（working tree == HEAD）で同じ集合になる。
  // なぜ git status --porcelain ではなく origin/main 差分か: agent は Step 5（コピー後・
  // コミット前）に走り作業ツリーが dirty → 実際の内容から digest が出る。フックは
  // git push 時（コミット後）に走るため作業ツリーが clean → パス集合が空になり digest が
  // 潰れる。origin/main 差分ならコミット前後どちらでも同一集合が得られる。
  let changed = [];
  try {
    changed = sh('git diff --name-only origin/main').split('\n').filter(Boolean);
  } catch (e) {
    // origin/main ref が解決できない場合は失敗
    throw new Error(`origin/main との差分取得に失敗: ${e.message}`);
  }

  // 未追跡の新規ファイル。コミット後は上の diff 側に現れるため、和集合を取れば
  // どちらのタイミングでもパス集合は変わらない。
  const untracked = sh('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
  const paths = [...new Set([...changed, ...untracked])].sort();

  const lines = paths.map((p) => {
    const full = path.join(kitPath, p);
    // 作業ツリーの内容をハッシュ化する（コミット前後で同一）。削除済みは "deleted"。
    const content = fs.existsSync(full) ? fs.readFileSync(full) : Buffer.from('deleted');
    return crypto.createHash('sha256').update(content).digest('hex') + '  ' + p;
  });
  return crypto.createHash('sha256').update(lines.join('\n')).digest('hex');
}

// Bash コマンド文字列から「git push の対象リポジトリのパス」を取り出す。
// push が実行されないコマンドなら null を返す。
//
// コマンドを && / || / ; で区切り、各区間を先頭からトークン化して git のサブコマンドを見る。
// -C <path> / -c <k=v> / その他のオプションは読み飛ばし、最初の非オプション語を
// サブコマンドとみなす。それが push のときだけ対象とする。
// 対象パスの優先順位は git -C の値 > 直前の cd の値 > フックの cwd。
function extractPushTarget(cmd, cwd) {
  const unquote = (s) => (s ? s.replace(/^["']|["']$/g, '') : s);
  let cdPath = null;

  for (const segment of cmd.split(/&&|\|\||;/)) {
    const toks = segment.trim().split(/\s+/).filter(Boolean);
    if (toks.length === 0) continue;

    if (toks[0] === 'cd' && toks[1]) {
      cdPath = unquote(toks[1]);
      continue;
    }

    const gitIdx = toks.indexOf('git');
    if (gitIdx === -1) continue;

    let i = gitIdx + 1;
    let dashC = null;
    while (i < toks.length) {
      if (toks[i] === '-C') {
        dashC = unquote(toks[i + 1]);
        i += 2;
      } else if (toks[i] === '-c') {
        i += 2;
      } else if (toks[i].startsWith('-')) {
        i += 1;
      } else {
        break;
      }
    }

    if (toks[i] === 'push') {
      return dashC || cdPath || cwd || null;
    }
  }

  return null;
}

// モード1: --context <kitpath> 引数が渡されたら JSON を計算・出力して終了
// （agent がこのモードを呼ぶ。層名判定・digest 計算ロジックの単一ソース化）
if (process.argv[2] === '--context') {
  const kitPath = process.argv[3];
  try {
    const layer = resolveLayer(kitPath);
    if (!layer) {
      console.error(`kit と判定できません: ${kitPath}`);
      process.exit(1);
    }
    const targetRepo = path.basename(kitPath);
    const digest = calculateDigest(kitPath);
    const result = { layer, target_repo: targetRepo, digest };
    console.log(JSON.stringify(result));
    process.exit(0);
  } catch (e) {
    console.error(`context 生成エラー: ${e.message}`);
    process.exit(1);
  }
}

// モード2: Bash matcher。kit への git push をゲート
let d = '';
process.stdin.on('data', (c) => (d += c));
process.stdin.on('end', () => {
  const o = JSON.parse(d);
  const cmd = (o.tool_input || {}).command || '';
  const cwd = o.cwd || '';
  const agentType = o.agent_type;

  // 役割C（ベストエフォート）: verdict ファイルへの Bash リダイレクト検知
  // メイン Claude（agent_type なし）が steering/reviews/[..]-kit-push[...] へ
  // 書き込もうとしたら阻止（善意の誤動作対策）
  const verdictWritePattern =
    /(?:>>?|tee|cp|mv|sed\s+-i)\s+[^|;]*steering\/reviews\/[^|;]*kit-push/;
  if (verdictWritePattern.test(cmd)) {
    if (agentType !== 'kit-push-review-agent') {
      console.error(
        'kit-push verdict ファイルの書き込みは kit-push-review-agent 専用です。ゲートに阻まれた場合は agent を再起動してレビューを得てください。'
      );
      process.exit(2);
    }
  }

  // コマンドから push 対象の kit パスを抽出する。
  //
  // "push" の部分文字列一致では判定できない: ブランチ命名規約が kit-push/... のため、
  // git -C <kit> switch -c kit-push/... のような push でないコマンドにも当たってしまう。
  // git のサブコマンドとして push かどうかをトークン単位で見る。
  let kitPath = extractPushTarget(cmd, cwd);

  // push コマンドでなければ対象外
  if (!kitPath) {
    process.exit(0);
  }

  // 相対パスを絶対パスに変換
  if (!path.isAbsolute(kitPath)) {
    kitPath = path.resolve(cwd, kitPath);
  }

  // マーカー規則で kit かどうかと層を判定
  // （リポジトリ名をハードコードしない。ファイル名から層を判定する）
  const layerName = resolveLayer(kitPath);

  // kit ではない場合は何もせず通す
  if (!layerName) {
    process.exit(0);
  }

  // 現在の kit クローンの digest を計算
  let currentDigest;
  try {
    currentDigest = calculateDigest(kitPath);
  } catch (e) {
    console.error(`digest 計算エラー: ${e.message}`);
    process.exit(2);
  }

  // steering/reviews/*.md を走査し、clean verdict が存在するか確認
  const projectDir = process.env.CLAUDE_PROJECT_DIR || '';
  const reviewDir = path.join(projectDir, '.claude', 'steering', 'reviews');
  const targetRepo = path.basename(kitPath);
  let foundClean = false;

  if (fs.existsSync(reviewDir)) {
    const reviews = fs.readdirSync(reviewDir);

    for (const file of reviews) {
      if (!file.endsWith('.md')) continue;

      const filePath = path.join(reviewDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // YAML frontmatter をパース（--- から次の --- まで）
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;

        const fm = fmMatch[1];

        // 必要な frontmatter キーを抽出
        const verdictMatch = fm.match(/verdict:\s*(clean|contaminated)/);
        const layerMatch = fm.match(/layer:\s*(\S+)/);
        const targetMatch = fm.match(/target_repo:\s*(\S+)/);
        const digestMatch = fm.match(/digest:\s*(\S+)/);

        // すべての条件が一致 → clean verdict を見つけた
        if (
          verdictMatch &&
          verdictMatch[1] === 'clean' &&
          layerMatch &&
          layerMatch[1] === layerName &&
          targetMatch &&
          targetMatch[1] === targetRepo &&
          digestMatch &&
          digestMatch[1] === currentDigest
        ) {
          foundClean = true;
          break;
        }
      } catch (e) {
        // ファイル読み込みエラーは無視して次へ
      }
    }
  }

  if (!foundClean) {
    console.error(
      'kit への push には kit-push-review-agent による clean verdict が必要です。/kit-push で agent を起動してレビューを受けてください。（digest 不一致の場合はレビュー後にファイルが変更されています）'
    );
    process.exit(2);
  }

  // すべて OK
  process.exit(0);
});
