/* ============================ TEST DATA（docs/handoff/2026-08-31-testdata-patterns.md） ============================
   パターン別のテストデータ生成。決定性（D1）＝ mulberry32 のシード付き乱数のみを使い Math.random() は使わない
   （選手IDの uid() のみ例外＝D3。計算結果はIDに依存しない）。隠しホールは固定配列（D2・pickHidden12 は呼ばない）。
   トップレベルは純データの const と関数宣言だけ＝読込順に非依存（D10）。 */

/* ---- 1) 定数データ ---- */
/* 共通コース（§5.1）: OUT 36 / IN 36 = par 72。par3=index 2,6,11,16（ニアピン）/ par5=index 3,8,13,17（ドラコン） */
const SD_PAR    = [4,4,3,5,4,4,3,4,5, 4,4,3,4,5,4,4,3,5];
/* 隠し12H（固定・前後半×パー帯 均等＝2026-08-20-hidden12-balance.md §2 と同型）。隠しの par 合計 = 48 */
const SD_HIDDEN = [true,false,true,true,true,false,true,false,true, true,false,true,true,true,false,false,true,true];

/* 姓リスト（68）: パターンごとに offset 固定割当＝互いに素な名簿（D5）。パターン1の12名の姓とは重複させない */
const SD_SEI = ['井上','木村','林','斎藤','清水','山崎','森','池田','橋本','阿部',
  '石川','山下','中島','石井','小川','前田','岡田','長谷川','藤田','後藤',
  '近藤','村上','遠藤','青木','坂本','菅原','福田','太田','西村','藤井',
  '金子','岡本','藤原','中野','三浦','原田','中川','松田','竹内','上田',
  '原','和田','中山','石田','上野','柴田','酒井','工藤','横山','宮崎',
  '宮本','内田','高木','安藤','島田','谷口','大野','高田','丸山','今井',
  '河野','藤本','村田','武田','上原','杉山','増田','小野'];
const SD_MEI_M = ['翔太','健一','大樹','直樹','拓也','亮','悠斗','和也','誠司','陽介'];
const SD_MEI_F = ['美穂','彩香','直美','千尋','真由美','智子','里奈','陽子','沙織','麻衣'];

/* 打数分布（§5.2）: skill 0=上級 / 1=中級 / 2=初級 / 3=大叩き。[しきい値, パーとの差] の累積表。
   どの枝にも当たらなければ +3+floor(rnd()*3)（rnd を追加1回消費） */
const SD_DIST = {
  0:[[0.02,-2],[0.12,-1],[0.50,0],[0.80,1],[0.94,2]],
  1:[[0.06,-1],[0.34,0],[0.70,1],[0.90,2]],
  2:[[0.02,-1],[0.18,0],[0.50,1],[0.80,2]],
  3:[[0.06,0],[0.28,1],[0.60,2]]
};

/* パターン表（§5）。label/desc は i18n キーを文字列リテラルで保持（D9・verify.mjs の未使用キー検査を通す）。
   選手・チーム・コンペ名は辞書化しない（D8＝保存データが言語で変わらないようにする）。
   players[] の各要素:
     n   … 氏名（省略時は姓リスト offset+index から生成）  g … 'M'|'F'   e … everyType   x … kanjiExempt
     b   … 生年月日（省略時 sdBirth）                        s … skill（seeded スコアの巧拙・省略時 1）
     copy… 同パターン内の別選手 index のスコアをコピー（乱数は消費しない）
     pd  … 全ホール par+pd 固定   pdh … {hole:d} で par+d 固定   abs … {hole:打数} で絶対値固定   cut … このホール以降を未入力(null) */
const SD_PATTERNS = [
  { key:'p1', label:'seed.p1', desc:'seed.p1d', seed:20260901, ch:'a',
    name:'テストコンペ1 個人戦フル', date:'2026-09-01', course:'テスト国際CC',
    every:true, pool:24000, kanjiBadge:true,
    kanjiRanks:{r1:{enabled:true,dir:'down'},r2:{enabled:true,dir:'down'},booby:{enabled:true,dir:'up'}},
    points:{ net:[10,6,3] },
    formats:{ gross:true,net:true,niadoraInd:true,niadoraTeam:false,teamGross:false,teamNet:false,holeByHole:false,
      roulette:false,stableford:false,nassau:false,olympic:false,callaway:false,best2ball:false,vegas:false,match1v1:false,univMatch:false },
    players:[
      { n:'田中 太郎', g:'M', e:'none', b:'1975-04-12', s:1 },
      { n:'佐藤 花子', g:'F', e:'every2', b:'1982-09-03', pd:2 },   // グロス108→エブリ後72／隠し12=48→HDCP 0.0・ネット 72.0
      { n:'鈴木 一郎', g:'M', e:'none', b:'1968-01-25', pd:1 },     // ネット 75.6（タイブレーク②年長）
      { n:'高橋 美咲', g:'F', e:'every1', b:'1990-11-18', s:2 },
      { n:'渡辺 健',   g:'M', e:'none', b:'1979-06-30', pd:1 },     // ネット 75.6
      { n:'伊藤 由美', g:'F', e:'none', b:'1985-03-14', pd:1 },     // ネット 75.6（タイブレーク①女性が上位）
      { n:'山本 大輔', g:'M', e:'none', x:true, b:'1972-12-05', s:1 },
      { n:'中村 彩',   g:'F', e:'every2', b:'1988-07-22', s:2 },
      { n:'小林 誠',   g:'M', e:'none', b:'1965-02-09', s:1 },
      { n:'加藤 香織', g:'F', e:'every1', b:'1993-05-17', s:2 },
      { n:'吉田 隆',   g:'M', e:'none', b:'1981-08-28', pd:1 },     // ネット 75.6
      { n:'松本 恵',   g:'F', e:'none', b:'1977-10-11', s:3 }
    ],
    np:[0,3,6,9], dc:[1,4,7,10] },

  { key:'p2', label:'seed.p2', desc:'seed.p2d', seed:20260902, ch:'a',
    name:'テストコンペ2 チーム戦フル', date:'2026-09-02', course:'テスト国際CC', off:0,
    every:true, pool:30000,
    points:{ teamRankPts:[10,6,3],
      teamEventPts:{ teamGross:2, teamNet:1, holeByHole:1, niadora:3, roulette:1, univMatch:1, best2ball:1, vegas:1, match1v1:1 } },
    formats:{ gross:true,net:true,niadoraInd:true,niadoraTeam:true,teamGross:true,teamNet:true,holeByHole:true,
      roulette:true,stableford:false,nassau:false,olympic:false,callaway:false,best2ball:false,vegas:false,match1v1:false,univMatch:false },
    players:[
      { g:'F', e:'every1', s:0 }, { g:'M', e:'none', s:0 }, { g:'M', e:'none', s:0 },
      { g:'M', e:'none', s:1 }, { g:'F', e:'every2', s:1 }, { g:'M', e:'none', s:1 },
      { g:'M', e:'none', s:2 }, { g:'M', e:'none', s:2 }, { g:'F', e:'every1', s:2 },
      { g:'M', e:'none', s:3 }, { g:'M', e:'none', s:3 }, { g:'F', e:'every2', s:3 }
    ],
    teams:[ { name:'チームレッド',   color:'red',   members:[0,3,6,9] },
            { name:'チームブルー',   color:'blue',  members:[1,4,7,10] },
            { name:'チームグリーン', color:'green', members:[2,5,8,11] } ],
    np:[0,1,2,3], dc:[4,5,6,7],                       // ニアドラ本数 レッド3・ブルー3・グリーン2
    announced:{ teamGross:true, niadora:true },       // 5種目中2種目だけ発表済み（段階表示）
    roulette:{ changeN:3, challengeM:1, cur:9 } },    // 前半9H 進行済み・後半分のチェンジ/チャレンジ付与済み

  /* §5.5 大学対抗（31名・4校）。uvTargetN の丸め（14→10 / 7→6 / 5→5）・HDCP上限（男36/女40）＋
     ダブルパーカット・学校同点の②平均グロス決着（北稜 vs 西京）を実データで確認する */
  { key:'p3', label:'seed.p3', desc:'seed.p3d', seed:20260903, ch:'a',
    name:'テストコンペ3 大学対抗', date:'2026-09-03', course:'テスト国際CC', off:12,
    every:false, pool:20000,
    formats:{ gross:true,net:true,niadoraInd:false,niadoraTeam:false,teamGross:false,teamNet:false,holeByHole:false,
      roulette:false,stableford:false,nassau:false,olympic:false,callaway:false,best2ball:false,vegas:false,match1v1:false,univMatch:true },
    players:[
      // 東都大学 14名（index 0-13）。末尾2名は全ホール par+4 固定＝HDCP上限（男36/女40）とダブルパーカットの検証用
      { g:'M', s:1 }, { g:'M', s:0 }, { g:'M', s:2 }, { g:'F', s:1 }, { g:'M', s:1 }, { g:'M', s:2 }, { g:'M', s:0 },
      { g:'M', s:1 }, { g:'F', s:2 }, { g:'M', s:1 }, { g:'M', s:2 }, { g:'M', s:1 },
      { g:'M', pd:4 }, { g:'F', pd:4 },
      // 南山大学 7名（index 14-20）
      { g:'M', s:1 }, { g:'M', s:0 }, { g:'F', s:2 }, { g:'M', s:1 }, { g:'M', s:2 }, { g:'M', s:1 }, { g:'M', s:3 },
      // 北稜大学 5名（index 21-25）。c1=index21 は hole1/hole3 を固定して西京との差分を作る
      { g:'M', s:1, abs:{1:5, 3:5} }, { g:'M', s:2 }, { g:'F', s:1 }, { g:'M', s:2 }, { g:'M', s:1 },
      // 西京大学 5名（index 26-30）＝北稜のスコアをコピー。d1=index26 だけ hole3 +5（隠し・2×par ちょうど）／hole1 +1
      { g:'M', copy:21, abs:{1:6, 3:10} }, { g:'M', copy:22 }, { g:'F', copy:23 }, { g:'M', copy:24 }, { g:'M', copy:25 }
    ],
    teams:[ { name:'東都大学', color:'red',    members:[0,1,2,3,4,5,6,7,8,9,10,11,12,13] },
            { name:'南山大学', color:'blue',   members:[14,15,16,17,18,19,20] },
            { name:'北稜大学', color:'green',  members:[21,22,23,24,25] },
            { name:'西京大学', color:'yellow', members:[26,27,28,29,30] } ] },

  /* §5.6 1 on 1 マッチプレー（10名・2チーム×5組）。B側はA側のスコアをコピーし hole0-5 にだけ差分＝
     6H以降は全ハーフ。結果は A 3勝1敗1引分（レッド 3-1 ブルー・AS 1） */
  { key:'p4', label:'seed.p4', desc:'seed.p4d', seed:20260904, ch:'a',
    name:'テストコンペ4 1on1 マッチプレー', date:'2026-09-04', course:'テスト国際CC', off:43,
    every:false, pool:15000,
    points:{ teamRankPts:[10,5] },
    formats:{ gross:true,net:true,niadoraInd:true,niadoraTeam:true,teamGross:true,teamNet:true,holeByHole:true,
      roulette:false,stableford:false,nassau:false,olympic:false,callaway:false,best2ball:false,vegas:false,match1v1:true,univMatch:false },
    players:[
      // A側（チームレッド・index 0-4）: hole0-5 は par+1 固定／hole6-17 は seeded
      { g:'M', s:1, pdh:{0:1,1:1,2:1,3:1,4:1,5:1} },
      { g:'F', s:2, pdh:{0:1,1:1,2:1,3:1,4:1,5:1} },
      { g:'M', s:1, pdh:{0:1,1:1,2:1,3:1,4:1,5:1} },
      { g:'M', s:2, pdh:{0:1,1:1,2:1,3:1,4:1,5:1} },
      { g:'F', s:1, pdh:{0:1,1:1,2:1,3:1,4:1,5:1} },
      // B側（チームブルー・index 5-9）: A側の同組をコピー＋hole0-5 の差分（§5.6 の表）
      { g:'M', copy:0, pdh:{0:2,1:2,2:2,3:1,4:1,5:1} },   // #1 A 3UP 勝ち
      { g:'F', copy:1, pdh:{0:0,1:0,2:0,3:0,4:2,5:1} },   // #2 B 3UP 勝ち
      { g:'M', copy:2, pdh:{0:2,1:2,2:0,3:0,4:1,5:1} },   // #3 AS（引分）
      { g:'M', copy:3, pdh:{0:2,1:1,2:1,3:1,4:1,5:1} },   // #4 A 1UP 勝ち
      { g:'F', copy:4, pdh:{0:1,1:1,2:1,3:1,4:1,5:2} }    // #5 A 1UP 勝ち
    ],
    teams:[ { name:'チームレッド', color:'red',  members:[0,1,2,3,4] },
            { name:'チームブルー', color:'blue', members:[5,6,7,8,9] } ],
    m1:{ a:0, b:1, pairs:[[0,5],[1,6],[2,7],[3,8],[4,9]] },
    np:[0,5,1,6], dc:[2,7,3,4] }                          // ニアドラ本数 レッド5・ブルー3
];

let sdPat = 'p1';   // 選択中パターン（揮発・localStorage には保存しない・D7）

/* ---- 2) ヘルパ ---- */
/* mulberry32（§5.2）。パターンごとの固定シードで生成＝同じパターンは何度作っても同じスコア */
function sdRnd(seed){ let a=seed>>>0; return function(){ a|=0; a=(a+0x6D2B79F5)|0;
  let t=Math.imul(a^(a>>>15), 1|a); t=(t+Math.imul(t^(t>>>7), 61|t))^t;
  return ((t^(t>>>14))>>>0)/4294967296; }; }
function sdHole(rnd, par, skill){
  const T=SD_DIST[skill]||SD_DIST[1]; const r=rnd();
  for(let i=0;i<T.length;i++){ if(r<T[i][0]) return Math.max(2, par+T[i][1]); }
  return Math.max(2, par+3+Math.floor(rnd()*3));
}
function sdName(i, gender){ return SD_SEI[i%SD_SEI.length] + ' ' + (gender==='F'?SD_MEI_F:SD_MEI_M)[i%10]; }
function sdBirth(i){ const y=1965+(i*7)%31, m=1+(i*5)%12, d=1+(i*11)%28;
  return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
/* 選手マスターは同名なら再利用して属性を上書き（現行ロジック踏襲＝再生成しても選手が増えない・D5） */
function sdPlayer(spec){
  let p=state.players.find(x=>x.name===spec.name);
  if(!p){ p={id:uid(),name:spec.name,gender:spec.gender,birth:spec.birth,everyType:spec.everyType,kanjiExempt:spec.kanjiExempt};
    state.players.push(p); }
  else { p.gender=spec.gender; p.birth=spec.birth; p.everyType=spec.everyType; p.kanjiExempt=spec.kanjiExempt; }
  return p.id;
}
function sdRoster(p){
  const off=p.off||0;
  return p.players.map((s,i)=>({ name:s.n||sdName(off+i, s.g), gender:s.g||'M',
    birth:s.b||sdBirth(off+i), everyType:s.e||'none', kanjiExempt:!!s.x }));
}
/* スコア: ①seeded を選手順×ホール順の1本の乱数ストリームで生成（copy 指定は消費しない）
   ②copy 派生 ③固定（pd / pdh / abs / cut）で上書き＝乱数の消費位置は固定 */
function sdScores(g, p, ids, rnd){
  const sc=p.players.map(s=> s.copy==null ? g.par.map(par=>sdHole(rnd,par,s.s==null?1:s.s)) : null);
  p.players.forEach((s,i)=>{ if(s.copy!=null) sc[i]=sc[s.copy].slice(); });
  p.players.forEach((s,i)=>{ const a=sc[i];
    if(s.pd!=null) for(let h=0;h<18;h++) a[h]=Math.max(2,g.par[h]+s.pd);
    if(s.pdh) for(const h in s.pdh) a[+h]=Math.max(2,g.par[+h]+s.pdh[h]);
    if(s.abs) for(const h in s.abs) a[+h]=s.abs[h];
    if(s.cut!=null) for(let h=s.cut;h<18;h++) a[h]=null;
    g.scores[ids[i]]=a; });
}
/* NP/DC 勝者の固定割当（対象ホールは par から導出・2026-08-20-npdc-par.md）。要素 null＝そのホールは未設定 */
function sdPrizes(g, p, ids){
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  (p.np||[]).forEach((idx,k)=>{ if(idx!=null && NP[k]!=null) g.prizes.niapinWinner[NP[k]]=ids[idx]; });
  (p.dc||[]).forEach((idx,k)=>{ if(idx!=null && DC[k]!=null) g.prizes.draconWinner[DC[k]]=ids[idx]; });
}
/* ルーレット対抗の進行済み状態を投入（reps はチームのメンバー配列を h ごとに巡回＝決定的） */
function sdRoulette(g, r){
  const R=g.roulette, cur=r.cur||0;
  R.changeN=r.changeN; R.challengeM=r.challengeM;
  g.teams.forEach(t=>{ R.remChange[t.id]=r.changeN; R.remChallenge[t.id]=r.challengeM; R.pool[t.id]=[]; });
  for(let h=0; h<cur; h++){ R.reps[h]={};
    g.teams.forEach(t=>{ if(!t.memberIds.length)return; const pid=t.memberIds[h%t.memberIds.length];
      R.reps[h][t.id]=pid; R.pool[t.id].push(pid); }); }
  R.cur=cur;
}

/* ---- 3) ビルダ＋エントリポイント（関数名は据え置き＝basic.js の inline onclick 互換） ---- */
function sdSetPat(v){ sdPat=v;   // ★renderBasic() は呼ばない（<details> が閉じてしまうため・§7）
  const p=SD_PATTERNS.find(x=>x.key===v)||SD_PATTERNS[0];
  const el=document.getElementById('sdDesc'); if(el) el.textContent=t(p.desc);
}
function sdBuild(p){
  const rnd=sdRnd(p.seed);
  const ids=sdRoster(p).map(sdPlayer);
  const g=newGame();
  g.name=p.name; g.date=p.date; g.course=p.course||'';
  g.par=SD_PAR.slice(); g.hidden=SD_HIDDEN.slice();
  g.womenEvery.enabled=!!p.every;
  if(p.kanjiBadge) g.kanjiBadge=true;
  if(p.kanjiRanks) g.kanjiRanks=JSON.parse(JSON.stringify(p.kanjiRanks));
  if(p.univEvery) g.univ.every=true;
  Object.assign(g.formats, p.formats||{});
  if(p.points) for(const k in p.points){
    if(k==='teamEventPts') Object.assign(g.points.teamEventPts, p.points[k]); else g.points[k]=p.points[k]; }
  g.prizePool=p.pool||0;
  g.participants=ids.slice();
  if(p.announced) g.announced=Object.assign({}, p.announced);
  (p.teams||[]).forEach(td=>{ g.teams.push({ id:uid(), name:td.name, color:td.color,
    memberIds:td.members.map(i=>ids[i]) }); });
  sdScores(g,p,ids,rnd);
  sdPrizes(g,p,ids);
  if(p.roulette) sdRoulette(g,p.roulette);
  if(p.m1 && g.teams.length>Math.max(p.m1.a,p.m1.b)){
    g.match1v1.teamA=g.teams[p.m1.a].id; g.match1v1.teamB=g.teams[p.m1.b].id;
    g.match1v1.pairs=p.m1.pairs.map(([a,b])=>[ids[a],ids[b]]); }
  return g;
}
function seedTestData(){
  const p=SD_PATTERNS.find(x=>x.key===sdPat)||SD_PATTERNS[0];
  if(!confirm(t('confirm.seedTest',{v:t(p.label)})))return;
  const g=sdBuild(p);
  state.games.push(g); state.currentGameId=g.id; save();
  if(p.ch) setChannel(p.ch); else render();   // setChannel は render() を内包（D11）
  toast(t('toast.testCreated',{v:t(p.label)}));
}
