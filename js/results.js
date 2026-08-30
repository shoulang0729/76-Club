/* ============================ RESULTS ============================ */
/* 2階層タブの表示状態（2026-08-20-results-regroup.md §4.1・揮発＝再読込で個人戦＞ニアドラに戻る。localStorage 非保存） */
let resGrp='ind';                             // 'ind' | 'team' | 'pts'
let resGame={ ind:'prize', team:'overall' };  // グループ別の選択中ゲームタブ（セッション内は記憶）
/* ニアドラヒーローの伏せ演出（§5.1.1 D18・nsMode/nsExcept と同型の揮発状態。キー=ホールindex・NP/DC は対象ホールが素で排他） */
let pzMode='show'; let pzExcept=new Set();
/* 2026-08-30 指示⑤: 共通スコアカード（renderScorecard）の開閉。ルーレットの rlScOpen と同型の揮発状態
   （localStorage 非保存・再描画をまたいで維持）。表ごとに独立: 'ind'=個人戦・'team'=チーム別。既定=閉（#97） */
let scOpen={ind:false,team:false};
function scOpenToggle(k,open){ scOpen[k]=open; }
function pzMasked(h){ return (pzMode==='hide') !== pzExcept.has(h); }
function togglePzAll(){ pzMode = pzMode==='show'?'hide':'show'; pzExcept.clear(); renderResult(); }
function togglePzCell(h){ if(pzExcept.has(h)) pzExcept.delete(h); else pzExcept.add(h); renderResult(); }
function setResGrp(grp){ if(!(grp==='team'&&resGame.team==='roulette')) rlStopTimer(); resGrp=grp; renderResult(); }
function setResGame(k){ if(k!=='roulette') rlStopTimer();
  resGame[resGrp]=k;
  if(resGrp==='ind' && (k==='gross'||k==='net')) scSortInd=k;                       // §3 D8: スコア表の並べ替え自動追従
  if(resGrp==='team'&& (k==='gross'||k==='net'||k==='hbh')) scSortTeam=k;           // §3 D8
  renderResult(); }
/* 下段ゲームタブのリスト（§4.3。表示条件=採用中フォーマット連動 D9。'pts' は []＝下段なし） */
function resGameTabs(grp,g){ const F=chFormats(g); const T=[];
  if(grp==='ind'){
    if(F.niadoraInd) T.push(['prize', t('result.sub.prize')]);   // ニアドラ個人トグル連動（バッチ95追加5。対象ホールなしは中身の empty）
    if(F.gross)      T.push(['gross', t('term.gross')]);
    if(F.net)        T.push(['net',   t('term.net')]);
    if(F.stableford) T.push(['stb',   t('term.stableford')]);
    if(F.olympic)    T.push(['oly',   t('term.olympic')]);
    if(F.callaway)   T.push(['cal',   t('term.callaway')]);
    if(F.nassau)     T.push(['nas',   t('pts.nassauTotal')]);
  } else if(grp==='team'){
    T.push(['overall', t('result.sub.overall')]);                // 常時（空状態は §5.2）
    const anyTeam=F.teamGross||F.teamNet||F.holeByHole||F.best2ball||F.vegas||F.match1v1;
    if(F.niadoraTeam && anyTeam && typeof niadoraTeamCount==='function')   // ニアドラチームトグル連動（バッチ95追加5）＋チーム戦ニアドラ従来条件（team-points §3.1・regroup §4.3）
                     T.push(['nd',    t('term.niadora')]);       // ラベルは「ニアドラ」（result.sub.prize は個人戦チップ用のフル表記に変更のため）
    if(F.teamGross)  T.push(['gross', t('term.gross')]);
    if(F.teamNet)    T.push(['net',   t('term.net')]);
    if(F.univMatch)  T.push(['univ',  t('term.univ')]);   // 大学対抗（β・univ-match §6.1。ネット系としてネットとHBHの間）
    if(F.holeByHole) T.push(['hbh',   t('term.hbh')]);
    if(F.best2ball)  T.push(['b2',    t('term.best2')]);
    if(F.vegas)      T.push(['vegas', t('term.vegas')]);
    if(F.match1v1)   T.push(['m1',    t('result.sub.match1v1')]);
    if(F.roulette) T.push(['roulette', t('result.sub.roulette')]);   // ルーレット対抗トグル連動（winpoints-reveal 要件D。OFF時はタブ消失→tabs[0]フォールバック）
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
  let body, stickyHead='';
  if(resGrp==='pts') body=renderStanding(g, parts);
  else if(resGrp==='ind') body=renderIndGame(g, parts, resGame.ind);
  else if(resGame.team==='m1'){ const P=renderMatch1v1Parts(g0);   // 生ゲームを渡す（マスクはモード別に内部で・§14.1）。head=サマリ＋操作バー（sticky 同居・D15）
    stickyHead=P.head; body=P.body; }
  else if(resGame.team==='roulette'){ const P=renderRouletteParts(g0);   // g0（生・実スコアで動作）。head=抽選カード一式（sticky 同居・roulette-standings §5）
    stickyHead=P.head; body=P.body; }
  else body=renderTeamGame(g, g0, parts, resGame.team);
  const grpBtn=k=>`<button class="${resGrp===k?'on':''}" onclick="setResGrp('${k}')">${t('result.sub.'+k)}</button>`;
  const sticky=`<div class="result-sticky">
    <div class="subtab4">${grpBtn('ind')}${grpBtn('team')}${grpBtn('pts')}</div>
    ${tabs.length?`<div class="subtab-games">${tabs.map(([k,lb])=>`<button class="${resGame[resGrp]===k?'on':''}" onclick="setResGame('${k}')">${lb}</button>`).join('')}</div>`:''}
    ${stickyHead}
  </div>`;
  el.innerHTML = sticky + body;
  const on=el.querySelector('.subtab-games .on'); if(on) on.scrollIntoView({inline:'center',block:'nearest'});
}
// 当該ゲーム1件のルール解説（D12: 全ルール一括 details を廃止し、各タブ末尾に1行だけ）
function ruleBox(key){ return `<details class="mt10"><summary>${t('rule.summary')}</summary><div class="in"><div class="rule">${t(key)}</div></div></details>`; }

// 配分タブ
/* #87 指示⑦→2026-08-30 指示③: チーム設定のあるゲームでは (a)選手名の左に「チーム」列（チームカラーでチーム名・未所属は空。
   選手名下の小ラベル .pt-team は廃止。375px はチーム名 ellipsis＝.pt-tm で5列非破綻）
   (b)チーム別合計の別表（行=チーム＋ポイントのある未所属・列=ポイント/配分額の合計・配分額降順）を追加。
   値は既存 computePayout の個人行の合算のみ＝配点・配分計算には一切触れない。チーム設定なしのゲームは従来表示のまま（列ごと出さない） */
function renderStanding(g, parts){
  const {pts,payout,total,pool}=computePayout(g);
  const prows=parts.map(pid=>({pid,pt:pts[pid]||0,yen:payout[pid]||0})).sort((a,b)=>b.pt-a.pt);
  const hasTeams=g.teams.length>0;
  const teamOf=pid=>g.teams.find(T=>T.memberIds.includes(pid))||null;
  const tmCell=pid=>{ if(!hasTeams)return''; const T=teamOf(pid);
    return `<td class="tal">${T?`<span class="pt-tm" style="color:${tmColor(T.name)}">${esc(T.name)}</span>`:''}</td>`; };   // 未所属は空セル。span=auto レイアウト表でも ellipsis を効かせる
  const main=`<div class="card payoutcard"><h2>${t('standing.title')} ${statusBadge(g)}</h2>
    <div class="muted">${t('standing.total',{t:total})}${pool?t('standing.poolNote',{p:pool.toLocaleString()}):t('standing.noPool')}。${revealHoles<18?t('standing.revealNote',{n:revealHoles}):t('standing.autoNote')}</div>
    <table class="lb"><tr><th>${t('col.rank')}</th>${hasTeams?`<th class="tal">${t('col.team')}</th>`:''}<th>${t('col.player')}</th><th>${t('col.points')}</th>${pool?`<th>${t('col.payout')}</th>`:''}</tr>
    ${prows.map((r,i)=>{const p=state.players.find(x=>x.id===r.pid);
      return `<tr class="rank ${i===0&&r.pt>0?'rank1':''}"><td>${r.pt>0?(i+1):'-'}</td>${tmCell(r.pid)}<td class="tal">${esc(p.name)}</td><td><b>${r.pt}</b>pt</td>${pool?`<td><b>¥${r.yen.toLocaleString()}</b></td>`:''}</tr>`}).join('')}
    </table></div>`;
  if(!hasTeams) return main;
  // (b) チーム別合計: 個人行（prows）の合算のみ。未所属はポイント/配分額が付いたときだけ行を出す
  const agg=new Map();
  prows.forEach(r=>{ const T=teamOf(r.pid); const k=T?T.id:'_none';
    if(!agg.has(k)) agg.set(k,{T,pt:0,yen:0}); const a=agg.get(k); a.pt+=r.pt; a.yen+=r.yen; });
  const trows=[...agg.values()].filter(a=>a.T||a.pt>0||a.yen>0).sort((a,b)=> b.yen-a.yen || b.pt-a.pt);
  const teamCard=`<div class="card payoutcard"><h2>${t('standing.teamTitle')}</h2>
    <table class="lb"><tr><th class="tal">${t('col.team')}</th><th>${t('col.points')}</th>${pool?`<th>${t('col.payout')}</th>`:''}</tr>
    ${trows.map(a=>{ const nm=a.T?`<b style="color:${tmColor(a.T.name)}">${esc(a.T.name)}</b>`:t('standing.noTeam');
      return `<tr class="rank"><td class="tal">${nm}</td><td><b>${a.pt}</b>pt</td>${pool?`<td><b>¥${a.yen.toLocaleString()}</b></td>`:''}</tr>`; }).join('')}
    </table></div>`;
  return main + teamCard;
}

// 個人戦グループ（§5.1）: key ごとに バナー＋当該順位カード（上）＋共通スコアカード（下）＋当該ルール1行
/* 個人賞の勝者登録 details の開閉（手動トグルのみ・勝者選択の再描画で閉じない）。揮発の表示状態＝localStorage に保存しない */
let pzCfgOpen=false;
function pzCfgToggle(open){ pzCfgOpen=open; }
function renderIndGame(g, parts, key){
  if(key==='prize'){   // ニアドラ: ヒーロー主役＋勝者登録は details 内に控えめ（§5.1.1。prizes は viewGame 非依存＝g で同値）
    if(!niapinHolesOf(g).length && !draconHolesOf(g).length)
      return `<div class="card"><h2>${t('prize.title')}</h2><div class="empty">${t('prize.emptyCfg')}</div></div>`;
    return renderPrizeHero(g)
      + `<details class="prize-edit mt10"${pzCfgOpen?' open':''} ontoggle="pzCfgToggle(this.open)"><summary>${t('prize.recTitle')}</summary><div class="in">${renderPrizes(g)}</div></details>`;
  }
  // 進捗バナーは全廃（順位確定=#87・暫定順位=2026-08-30 Sレーン②）。進捗はスコア表と statusBadge で読める
  let card='', rule='';
  if(key==='gross'){ card=rankCardNS(g.womenEvery.enabled?t('result.grossEvery'):t('term.gross'), parts, pid=>effGross(g,pid), 'asc', v=>v, 'gross', null); rule='rule.gross'; }
  else if(key==='net'){
    // 次回幹事（ネットで決定）：ゲーム設定の対象順位 kanjiRanks の行にバッジ表示（ネットタブのみ・§11.17）。
    // マスター g.kanjiBadge で ON/OFF（既定OFF・2026-08-29-host-option.md §2。OFF は判定自体を行わず hlMap=null）
    const kpids = g.kanjiBadge ? nextKanji(g) : [];
    const hl = kpids.length ? {} : null; kpids.forEach(pid=>hl[pid]=t('term.organizer'));
    card=rankCardNS(t('term.net'), parts, pid=>netScore(g,pid), 'asc', v=>v, 'net', hl); rule='rule.net'; }
  else if(key==='stb'){ card=leaderboard(t('term.stableford'), parts, pid=>stablefordPts(g,pid), 'desc', v=>v+'pt', '', 'stb'); rule='rule.stableford'; }
  else if(key==='oly'){ card=leaderboard(t('term.olympic'), parts, pid=>olympicPts(g,pid), 'desc', v=>v+'pt', '', 'oly'); rule='rule.olympic'; }
  else if(key==='cal'){ card=leaderboard(t('term.callaway'), parts, pid=>callawayNet(g,pid),'asc',v=>v,'', 'cal'); rule='rule.callaway'; }
  else if(key==='nas'){ card=leaderboard(t('pts.nassauTotal'), parts, pid=>nassauTotalNet(g,pid),'asc',v=>v,'', 'nas'); rule='rule.nassau'; }
  return `<div class="rank-wrap">${card}</div>` + renderScorecard(g,parts,null) + ruleBox(rule);
}

/* ニアドラのヒーロー表示（§5.1.1 D16〜D18・投影原則 §11.14）:
   ホール番号昇順・NP/DC 混在・区分文字併記。数値階層はルーレットパネルと同型（--f-rl-hole > --f-rl-name）。
   見出しはチップラベル（result.sub.prize=ニアピン／ドラコン）が兼ねるためカード内 h2 なし・
   伏せ演出の master トグルは結果が先に読めるようカード群の下（幹事操作は控えめ配置 §11.14）。
   withTeam=true（チーム戦ニアドラタブ・#87 指示⑤）: 勝者の所属チーム名をチームカラーで併記（未所属は表記なし）。
   伏せ状態 pzMode/pzExcept は個人戦と共有＝どちらのタブで開封しても両方に反映。省略時（個人戦）の出力は従来と同一 */
function renderPrizeHero(g, withTeam){
  const NP=niapinHolesOf(g), DC=draconHolesOf(g);
  const cells=[...NP.map(h=>({h,kind:'np'})),...DC.map(h=>({h,kind:'dc'}))].sort((a,b)=>a.h-b.h);
  const on = pzMode==='show';
  const tools=`<div class="cardtools mt8"><span class="tgl ${on?'on':'off'}" onclick="togglePzAll()">${on?t('ns.allShow'):t('ns.allHide')}</span></div>`;
  const cell=({h,kind})=>{
    const pid = kind==='np' ? g.prizes.niapinWinner[h] : g.prizes.draconWinner[h];
    const p = pid ? state.players.find(x=>x.id===pid) : null;
    const top=`<div class="npdc-top"><span class="npdc-hole">${h+1}<small>H</small></span><span class="npdc-kind">${kind==='np'?t('term.niapin'):t('term.dracon')}</span></div>`;
    if(!p) return `<div class="npdc-cell ${kind}" style="cursor:default">${top}<div class="npdc-name empty">—</div></div>`;   // 未登録: 伏せ対象外・タップ無効
    const m=pzMasked(h);
    const nm = m ? '<span class="mask">？？？</span>' : esc(p.name);
    let tmRow='';
    if(withTeam && !m){ const T=(g.teams||[]).find(T=>T.memberIds.includes(p.id));   // 伏せ中はチーム名も出さない（正体が漏れるため）
      if(T) tmRow=`<div class="npdc-team" style="color:${tmColor(T.name)}">${esc(T.name)}</div>`; }
    return `<div class="npdc-cell ${kind}" onclick="togglePzCell(${h})">${top}<div class="npdc-name">${nm}</div>${tmRow}</div>`; };
  return `<div class="card"><div class="npdc-hero">${cells.map(cell).join('')}</div>${tools}</div>`;
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
  /* 指示⑤: カード全体を <details open> 化（rl-sc と同UX）。summary=見出し（既存キー流用）＋開封数タグ。
     開閉状態は scOpen[okey]（表ごと独立の揮発）。表の内容・並び・印は不変 */
  const okey=teams?'team':'ind';
  return `<details class="sc-tgl"${scOpen[okey]?' open':''} ontoggle="scOpenToggle('${okey}',this.open)">
    <summary>${t('sc.title')}${teams?t('sc.teamSuffix'):''} <span class="tag tagtie">${n>=18?t('sc.allHoles'):n+'/18H'}</span></summary>
    <div class="in"><h2 class="lbh sc-ctl">
      <span class="scsw-wrap"><span class="scsw-l">${t('sc.sort')}</span>${sortSw}</span>
      <span class="tgl ${show.totals?'on':'off'}" onclick="toggleShow('totals')">${t('sc.totalsTgl')} ${show.totals?t('btn.show'):t('btn.hide')}</span></h2>
    <div class="reveal-bar">
      <button class="btn gray sm" onclick="resetHoles()" ${n<=0?'disabled':''}>${t('btn.reset')}</button>
      <button class="btn gray sm" onclick="closeHole()" ${n<=0?'disabled':''}>${t('sc.prev')}</button>
      <button class="btn gold sm" onclick="openNextHole()" ${n>=18?'disabled':''}>${t('sc.next')}</button>
      <button class="btn gray sm" onclick="openAllHoles()" ${n>=18?'disabled':''}>${t('btn.all')}</button>
    </div>
    <table class="sc2">${SC_COLGROUP}${head}${parRow}${body}</table>
    <div class="muted">${note} ${t('sc.noteCols')}${n<18?t('sc.noteOpen'):''}</div>
  </div></details>`;
}

// グロス/ネット専用の順位カード（名前・スコアを表ごと master ＋順位ごとの目隠しボタンで制御。バッジは常時表示）
// master トグルは表の下（結果が先・操作が後＝追加指示⑪・§11.14 幹事操作は控えめ配置）
function rankCardNS(title, pids, valFn, dir, fmt, table, hlMap){
  const rows=ranked(pids,valFn,dir);
  const nameOf=pid=>{const p=state.players.find(x=>x.id===pid);return esc(p&&p.name);};
  const nsOn = nsMode[table]==='show';
  const tools=`<div class="cardtools mt8">
    <span class="tgl ${nsOn?'on':'off'}" onclick="toggleNSAll('${table}')">${nsOn?t('ns.allShow'):t('ns.allHide')}</span></div>`;
  const body=`<table class="lb big"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.player')}</th><th class="c-val">${dir==='asc'?t('col.score'):t('col.pts')}</th></tr>
    ${rows.map(r=>{ const hb=hlMap&&hlMap[r.pid]; const m=nsMasked(table,r.pid);
      const nm = m ? '<span class="mask">※※※</span>' : nameOf(r.pid);
      const sv = m ? '<span class="mask">？</span>' : `<b>${fmt(r.v)}</b>`;
      return `<tr class="rank ${hb?'hlrow':''}"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleNSRow('${table}','${r.pid}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(r.rank,r.rank===1)}</td><td class="nmc">${nm}${hb?`<span class="kanjibadge">${hb}</span>`:''}</td><td class="c-val">${sv}</td></tr>`; }).join('')}</table>`;
  return `<div class="card tight wide"><h2 class="lbh"><span>${title}</span></h2>${body}${tools}</div>`;
}

