#!/usr/bin/env node
/* 76-Club 計算回帰ハーネス（常設・スナップショット方式）
   使い方: node tools/regress.mjs            … tools/regress-expected.json と比較（差分あれば FAIL / exit 1）
           node tools/regress.mjs --update   … 現在の計算結果で期待値スナップショットを再生成
   対象: js/state.js + js/nav.js + js/score.js + js/roulette.js + js/calc.js を vm に読み込み、
         決定的フィクスチャ（乱数不使用・固定スコアの12名構成）で
         teamWinPoints / computePoints / computePayout / nextKanji（＋univMatch ケースのみ uvStanding/uvTargetN）の出力を丸ごと比較する。
   注意: §3 計算は load-bearing（CLAUDE.md）。本ハーネスが FAIL したら、まず「意図しない挙動変化」を疑う。
         設計書で計算仕様を変えた PR でのみ --update で期待値を更新し、差分をレビューに供すること。 */
import fs from 'node:fs';
import vm from 'node:vm';

const root = process.cwd();
const EXPECTED = root + '/tools/regress-expected.json';
const UPDATE = process.argv.includes('--update');

/* ============ 決定的フィクスチャ ============ */
// newGame() と同じ Par 配置（Par3=2,7,11,16 / Par5=4,13。NPDC 対象ホールは par から導出される）
const PAR = [4, 4, 3, 4, 5, 4, 4, 3, 4, 4, 4, 3, 4, 5, 4, 4, 3, 4];
const HIDDEN12 = [0, 1, 3, 4, 6, 8, 10, 12, 13, 15, 16, 17];   // 隠し12ホール（ペリア用・全ケース共通）
// 選手12名: 性別/生年月日（タイブレーク）・everyType（エブリ適用）・kanjiExempt（幹事免除スキップ）を混在させる
const PLAYERS = [
  ['p01', '明',   'M', '1958-04-02', 'none',   false],
  ['p02', '蓮',   'M', '1990-11-23', 'none',   false],
  ['p03', '桜',   'F', '1985-06-15', 'every1', false],
  ['p04', '健',   'M', '1972-01-30', 'none',   true],
  ['p05', '美咲', 'F', '1993-09-09', 'every2', false],
  ['p06', '豪',   'M', '1980-12-01', 'none',   false],
  ['p07', '葵',   'F', '1988-03-18', 'every1', false],
  ['p08', '昇',   'M', '1965-07-07', 'none',   false],
  ['p09', '司',   'M', '2001-05-05', 'none',   false],
  ['p10', '凛',   'F', '1979-10-10', 'every2', true],
  ['p11', '大和', 'M', '1969-02-14', 'none',   false],
  ['p12', '匠',   'M', '1996-08-08', 'none',   false],
].map(([id, name, gender, birth, everyType, kanjiExempt]) => ({ id, name, gender, birth, everyType, kanjiExempt }));
const ALL = PLAYERS.map(p => p.id);
// 固定スコア生成: par + f(選手index, ホール)。f が null を返したら未入力（経過ラウンド）
const mkScores = (pids, f) => Object.fromEntries(pids.map((pid, pi) =>
  [pid, PAR.map((p, h) => { const d = f(pi, h); return d == null ? null : Math.max(1, p + d); })]));
const hidden = () => { const a = Array(18).fill(false); HIDDEN12.forEach(i => a[i] = true); return a; };
// ゲーム骨格。points/roulette/kanjiRanks 等の既定は vm 内の migrate() が実アプリと同一手順で補完する
// （defaultPoints 変更もスナップショット差分として検出される）。formats は各ケースで全キー明示
// （migrate が roulette/niadora* 等を true に補完するため、省略すると意図しない ON になる）
const baseGame = (over) => Object.assign({
  id: 'G1', name: 'REGRESS', date: '2026-08-30', course: '',
  par: PAR.slice(), hidden: hidden(),
  periaCoef: 0.8, periaCap: null,
  womenEvery: { enabled: true },
  teams: [], participants: [], scores: {},
  prizes: { niapinWinner: {}, draconWinner: {} },
  prizePool: 0,
  vegas: { flip: true, cap: 'doublePar' },
  match1v1: { teamA: null, teamB: null, pairs: [] },
  announced: {},
}, over);

const CASES = {
  // A) 個人戦フルセット（β・12名・p12 は前半9Hのみ入力=経過）: ペリア/エブリ/ステーブル/オリンピック/
  //    キャロウェイ/握り(ナッソー)/NPDC個人配点/payout/nextKanji(既定=2位下・ブービー上)
  indBasic: { channel: 'b', game: baseGame({
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => (pi === 11 && h >= 9) ? null : ((pi * 7 + h * 5) % 7) - 2),
    periaCap: 30, prizePool: 10000,
    prizes: { niapinWinner: { 2: 'p03', 7: 'p08', 11: 'p01', 16: 'p05' }, draconWinner: { 4: 'p02', 13: 'p10' } },
    formats: { gross: true, net: true, stableford: true, olympic: true, callaway: true, nassau: true,
      niadoraInd: true, niadoraTeam: false, roulette: false, teamGross: false, teamNet: false,
      holeByHole: false, best2ball: false, vegas: false, match1v1: false },
  }) },
  // B) チーム戦3チーム（α）: 種目別勝ち点の「重み」(teamGross=2/niadora=3)と「連携」
  //    （announced= teamGross/holeByHole/niadora のみ→ teamNet/roulette は未確定=勝ち点0）、
  //    ニアドラ同数タイの山分け(T1=T2=2本→w3を1.5ずつ)、ルーレット(cur=4・h2は代表欠け=pending)、
  //    幹事3対象(1位down/2位down/ブービーup・免除 p04/p10)
  team3: { channel: 'a', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03', 'p04'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06', 'p07', 'p08'] },
      { id: 'T3', name: 'グリーン', memberIds: ['p09', 'p10', 'p11', 'p12'] },
    ],
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),   // pi*h 交差項=チーム合計の縮退（全チーム同グロス）を防ぐ
    prizePool: 30000,
    prizes: { niapinWinner: { 2: 'p01', 7: 'p05', 11: 'p09', 16: 'p02' }, draconWinner: { 4: 'p06' } },
    points: { teamEventPts: { teamGross: 2, niadora: 3 } },   // 残りキーは migrate が既定(全1)補完
    roulette: { cur: 4, reps: {
      0: { T1: 'p01', T2: 'p05', T3: 'p09' }, 1: { T1: 'p02', T2: 'p06', T3: 'p10' },
      2: { T1: 'p03', T2: 'p07' }, 3: { T1: 'p04', T2: 'p08', T3: 'p12' } } },
    announced: { teamGross: true, holeByHole: true, niadora: true },
    kanjiBadge: true,
    kanjiRanks: { r1: { enabled: true, dir: 'down' }, r2: { enabled: true, dir: 'down' }, booby: { enabled: true, dir: 'up' } },
    formats: { gross: true, net: true, teamGross: true, teamNet: true, holeByHole: true, roulette: true,
      niadoraInd: true, niadoraTeam: true, stableford: false, olympic: false, callaway: false,
      nassau: false, best2ball: false, vegas: false, match1v1: false },
  }) },
  // C) 2チーム×2名（β）: ラスベガス（フリップ＋ダブルパー上限）/ ベスト2 / 1on1マッチ（2試合）/ 全種目連携済み
  team2Vegas: { channel: 'b', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06'] },
    ],
    participants: ['p01', 'p02', 'p05', 'p06'],
    scores: mkScores(['p01', 'p02', 'p05', 'p06'], (pi, h) => ((pi * 3 + h * 2) % 5) - 2),
    prizePool: 5000,
    match1v1: { teamA: 'T1', teamB: 'T2', pairs: [['p01', 'p05'], ['p02', 'p06']] },
    announced: { teamGross: true, best2ball: true, vegas: true, match1v1: true },
    formats: { gross: true, net: true, teamGross: true, best2ball: true, vegas: true, match1v1: true,
      teamNet: false, holeByHole: false, roulette: false, niadoraInd: false, niadoraTeam: false,
      stableford: false, olympic: false, callaway: false, nassau: false },
  }) },
  // D) 大学対抗（β・every OFF・§11.20 / 2026-08-30-univ-match.md）: U1=7名(N=6)・U2=4名(N=4=全員)。
  //    p06/p07 は全ホール同一スコア＝ネット/グロス完全同値の境界タイ（6位/7位）→ memberIds 登録順で p06 が対象・p07 対象外。
  //    womenEvery ON でも univ.every OFF なら uv 計算にエブリは効かない（独立計算・§4.4）。announced なし＝未確定（勝ち点0）
  univOff: { channel: 'b', game: baseGame({
    teams: [
      { id: 'U1', name: '青葉大', memberIds: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07'] },
      { id: 'U2', name: '白樺大', memberIds: ['p08', 'p09', 'p10', 'p11'] },
    ],
    participants: ALL.slice(0, 11),
    scores: mkScores(ALL.slice(0, 11), (pi, h) => (pi === 5 || pi === 6) ? (h % 3) + 1 : ((pi * 5 + h * 3 + (pi * h) % 5) % 6) - 2),
    formats: { gross: true, net: true, univMatch: true, teamGross: false, teamNet: false, holeByHole: false,
      roulette: false, niadoraInd: false, niadoraTeam: false, stableford: false, olympic: false,
      callaway: false, nassau: false, best2ball: false, vegas: false, match1v1: false },
  }) },
  // E) 大学対抗（β・every ON・重み2・連携済み）: スコアはDと同一。womenEvery OFF でも univ.every ON なら
  //    各ホール −1/−2 を反映して集計（コンペ本体エブリと独立・§4.4）。エブリで p07(every1) が p06 を上回り境界タイ解消
  univOn: { channel: 'b', game: baseGame({
    teams: [
      { id: 'U1', name: '青葉大', memberIds: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07'] },
      { id: 'U2', name: '白樺大', memberIds: ['p08', 'p09', 'p10', 'p11'] },
    ],
    participants: ALL.slice(0, 11),
    scores: mkScores(ALL.slice(0, 11), (pi, h) => (pi === 5 || pi === 6) ? (h % 3) + 1 : ((pi * 5 + h * 3 + (pi * h) % 5) % 6) - 2),
    womenEvery: { enabled: false },
    univ: { every: true },
    points: { teamEventPts: { univMatch: 2 } },   // 残りキーは migrate が既定(全1)補完
    announced: { univMatch: true },
    formats: { gross: true, net: true, univMatch: true, teamGross: false, teamNet: false, holeByHole: false,
      roulette: false, niadoraInd: false, niadoraTeam: false, stableford: false, olympic: false,
      callaway: false, nassau: false, best2ball: false, vegas: false, match1v1: false },
  }) },
  // F) 任意対決・同点（α・§11.21 / 2026-08-31-custom-match.md §9-6）: 3チーム。pts={T1:5,T2:5}（T3 は未入力=null）・
  //    重み2・連携済み → winners=[0,1]・vals=[5,5,null]・wins=[1,1,0]（w/n=2/2=1）。他のチーム種目は全 OFF
  customTie: { channel: 'a', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03', 'p04'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06', 'p07', 'p08'] },
      { id: 'T3', name: 'グリーン', memberIds: ['p09', 'p10', 'p11', 'p12'] },
    ],
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),
    custom: { name: 'ビンゴ大会', pts: { T1: 5, T2: 5 } },
    points: { teamEventPts: { customMatch: 2 } },   // 残りキーは migrate が既定(全1)補完
    announced: { customMatch: true },
    formats: { gross: true, net: true, customMatch: true, teamGross: false, teamNet: false, holeByHole: false,
      roulette: false, niadoraInd: false, niadoraTeam: false, stableford: false, olympic: false,
      callaway: false, nassau: false, best2ball: false, vegas: false, match1v1: false, univMatch: false },
  }) },
  // G) 任意対決・全未入力（α）: 同構成で custom={name:'',pts:{}} → add の live<2 で種目不成立＝
  //    events に customMatch の要素が出ない・wins=[0,0,0]・computePoints のチーム配分もゼロ
  customNone: { channel: 'a', game: baseGame({
    teams: [
      { id: 'T1', name: 'レッド', memberIds: ['p01', 'p02', 'p03', 'p04'] },
      { id: 'T2', name: 'ブルー', memberIds: ['p05', 'p06', 'p07', 'p08'] },
      { id: 'T3', name: 'グリーン', memberIds: ['p09', 'p10', 'p11', 'p12'] },
    ],
    participants: ALL.slice(),
    scores: mkScores(ALL, (pi, h) => ((pi * 5 + h * 3 + (pi * h) % 4) % 6) - 2),
    custom: { name: '', pts: {} },
    points: { teamEventPts: { customMatch: 2 } },
    announced: { customMatch: true },
    formats: { gross: true, net: true, customMatch: true, teamGross: false, teamNet: false, holeByHole: false,
      roulette: false, niadoraInd: false, niadoraTeam: false, stableford: false, olympic: false,
      callaway: false, nassau: false, best2ball: false, vegas: false, match1v1: false, univMatch: false },
  }) },
};

/* ============ vm 読込と実行 ============ */
// index.html の読込順を尊重した部分集合（state→nav→score→roulette→calc）。DOM 依存の関数は呼ばない
const FILES = ['state', 'nav', 'score', 'roulette', 'calc'];
const src = FILES.map(n => fs.readFileSync(`${root}/js/${n}.js`, 'utf8')).join('\n');
const sandbox = {
  console, Math, JSON,
  localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
  window: { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} },
  __CASES: JSON.stringify(Object.fromEntries(Object.entries(CASES).map(([k, c]) =>
    [k, { channel: c.channel, state: { players: PLAYERS, games: [c.game], currentGameId: c.game.id } }]))),
};
const driver = `
globalThis.__RESULTS = {};
for (const [name, cs] of Object.entries(JSON.parse(__CASES))) {
  CHANNEL = cs.channel;              // α/β（chFormats が参照。表示状態だが計算のゲートに効く）
  state = cs.state; migrate(state);  // 実アプリと同じ補完（defaultPoints/newRoulette/kanjiRanks 等）
  const g = curGame();
  const twp = teamWinPoints(g);
  globalThis.__RESULTS[name] = {
    teamWinPoints: { teams: twp.teams.map(t => t.id), wins: twp.wins,
      events: twp.events.map(e => ({ key: e.key, winners: e.winners, vals: e.vals, on: e.on, w: e.w })) },
    computePoints: computePoints(g),
    computePayout: computePayout(g),
    nextKanji: nextKanji(g),
  };
  // 大学対抗（§11.20）: univMatch ON のケースのみ uv 系スナップショットを追加（既存ケースの形は不変）
  if (g.formats && g.formats.univMatch) {
    const uv = uvStanding(g);
    globalThis.__RESULTS[name].univ = {
      targetN: Array.from({ length: 15 }, (_, i) => uvTargetN(i + 1)),   // §4.1 例表（P=1..15）
      rows: uv.rows.map(r => ({ t: r.t.id, P: r.P, N: r.N, sel: r.sel, members: r.members,
        net: r.members.map(pid => uvNetA(g, pid)), gross: r.members.map(pid => uvGrossA(g, pid)),
        hdcp: r.members.map(pid => uvHdcpA(g, pid)), r4: r.r4, rank: r.rank })),
    };
  }
}`;
vm.runInContext(src + '\n' + driver, vm.createContext(sandbox));
const actual = JSON.parse(JSON.stringify(sandbox.__RESULTS));   // vm realm → 素の JSON に正規化

/* ============ 比較 / 更新 ============ */
if (UPDATE) {
  fs.writeFileSync(EXPECTED, JSON.stringify(actual, null, 2) + '\n');
  console.log('✅ 期待値スナップショットを再生成: tools/regress-expected.json（差分は git diff でレビューすること）');
  process.exit(0);
}
if (!fs.existsSync(EXPECTED)) {
  console.log('❌ tools/regress-expected.json がありません。node tools/regress.mjs --update で生成してください。');
  process.exit(1);
}
const expected = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
const diffs = [];
const walk = (path, a, b) => {
  if (diffs.length >= 20) return;
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
console.log('■ 計算回帰（スナップショット比較）');
for (const name of Object.keys(CASES)) {
  const before = diffs.length;
  walk(name, expected[name], actual[name]);
  if (diffs.length === before) console.log(`  ✅ ${name} 一致`);
  else { console.log(`  ❌ ${name} 差分あり`); fails++; }
}
for (const name of Object.keys(expected)) if (!(name in actual)) { console.log(`  ❌ ${name} 期待値のみに存在（ケース削除?）`); fails++; }
if (diffs.length) console.log(diffs.slice(0, 20).map(d => '    ' + d).join('\n') + (diffs.length >= 20 ? '\n    …' : ''));
console.log(fails ? `\n❌ 計算回帰 NG（${fails}ケース）— 意図した仕様変更なら設計書更新後に --update` : '\n✅ 計算回帰 全PASS');
process.exit(fails ? 1 : 0);
