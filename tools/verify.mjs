#!/usr/bin/env node
/* 76-Club 検証ハーネス（reviewer / implementer 共用）
   使い方: node tools/verify.mjs [--refactor <gitref>]
   チェック: JS構文 / i18n ja=zh=en 完全一致・空値・en日本語残存 / 使用キー未定義参照 / 未使用キー / CSS孤立var() / 計算回帰(#3・Vegas)
   --refactor <gitref>（例 origin/main）: 挙動不変リファクタPR用の追加チェック。
     指定 ref と作業ツリーの js/*.js＋styles.css を「トリム後の非空行のマルチセット」としてファイル横断で合算比較する
     （分割・移動は行の所属ファイルが変わるだけ＝合算マルチセットは一致するはず）。通常実行には影響しない。
   すべて PASS で exit 0、1つでも失敗で exit 1。 */
import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const root = process.cwd();
let fails = 0;
const ok  = (m) => console.log('  ✅ ' + m);
const bad = (m) => { console.log('  ❌ ' + m); fails++; };

const html = fs.readFileSync(root + '/index.html', 'utf8');
const order = [...html.matchAll(/<script src="js\/([^."]+)\.js(?:\?[^"]*)?">/g)].map(m => m[1]);   // ?v=NN のキャッシュバスティング付きも検出（#75）
const combined = order.map(n => fs.readFileSync(`${root}/js/${n}.js`, 'utf8')).join('\n');

// 1) 構文
console.log('■ JS構文');
try {
  fs.writeFileSync('/tmp/_verify_bundle.js', combined);
  execSync('node --check /tmp/_verify_bundle.js', { stdio: 'pipe' });
  ok(`連結JS(${order.length}モジュール)構文OK`);
} catch (e) { bad('構文エラー: ' + String(e.stderr || e).slice(0, 300)); }

// 2) i18n
console.log('■ i18n');
let I18N = null;
try {
  const src = fs.readFileSync(root + '/js/i18n.js', 'utf8');
  const i = src.indexOf('I18N'); const s = src.indexOf('{', i);
  let d = 0, e = -1;
  for (let p = s; p < src.length; p++) { const c = src[p]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { e = p; break; } } }
  I18N = eval('(' + src.slice(s, e + 1) + ')');
  const ja = Object.keys(I18N.ja), zh = Object.keys(I18N.zh), en = Object.keys(I18N.en);
  if (ja.length === zh.length && ja.length === en.length) ok(`キー数一致 ${ja.length}`); else bad(`キー数不一致 ja=${ja.length} zh=${zh.length} en=${en.length}`);
  const missZh = ja.filter(k => !(k in I18N.zh)), missEn = ja.filter(k => !(k in I18N.en));
  if (!missZh.length && !missEn.length) ok('ja基準の欠落なし'); else bad(`欠落 zh=${JSON.stringify(missZh.slice(0,6))} en=${JSON.stringify(missEn.slice(0,6))}`);
  const empty = ['ja','zh','en'].flatMap(l => ja.filter(k => !I18N[l][k]));
  empty.length ? bad(`空値 ${empty.length}件`) : ok('空値なし');
  const hira = /[぀-ゟ]/; // ひらがな = 未翻訳の目印（中黒・は許容）
  const enJp = ja.filter(k => hira.test(I18N.en[k] || ''));
  enJp.length ? bad(`en に日本語残存 ${JSON.stringify(enJp.slice(0,6))}`) : ok('en日本語残存なし');
} catch (err) { bad('I18N 解析失敗: ' + err.message); }

// 3) 使用キー未定義参照
console.log('■ i18n 使用キー');
try {
  let scan = html; for (const f of fs.readdirSync(root + '/js')) scan += fs.readFileSync(`${root}/js/${f}`, 'utf8');
  const jaSet = new Set(Object.keys(I18N.ja));
  const attr = [...scan.matchAll(/data-i18n(?:-ph|-title)?="([^"]+)"/g)].map(m => m[1]);
  const calls = [...scan.matchAll(/\bt\(\s*(['"])([^'"]+)\1/g)].map(m => m[2]);
  const used = [...new Set([...attr, ...calls])].filter(k => !k.endsWith('.')); // 末尾. は動的連結
  const miss = used.filter(k => !jaSet.has(k));
  miss.length ? bad(`未定義参照 ${JSON.stringify(miss.slice(0,10))}`) : ok(`未定義参照なし（使用${used.length}種）`);
} catch (err) { bad('使用キー走査失敗: ' + err.message); }

// 3b) 未使用 i18n キー（定義されているのに js/** と index.html のどこからも参照されないキー）
console.log('■ i18n 未使用キー');
try {
  // 辞書リテラルの範囲を再抽出（この範囲は走査対象から除外＝キー定義自身を「使用」と誤認しない）
  const isrc = fs.readFileSync(root + '/js/i18n.js', 'utf8');
  const di = isrc.indexOf('I18N'); const ds = isrc.indexOf('{', di);
  let dd = 0, de = -1;
  for (let p = ds; p < isrc.length; p++) { const c = isrc[p]; if (c === '{') dd++; else if (c === '}') { dd--; if (dd === 0) { de = p; break; } } }
  let scan = html;
  for (const f of fs.readdirSync(root + '/js')) {
    let t = fs.readFileSync(`${root}/js/${f}`, 'utf8');
    if (f === 'i18n.js') t = t.slice(0, ds) + t.slice(de + 1);   // 辞書部分だけ除外（t() 実装等の残部は走査する）
    scan += '\n' + t;
  }
  /* 動的キー連結の allowlist（コードに実在する連結呼び出しのみ列挙。プレフィックス一致で「使用扱い」）:
     - 'ch.'         … home.js renderHome の t('ch.'+c) / t('ch.'+c+'.desc') / t('ch.enter',{v:t('ch.'+c)})、
                       nav.js toggleChannel/render の t('ch.'+CHANNEL)（c,CHANNEL ∈ {a,b}）
     - 'tab.'        … nav.js の tabLabel = k => t('tab.'+k)
     - 'result.sub.' … results.js renderResult の grpBtn: t('result.sub.'+k)（k ∈ ind/team/pts） */
  const DYN_PREFIX = ['ch.', 'tab.', 'result.sub.'];
  /* 既知の未参照キー（グランドファーザー）: i18n 既存キーは互換維持（CLAUDE.md）のため辞書からは削除しない。
     削除は別途 Issue で判断。ここに載せた分は検出から除外＝新規の未使用キーは引き続き FAIL する。
     - 'team.emptyFmt' … 2026-08-30 時点で参照なし（m1.emptyFmt のみ使用・過去のリニューアルで参照が消えた模様） */
  const KNOWN_UNUSED = ['team.emptyFmt'];
  const escRe = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const jaKeys = Object.keys(I18N.ja);
  const unused = jaKeys.filter(k =>
    !DYN_PREFIX.some(p => k.startsWith(p)) &&
    !KNOWN_UNUSED.includes(k) &&
    !new RegExp(`['"\`]${escRe(k)}['"\`]`).test(scan));   // 引用符で囲まれた完全一致＝リテラル参照（data-i18n / t() / 配列・マップ値を包括）
  unused.length ? bad(`未使用キー ${unused.length}件 ${JSON.stringify(unused.slice(0, 10))}`)
                : ok(`未使用キーなし（定義${jaKeys.length}・動的prefix${DYN_PREFIX.length}・既知除外${KNOWN_UNUSED.length}）`);
} catch (err) { bad('未使用キー走査失敗: ' + err.message); }

// 4) CSS 孤立 var()
console.log('■ CSS トークン');
try {
  const css = fs.readFileSync(root + '/styles.css', 'utf8');
  const def = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  const usedV = [...new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map(m => m[1]))];
  const orphan = usedV.filter(v => !def.has(v));
  orphan.length ? bad(`孤立var() ${JSON.stringify(orphan)}`) : ok(`孤立var()なし（定義${def.size}/使用${usedV.length}）`);
  /html\[data-theme="dark"\]/.test(css) ? ok('dark上書きブロックあり') : bad('dark上書きブロックなし');
} catch (err) { bad('CSS走査失敗: ' + err.message); }

// 5) 計算回帰
console.log('■ 計算回帰');
try {
  const grab = (n) => { const m = combined.match(new RegExp('function ' + n + '\\b[\\s\\S]*?\\n}', 'm')); if (!m) throw new Error('missing ' + n); return m[0]; };
  const need = ['parTotal','gross','periaHdcp','enteredCount','everyStrokes','womenEvery','effGross','evPer','adjArr','adjHole','netScore','vegasPair','vAdj','vegasBase','vegasBirdie','vegasHoleNet'];
  const sb = { state: { players: [] }, Math, console };
  let src = 'function sum(a,s,e){let x=0;for(let i=s;i<e;i++)x+=(a[i]?Number(a[i]):0);return x;}\n';
  need.forEach(n => src += grab(n) + '\n');
  src += 'globalThis.F={periaHdcp,netScore,effGross,vegasHoleNet};';
  vm.runInContext(src, vm.createContext(sb));
  const F = sb.F;
  // #3: エブリ2・par72・全ホール6打 → 隠し12合計72 → HDCP 0（エブリ後基準）・net 72
  const par = Array(18).fill(4); const hid = Array(18).fill(false); for (let i = 0; i < 12; i++) hid[i] = true;
  sb.state.players = [{ id: 'E2', everyType: 'every2' }];
  const g = { par, hidden: hid, periaCoef: 0.8, periaCap: null, womenEvery: { enabled: true }, scores: { E2: Array(18).fill(6) } };
  const hd = F.periaHdcp(g, 'E2'), nt = F.netScore(g, 'E2');
  (hd === 0 && nt === 72) ? ok(`#3 エブリ後基準 HDCP=${hd} net=${nt}`) : bad(`#3 期待HDCP0/net72 実際 HDCP=${hd}/net=${nt}`);
  // Vegas ワーク例: A=3&5 / B=4&6, Aバーディ → netA=29
  sb.state.players = ['a1','a2','b1','b2'].map(id => ({ id, everyType: 'none' }));
  const gv = { par: Array(18).fill(4), womenEvery: { enabled: true }, vegas: { flip: true, cap: 'doublePar' }, participants: ['a1','a2','b1','b2'], scores: { a1: [3], a2: [5], b1: [4], b2: [6] }, teams: [{ id: 'A', memberIds: ['a1','a2'] }, { id: 'B', memberIds: ['b1','b2'] }] };
  const net = F.vegasHoleNet(gv, gv.teams[0], gv.teams[1], 0);
  (net === 29) ? ok(`Vegas netA=${net}`) : bad(`Vegas 期待29 実際 ${net}`);
} catch (err) { bad('計算回帰失敗: ' + err.message); }

// 6) --refactor <gitref>: 挙動不変リファクタの行マルチセット一致（フラグ指定時のみ・通常実行は素通り）
//    比較対象 = js/*.js ＋ styles.css。各行を trim → 非空行のみ → ファイル横断で合算した多重集合を ref と比較する。
//    ファイル分割・移動（行の所属ファイルが変わるだけ）は一致のまま、行の追加・削除・書き換えは差分として出る。
//    新規ファイルは作業ツリー側にのみ存在してよい（合算比較なので自然に扱える）。
const rfIdx = process.argv.indexOf('--refactor');
if (rfIdx >= 0) {
  const ref = process.argv[rfIdx + 1] || 'origin/main';   // 省略時は origin/main
  console.log(`■ リファクタ行一致（vs ${ref}）`);
  try {
    const targets = (files) => files.filter(f => f === 'styles.css' || /^js\/[^/]+\.js$/.test(f));
    const refFiles = targets(execSync(`git ls-tree -r --name-only ${JSON.stringify(ref)} -- js styles.css`, { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean));
    const wtFiles = targets([...fs.readdirSync(root + '/js').map(f => 'js/' + f), 'styles.css'].filter(f => fs.existsSync(root + '/' + f)));
    const bag = (texts) => { const m = new Map();
      for (const t of texts) for (const raw of t.split('\n')) { const l = raw.trim(); if (l) m.set(l, (m.get(l) || 0) + 1); }
      return m; };
    const refBag = bag(refFiles.map(f => execSync(`git show ${JSON.stringify(ref + ':' + f)}`, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })));
    const wtBag = bag(wtFiles.map(f => fs.readFileSync(root + '/' + f, 'utf8')));
    const diff = (a, b) => { const out = []; for (const [l, n] of a) { const d = n - (b.get(l) || 0); if (d > 0) out.push([l, d]); } return out; };
    const lost = diff(refBag, wtBag), added = diff(wtBag, refBag);   // lost=ref にのみ / added=作業ツリーにのみ
    const nOf = (d) => d.reduce((a, [, n]) => a + n, 0);
    const sample = (d) => d.slice(0, 5).map(([l, n]) => `  ${n > 1 ? `(x${n}) ` : ''}${l.length > 120 ? l.slice(0, 120) + '…' : l}`).join('\n');
    if (!lost.length && !added.length) ok(`行マルチセット一致（ref ${refFiles.length}ファイル / 作業ツリー ${wtFiles.length}ファイル）`);
    else {
      bad(`行マルチセット不一致 消失${nOf(lost)}行 / 新規${nOf(added)}行`);
      if (lost.length) console.log(`  --- 消失行サンプル（${ref} にのみ存在）---\n${sample(lost)}`);
      if (added.length) console.log(`  --- 新規行サンプル（作業ツリーにのみ存在）---\n${sample(added)}`);
    }
  } catch (err) { bad('リファクタ比較失敗: ' + String(err.stderr || err.message).slice(0, 300)); }
}

console.log(fails ? `\n❌ 検証 NG（${fails}件）` : '\n✅ 検証 全PASS');
process.exit(fails ? 1 : 0);
