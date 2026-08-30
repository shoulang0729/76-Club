/* ============================ STATE ============================ */
const LS_KEY = "golfCompe_v1";
let state = load();
function load(){
  let s=null;
  try{ s = JSON.parse(localStorage.getItem(LS_KEY)); }catch(e){}
  if(!s||!s.players) s = { players:[], games:[], currentGameId:null };
  migrate(s);
  return s;
}
function migrate(s){
  (s.players||[]).forEach(p=>{
    if(p.everyType===undefined) p.everyType='none';   // none | every1 | every2
    if(p.kanjiExempt===undefined) p.kanjiExempt=false;
    if(p.gender===undefined) p.gender='M';
    if(p.birth===undefined) p.birth=null;             // 生年月日(YYYY-MM-DD)。同ネットのタイブレークに使用
  });
  (s.games||[]).forEach(g=>{
    if(!g.womenEvery) g.womenEvery={enabled:false};
    if(g.womenEvery.enabled===undefined) g.womenEvery.enabled=false;
    if(g.kanjiBadge===undefined) g.kanjiBadge=false;   // 次回幹事バッジ表示（既定OFF・§11.16 / 2026-08-29-host-option.md）
    // 対象順位＋順位ごとシフト方向（§11.17 / 2026-08-29-host-option.md §12）。既定＝旧filter方式の挙動を保存（2位=下・ブービー=上・1位=OFF）
    if(!g.kanjiRanks) g.kanjiRanks={r1:{enabled:false,dir:'down'},r2:{enabled:true,dir:'down'},booby:{enabled:true,dir:'up'}};
    if(!g.points) g.points=defaultPoints();
    else { const d=defaultPoints(); for(const k in d) if(g.points[k]===undefined) g.points[k]=d[k]; }
    // teamEventPts の per-key バックフィル（将来キー追加に備える・formats の per-key 慣例と同型。winpoints-reveal §13.2）
    { const d=defaultPoints().teamEventPts, w=g.points.teamEventPts;
      for(const k in d) if(w[k]===undefined) w[k]=d[k]; }
    if(g.prizePool===undefined) g.prizePool=0;
    if(!g.prizes) g.prizes={ niapinHoles:[], draconHoles:[], niapinWinner:{}, draconWinner:{} };
    if(!g.roulette) g.roulette=newRoulette();
    else { const r=newRoulette(); for(const k in r) if(g.roulette[k]===undefined) g.roulette[k]=r[k]; }
    if(g.formats && g.formats.vegas===undefined) g.formats.vegas=false;   // ラスベガス（§11.11）
    if(!g.vegas) g.vegas={ flip:true, cap:'doublePar' };
    else { if(g.vegas.flip===undefined) g.vegas.flip=true; if(!g.vegas.cap) g.vegas.cap='doublePar'; }
    if(g.formats && g.formats.match1v1===undefined) g.formats.match1v1=false;   // 1 on 1 マッチプレー（§11.13）
    if(!g.match1v1) g.match1v1={ teamA:null, teamB:null, pairs:[] };
    if(g.formats && g.formats.roulette===undefined) g.formats.roulette=true;   // ルーレット対抗トグル（α・既定ON=現状「常時有効」の後方互換。winpoints-reveal D7）
    if(g.formats && g.formats.niadoraInd===undefined) g.formats.niadoraInd=true;    // ニアドラ個人タブ表示トグル（α・既定ON=後方互換。バッチ95追加5・roulette と同型）
    if(g.formats && g.formats.niadoraTeam===undefined) g.formats.niadoraTeam=true;  // ニアドラチーム種目トグル（α・既定ON=後方互換。バッチ95追加5・roulette と同型）
    if(g.announced===undefined) g.announced={};   // 種目別の発表済みフラグ（winpoints-reveal §4.2）。救済補完はしない（D10・既存ゲームは全種目未発表スタート＝ユーザー了承済み）
  });
}
/* changeN/challengeM は「ハーフ9Hあたり」の回数（§11.3・2026-08-16に意味変更。既存ゲームの値もハーフあたりとして解釈） */
function newRoulette(){ return { changeN:2, challengeM:2, reps:{}, pool:{}, remChange:{}, remChallenge:{}, cur:0 }; }
/* teamRankPts＝チーム総合順位配分（§11.15・2026-08-20-team-points.md §4）。
   旧・種目別チーム配点 teamGross/teamNet/holeByHole/best2ball/roulette は廃止フィールド
   （既定から削除・既存データは残置・非参照。niapinHoles と同じ後方互換パターン。
    既存ゲームへの teamRankPts 補完は migrate の既定マージで自動）。 */
function defaultPoints(){ return {
  net:[5,3,1], gross:[5,3,1], stableford:[5,3,1], olympic:[5,3,1], callaway:[5,3,1], nassauTotal:[5,3,1],
  teamRankPts:[10,5], niapin:2, dracon:2,
  m1win:2, m1draw:1,   // 1 on 1 マッチプレー（§11.13）：勝者+2pt/引分両者+1pt（個人にのみ加算）
  teamEventPts:{ niadora:1, teamGross:1, teamNet:1, holeByHole:1,   // 種目別勝ち点の重み（0以上の整数・既定 全1＝現行互換。winpoints-reveal §13.2）
    best2ball:1, vegas:1, match1v1:1, roulette:1 } }; }
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),1600); }
function curGame(){ return state.games.find(g=>g.id===state.currentGameId)||null; }

/* NPDC 対象ホールはパーから導出（Par3=ニアピン / Par5=ドラコン・2026-08-20-npdc-par.md）。
   g.prizes.niapinHoles/draconHoles は廃止フィールド（後方互換のため残置・非参照） */
function niapinHolesOf(g){ return g.par.map((p,i)=>p===3?i:-1).filter(i=>i>=0); }
function draconHolesOf(g){ return g.par.map((p,i)=>p===5?i:-1).filter(i=>i>=0); }

function newGame(){
  return {
    id:uid(), name:"新しいコンペ", date:new Date().toISOString().slice(0,10), course:"",
    par:[4,4,3,4,5,4,4,3,4, 4,4,3,4,5,4,4,3,4],
    hidden:Array(18).fill(false),
    periaCoef:0.8, periaCap:null,
    womenEvery:{enabled:false},
    kanjiBadge:false,   // 次回幹事バッジ表示（既定OFF・§11.16 / 2026-08-29-host-option.md）
    kanjiRanks:{r1:{enabled:false,dir:'down'},r2:{enabled:true,dir:'down'},booby:{enabled:true,dir:'up'}},   // 対象順位＋順位ごと方向（§11.17）
    teams:[],
    participants:[],
    scores:{},
    prizes:{ niapinHoles:[], draconHoles:[], niapinWinner:{}, draconWinner:{} },
    points:defaultPoints(), prizePool:0, roulette:newRoulette(),
    vegas:{ flip:true, cap:'doublePar' },   // ラスベガス設定（§11.11）
    match1v1:{ teamA:null, teamB:null, pairs:[] },   // 1 on 1 マッチプレーの抽選結果（§11.13）
    announced:{},   // 種目別の発表済みフラグ（データ＝幹事の記録。演出の開封状態〔揮発〕とは別物・winpoints-reveal §4.1）
    formats:{ gross:true, net:true, niadoraInd:true, niadoraTeam:true, teamGross:true, teamNet:true, holeByHole:true, roulette:true,
      stableford:true, nassau:true, olympic:true, callaway:false, best2ball:false, vegas:false, match1v1:false }
  };
}

