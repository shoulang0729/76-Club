#!/usr/bin/env node
/* 76-Club 検証ハーネス（reviewer / implementer 共用）
   使い方: node tools/verify.mjs
   チェック: JS構文 / i18n ja=zh=en 完全一致・空値・en日本語残存 / 使用キー未定義参照 / CSS孤立var() / 計算回帰(#3・Vegas)
   すべて PASS で exit 0、1つでも失敗で exit 1。 */
import fs from 'node:fs';
import vm from 'node:vm';
import { execSync } from 'node:child_process';

const root = process.cwd();
let fails = 0;
const ok  = (m) => console.log('  ✅ ' + m);
const bad = (m) => { console.log('  ❌ ' + m); fails++; };

const html = fs.readFileSync(root + '/index.html', 'utf8');
const order = [...html.matchAll(/<script src="js\/([^."]+)\.js">/g)].map(m => m[1]);
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

console.log(fails ? `\n❌ 検証 NG（${fails}件）` : '\n✅ 検証 全PASS');
process.exit(fails ? 1 : 0);
