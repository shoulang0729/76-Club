/* ============================ RESULTS ============================ */
/* 1 on 1 のオープン演出用表示状態（§13.2/§14.1・揮発＝再読込で既定に戻る。localStorage には保存しない） */
let m1RevealMode='all';      // 'all'=全組一括（既定） | 'one'=一組ずつ
let m1Opened=new Map();      // 一組ずつモードのオープン済みカード（キー='pidA:pidB'・並び替え/削除に不変。値=その組の開封ホール数0〜18 §14.1）
/* 2階層タブの表示状態（2026-08-20-results-regroup.md §4.1・揮発＝再読込で個人戦＞ニアドラに戻る。localStorage 非保存） */
let resGrp='ind';                             // 'ind' | 'team' | 'pts'
let resGame={ ind:'prize', team:'overall' };  // グループ別の選択中ゲームタブ（セッション内は記憶）
/* ニアドラヒーローの伏せ演出（§5.1.1 D18・nsMode/nsExcept と同型の揮発状態。キー=ホールindex・NP/DC は対象ホールが素で排他） */
let pzMode='show'; let pzExcept=new Set();
function pzMasked(h){ return (pzMode==='hide') !== pzExcept.has(h); }
function togglePzAll(){ pzMode = pzMode==='show'?'hide':'show'; pzExcept.clear(); renderResult(); }
function togglePzCell(h){ if(pzExcept.has(h)) pzExcept.delete(h); else pzExcept.add(h); renderResult(); }
function setResGrp(grp){ if(!(grp==='team'&&resGame.team==='roulette')) rlStopTimer(); resGrp=grp; renderResult(); }
function setResGame(k){ if(k!=='roulette') rlStopTimer();
  resGame[resGrp]=k;
  if(resGrp==='ind' && (k==='gross'||k==='net')) scSortInd=k;                       // §3 D8: スコア表の並べ替え自動追従
  if(resGrp==='team'&& (k==='gross'||k==='net'||k==='hbh')) scSortTeam=k;           // §3 D8
  renderResult(); }
/* 下段ゲームタブのリスト（§4.3。表示条件=採用中フォーマット連動 D9。'pts' は []＝下段なし）
   チーム戦ニアドラタブは team-points PR-②（#67）で追加＝本件ではスロット定義のみ（§6） */
function resGameTabs(grp,g){ const F=chFormats(g); const T=[];
  if(grp==='ind'){
    T.push(['prize', t('result.sub.prize')]);                    // 常時（対象ホールなしは中身の empty）
    if(F.gross)      T.push(['gross', t('term.gross')]);
    if(F.net)        T.push(['net',   t('term.net')]);
    if(F.stableford) T.push(['stb',   t('term.stableford')]);
    if(F.olympic)    T.push(['oly',   t('term.olympic')]);
    if(F.callaway)   T.push(['cal',   t('term.callaway')]);
    if(F.nassau)     T.push(['nas',   t('pts.nassauTotal')]);
  } else if(grp==='team'){
    T.push(['overall', t('result.sub.overall')]);                // 常時（空状態は §5.2）
    if(F.teamGross)  T.push(['gross', t('term.gross')]);
    if(F.teamNet)    T.push(['net',   t('term.net')]);
    if(F.holeByHole) T.push(['hbh',   t('term.hbh')]);
    if(F.best2ball)  T.push(['b2',    t('term.best2')]);
    if(F.vegas)      T.push(['vegas', t('term.vegas')]);
    if(F.match1v1)   T.push(['m1',    t('result.sub.match1v1')]);
    T.push(['roulette', t('result.sub.roulette')]);              // 常時（format トグルなし・現行踏襲）
  }
  return T;
}
// 先頭 n ホールのスコアだけ残した集計用ビューゲーム（n>=18=全開・§14.1 の一般化ヘルパー）
function viewGameN(g,n){
  if(n>=18) return g;
  const scores={};
  g.participants.forEach(pid=>{ const a=g.scores[pid]||[]; scores[pid]=a.map((v,i)=> i<n? v : null); });
  return Object.assign({}, g, {scores});
}
// 開封済みホール(revealHoles)までのスコアだけ集計に使うビュー用ゲーム（既存呼び出しは挙動不変）
function viewGame(g){ return viewGameN(g,revealHoles); }
function openNextHole(){ revealHoles=Math.min(18,revealHoles+1); renderResult(); }
function closeHole(){ revealHoles=Math.max(0,revealHoles-1); renderResult(); }
function openAllHoles(){ revealHoles=18; renderResult(); }
function resetHoles(){ revealHoles=0; renderResult(); }

function renderResult(){
  const el=document.getElementById('view-result'); const g0=curGame();
  if(!g0){ el.innerHTML=`<div class="empty">${t('result.noGame')}</div>`; return; }
  const parts=g0.participants.filter(pid=>state.players.find(x=>x.id===pid));
  if(!parts.length){ el.innerHTML=`<div class="empty">${t('result.noParts')}</div>`; return; }
  const tabs=resGameTabs(resGrp,g0);
  if(tabs.length && !tabs.some(([k])=>k===resGame[resGrp])) resGame[resGrp]=tabs[0][0];   // タブ消失（形式OFF・α切替）→グループ先頭へフォールバック
  const g=viewGame(g0);   // 開封済みホールのみ反映
  let body, m1Head='';
  if(resGrp==='pts') body=renderStanding(g, parts);
  else if(resGrp==='ind') body=renderIndGame(g, parts, resGame.ind);
  else if(resGame.team==='m1'){ const P=renderMatch1v1Parts(g0);   // 生ゲームを渡す（マスクはモード別に内部で・§14.1）。head=サマリ＋操作バー（sticky 同居・D15）
    m1Head=P.head; body=P.body; }
  else body=renderTeamGame(g, g0, parts, resGame.team);            // roulette は g0（生・実スコアで動作）
  const grpBtn=k=>`<button class="${resGrp===k?'on':''}" onclick="setResGrp('${k}')">${t('result.sub.'+k)}</button>`;
  const sticky=`<div class="result-sticky">
    <div class="subtab4">${grpBtn('ind')}${grpBtn('team')}${grpBtn('pts')}</div>
    ${tabs.length?`<div class="subtab-games">${tabs.map(([k,lb])=>`<button class="${resGame[resGrp]===k?'on':''}" onclick="setResGame('${k}')">${lb}</button>`).join('')}</div>`:''}
    ${m1Head}
  </div>`;
  el.innerHTML = sticky + body;
  const on=el.querySelector('.subtab-games .on'); if(on) on.scrollIntoView({inline:'center',block:'nearest'});
}
// 当該ゲーム1件のルール解説（D12: 全ルール一括 details を廃止し、各タブ末尾に1行だけ）
function ruleBox(key){ return `<details class="mt10"><summary>${t('rule.summary')}</summary><div class="in"><div class="rule">${t(key)}</div></div></details>`; }

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

// 個人戦グループ（§5.1）: key ごとに バナー＋当該順位カード（上）＋共通スコアカード（下）＋当該ルール1行
function renderIndGame(g, parts, key){
  if(key==='prize'){   // ニアドラ: ヒーロー主役＋勝者登録は details 内に控えめ（§5.1.1。prizes は viewGame 非依存＝g で同値）
    if(!niapinHolesOf(g).length && !draconHolesOf(g).length)
      return `<div class="card"><h2>${t('prize.title')}</h2><div class="empty">${t('prize.emptyCfg')}</div></div>`;
    return renderPrizeHero(g)
      + `<details class="prize-edit mt10"><summary>${t('prize.recTitle')}</summary><div class="in">${renderPrizes(g)}</div></details>`;
  }
  const done=parts.filter(pid=>complete(g,pid)).length;
  const banner = allComplete(g)
    ? `<div class="card" style="background:var(--win-bg)">${t('ind.finalBanner',{N:parts.length})}</div>`
    : `<div class="card" style="background:var(--acc-bg)">${t('ind.provBanner',{n:done,N:parts.length,rev:revealHoles<18?t('ind.revealing',{h:revealHoles}):''})}</div>`;
  let card='', rule='';
  if(key==='gross'){ card=rankCardNS(g.womenEvery.enabled?t('result.grossEvery'):t('term.gross'), parts, pid=>effGross(g,pid), 'asc', v=>v, 'gross', null); rule='rule.gross'; }
  else if(key==='net'){
    // 次回幹事（ネットで決定）：バッジをネット順位の2位/ブービー行に表示（ネットタブのみ・現行どおり）
    const nk=nextKanji(g); const hl={};
    if(nk){ hl[nk.nikai]=t('term.organizer'); hl[nk.booby]=t('term.organizer'); }
    card=rankCardNS(t('term.net'), parts, pid=>netScore(g,pid), 'asc', v=>v, 'net', hl); rule='rule.net'; }
  else if(key==='stb'){ card=leaderboard(t('term.stableford'), parts, pid=>stablefordPts(g,pid), 'desc', v=>v+'pt', '', 'stb'); rule='rule.stableford'; }
  else if(key==='oly'){ card=leaderboard(t('term.olympic'), parts, pid=>olympicPts(g,pid), 'desc', v=>v+'pt', '', 'oly'); rule='rule.olympic'; }
  else if(key==='cal'){ card=leaderboard(t('term.callaway'), parts, pid=>callawayNet(g,pid),'asc',v=>v,'', 'cal'); rule='rule.callaway'; }
  else if(key==='nas'){ card=leaderboard(t('pts.nassauTotal'), parts, pid=>nassauTotalNet(g,pid),'asc',v=>v,'', 'nas'); rule='rule.nassau'; }
  return banner + `<div class="rank-wrap">${card}</div>` + renderScorecard(g,parts,null) + ruleBox(rule);
}

/* ニアドラのヒーロー表示（§5.1.1 D16〜D18・投影原則 §11.14）:
   ホール番号昇順・NP/DC 混在・区分文字併記。数値階層はルーレットパネルと同型（--f-rl-hole > --f-rl-name） */
function renderPrizeHero(g){
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  const cells=[...NP.map(h=>({h,kind:'np'})),...DC.map(h=>({h,kind:'dc'}))].sort((a,b)=>a.h-b.h);
  const on = pzMode==='show';
  const tools=`<div class="cardtools"><span class="tgl ${on?'on':'off'}" onclick="togglePzAll()">${on?t('ns.allShow'):t('ns.allHide')}</span></div>`;
  const cell=({h,kind})=>{
    const pid = kind==='np' ? g.prizes.niapinWinner[h] : g.prizes.draconWinner[h];
    const p = pid ? state.players.find(x=>x.id===pid) : null;
    const top=`<div class="npdc-top"><span class="npdc-hole">${h+1}<small>H</small></span><span class="npdc-kind">${kind==='np'?t('term.niapin'):t('term.dracon')}</span></div>`;
    if(!p) return `<div class="npdc-cell ${kind}" style="cursor:default">${top}<div class="npdc-name empty">—</div></div>`;   // 未登録: 伏せ対象外・タップ無効
    const nm = pzMasked(h) ? '<span class="mask">？？？</span>' : esc(p.name);
    return `<div class="npdc-cell ${kind}" onclick="togglePzCell(${h})">${top}<div class="npdc-name">${nm}</div></div>`; };
  return `<div class="card"><h2 class="lbh"><span>${t('prize.title')}</span></h2>${tools}<div class="npdc-hero">${cells.map(cell).join('')}</div></div>`;
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

/* チーム戦グループ（§5.2）: key ごとに 当該対抗カード（上）＋チーム別スコア表（下・グロス/ネット/HBH と総合のみ）。
   'm1' は renderResult 側で renderMatch1v1Parts を直接使う（sticky 同居 D15）。
   総合タブは現時点ではチーム別スコア表のみ（総合カード/勝ち点表は team-points PR-②・§6 で投入） */
function renderTeamGame(g, g0, parts, key){
  if(key==='roulette') return renderRouletteTab(g0);   // 現行そのまま（自前ガード rl.need2）
  const teams=g.teams.filter(t=>t.memberIds.length);
  if(!teams.length)
    return `<div class="card"><h2>${t('team.title')}</h2><div class="empty">${t('team.emptyTeams')}</div></div>`;
  const sc=()=>renderScorecard(g, g.participants, teams);
  if(key==='overall') return sc();
  if(key==='gross') return `<div class="rank-wrap">${renderTeams(g,'teamGross')}</div>` + sc();
  if(key==='net')   return `<div class="rank-wrap">${renderTeams(g,'teamNet')}</div>` + sc();
  if(key==='hbh')   return `<div class="rank-wrap">${renderTeams(g,'holeByHole')}</div>` + sc();
  if(key==='b2')    return `<div class="rank-wrap">${renderTeams(g,'best2ball')}</div>`;
  if(key==='vegas') return `<div class="rank-wrap">${renderTeams(g,'vegas')}</div>` + ruleBox('rule.vegas');
  return '';
}

/* ---- 1 on 1 マッチプレー タブ（§11.13・docs/handoff/2026-08-20-1on1-match.md §13 が正。一組ずつモードの開封は §14・編集UIの置き場所とサマリ表示は §15 が正）----
   組合せ=幹事の手動作成（編集UIは §15.1 で選手タブ js/players.js へ移設＝本タブは閲覧・オープン演出専用）。判定/配点/データ構造（§3/§5/§6）は不変。
   投影原則（正本 §11.14）適用第1号: 大型UP表示が主役。 */
// オープン演出（§13.2/§14.1）: 表示状態のみを更新（save() しない＝localStorage 非保存）
function m1Key(a,b){ return a+':'+b; }
function m1SetMode(mode){ if(mode!==m1RevealMode) m1Opened.clear(); m1RevealMode=mode; renderResult(); }   // モード切替で組状態リセット（§14.1）
function m1OpenCard(k){ m1Opened.set(k,0); renderResult(); }   // オープン直後=0開封（全ホール伏せ・§14.1）
function m1OpenNext(){ const g=curGame(); if(!g)return;
  const k=m1ValidPairs(g).map(([a,b])=>m1Key(a,b)).find(x=>!m1Opened.has(x));   // 未オープンの先頭＝登録リスト順
  if(k){ m1Opened.set(k,0); renderResult(); } }
function m1OpenAllCards(){ const g=curGame(); if(!g)return;
  m1ValidPairs(g).forEach(([a,b])=>m1Opened.set(m1Key(a,b),18)); renderResult(); }   // 演出スキップ＝全開
function m1CoverAll(){ m1Opened.clear(); renderResult(); }
// 組ローカルのホール開封（一組ずつモード・カード内バー §14.2）
function m1Holes(k,op){ const c=m1Opened.get(k)||0;
  m1Opened.set(k, op==='reset'?0 : op==='prev'?Math.max(0,c-1) : op==='next'?Math.min(18,c+1) : 18);
  renderResult(); }

/* §8.3 D15: 返り値 {head, body}。head=チームサマリカード＋共通開封バーカード（.result-sticky 同居＝固定）・body=対戦カード群。
   ガード時（emptyFmt / need2Teams / 組合せなし）は {head:'', body:空状態カード}＝空状態は固定しない。中身/挙動は §13〜§15 のまま不変 */
function renderMatch1v1Parts(g){
  const F=chFormats(g);   // αでは match1v1 は一律 false（§11.12 C）
  if(!F.match1v1) return {head:'', body:`<div class="card"><h2>${t('term.match1v1')}</h2><div class="empty">${t('m1.emptyFmt')}</div></div>`};
  const T=m1Teams(g);
  if(T.length!==2) return {head:'', body:`<div class="card"><h2>${t('term.match1v1')}</h2><div class="empty">${t('m1.need2Teams')}</div></div>`};
  const m=g.match1v1||{pairs:[]};
  const raw=m.pairs||[];              // 登録済み全組（無効組も編集UIには出す）
  const v=m1Valid(g);                 // 現在の2チームと一致する保存済み組合せ（なければ null）
  const pairs=m1ValidPairs(g);        // 有効試合のみ（無効試合は表示・集計からスキップ §4.3）
  const stale=raw.length>0 && pairs.length<raw.length;
  const nameOf=pid=>{ const p=state.players.find(x=>x.id===pid); return p?esc(p.name):'?'; };
  const n=revealHoles;
  const one=m1RevealMode==='one';
  const isOpen=(a,b)=> !one || m1Opened.has(m1Key(a,b));
  const gAll=viewGame(g);   // 全組一括モード用（従来どおり共通 revealHoles でマスク。一組ずつは組ごとに viewGameN §14.1）
  // 未出場（両チームの参加メンバーで組合せに1度も現れない選手）: 警告のみ・登録/集計はブロックしない（§13.1 運用ガイド）
  const appeared=new Set(); raw.forEach(([a,b])=>{ appeared.add(a); appeared.add(b); });
  const notPlayed=[...m1MemberIds(g,T[0]),...m1MemberIds(g,T[1])].filter(pid=>!appeared.has(pid));
  const npNote=(raw.length&&notPlayed.length)?`<div class="muted mt6" style="color:var(--red)">${t('m1.notPlayed',{name:notPlayed.map(nameOf).join(', ')})}</div>`:'';
  // 上部カード：h2 見出し行なし＝チームサマリ行から始まる（§15.2。開封状況 pill は開封バーカード側に表示）。
  // チーム対抗サマリ（表示のみ・配点には使わない。一組ずつモードではオープン済みカードの現在開封数のみ集計 §14.2）
  let top=`<div class="card">`;
  if(v && pairs.length){
    const rs=one
      ? pairs.filter(([a,b])=>m1Opened.has(m1Key(a,b))).map(([a,b])=>m1Result(viewGameN(g,m1Opened.get(m1Key(a,b))||0),a,b))
      : pairs.map(([a,b])=>m1Result(gAll,a,b));
    const wA=rs.filter(r=>r.played&&r.diff>0).length, wB=rs.filter(r=>r.played&&r.diff<0).length, dr=rs.filter(r=>r.played&&r.diff===0).length;
    top+=`<div class="m1-teamsum">
      <span style="color:${tmColor(v.A.name)}">${esc(v.A.name)}</span> <b>${wA}</b> – <b>${wB}</b> <span style="color:${tmColor(v.B.name)}">${esc(v.B.name)}</span>
      ${dr?`<span class="tag tagtie">${t('m1.as')} ${dr}</span>`:''}</div>`;
  }
  if(!raw.length) top+=`<div class="empty">${t('m1.noPairs')}</div>`;
  top+=npNote;
  if(stale) top+=`<div class="muted mt6" style="color:var(--red)">${t('m1.stale')}</div>`;
  top+=`</div>`;
  if(!pairs.length) return {head:'', body:top};   // 編集UIは選手タブ側（§15.1。m1.noPairs / m1.stale が選手タブへ誘導）
  // 共通開封バー：全組一括=従来どおり4ボタン＋タグ（revealHoles）。一組ずつ=ホール開封は組ローカルに一本化するため4ボタン・タグ非表示（§14.2）
  const allOpen=pairs.every(([a,b])=>m1Opened.has(m1Key(a,b)));
  const bar=`<div class="card"><div class="reveal-bar">
    ${one?'':`<button class="btn gray sm" onclick="resetHoles()" ${n<=0?'disabled':''}>${t('btn.reset')}</button>
    <button class="btn gray sm" onclick="closeHole()" ${n<=0?'disabled':''}>${t('sc.prev')}</button>
    <button class="btn gold sm" onclick="openNextHole()" ${n>=18?'disabled':''}>${t('sc.next')}</button>
    <button class="btn gray sm" onclick="openAllHoles()" ${n>=18?'disabled':''}>${t('btn.all')}</button>
    <span class="tag tagtie">${n>=18?t('sc.allHoles'):n+'/18H'}</span>`}
    <span class="seg"><button class="${one?'':'on'}" onclick="m1SetMode('all')">${t('m1.modeAll')}</button><button class="${one?'on':''}" onclick="m1SetMode('one')">${t('m1.modeOne')}</button></span>
    ${one?`<button class="btn gold sm" onclick="m1OpenNext()" ${allOpen?'disabled':''}>${t('m1.openNext')}</button>
      <button class="btn gray sm" onclick="m1OpenAllCards()">${t('m1.openAllCards')}</button>
      <button class="btn gray sm" onclick="m1CoverAll()">${t('m1.coverAll')}</button>`:''}</div></div>`;
  // 対戦カード（1試合=1カード・登録リスト順）: hero=大型UP表示（§13.3）＋[一組ずつ: カード内開封バー §14.2]＋ホール表（値=adjHole・勝ち=rwin・ハーフ=rtie・未開封=空欄）
  const H=[...Array(18).keys()];
  const colg=`<colgroup><col class="cnm">${H.map(()=>'<col class="ch">').join('')}</colgroup>`;
  const colA=tmColor(v.A.name), colB=tmColor(v.B.name);
  const cards=pairs.map(([a,b])=>{
    const k=m1Key(a,b);
    const hero=c=>`<div class="m1-hero"><div class="m1-nm" style="color:${colA}">${nameOf(a)}</div><div>${c}</div><div class="m1-nm" style="color:${colB}">${nameOf(b)}</div></div>`;
    if(!isOpen(a,b))   // 伏せ状態（一組ずつ・未オープン §13.2）: 名前は見える・結果とホール表は隠す
      return `<div class="card">${hero(`<button class="btn gold" onclick="m1OpenCard('${k}')">${t('m1.open')}</button>`)}</div>`;
    const c=one? (m1Opened.get(k)||0) : 18;      // 一組ずつ=組ローカル開封数（オープン直後0）
    const gc=one? viewGameN(g,c) : gAll;         // 表示・判定の基準ゲーム（§14.1。revealHoles は一組ずつでは関与しない）
    const r=m1Result(gc,a,b);
    const big = !r.played ? `<div class="m1-big n">—</div>`   // 機能色維持＋文字併記: 勝ち=緑＋矢印（リード側を指す）/ AS=橙 / 未プレー=sub
      : r.diff>0 ? `<div class="m1-big w">◀ ${t('m1.up',{n:r.diff})}</div>`
      : r.diff<0 ? `<div class="m1-big w">${t('m1.up',{n:-r.diff})} ▶</div>`
      : `<div class="m1-big d">${t('m1.as')}</div>`;
    // 暫定タグ: 一組ずつ=c<18 で常に表示（0/18H で進捗ゼロが分かる §14.2）／一括=従来（revealHoles<18 かつ played>0）
    const prov=one ? (c<18?`<div class="mt6"><span class="tag tagtie">${c}/18H</span></div>`:'')
      : ((n<18&&r.played>0)?`<div class="mt6"><span class="tag tagtie">${n}/18H</span></div>`:'');
    // カード内開封バー（一組ずつのみ・既存キー流用＝新キーなし。disabled 境界 0/18）
    const cardbar=one?`<div class="reveal-bar m1-cardbar">
      <button class="btn gray sm" onclick="m1Holes('${k}','reset')" ${c<=0?'disabled':''}>${t('btn.reset')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','prev')" ${c<=0?'disabled':''}>${t('sc.prev')}</button>
      <button class="btn gold sm" onclick="m1Holes('${k}','next')" ${c>=18?'disabled':''}>${t('sc.next')}</button>
      <button class="btn gray sm" onclick="m1Holes('${k}','all')" ${c>=18?'disabled':''}>${t('btn.all')}</button>
      <span class="tag tagtie">${c>=18?t('sc.allHoles'):c+'/18H'}</span></div>`:'';
    const row=(pid,me,col)=>`<tr><td class="nm" style="color:${col}">${nameOf(pid)}</td>${H.map(i=>{
      const w=m1HoleWin(gc,a,b,i); const cls=w===me?'rwin':w==='H'?'rtie':'';
      const val=adjHole(gc,pid,i); return `<td class="${cls}">${val==null?'':val}</td>`; }).join('')}</tr>`;
    return `<div class="card">${hero(big+prov)}${cardbar}
      <table class="sc2">${colg}<tr><th class="nm"></th>${H.map(i=>`<th>${i+1}</th>`).join('')}</tr>
      ${row(a,'A',colA)}${row(b,'B',colB)}</table></div>`;
  }).join('');
  return {head: top + bar, body: cards + ruleBox('rule.match1v1')};
}

