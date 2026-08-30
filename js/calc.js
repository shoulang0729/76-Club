/* ============================ CALCULATIONS ============================ */
function parTotal(g){ return g.par.reduce((a,b)=>a+b,0); }
function gross(g,pid){ const sc=g.scores[pid]||[]; return sc.reduce((a,v)=>a+(v?Number(v):0),0); }
function complete(g,pid){ const sc=g.scores[pid]||[]; return sc.filter(v=>v!=null&&v!=='').length===18; }
/* ダブルペリアHDCP（★§11.12 H・2026-08-19に算定基準を変更＝§3/§11.2 を上書き）:
   隠し12ホールの合計を「エブリ適用後スコア」(adjHole) 基準で取る。
   ＝①エブリを各ホールに先に反映 → ②その合計からHDCPを算定 → ③ネット＝(エブリ後グロス)−(このHDCP)。
   エブリ選手はHDCPが小さくなり（0クリップされやすく）ネットが上がる。二重控除にはならない。 */
function periaHdcp(g,pid){
  let h=0; g.hidden.forEach((hid,i)=>{ if(hid){ const v=adjHole(g,pid,i); if(v!=null)h+=v; } });
  let hd=(h*1.5 - parTotal(g))*g.periaCoef;
  if(hd<0)hd=0; if(g.periaCap!=null && hd>g.periaCap)hd=g.periaCap;
  return Math.round(hd*10)/10;
}
function enteredCount(g,pid){ return (g.scores[pid]||[]).filter(v=>v!=null&&v!=='').length; }
/* エブリ控除の実額（§11.2）：入力済み各ホールに−1(E1)/−2(E2)を積み上げる＝表示系(adjArr/adjHole)と同一基準。
   18H入力時は従来どおりE1=−18/E2=−36。ペリアHDCPもこのエブリ後スコアを基準に算定する（§11.12 H）。 */
function everyStrokes(g,pid){ return evPer(g,pid)*enteredCount(g,pid); }
function womenEvery(g,pid){ return everyStrokes(g,pid); }
function gross_(g,pid){ return gross(g,pid); }
function effGross(g,pid){ return gross(g,pid) - womenEvery(g,pid); }
// エブリ支給（各ホール−1/−2）。表示用のホール別スコアは「エブリ適用後」に統一（入力タブのみ生スコア）
function evPer(g,pid){ if(!g.womenEvery.enabled)return 0; const p=state.players.find(x=>x.id===pid); return p?(p.everyType==='every1'?1:p.everyType==='every2'?2:0):0; }
function adjArr(g,pid){ const sc=g.scores[pid]||[]; const ev=evPer(g,pid); return sc.map(v=>(v!=null&&v!=='')?Number(v)-ev:v); }
function adjHole(g,pid,i){ const v=(g.scores[pid]||[])[i]; return (v==null||v==='')?null:Number(v)-evPer(g,pid); }
function netScore(g,pid){ return Math.round((effGross(g,pid) - periaHdcp(g,pid))*10)/10; }
function stablefordPts(g,pid){ const sc=g.scores[pid]||[]; let t=0;
  sc.forEach((v,i)=>{ if(v==null||v==='')return; const d=Number(v)-g.par[i];
    t += d<=-3?5 : d===-2?4 : d===-1?3 : d===0?2 : d===1?1 : 0; }); return t; }
function olympicPts(g,pid){ const sc=g.scores[pid]||[]; let t=0;
  sc.forEach((v,i)=>{ if(v==null||v==='')return; const d=Number(v)-g.par[i];
    t += d<=-3?10 : d===-2?6 : d===-1?4 : d===0?1 : 0; }); return t; }
function callawayHdcp(g,pid){
  const sc=g.scores[pid]||[]; if(!enteredCount(g,pid))return null;  // 経過でも計算（入力があれば）
  const gr=gross(g,pid);
  const tbl=[[71,0],[75,0.5],[80,1],[85,1.5],[90,2],[95,2.5],[100,3],[105,3.5],[110,4],[115,4.5],[120,5],[125,5.5],[130,6],[9999,6.5]];
  let units=0; for(const [max,u] of tbl){ if(gr<=max){units=u;break;} }
  const adj=[[71,-2],[75,-1],[80,0],[85,1],[90,2],[95,-2],[100,-1],[105,0],[110,1],[9999,2]];
  let a=0; for(const [max,x] of adj){ if(gr<=max){a=x;break;} }
  // 悪いホールを控除（17・18番は対象外）＝入力済みホールのうち index<16 から
  const holes=sc.map((v,i)=>({v:v?Number(v):null,i})).filter(o=>o.v!=null&&o.i<16).map(o=>o.v).sort((x,y)=>y-x);
  const whole=Math.floor(units); let ded=0;
  for(let i=0;i<whole;i++)ded+=holes[i]||0;
  if(units-whole>=0.5)ded+=(holes[whole]||0)/2;
  let hd=ded+a; if(hd<0)hd=0; return Math.round(hd*10)/10;
}
function callawayNet(g,pid){ const h=callawayHdcp(g,pid); return h==null?null:gross(g,pid)-h; }
function net9(g,pid,s,e){ const sc=g.scores[pid]||[]; const raw=sum(sc,s,e);
  let ev=0; for(let i=s;i<e;i++){ if(sc[i]!=null&&sc[i]!=='') ev+=evPer(g,pid); }   // 当該9Hのエブリ実額（§11.2）。HDCPはエブリ後基準（§11.12 H）
  return Math.round((raw-ev-periaHdcp(g,pid)/2)*10)/10; }
function nassauTotalNet(g,pid){ return Math.round((net9(g,pid,0,9)+net9(g,pid,9,18))*10)/10; }

/* ---- ranking helpers ---- */
/* 同スコアのタイブレーク：①性別（女性を上位）②生年月日（年長＝生年月日が早い方を上位）。
   判別不能（性別同じ＆生年月日どちらか未入力/同一）なら 0＝同順位のまま。 */
function tieBreak(pidA, pidB){
  const a=state.players.find(x=>x.id===pidA), b=state.players.find(x=>x.id===pidB);
  const ga=(a&&a.gender==='F')?0:1, gb=(b&&b.gender==='F')?0:1;
  if(ga!==gb) return ga-gb;                       // 女性(0)が先
  const ba=a&&a.birth, bb=b&&b.birth;
  if(ba&&bb){ if(ba<bb)return -1; if(ba>bb)return 1; }   // 生年月日が早い＝年長が先
  return 0;
}
function ranked(pids, valFn, dir){
  const rows=pids.map(pid=>({pid,v:valFn(pid)})).filter(r=>r.v!=null);
  rows.sort((a,b)=>{ const d = dir==='asc'? a.v-b.v : b.v-a.v; return d!==0? d : tieBreak(a.pid,b.pid); });
  let rank=1;
  return rows.map((r,i)=>{ if(i>0){ const p=rows[i-1]; const eq=(r.v===p.v)&&(tieBreak(p.pid,r.pid)===0); rank = eq? rank : i+1; } return {pid:r.pid,v:r.v,rank}; });
}
function teamRanked(g, valFn, dir){
  const teams=g.teams.filter(t=>t.memberIds.length);
  const rows=teams.map(t=>({t,v:valFn(t)})).filter(r=>r.v!=null);
  rows.sort((a,b)=> dir==='asc'? a.v-b.v : b.v-a.v);
  let rank=0,prev=null;
  return rows.map((r,i)=>{ if(prev===null||r.v!==prev){rank=i+1;prev=r.v;} return {t:r.t,v:r.v,rank}; });
}
function holesWon(g){
  const teams=g.teams.filter(t=>t.memberIds.length); const won=teams.map(()=>0);
  for(let h=0;h<18;h++){
    const tot=teams.map(t=>{ let s=0,cnt=0; t.memberIds.forEach(pid=>{const v=adjHole(g,pid,h); if(v!=null){s+=v;cnt++;}}); return cnt?s:null; });
    const valid=tot.filter(v=>v!=null); if(!valid.length)continue;
    const min=Math.min(...valid); const winners=tot.map((v,i)=>v===min?i:-1).filter(i=>i>=0);
    winners.forEach(i=>won[i]+=1/winners.length);
  }
  return {teams,won};
}
function best2(g,t){ const ns=t.memberIds.map(pid=>netScore(g,pid)).sort((a,b)=>a-b); return Math.round((ns[0]+(ns[1]||ns[0]))*10)/10; }

/* ---- ラスベガス（Vegas・§11.11）: 2人組の2桁合体・フリップ・点差累積。独立集計＝payout非干渉 ---- */
/* 数字は「エブリ適用後×ダブルパー上限」、フリップ発動のバーディ判定は「生スコア」（各々既存慣例に準拠） */
function vegasPair(g,T){ const m=T.memberIds.filter(pid=>g.participants.includes(pid)); return m.length===2?m:null; }
function vAdj(g,pid,i){ const v=adjHole(g,pid,i); if(v==null)return null;
  return (g.vegas&&g.vegas.cap==='none') ? v : Math.min(v, 2*g.par[i]); }
function vegasBase(g,T,i){ const m=vegasPair(g,T); if(!m)return null;
  const a=vAdj(g,m[0],i), b=vAdj(g,m[1],i); if(a==null||b==null)return null;
  const lo=Math.min(a,b), hi=Math.max(a,b);
  return { base:10*lo+hi, flip:10*hi+lo }; }
function vegasBirdie(g,T,i){ const m=vegasPair(g,T)||[];
  return m.some(pid=>{ const v=(g.scores[pid]||[])[i]; return v!=null&&v!==''&&Number(v)-g.par[i]<=-1; }); }
function vegasHoleNet(g,A,B,i){ const nA0=vegasBase(g,A,i), nB0=vegasBase(g,B,i);
  if(!nA0||!nB0) return null;
  const useFlip = !(g.vegas&&g.vegas.flip===false);
  const nA = (useFlip&&vegasBirdie(g,B,i)) ? nA0.flip : nA0.base;   // 相手がバーディ→自分の数字を反転
  const nB = (useFlip&&vegasBirdie(g,A,i)) ? nB0.flip : nB0.base;
  return nB - nA;   // 正=Aが有利
}
function vegasStandings(g){ const teams=g.teams.filter(T=>vegasPair(g,T));   // 資格=参加メンバーちょうど2人
  const tot=teams.map(()=>0);
  for(let a=0;a<teams.length;a++) for(let b=a+1;b<teams.length;b++)   // 総当たり
    for(let i=0;i<18;i++){ const n=vegasHoleNet(g,teams[a],teams[b],i); if(n!=null){ tot[a]+=n; tot[b]-=n; } }
  return { teams, tot };
}

/* ---- 1 on 1 マッチプレー（§11.13・docs/handoff/2026-08-20-1on1-match.md §3/§4）----
   判定スコアはエブリ適用後 adjHole（チームHBH・スコア表と同一基準）。既存 §3 計算には一切触れない。 */
function m1HoleWin(g,pidA,pidB,i){ const a=adjHole(g,pidA,i), b=adjHole(g,pidB,i);
  if(a==null||b==null) return null;                       // 未入力/未開封はスキップ
  return a<b?'A' : b<a?'B' : 'H'; }                       // 少ない方が1UP・同打数はハーフ
function m1Result(g,pidA,pidB){ let upA=0,upB=0,half=0;
  for(let i=0;i<18;i++){ const w=m1HoleWin(g,pidA,pidB,i);
    if(w==='A')upA++; else if(w==='B')upB++; else if(w==='H')half++; }
  return { upA, upB, half, played:upA+upB+half, diff:upA-upB }; }   // diff>0=A勝ち/<0=B勝ち/0=AS。タイブレークなし
/* §4.1 前提: 「参加中かつ選手マスターに実在するメンバー」が1人以上のチーム。ちょうど2チームで抽選可 */
function m1MemberIds(g,T){ return T.memberIds.filter(pid=>g.participants.includes(pid)&&state.players.find(x=>x.id===pid)); }
function m1Teams(g){ return g.teams.filter(T=>m1MemberIds(g,T).length); }
/* §4.3 有効性チェック: 保存済み teamA/teamB が現在の2チームと一致し、pair の両 pid が該当チームの参加メンバーである試合のみ有効 */
function m1Valid(g){ const m=g.match1v1; if(!m||!m.teamA||!m.teamB||!(m.pairs||[]).length) return null;
  const T=m1Teams(g); if(T.length!==2) return null;
  const A=T.find(x=>x.id===m.teamA), B=T.find(x=>x.id===m.teamB);
  return (A&&B)? {A,B} : null; }
function m1ValidPairs(g){ const v=m1Valid(g); if(!v) return [];
  return g.match1v1.pairs.filter(([a,b])=> m1MemberIds(g,v.A).includes(a) && m1MemberIds(g,v.B).includes(b)); }

/* ---- チーム戦・種目別勝ち点（§11.15・docs/handoff/2026-08-20-team-points.md §3）----
   各種目の勝敗値の計算式（Σ effGross・Σ net・holesWon・best2・rlStandings・m1Result・vegasHoleNet）は不変。
   変わるのは「値→配点」の変換のみ：各成立種目の総合1位に勝ち点1（同点は山分け）→勝ち点合計の総合順位で配分。 */
/* §3.3.1 ニアドラ本数（NP＋DC獲得本数のチーム合計）。対象ホールはパー導出のみ（npdc-par §4 と同じ非破壊規則）。
   チーム未所属の勝者はどのチームにも数えない（個人配点は従来どおり別途付く）。 */
function niadoraTeamCount(g,T){ let n=0;
  niapinHolesOf(g).forEach(h=>{ const pid=(g.prizes.niapinWinner||{})[h]; if(pid&&T.memberIds.includes(pid))n++; });
  draconHolesOf(g).forEach(h=>{ const pid=(g.prizes.draconWinner||{})[h]; if(pid&&T.memberIds.includes(pid))n++; });
  return n;
}
/* §3.3.2 ベガス勝ちホール数：vegasStandings と同じ総当たりで vegasHoleNet の符号のみ数える。
   点差集計（vegasStandings.tot・ベガス表）は従来どおり独立＝本関数は読むだけで一切変えない。 */
function vegasHoleWins(g){ const teams=g.teams.filter(T=>vegasPair(g,T));   // 資格=参加メンバーちょうど2人（§11.11）
  const wins=teams.map(()=>0);
  for(let a=0;a<teams.length;a++) for(let b=a+1;b<teams.length;b++)
    for(let i=0;i<18;i++){ const n=vegasHoleNet(g,teams[a],teams[b],i);
      if(n!=null){ if(n>0)wins[a]++; else if(n<0)wins[b]++; } }   // 0（フリップ後も同数字）・null（未入力）は加算なし
  return {teams,wins};
}
/* §3.1〜3.2 種目別勝ち点。teams=順位対象チーム（メンバー1人以上かつ1H以上入力済み）。
   返り値 { teams, wins:number[], events:[{key,winners:int[],vals:(number|null)[]}] }（表示側 §6 と共用の正）。
   rlStandings/holesWon/vegasHoleWins は独自に g.teams をフィルタするため index 前提にせず team.id で突合する。 */
function teamWinPoints(g){
  const entered=pid=>(g.scores[pid]||[]).some(v=>v!=null&&v!=='');
  const teams=g.teams.filter(t=>t.memberIds.length&&t.memberIds.some(entered));
  const wins=teams.map(()=>0), events=[];
  if(teams.length<2) return {teams,wins,events};   // 成立条件（共通）：対象チーム2以上
  const F=chFormats(g);   // αではβ種目（best2ball/vegas）を懸けない（§11.12 C）
  const add=(key,vals,dir)=>{   // 種目の成立判定＋勝ち点1（同点は 1/同点チーム数 で山分け・§3.2）
    const live=vals.map((v,i)=>v!=null?i:-1).filter(i=>i>=0);
    if(live.length<2)return;   // 種目の対象チームが1以下＝不成立
    const best=(dir==='asc'?Math.min:Math.max)(...live.map(i=>vals[i]));
    const winners=live.filter(i=>vals[i]===best);
    winners.forEach(i=>wins[i]+=1/winners.length);
    events.push({key,winners,vals});
  };
  const byId=(list,fn)=>teams.map(t=>{ const j=list.findIndex(x=>x.id===t.id); return j>=0?fn(j):null; });
  if(F.teamGross) add('teamGross', teams.map(t=>t.memberIds.reduce((a,pid)=>a+effGross(g,pid),0)),'asc');
  if(F.teamNet) add('teamNet', teams.map(t=>Math.round(t.memberIds.reduce((a,pid)=>a+netScore(g,pid),0)*10)/10),'asc');
  if(F.holeByHole){ const hw=holesWon(g); if(hw.won.some(w=>w>0)) add('holeByHole', byId(hw.teams,j=>hw.won[j]),'desc'); }
  if(F.best2ball) add('best2ball', teams.map(t=>best2(g,t)),'asc');
  // ルーレット対抗：formats トグルなし・進行実績（決着ホール≥1）があれば自動で1種目。現行どおり実ゲーム curGame() 基準
  const st=rlStandings(curGame()||g);
  if(st.won.some(w=>w>0)) add('roulette', byId(st.teams,j=>st.won[j]),'desc');
  // 1 on 1：マッチ勝利数（引分は勝利数に入れない）。個人配点 m1win/m1draw は computePoints 側で従来どおり別途加算
  if(F.match1v1&&g.match1v1&&(g.match1v1.pairs||[]).length){ const v=m1Valid(g);
    if(v){ let played=0; const w={[v.A.id]:0,[v.B.id]:0};
      m1ValidPairs(g).forEach(([a,b])=>{ const r=m1Result(g,a,b); if(!r.played)return; played++;
        if(r.diff>0)w[v.A.id]++; else if(r.diff<0)w[v.B.id]++; });
      if(played) add('match1v1', teams.map(t=>w[t.id]!==undefined?w[t.id]:null),'desc'); } }
  // ラスベガス：勝ちホール数（§3.3.2）。点差ではない。成立=資格チーム≥2 かつ 勝ちホール合計≥1
  if(F.vegas){ const vw=vegasHoleWins(g);
    if(vw.teams.length>=2&&vw.wins.some(w=>w>0)) add('vegas', byId(vw.teams,j=>vw.wins[j]),'desc'); }
  // ニアドラ（§3.3.1）：他のチーム種目が1つ以上採用中（=チーム戦をやっている）かつ チームに数えた本数合計≥1
  const anyTeamEvent=F.teamGross||F.teamNet||F.holeByHole||F.best2ball||F.vegas||F.match1v1||st.won.some(w=>w>0);
  if(anyTeamEvent){ const nd=teams.map(t=>niadoraTeamCount(g,t));
    if(nd.reduce((a,b)=>a+b,0)>=1) add('niadora', nd,'desc'); }
  return {teams,wins,events};
}

/* ---- points & payout ---- */
function computePoints(g){
  const parts=g.participants.filter(pid=>state.players.find(x=>x.id===pid));
  const pts={}; parts.forEach(pid=>pts[pid]=0);
  const F=chFormats(g), P=g.points;   // αではβゲームを集計しない（§11.12 C）。g.formats は保持
  const entered=pid=>(g.scores[pid]||[]).some(v=>v!=null&&v!=='');   // 1H以上入力済み（表彰式では開封済みのみ）
  const iv=fn=>pid=> entered(pid)? fn(pid) : null;                    // 未入力＝ランキング対象外＝配点なし
  const awardInd=(cond,order,arr)=>{ if(!cond||!arr||!arr.length)return; order.forEach(o=>{ pts[o.pid]=(pts[o.pid]||0)+(arr[o.rank-1]||0); }); };
  awardInd(F.net, ranked(parts,iv(pid=>netScore(g,pid)),'asc'), P.net);
  awardInd(F.gross, ranked(parts,iv(pid=>effGross(g,pid)),'asc'), P.gross);
  awardInd(F.stableford, ranked(parts,iv(pid=>stablefordPts(g,pid)),'desc'), P.stableford);
  awardInd(F.olympic, ranked(parts,iv(pid=>olympicPts(g,pid)),'desc'), P.olympic);
  awardInd(F.callaway, ranked(parts,pid=>callawayNet(g,pid),'asc'), P.callaway);   // callawayNetは18H完了時のみ値
  awardInd(F.nassau, ranked(parts,iv(pid=>nassauTotalNet(g,pid)),'asc'), P.nassauTotal);
  // prizes（対象ホールは par から導出・対象外ホールの勝者エントリは無視＝+0pt。2026-08-20-npdc-par.md §4）
  niapinHolesOf(g).forEach(h=>{ const pid=(g.prizes.niapinWinner||{})[h]; if(pid&&pts[pid]!=null)pts[pid]+=(P.niapin||0); });
  draconHolesOf(g).forEach(h=>{ const pid=(g.prizes.draconWinner||{})[h]; if(pid&&pts[pid]!=null)pts[pid]+=(P.dracon||0); });
  // 1 on 1 マッチプレー（§11.13 §6）：勝者+m1win/引分両者+m1draw。個人にのみ加算（チーム全員加算はしない）
  if(F.match1v1 && g.match1v1 && (g.match1v1.pairs||[]).length){
    m1ValidPairs(g).forEach(([a,b])=>{ const r=m1Result(g,a,b); if(!r.played)return;   // 有効試合のみ・未プレーは配点なし
      if(r.diff>0){ if(pts[a]!=null)pts[a]+=(P.m1win||0); }
      else if(r.diff<0){ if(pts[b]!=null)pts[b]+=(P.m1win||0); }
      else { if(pts[a]!=null)pts[a]+=(P.m1draw||0); if(pts[b]!=null)pts[b]+=(P.m1draw||0); } });
  }
  // teams（§11.15・team-points §3.4）：種目別勝ち点→総合順位（同点は同順位・満額＝1,1,3方式）→ teamRankPts をチーム各員に満額加算
  if(g.teams.length){
    const {teams,wins,events}=teamWinPoints(g);
    if(events.length){   // 成立種目0なら配分しない
      const rows=teams.map((t,i)=>({t,v:wins[i]})); rows.sort((a,b)=>b.v-a.v);
      let rank=0,prev=null;
      rows.forEach((r,i)=>{ if(prev===null||r.v!==prev){rank=i+1;prev=r.v;}
        const p=(P.teamRankPts||[])[rank-1]||0;
        r.t.memberIds.forEach(pid=>{ if(pts[pid]!=null)pts[pid]+=p; }); });
    }
  }
  return pts;
}
function computePayout(g){
  const pts=computePoints(g); const parts=Object.keys(pts);
  const total=parts.reduce((a,pid)=>a+pts[pid],0);
  const pool=g.prizePool||0;
  const out={}; parts.forEach(pid=>{ out[pid]= (total>0&&pool>0)? Math.round(pool*pts[pid]/total) : 0; });
  return {pts,payout:out,total,pool};
}
/* next kanji（§11.17・2026-08-29-host-option.md §11）: 対象順位 kanjiRanks（1位/2位/ブービー）を
   順位ごとの dir 方向（down=下位方向/up=上位方向）に免除(kanjiExempt)スキップして解決。
   端を越えたらその対象は該当なし・同一人物への重複はバッジ1個（pid 重複排除）。表示専用・配点非関与 */
function nextKanji(g){
  const parts=g.participants.filter(pid=>{const p=state.players.find(x=>x.id===pid); return p && gross(g,pid)>0;});
  const order=ranked(parts,pid=>netScore(g,pid),'asc').map(r=>r.pid);
  const N=order.length, R=g.kanjiRanks;
  const exempt=pid=>{const p=state.players.find(x=>x.id===pid); return !p||p.kanjiExempt;};
  const resolve=(i0,dir)=>{ const step=dir==='up'?-1:1;
    for(let i=i0; i>=0&&i<N; i+=step){ if(!exempt(order[i])) return order[i]; } return null; };
  const T=[]; if(R.r1.enabled)T.push([0,R.r1.dir]); if(R.r2.enabled)T.push([1,R.r2.dir]); if(R.booby.enabled)T.push([N-2,R.booby.dir]);
  return [...new Set(T.filter(([i])=>i>=0&&i<N).map(([i,d])=>resolve(i,d)).filter(Boolean))];
}

