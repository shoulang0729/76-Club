#!/usr/bin/env node
/* 76-Club 結果表モデル回帰ハーネス（常設・スナップショット方式）
   設計: docs/handoff/2026-09-23-result-image-export.md §9 / §12.2

   使い方: node tools/regress-sheet.mjs            … tools/regress-sheet-expected.json と比較（差分あれば FAIL / exit 1）
           node tools/regress-sheet.mjs --update   … 現在のモデルで期待値スナップショットを再生成

   対象: js/state.js + js/nav.js + js/score.js + js/testdata.js + js/calc.js + js/roulette.js + js/sheet-model.js
         を vm に読み込み（index.html の読込順の部分集合）、js/testdata.js の **p1〜p6 全パターン**を
         sdBuild() で決定的に生成して `JSON.stringify(sheetModel(g))` を丸ごと比較する。
         ＝「画像に載る中身」が以後の改修で1文字も変わらないことを機械で固定する。

   ★これが可能なのは sheetModel が言語・テーマ・DOM・揮発の表示状態に依存しないから（設計 §6.2）。
     その前提そのものを下の2つの追加検査で毎回確かめる:
       ① 揮発の非参照: 開封ホール数・合計値トグル・順位行の目隠し・チーム行の目隠しを振っても JSON が完全一致
       ② 連携ゲート: g.announced のフラグを反転すると、その種目の明細だけが pending ⇄ 実データで入れ替わる
   注意: チーム総合（tpShareModel）は i18n/DOM 依存のため本ハーネスの対象外。その値の回帰は
         tools/regress.mjs の teamWinPoints スナップショットが既に担保している（設計 §12.2）。
         js/calc.js の計算回帰も tools/regress.mjs 側が正（本ハーネスは計算を1つも持たない）。 */
import fs from 'node:fs';
import vm from 'node:vm';

const root = process.cwd();
const EXPECTED = root + '/tools/regress-sheet-expected.json';
const UPDATE = process.argv.includes('--update');

/* ============ vm 読込と実行 ============ */
// index.html の読込順を尊重した部分集合。DOM 依存の関数は呼ばない（sdSetPat / seedTestData は未使用）
const FILES = ['state', 'nav', 'score', 'testdata', 'calc', 'roulette', 'sheet-model'];
const src = FILES.map(n => fs.readFileSync(`${root}/js/${n}.js`, 'utf8')).join('\n');
const sandbox = {
  console, Math, JSON,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
};
const driver = `
globalThis.__RESULTS = {};
globalThis.__CHECKS = { volatile: [], announced: [] };
const clone = o => JSON.parse(JSON.stringify(o));
for (const p of SD_PATTERNS) {
  CHANNEL = p.ch || 'a';                       // α/β（chFormats が参照＝採用種目のゲートに効く）
  state = { players: [], games: [], currentGameId: null };   // パターンごとに新品（選手マスターの再利用差を作らない）
  const g = sdBuild(p);                        // 決定的（mulberry32 の固定シード・uid は モデルに出ないので無害）
  state.games.push(g); state.currentGameId = g.id;           // 実アプリの seedTestData と同じ状態にする
  const base = JSON.stringify(sheetModel(g));
  globalThis.__RESULTS[p.key] = JSON.parse(base);

  /* ① 揮発の表示状態（設計 §3・§6.2）を振っても完全一致すること。
        ここで触るのは js/nav.js / js/results.js が持つ「発表演出の進行状態」だけ＝データは一切変えない。 */
  const volatileSets = [
    () => { revealHoles = 0;  show.totals = false; nsMode = { gross:'show', net:'show' }; },
    () => { revealHoles = 9;  show.totals = true;  nsMode = { gross:'hide', net:'hide' }; },
    () => { revealHoles = 18; show.totals = false; nsMode = { gross:'hide', net:'show' };
            tgMode = { teamGross:'hide', teamNet:'hide', best2ball:'hide', holeByHole:'hide', vegas:'hide' };
            pzMode = 'hide'; },
  ];
  let volOk = true;
  volatileSets.forEach(set => { set(); if (JSON.stringify(sheetModel(g)) !== base) volOk = false; });
  revealHoles = 0; show.totals = false;                      // 既定へ戻す
  nsMode = { gross:'show', net:'show' };
  tgMode = { teamGross:'show', teamNet:'show', best2ball:'show', holeByHole:'show', vegas:'show' };
  pzMode = 'show';
  globalThis.__CHECKS.volatile.push({ key: p.key, same: volOk });

  /* ② g.announced（データ）には従うこと: 明細セクションの連携フラグを反転すると、
        そのセクションだけが pending ⇄ 実データで入れ替わる（他のセクションは不変）。 */
  const DET = { m1:'match1v1', univ:'univMatch', custom:'customMatch' };
  const m0 = sheetModel(g);
  for (const dk of Object.keys(DET)) {
    if (!m0.det[dk]) continue;                               // その種目を採用していない＝セクションなし
    const key = DET[dk], g2 = clone(g);
    (g2.announced = g2.announced || {})[key] = !m0.det[dk].on;
    const m1m = sheetModel(g2);
    /* 連携は配分（computePoints のチーム総合配分ゲート）に効くので pay/det は変わってよい。
       スコア表・個人戦順位・ニアドラ旗・meta は announced に依存しない＝必ず不変であること。 */
    const fixed = o => JSON.stringify({ meta:o.meta, sc:o.sc, ind:o.ind, flags:o.flags });
    globalThis.__CHECKS.announced.push({ key: p.key, sec: dk,
      on0: m0.det[dk].on, rows0: m0.det[dk].rows.length,
      on1: m1m.det[dk].on, rows1: m1m.det[dk].rows.length,
      pendingFollows: (m0.det[dk].pending === !m0.det[dk].on) && (m1m.det[dk].pending === !m1m.det[dk].on),
      hiddenWhenOff: (m0.det[dk].on ? m1m.det[dk].rows.length === 0 : m0.det[dk].rows.length === 0),
      shownWhenOn:   (m0.det[dk].on ? m0.det[dk].rows.length > 0    : m1m.det[dk].rows.length > 0),
      indepSame: fixed(m0) === fixed(m1m) });
  }
}`;
vm.runInContext(src + '\n' + driver, vm.createContext(sandbox));
const actual = JSON.parse(JSON.stringify(sandbox.__RESULTS));   // vm realm → 素の JSON に正規化
const checks = JSON.parse(JSON.stringify(sandbox.__CHECKS));

/* ============ 比較 / 更新 ============ */
if (UPDATE) {
  fs.writeFileSync(EXPECTED, JSON.stringify(actual, null, 2) + '\n');
  console.log('✅ 期待値スナップショットを再生成: tools/regress-sheet-expected.json（差分は git diff でレビューすること）');
  process.exit(0);
}
if (!fs.existsSync(EXPECTED)) {
  console.log('❌ tools/regress-sheet-expected.json がありません。node tools/regress-sheet.mjs --update で生成してください。');
  process.exit(1);
}
const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
const diffs = [];
const walk = (path, a, b) => {   // tools/regress.mjs と同じ全走査（打ち切りは表示側だけで行う）
  if (a === b) return;
  const ta = a === null ? 'null' : typeof a, tb = b === null ? 'null' : typeof b;
  if (ta !== 'object' || tb !== 'object') { diffs.push(`${path}: 期待 ${JSON.stringify(a)} ≠ 実際 ${JSON.stringify(b)}`); return; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (!(k in a)) diffs.push(`${path}.${k}: 期待に無いキー（実際 ${JSON.stringify(b[k])}）`);
    else if (!(k in b)) diffs.push(`${path}.${k}: 実際に無いキー（期待 ${JSON.stringify(a[k])}）`);
    else walk(`${path}.${k}`, a[k], b[k]);
  }
};
let fails = 0;
console.log('■ 結果表モデル回帰（sheetModel スナップショット比較）');
for (const name of Object.keys(actual)) {
  const before = diffs.length;
  walk(name, expected[name], actual[name]);
  if (diffs.length === before) console.log(`  ✅ ${name} 一致`);
  else { console.log(`  ❌ ${name} 差分あり`); fails++; }
}
for (const name of Object.keys(expected)) if (!(name in actual)) { console.log(`  ❌ ${name} 期待値のみに存在（パターン削除?）`); fails++; }
if (diffs.length) console.log(diffs.slice(0, 20).map(d => '    ' + d).join('\n') + (diffs.length > 20 ? `\n    …ほか ${diffs.length - 20} 件` : ''));

console.log('■ 揮発の表示状態を参照しないこと（開封/合計値/目隠し/伏せ を振っても同一）');
for (const c of checks.volatile) {
  if (c.same) console.log(`  ✅ ${c.key} 完全一致`);
  else { console.log(`  ❌ ${c.key} 揮発状態で中身が変わった（設計 §3 違反）`); fails++; }
}

console.log('■ g.announced（連携＝データ）には従うこと');
if (!checks.announced.length) console.log('  － 明細セクションを持つパターンなし');
for (const c of checks.announced) {
  const good = c.pendingFollows && c.hiddenWhenOff && c.shownWhenOn && c.indepSame;
  if (good) console.log(`  ✅ ${c.key}.${c.sec} 連携 ${c.on0}→${c.on1} で明細 ${c.rows0}→${c.rows1} 行（スコア表・個人戦・旗は不変）`);
  else { console.log(`  ❌ ${c.key}.${c.sec} 連携ゲートが効いていない ${JSON.stringify(c)}`); fails++; }
}

console.log(fails ? `\n❌ 結果表モデル回帰 NG（${fails}件）— 意図した仕様変更なら設計書更新後に --update`
                  : '\n✅ 結果表モデル回帰 全PASS');
process.exit(fails ? 1 : 0);
