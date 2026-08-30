/* ============================ RESULTS ============================ */
/* 1 on 1 のオープン演出用表示状態（§13.2/§14.1・揮発＝再読込で既定に戻る。localStorage には保存しない） */
let m1RevealMode='all';      // 'all'=全組一括（既定） | 'one'=一組ずつ
let m1Opened=new Map();      // 一組ずつモードのオープン済みカード（キー='pidA:pidB'・並び替え/削除に不変。値=その組の開封ホール数0〜18 §14.1）
/* 2階層タブの表示状態（2026-08-20-results-regroup.md §4.1・揮発＝再読込で個人戦＞ニアドラに戻る。localStorage 非保存） */
let resGrp='ind';                             // 'ind' | 'team' | 'pts'
let resGame={ ind:'prize', team:'overall' };  // グループ別の選択中ゲームタブ（セッション内は記憶）
/* ニアドラヒーローの伏せ演出（§5.1.1 D18・nsMode/nsExcept と同型の揮発状態。キー=ホールindex・NP/DC は対象ホールが素で排他） */
let pzMode='show'; let pzExcept=new Set();
/* 2026-08-30 指示⑤: 共通スコアカード（renderScorecard）の開閉。ルーレットの rlScOpen と同型の揮発状態
   （localStorage 非保存・再描画をまたいで維持）。表ごとに独立: 'ind'=個人戦・'team'=チーム別。既定=表示(open) */
let scOpen={ind:true,team:true};
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
    T.push(['prize', t('result.sub.prize')]);                    // 常時（対象ホールなしは中身の empty）
    if(F.gross)      T.push(['gross', t('term.gross')]);
    if(F.net)        T.push(['net',   t('term.net')]);
    if(F.stableford) T.push(['stb',   t('term.stableford')]);
    if(F.olympic)    T.push(['oly',   t('term.olympic')]);
    if(F.callaway)   T.push(['cal',   t('term.callaway')]);
    if(F.nassau)     T.push(['nas',   t('pts.nassauTotal')]);
  } else if(grp==='team'){
    T.push(['overall', t('result.sub.overall')]);                // 常時（空状態は §5.2）
    const anyTeam=F.teamGross||F.teamNet||F.holeByHole||F.best2ball||F.vegas||F.match1v1;
    if(anyTeam && typeof niadoraTeamCount==='function')          // チーム戦ニアドラ（team-points §3.1・regroup §4.3。calc の関数存在がゲート）
                     T.push(['nd',    t('term.niadora')]);       // ラベルは「ニアドラ」（result.sub.prize は個人戦チップ用のフル表記に変更のため）
    if(F.teamGross)  T.push(['gross', t('term.gross')]);
    if(F.teamNet)    T.push(['net',   t('term.net')]);
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
    <table class="lb" class="mt6"><tr><th>${t('col.rank')}</th>${hasTeams?`<th class="tal">${t('col.team')}</th>`:''}<th>${t('col.player')}</th><th>${t('col.points')}</th>${pool?`<th>${t('col.payout')}</th>`:''}</tr>
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
    <table class="sc2" class="mt8">${SC_COLGROUP}${head}${parRow}${body}</table>
    <div class="muted" class="mt6">${note} ${t('sc.noteCols')}${n<18?t('sc.noteOpen'):''}</div>
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

/* チーム戦グループ（§5.2）: key ごとに 当該対抗カード（上）＋チーム別スコア表（下・グロス/ネット/HBH のみ）。
   'm1'/'roulette' は renderResult 側で renderMatch1v1Parts / renderRouletteParts を直接使う（sticky 同居 D15・roulette-standings §5）。
   総合=①チーム総合カード＋②種目別勝ち点表の2つのみ（スコア表なし・winpoints-reveal 要件A）、nd=ニアドラ・ヒーローカード（team-points §6.2①③・配置=regroup §6） */
function renderTeamGame(g, g0, parts, key){
  const teams=g.teams.filter(t=>t.memberIds.length);
  if(!teams.length)
    return `<div class="card"><h2>${t('team.title')}</h2><div class="empty">${t('team.emptyTeams')}</div></div>`;
  const sc=()=>renderScorecard(g, g.participants, teams);
  if(key==='overall') return renderTeamOverall(g);
  if(key==='nd')    return renderTeamNiadora(g);
  if(key==='gross') return `<div class="rank-wrap">${renderTeams(g,'teamGross')}</div>` + sc();
  if(key==='net')   return `<div class="rank-wrap">${renderTeams(g,'teamNet')}</div>` + sc();
  if(key==='hbh')   return `<div class="rank-wrap">${renderTeams(g,'holeByHole')}</div>` + sc();
  if(key==='b2')    return `<div class="rank-wrap">${renderTeams(g,'best2ball')}</div>`;
  if(key==='vegas') return `<div class="rank-wrap">${renderTeams(g,'vegas')}</div>` + ruleBox('rule.vegas');
  return '';
}

/* ---- 発表ボタン（winpoints-reveal §5.2・D1/D8・投影原則 §11.14「幹事操作は控えめ配置」）----
   g.announced はデータ（幹事の運営記録）＝save() で golfCompe_v1 に保存（開封・めくり演出の揮発状態とは別物）。
   ボタンは常時活性・不成立種目の発表フラグは休眠（算入は 成立∧on の AND・D9）。取り消しは可逆・confirm なし（D8） */
function tpAnnounce(key,on){ const g=curGame(); if(!g)return;
  (g.announced=g.announced||{})[key]=!!on; save(); renderResult(); }
function tpAnnounceUI(g,key){ const on=!!(g.announced||{})[key];
  return on
    ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('team.announced')}</span>
       <button class="btn gray sm" onclick="tpAnnounce('${key}',false)">${t('team.unannounce')}</button>`
    : `<button class="btn gold sm" onclick="tpAnnounce('${key}',true)">${t('team.announce')}</button>`; }

/* ---- チーム総合カード＋種目別勝ち点表（team-points.md §6.2①・winpoints-reveal §5.1・投影原則 §11.14）----
   総合順位・勝ち点は calc.js の teamWinPoints(g) だけを正とする（表示側で再計算しない）。
   総合順位はヒーロー型の左右均等横並び（.tp-nd 縦積みブロック共用・2026-08-30 #87 指示④）。
   大型勝ち点=チームカラー・勝ちセル=緑（値併記）＝モック承認済み。
   目隠し（'overall' 系 tgMasked）は廃止＝発表状態連動マスク（未確定行の？）が代替（winpoints-reveal 要件A/D6）。
   ヘッダは発表進捗タグ「発表 n/N」（全発表で「確定」緑・D5）。順位バッジ・配分タグは発表≥1 のときのみ＝computePoints のゲートと一致 */
function tpFmtWin(v){   // 勝ち点合計の表示（1→"1"・0.5刻み→"2.5"・1/3混じり→小数2桁）
  if(Math.abs(v-Math.round(v))<1e-9) return String(Math.round(v));
  if(Math.abs(v*2-Math.round(v*2))<1e-9) return v.toFixed(1);
  return String(Math.round(v*100)/100);
}
function tpShare(n){ return n===1?'1' : n===2?'0.5' : '1/'+n; }   // 種目セルの獲得分（同点山分けは分数表記・小数丸めにしない）
const TP_EV_LABEL={teamGross:'term.teamGross',teamNet:'term.teamNet',holeByHole:'term.hbh',best2ball:'term.best2',
  roulette:'term.roulette',match1v1:'term.match1v1',vegas:'term.vegas',niadora:'term.niadora'};
/* 種目別勝ち点表の行順（#87 指示③）＝チーム戦下段タブの生成順（resGameTabs grp='team'・総合を除く）:
   nd→gross→net→hbh→b2→vegas→m1→roulette。タブ生成順を変えるときは本配列も同期させる */
const TP_EV_ORDER=['niadora','teamGross','teamNet','holeByHole','best2ball','vegas','match1v1','roulette'];
function renderTeamOverall(g){
  const {teams,wins,events}=teamWinPoints(g);
  if(!events.length) return '';   // 成立種目0＝総合カード非表示（配分もされない・§3.4）
  const P=g.points||{};
  const N=events.length, n=events.filter(e=>e.on).length;   // 発表進捗（winpoints-reveal D5）。n=N(≥1)で「確定」
  const prog = n===N ? `<span class="tag" style="background:var(--win);color:var(--on-fill)">${t('status.fixed')}</span>`
                     : `<span class="tag tagtie">${t('team.annProg',{n,N})}</span>`;
  const rows=teams.map((tm,i)=>({tm,i,v:wins[i]})); rows.sort((a,b)=>b.v-a.v);
  let rank=0,prev=null;
  rows.forEach((r,idx)=>{ if(prev===null||r.v!==prev){rank=idx+1;prev=r.v;} r.rank=rank; r.p=(P.teamRankPts||[])[rank-1]||0; });
  // ヒーロー横並び（#87 指示④）: 順=勝ち点降順。勝ち点=確定(on)分のみの積み上げ（teamWinPoints が正）。
  // 順位バッジ＋配分タグは発表≥1 のときのみ（n=0 はチーム名と「0」だけ＝computePoints の配分ゲートと一致・D5）
  const hero=rows.map(r=>{ const col=tmColor(r.tm.name);
    return `<span class="rl-st tp-nd tp-ovh">
      <span class="rl-st-team" style="color:${col}">${esc(r.tm.name)}</span>
      <span class="tp-ov-pt" style="color:${col}">${tpFmtWin(r.v)}</span>
      ${n>=1?`<span class="tp-nd-tagrow">${posBadge(r.rank,r.rank===1)}<span class="tag">${t('team.rankTag',{rank:r.rank,p:r.p})}</span></span>`:''}
    </span>`; }).join('');   // 配分は各員満額（人数割りしない・D4）
  // 種目別勝ち点表（補助・通常サイズ）: 行=成立種目・列=チーム。勝ち=緑＋値・山分け=橙＋獲得分・負け=空欄・対象外=—。
  // 未確定(!on)行=ラベルに「未確定」タグ＋値セルは対象外含め全チーム？マスク（勝者ネタバレ防止・D6）
  // 行順=チーム戦の下段ゲームタブ（resGameTabs 左→右・総合を除く）に一致（2026-08-30 ユーザー指示・#87）。
  // 表示順のみの並べ替え＝teamWinPoints の値・成立判定は不変。タブに無いキーは末尾（安定ソートで元順維持）
  const mxEvs=[...events].sort((a,b)=>{ const o=k=>{ const i=TP_EV_ORDER.indexOf(k); return i<0?TP_EV_ORDER.length:i; }; return o(a.key)-o(b.key); });
  const mxHead=`<tr><th class="tal">${t('team.matrixTitle')}</th>${teams.map(tm=>
    `<th style="color:${tmColor(tm.name)}">${esc(tm.name)}</th>`).join('')}</tr>`;
  const mxRows=mxEvs.map(ev=>`<tr><td class="tal">${t(TP_EV_LABEL[ev.key]||ev.key)}${ev.on?'':` <span class="tag tagtie">${t('team.pending')}</span>`}</td>${teams.map((tm,i)=>{
    if(!ev.on) return '<td><span class="mask">？</span></td>';
    if(ev.vals[i]==null) return '<td><span class="muted">—</span></td>';
    if(ev.winners.includes(i)) return `<td class="${ev.winners.length>1?'rtie':'winc'}"><b>${tpShare(ev.winners.length)}</b></td>`;
    return '<td></td>'; }).join('')}</tr>`).join('');
  return `<div class="card"><h2 class="lbh"><span>${t('team.overallTitle')} ${prog}</span></h2>
    <div class="rl-standing tp-ovh-wrap">${hero}</div>
    <div class="scroll mt10"><table class="lb tp-mx">${mxHead}${mxRows}</table></div>
    <div class="muted mt6">${t('team.noteOverall')}</div>
    <div class="muted">${t('team.noteAnnounce')}</div>
    <div class="muted">${t('pts.teamRank')}: ${(P.teamRankPts||[]).join(', ')}</div>
  </div>`;
}

/* ---- チーム戦ニアドラ・ヒーローカード（team-points.md §6.2③）----
   .rl-standing/.rl-st 共用＋縦積みバリアント .tp-nd。本数=開封済みホールのみの表示側カウント（全開封で niadoraTeamCount と一致＝calc と同値保証）・本数降順（同数=登録順の安定ソート）。
   勝ち点タグ=文字併記（勝者に緑 +1・同数に橙 +0.5/+1/3）＝総合タブの種目別勝ち点表セルと同じ値。
   ヒーローは常時表示＝目隠しなし（#87 指示⑨で master トグル撤去・総合カード④と同じ扱い）。
   下部にホール別勝者カード群を併設（renderPrizeHero(g,true)＝チーム名併記・#87 指示⑤）。伏せ状態は個人戦ニアドラと共有＝開封演出はこちら側で行う。
   勝者登録パネル（prize-edit details）は個人戦側のみ＝ここには置かない（幹事操作の重複配置はしない） */
function renderTeamNiadora(g){
  const teams=g.teams.filter(t=>t.memberIds.length);
  const {teams:wt,events}=teamWinPoints(g);
  const ev=events.find(e=>e.key==='niadora');
  const winIds=ev?ev.winners.map(i=>wt[i].id):[];
  /* 2026-08-30 指示④: ヒーローの本数・NP/DC内訳は下部ホール別カードの「開封済み」ホールのみカウント（表示側フィルタ・
     開封状態=pzMode/pzExcept は個人戦と共有の揮発）。全ホール開封時は niadoraTeamCount(g,tm) と一致（計算側は不変）。
     勝ち点タグは全開封時のみ表示＝部分開封中のネタバレ防止（teamWinPoints・種目別勝ち点表は不変） */
  const opened=h=>!pzMasked(h);
  const npOf=T=>niapinHolesOf(g).filter(h=>{const pid=(g.prizes.niapinWinner||{})[h];return !!pid&&T.memberIds.includes(pid)&&opened(h);}).length;
  const dcOf=T=>draconHolesOf(g).filter(h=>{const pid=(g.prizes.draconWinner||{})[h];return !!pid&&T.memberIds.includes(pid)&&opened(h);}).length;
  const allOpen=[...niapinHolesOf(g).filter(h=>(g.prizes.niapinWinner||{})[h]),
                 ...draconHolesOf(g).filter(h=>(g.prizes.draconWinner||{})[h])].every(opened);
  const rows=teams.map(tm=>{const np=npOf(tm),dc=dcOf(tm);return {tm,n:np+dc,np,dc};}).sort((a,b)=>b.n-a.n);   // 並び=現表示値の降順
  const blocks=rows.map(({tm,n,np,dc})=>{
    const col=tmColor(tm.name);
    const sub=`NP ${np} ・ DC ${dc}`;   // NP/DC はリテラル略号（言語非依存）
    const tag=(ev&&ev.on&&allOpen&&winIds.includes(tm.id))   // 勝ち点タグは「発表済み(on)かつ全開封」でのみ表示（winpoints-reveal §5.2＝マスクと整合）
      ?`<span class="tp-nd-tagrow"><span class="tag ${ev.winners.length>1?'tagtie':'tagwin'}">${t('team.winpt')} +${tpShare(ev.winners.length)}</span></span>`:'';
    return `<span class="rl-st tp-nd"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${n}</span><span class="tp-nd-sub">${sub}</span>${tag}</span>`; }).join('');
  const holeCards=(niapinHolesOf(g).length||draconHolesOf(g).length)? renderPrizeHero(g,true) : '';   // 対象ホールなしは併設カードも省略
  return `<div class="card"><h2 class="lbh"><span>${t('term.niadora')}</span></h2>
    <div class="rl-standing">${blocks}</div>
    <div class="muted mt6">${t('team.noteNiadora')}</div>
    <div class="cardtools mt8">${tpAnnounceUI(g,'niadora')}</div></div>` + holeCards;
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
  const F=chFormats(g);   // チャンネル共通（2026-08-30 α昇格・2026-08-30-m1-alpha.md）
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
      <button class="btn gray sm" onclick="m1CoverAll()">${t('m1.coverAll')}</button>`:''}</div>
    <div class="cardtools mt8">${tpAnnounceUI(g,'match1v1')}</div></div>`;   // 発表ボタン（winpoints-reveal §5.2。開封演出 m1Opened は揮発のまま・発表だけがデータに残る）
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

