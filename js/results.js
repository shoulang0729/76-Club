/* ============================ RESULTS ============================ */
function setResultSub(s){ if(s!=='roulette')rlStopTimer(); resultSub=s; renderResult(); }
// 開封済みホール(revealHoles)までのスコアだけ集計に使うビュー用ゲーム（18=全開）
function viewGame(g){
  if(revealHoles>=18) return g;
  const scores={};
  g.participants.forEach(pid=>{ const a=g.scores[pid]||[]; scores[pid]=a.map((v,i)=> i<revealHoles? v : null); });
  return Object.assign({}, g, {scores});
}
function openNextHole(){ revealHoles=Math.min(18,revealHoles+1); renderResult(); }
function closeHole(){ revealHoles=Math.max(0,revealHoles-1); renderResult(); }
function openAllHoles(){ revealHoles=18; renderResult(); }
function resetHoles(){ revealHoles=0; renderResult(); }

function renderResult(){
  const el=document.getElementById('view-result'); const g0=curGame();
  if(!g0){ el.innerHTML=`<div class="empty">${t('result.noGame')}</div>`; return; }
  const parts=g0.participants.filter(pid=>state.players.find(x=>x.id===pid));
  if(!parts.length){ el.innerHTML=`<div class="empty">${t('result.noParts')}</div>`; return; }
  const g=viewGame(g0);   // 開封済みホールのみ反映
  const partial = revealHoles<18 ? `<span class="tag tagtie">${revealHoles}/18H</span>` : '';
  let sticky=`<div class="result-sticky"><div class="subtab4">
      <button class="${resultSub==='prize'?'on':''}" onclick="setResultSub('prize')">${t('result.sub.prize')}</button>
      <button class="${resultSub==='ind'?'on':''}" onclick="setResultSub('ind')">${t('result.sub.ind')}</button>
      <button class="${resultSub==='team'?'on':''}" onclick="setResultSub('team')">${t('result.sub.team')}</button>
      <button class="${resultSub==='roulette'?'on':''}" onclick="setResultSub('roulette')">${t('result.sub.roulette')}</button>
      <button class="${resultSub==='pts'?'on':''}" onclick="setResultSub('pts')">${t('result.sub.pts')}</button>
    </div></div>`;
  let body;
  if(resultSub==='pts') body=renderStanding(g, parts);
  else if(resultSub==='ind') body=renderIndividual(g, parts);
  else if(resultSub==='prize') body=renderPrizeTab(g);
  else if(resultSub==='roulette') body=renderRouletteTab(g0);   // 実スコアで動作
  else body=renderTeamTab(g);
  el.innerHTML = sticky + body;
}

// 配分タブ
function renderStanding(g, parts){
  const {pts,payout,total,pool}=computePayout(g);
  const prows=parts.map(pid=>({pid,pt:pts[pid]||0,yen:payout[pid]||0})).sort((a,b)=>b.pt-a.pt);
  return `<div class="card payoutcard"><h2>${t('standing.title')} ${statusBadge(g)}</h2>
    <div class="muted">${t('standing.total',{t:total})}${pool?t('standing.poolNote',{p:pool.toLocaleString()}):t('standing.noPool')}。${revealHoles<18?t('standing.revealNote',{n:revealHoles}):t('standing.autoNote')}</div>
    <table class="lb" class="mt6"><tr><th>${t('col.rank')}</th><th>${t('col.player')}</th><th>${t('col.points')}</th>${pool?`<th>${t('col.payout')}</th>`:''}</tr>
    ${prows.map((r,i)=>{const p=state.players.find(x=>x.id===r.pid);
      return `<tr class="rank ${i===0&&r.pt>0?'rank1':''}"><td>${r.pt>0?(i+1):'-'}</td><td class="tal">${esc(p.name)}</td><td><b>${r.pt}</b>pt</td>${pool?`<td><b>¥${r.yen.toLocaleString()}</b></td>`:''}</tr>`}).join('')}
    </table></div>`;
}

// 個人戦タブ（上：スコア表 / 下：各順位を左から右に並べる）
function renderIndividual(g, parts){
  const F=chFormats(g);   // αではβゲームを表示しない（§11.12 C）
  const done=parts.filter(pid=>complete(g,pid)).length;
  const banner = allComplete(g)
    ? `<div class="card" style="background:var(--win-bg)">${t('ind.finalBanner',{N:parts.length})}</div>`
    : `<div class="card" style="background:var(--acc-bg)">${t('ind.provBanner',{n:done,N:parts.length,rev:revealHoles<18?t('ind.revealing',{h:revealHoles}):''})}</div>`;
  // 次回幹事（ネットで決定）：バッジをネット順位の2位/ブービー行に表示（タイトル横の注記は廃止）
  const nk=nextKanji(g); const hl={};
  if(nk){ hl[nk.nikai]=t('term.organizer'); hl[nk.booby]=t('term.organizer'); }

  // 順位カード（左→右の順）：グロス→ネット→ステーブル→オリンピック→キャロウェイ→握り
  let cards='';
  if(F.gross) cards+=rankCardNS(g.womenEvery.enabled?t('result.grossEvery'):t('term.gross'), parts, pid=>effGross(g,pid), 'asc', v=>v, 'gross', null);
  if(F.net) cards+=rankCardNS(t('term.net'), parts, pid=>netScore(g,pid), 'asc', v=>v, 'net', hl);
  if(F.stableford) cards+=leaderboard(t('term.stableford'), parts, pid=>stablefordPts(g,pid), 'desc', v=>v+'pt', '', 'stb');
  if(F.olympic) cards+=leaderboard(t('term.olympic'), parts, pid=>olympicPts(g,pid), 'desc', v=>v+'pt', '', 'oly');
  if(F.callaway) cards+=leaderboard(t('term.callaway'), parts, pid=>callawayNet(g,pid),'asc',v=>v,'', 'cal');
  if(F.nassau) cards+=leaderboard(t('pts.nassauTotal'), parts, pid=>nassauTotalNet(g,pid),'asc',v=>v,'', 'nas');

  const scorecard = renderScorecard(g,parts,null);
  return banner + scorecard + `<div class="rank-wrap">${cards}</div>
    <details class="mt10"><summary>${t('rule.summary')}</summary><div class="in">
      <div class="rule">${t('rule.net')}</div>
      <div class="rule">${t('rule.gross')}</div>
      ${CHANNEL==='b'?`<div class="rule">${t('rule.stableford')}</div>
      <div class="rule">${t('rule.olympic')}</div>
      <div class="rule">${t('rule.callaway')}</div>
      <div class="rule">${t('rule.nassau')}</div>
      <div class="rule">${t('rule.vegas')}</div>`:''}
    </div></details>`;
}

// 左パネル：全18ホール＋OUT/IN小計＋Gross/HDCP/Net を合体した1枚のスコアカード（横スクロールなし）
/* ★共通スコアカード（個人戦・チーム戦で同一仕様）。枠は全18ホール固定、開封ホールに値が入る。
   列: 選手 | 1-9 | OUT | 10-18 | IN | 計 | HD | Net。ホール幅は全て均等・合計欄5列は全て同一幅。
   teams を渡すとチーム別（見出し＋メンバー＋チーム小計＋ホール勝敗ハイライト）。*/
const SC_COLGROUP = (()=>{ const F=[0,1,2,3,4,5,6,7,8],B=[9,10,11,12,13,14,15,16,17];
  return `<colgroup><col class="cnm">${F.map(()=>'<col class="ch">').join('')}<col class="cs">${B.map(()=>'<col class="ch">').join('')}<col class="cs"><col class="cs"><col class="cs"><col class="cs"></colgroup>`; })();
function renderScorecard(g, parts, teams){
  const n=revealHoles;
  const F9=[0,1,2,3,4,5,6,7,8], B9=[9,10,11,12,13,14,15,16,17];
  const hh=i=>g.hidden[i]?'hh':'';
  const MT=v=> show.totals ? v : '<span class="mask">···</span>';   // 合計値の表示/非表示
  const parOut=sum(g.par,0,9), parIn=sum(g.par,9,18);
  const head=`<tr><th class="nm">${t('col.player')}</th>${F9.map(i=>`<th class="${hh(i)}">${i+1}</th>`).join('')}<th class="sub">OUT</th>${B9.map(i=>`<th class="${hh(i)}">${i+1}</th>`).join('')}<th class="sub">IN</th><th class="tot">${t('col.total')}</th><th class="tot">${t('col.hd')}</th><th class="netc">${t('col.net')}</th></tr>`;
  const parRow=`<tr class="parr"><td class="nm">Par</td>${F9.map(i=>`<td class="${hh(i)}">${g.par[i]}</td>`).join('')}<td class="sub">${MT(parOut)}</td>${B9.map(i=>`<td class="${hh(i)}">${g.par[i]}</td>`).join('')}<td class="sub">${MT(parIn)}</td><td class="tot">${MT(parOut+parIn)}</td><td class="tot">-</td><td class="netc">-</td></tr>`;
  const pRow=(pid)=>{ const p=state.players.find(x=>x.id===pid); const av=adjArr(g,pid);
    const cell=i=>`<td class="${hh(i)}">${av[i]??''}</td>`;
    return `<tr><td class="nm">${esc(p.name)}</td>${F9.map(cell).join('')}<td class="sub">${MT(sum(av,0,9)||'')}</td>${B9.map(cell).join('')}<td class="sub">${MT(sum(av,9,18)||'')}</td><td class="tot">${MT(effGross(g,pid)||'')}</td><td class="tot">${MT(periaHdcp(g,pid))}</td><td class="netc">${MT(netScore(g,pid))}</td></tr>`; };
  /* §11.12 I: 選択指標での並べ替え。ranked()＋tieBreak を流用＝順位カードと同じ並び。
     値が無い（未入力）選手は ranked() から落ちるので、元の順序のまま末尾に付ける。 */
  const sortPids=(pids,metric)=>{
    const val = metric==='gross' ? (pid=>effGross(g,pid)) : (pid=>netScore(g,pid));
    const ord = ranked(pids, pid=>(enteredCount(g,pid)? val(pid) : null), 'asc').map(o=>o.pid);
    return ord.concat(pids.filter(pid=>!ord.includes(pid)));
  };
  const swBtn=(cur,v,label,fn)=>`<button class="${cur===v?'on':''}" onclick="${fn}('${v}')">${label}</button>`;
  const sortSw = teams
    ? `<span class="scsw">${swBtn(scSortTeam,'gross',t('term.gross'),'setScSortTeam')}${swBtn(scSortTeam,'net',t('term.net'),'setScSortTeam')}${swBtn(scSortTeam,'hbh',t('sc.hbh'),'setScSortTeam')}</span>`
    : `<span class="scsw">${swBtn(scSortInd,'gross',t('term.gross'),'setScSortInd')}${swBtn(scSortInd,'net',t('term.net'),'setScSortInd')}</span>`;
  let body='', note='';
  if(teams && teams.length){
    const colorOf=name=>tmColor(name);
    const tAt=(t,i)=>{let s=0,c=0;t.memberIds.forEach(pid=>{const v=adjHole(g,pid,i);if(v!=null){s+=v;c++;}});return c?s:null;};
    const winAt=[]; for(let i=0;i<18;i++){const tot=teams.map(t=>tAt(t,i));const val=tot.filter(v=>v!=null);winAt.push(val.length?tot.map((v,ti)=>v===Math.min(...val)?ti:-1).filter(x=>x>=0):[]);}
    const won=teams.map((_,ti)=>{let w=0;winAt.forEach(ws=>{if(ws.includes(ti))w+=1/ws.length;});return w;});
    /* §11.12 I: チームは選択指標で並べ替え（グロス/ネット=合計の昇順・HBH=取得ホール数の降順）。
       winAt は元の teams インデックス基準なので、並べ替えは表示順（ti を保持）だけで行う。 */
    const tGrossOf=T=>T.memberIds.reduce((a,pid)=>a+effGross(g,pid),0);
    const tNetOf=T=>Math.round(T.memberIds.reduce((a,pid)=>a+netScore(g,pid),0)*10)/10;
    const order=teams.map((tm,ti)=>({tm,ti}));
    order.sort((a,b)=> scSortTeam==='hbh' ? won[b.ti]-won[a.ti]
      : scSortTeam==='gross' ? tGrossOf(a.tm)-tGrossOf(b.tm) : tNetOf(a.tm)-tNetOf(b.tm));
    order.forEach(({tm,ti})=>{ const col=colorOf(tm.name);
      body+=`<tr><td class="nm" colspan="24" style="background:${col};color:var(--bg);font-weight:var(--w-bold);text-align:left">${esc(tm.name)}</td></tr>`;
      // メンバーは個人スコア順（グロス=エブリ後グロス／ネット・HBH=ネット）
      sortPids(tm.memberIds.filter(pid=>state.players.find(x=>x.id===pid)), scSortTeam==='gross'?'gross':'net')
        .forEach(pid=>{ body+=pRow(pid); });
      const tCell=(i)=>{ if(!show.totals) return '<td><span class="mask">·</span></td>';   // 合計値OFFなら値も色も隠す
        const s=tm.memberIds.reduce((a,pid)=>a+(adjHole(g,pid,i)||0),0); return `<td class="${winAt[i].includes(ti)?'winc':''}">${s||''}</td>`;};
      const tGross=tm.memberIds.reduce((a,pid)=>a+effGross(g,pid),0);
      const tNet=Math.round(tm.memberIds.reduce((a,pid)=>a+netScore(g,pid),0)*10)/10;
      const tOut=tm.memberIds.reduce((a,pid)=>a+sum(adjArr(g,pid),0,9),0);
      const tIn=tm.memberIds.reduce((a,pid)=>a+sum(adjArr(g,pid),9,18),0);
      body+=`<tr class="parr tsum"><td class="nm" style="color:${col};font-weight:var(--w-bold)">${t('col.total')}</td>${F9.map(i=>tCell(i)).join('')}<td class="sub">${MT(tOut||'')}</td>${B9.map(i=>tCell(i)).join('')}<td class="sub">${MT(tIn||'')}</td><td class="tot">${MT(tGross||'')}</td><td class="tot">-</td><td class="netc">${MT(tNet||'')}</td></tr>`;
    });
    note=t('sc.noteTeam');
  } else {
    body=sortPids(parts, scSortInd).map(pid=>pRow(pid)).join('');
    note=t('sc.noteHidden');
  }
  return `<div class="card"><h2 class="lbh"><span>${t('sc.title')}${teams?t('sc.teamSuffix'):''} <span class="tag tagtie">${n>=18?t('sc.allHoles'):n+'/18H'}</span></span>
      <span class="scsw-wrap"><span class="scsw-l">${t('sc.sort')}</span>${sortSw}</span>
      <span class="tgl ${show.totals?'on':'off'}" onclick="toggleShow('totals')">${t('sc.totalsTgl')} ${show.totals?t('btn.show'):t('btn.hide')}</span></h2>
    <div class="reveal-bar">
      <button class="btn gray sm" onclick="resetHoles()" ${n<=0?'disabled':''}>${t('btn.reset')}</button>
      <button class="btn gray sm" onclick="closeHole()" ${n<=0?'disabled':''}>${t('sc.prev')}</button>
      <button class="btn gold sm" onclick="openNextHole()" ${n>=18?'disabled':''}>${t('sc.next')}</button>
      <button class="btn gray sm" onclick="openAllHoles()" ${n>=18?'disabled':''}>${t('btn.all')}</button>
    </div>
    <table class="sc2" class="mt8">${SC_COLGROUP}${head}${parRow}${body}</table>
    <div class="muted" class="mt6">${note} ${t('sc.noteCols')}${n<18?t('sc.noteOpen'):''}</div>
  </div>`;
}

// グロス/ネット専用の順位カード（名前・スコアを表ごと master ＋順位ごとの目隠しボタンで制御。バッジは常時表示）
function rankCardNS(title, pids, valFn, dir, fmt, table, hlMap){
  const rows=ranked(pids,valFn,dir);
  const nameOf=pid=>{const p=state.players.find(x=>x.id===pid);return esc(p&&p.name);};
  const nsOn = nsMode[table]==='show';
  const tools=`<div class="cardtools">
    <span class="tgl ${nsOn?'on':'off'}" onclick="toggleNSAll('${table}')">${nsOn?t('ns.allShow'):t('ns.allHide')}</span></div>`;
  const body=`<table class="lb big"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.player')}</th><th class="c-val">${dir==='asc'?t('col.score'):t('col.pts')}</th></tr>
    ${rows.map(r=>{ const hb=hlMap&&hlMap[r.pid]; const m=nsMasked(table,r.pid);
      const nm = m ? '<span class="mask">※※※</span>' : nameOf(r.pid);
      const sv = m ? '<span class="mask">？</span>' : `<b>${fmt(r.v)}</b>`;
      return `<tr class="rank ${hb?'hlrow':''}"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleNSRow('${table}','${r.pid}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(r.rank,r.rank===1)}</td><td class="nmc">${nm}${hb?`<span class="kanjibadge">${hb}</span>`:''}</td><td class="c-val">${sv}</td></tr>`; }).join('')}</table>`;
  return `<div class="card tight wide"><h2 class="lbh"><span>${title}</span></h2>${tools}${body}</div>`;
}

// ニアピン/ドラコン タブ
function renderPrizeTab(g){
  const P=g.prizes;
  if(!P.niapinHoles.length && !P.draconHoles.length)
    return `<div class="card"><h2>${t('prize.title')}</h2><div class="empty">${t('prize.emptyCfg')}</div></div>`;
  return renderPrizes(g);
}

// チーム戦タブ（上：チーム別スコア表(ホール勝敗を直接表示) / 下：対抗結果を左→右に並べる）
function renderTeamTab(g){
  const F=chFormats(g);   // αではβゲームを表示しない（§11.12 C）
  const anyTeamFmt = F.teamGross||F.teamNet||F.holeByHole||F.best2ball||F.vegas;
  if(!g.teams.filter(t=>t.memberIds.length).length)
    return `<div class="card"><h2>${t('team.title')}</h2><div class="empty">${t('team.emptyTeams')}</div></div>`;
  if(!anyTeamFmt)
    return `<div class="card"><h2>${t('team.title')}</h2><div class="empty">${t('team.emptyFmt')}</div></div>`;
  const teams=g.teams.filter(t=>t.memberIds.length);
  return renderScorecard(g, g.participants, teams) + `<div class="rank-wrap">${renderTeams(g)}</div>`;
}

