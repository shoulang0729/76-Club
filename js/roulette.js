/* ============================ ルーレット対抗 ============================ */
function rTeams(g){ return g.teams.filter(t=>t.memberIds.length); }
function rColor(name){ return tmColor(name); }
function rColorBg(name){ return rColor(name).replace(')','-bg)'); }   // 'var(--tm-red)'→'var(--tm-red-bg)'（勝ちカードの淡色塗り。2026-08-20-roulette-standings.md §9.2）
// エブリ支給（各ホール）：エブリワン=−1・エブリツー=−2（ゲームでエブリ適用ON時）。ルーレットの1ホール勝負に反映
function rlEvery(g,pid){ if(!g.womenEvery.enabled)return 0; const p=state.players.find(x=>x.id===pid); return p?(p.everyType==='every1'?1:p.everyType==='every2'?2:0):0; }
function rlRaw(g,pid,h){ const v=(g.scores[pid]||[])[h]; return (v!=null&&v!=='')?Number(v):null; }
function rlHoleScore(g,pid,h){ const v=rlRaw(g,pid,h); return v==null?null:v-rlEvery(g,pid); }  // 比較に使う実質スコア
function rlDraw(g, teamId, excludePid){
  const t=g.teams.find(x=>x.id===teamId); const members=t.memberIds.slice();
  let cand=members.filter(m=>!(g.roulette.pool[teamId]||[]).includes(m));
  if(excludePid) cand=cand.filter(m=>m!==excludePid);
  if(cand.length===0){ g.roulette.pool[teamId]=[]; cand=members.filter(m=>m!==excludePid); if(!cand.length)cand=members.slice(); }
  return cand[Math.floor(Math.random()*cand.length)];
}
function rlTick(){ const g=curGame(); if(!g)return; const h=g.roulette.cur;
  const pick=Object.assign({}, g.roulette.reps[h]||{});   // 非回転チームは確定代表で比較（#6）
  rl.spinTeams.forEach(tid=>{ const t=g.teams.find(x=>x.id===tid); if(!t||!t.memberIds.length)return;
    const pid=t.memberIds[Math.floor(Math.random()*t.memberIds.length)]; pick[tid]=pid;
    const p=state.players.find(x=>x.id===pid);
    const el=document.getElementById('rl-name-'+tid);
    if(el) el.textContent=p?p.name:'';
    // 名前とセットで候補のスコア（エブリ適用後）も回す（#5）
    const es=document.getElementById('rl-score-'+tid);
    if(es){ const av=adjHole(g,pid,h); es.textContent = av==null?'—':av; } });
  rlFlash(g,h,pick); }
/* 回転中の勝敗予告（#6）：今表示中の候補どうしを比較し、勝ち=緑/負け=赤/引分=橙で点滅。未入力が混じれば消灯 */
function rlFlash(g,h,pick){ const teams=rTeams(g);
  const sc=teams.map(t=>{ const pid=pick[t.id]; return pid?adjHole(g,pid,h):null; });
  const ok=!sc.some(s=>s==null); const mn=ok?Math.min(...sc):null;
  const allTie=ok && sc.every(s=>s===mn);
  teams.forEach((t,i)=>{ const el=document.getElementById('rl-panel-'+t.id); if(!el)return;
    el.classList.remove('fwin','flose','ftie');
    if(ok) el.classList.add(allTie?'ftie':(sc[i]===mn?'fwin':'flose')); }); }
function rlBeginSpin(teamIds){ if(rl.timer)clearInterval(rl.timer); rl.spinning=true; rl.spinTeams=teamIds.slice(); rl.challengeFrom=null; renderResult(); rl.timer=setInterval(rlTick,75); }
function rlStop(){ rlStopTimer(); const g=curGame(); const R=g.roulette; const h=R.cur; R.reps[h]=R.reps[h]||{};
  rl.spinTeams.forEach(tid=>{ const prev=R.reps[h][tid]; R.reps[h][tid]=rlDraw(g,tid, rl.spinTeams.length===1?prev:null); });
  rl.spinTeams=[]; save(); renderResult(); }
function rlStartInitial(){ const g=curGame(); rlBeginSpin(rTeams(g).map(t=>t.id)); }
function rlChange(tid){ const g=curGame(); const R=g.roulette; if((R.remChange[tid]||0)<=0)return; R.remChange[tid]--; save(); rlBeginSpin([tid]); }
function rlChallengeStart(fromTid){ const g=curGame(); const R=g.roulette; if((R.remChallenge[fromTid]||0)<=0)return;
  const others=rTeams(g).filter(t=>t.id!==fromTid);
  if(others.length===1){ rlChallengeDo(fromTid, others[0].id); } else { rl.challengeFrom=fromTid; renderResult(); } }
function rlChallengeDo(fromTid, targetTid){ const g=curGame(); const R=g.roulette; if((R.remChallenge[fromTid]||0)<=0)return; R.remChallenge[fromTid]--; rl.challengeFrom=null; save(); rlBeginSpin([targetTid]); }
function rlCancelChallenge(){ rl.challengeFrom=null; renderResult(); }
function rlHoleDrawn(g){ const reps=g.roulette.reps[g.roulette.cur]||{}; return rTeams(g).every(t=>reps[t.id]); }
/* 使い切り必須の判定はハーフ単位（§11.3）：前半=9番(index8)終了まで／後半=18番(index17)終了までに残チェンジ0 */
function rlCanAdvance(g){ if(!rlHoleDrawn(g))return false; const cur=g.roulette.cur;
  const left = cur<=8 ? 8-cur : 17-cur;
  return rTeams(g).every(t=>(g.roulette.remChange[t.id]||0)<=left); }
function rlNextHole(){ const g=curGame(); const R=g.roulette; if(!rlCanAdvance(g)){toast(t('toast.useChange'));return;}
  const reps=R.reps[R.cur]||{}; rTeams(g).forEach(t=>{ R.pool[t.id]=[...(R.pool[t.id]||[]), reps[t.id]]; });
  R.cur=Math.min(18,R.cur+1);
  // OUT終了→後半開始：チェンジ/チャレンジをハーフ分再付与（上書き＝前半の余りは失効・§11.3）
  if(R.cur===9) rTeams(g).forEach(t=>{ R.remChange[t.id]=R.changeN; R.remChallenge[t.id]=R.challengeM; });
  rl.challengeFrom=null; save(); renderResult(); }
function rlReset(){ if(!confirm(t('confirm.rlReset')))return; const g=curGame(); const R=g.roulette;
  R.reps={};R.pool={};R.remChange={};R.remChallenge={};R.cur=0; rTeams(g).forEach(t=>{R.remChange[t.id]=R.changeN;R.remChallenge[t.id]=R.challengeM;});
  rl.challengeFrom=null; rlStopTimer(); rl.spinTeams=[]; save(); renderResult(); }
function rlStandings(g){ const teams=rTeams(g); const won=teams.map(()=>0); let pending=0;
  for(let h=0; h<g.roulette.cur; h++){ const reps=g.roulette.reps[h]; if(!reps)continue;
    const sc=teams.map(t=>{const pid=reps[t.id];return pid!=null?rlHoleScore(g,pid,h):null;});
    if(sc.some(s=>s==null)){pending++;continue;}
    const mn=Math.min(...sc); const w=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0); w.forEach(i=>won[i]+=1/w.length); }
  return {teams,won,pending}; }

// 開発者メニュー：代表を手動指定 / 回数を戻す（誤操作の復旧用）
function rlForceRep(tid,pid){ if(!pid)return; const g=curGame(); const R=g.roulette; R.reps[R.cur]=R.reps[R.cur]||{}; R.reps[R.cur][tid]=pid; save(); renderResult(); }
function rlRefund(tid,which){ const g=curGame(); const R=g.roulette; if(which==='change')R.remChange[tid]=(R.remChange[tid]||0)+1; else R.remChallenge[tid]=(R.remChallenge[tid]||0)+1; save(); renderResult(); }

// ルーレット用スコア表（読み取り専用・現在ホール強調・各チームの代表行に印）
// 各ホールの「採用代表セル」に印。全ホール分：勝ち=緑/引分=橙/採用(負け)=太枠
function rlMarks(g){
  const teams=rTeams(g); const R=g.roulette; const mark={}; const last=Math.min(R.cur,17);
  for(let hh=0; hh<=last; hh++){ const rp=R.reps[hh]; if(!rp)continue;
    const complete = teams.every(t=>rp[t.id]);
    const sc=teams.map(t=>{const pid=rp[t.id];return pid!=null?rlHoleScore(g,pid,hh):null;});
    const scored = complete && sc.every(s=>s!=null);
    let winI=new Set(), tie=false;
    if(scored){ const mn=Math.min(...sc); const wi=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0); if(wi.length===teams.length)tie=true; else wi.forEach(i=>winI.add(i)); }
    teams.forEach((t,ti)=>{ const pid=rp[t.id]; if(!pid)return; mark[pid]=mark[pid]||{};
      mark[pid][hh]= scored ? (tie?'rtie':(winI.has(ti)?'rwin':'adopt')) : 'adopt'; });
  }
  return mark;
}
/* スコアカードの開閉（§11.14: <details open> の控えめ操作・既定=表示）。揮発の表示状態＝localStorage に保存しない */
let rlScOpen=true;
function rlScToggle(open){ rlScOpen=open; }
function rlScorecard(g){
  const teams=rTeams(g); const R=g.roulette; const h=R.cur<18?R.cur:-1; const cols=[...Array(18).keys()]; const mark=rlMarks(g);
  const cg=`<colgroup><col style="width:72px">${cols.map(()=>'<col>').join('')}</colgroup>`;
  const head=`<tr><th class="nm">${t('col.player')}</th>${cols.map(i=>`<th class="${i===h?'cur':''}">${i+1}</th>`).join('')}</tr>`;
  const parRow=`<tr class="parr"><td class="nm">Par</td>${cols.map(i=>`<td class="${i===h?'cur':''} ${g.hidden[i]?'hh':''}">${g.par[i]}</td>`).join('')}</tr>`;
  let body='';
  /* §11.12 J②: チーム戦スコア表と同じ並べ方＝チームは取得Hの多い順、メンバーはネット順。
     並べ替えは表示だけで、代表/採用の印（rlMarks）や集計には影響しない。 */
  const wonOf=rlStandings(g).won;
  const ordered=teams.map((tm,ti)=>({tm,v:wonOf[ti]||0})).sort((a,b)=>b.v-a.v).map(o=>o.tm);
  ordered.forEach(t=>{ const col=rColor(t.name);
    body+=`<tr><td class="nm" colspan="19" style="background:${col};color:var(--bg);text-align:left;font-weight:var(--w-bold)">${esc(t.name)}</td></tr>`;
    const mem=t.memberIds.filter(pid=>state.players.find(x=>x.id===pid));
    const byNet=ranked(mem, pid=>enteredCount(g,pid)?netScore(g,pid):null, 'asc').map(o=>o.pid);
    byNet.concat(mem.filter(pid=>!byNet.includes(pid))).forEach(pid=>{ const p=state.players.find(x=>x.id===pid); if(!p)return; const av=adjArr(g,pid); const mm=mark[pid]||{};
      body+=`<tr><td class="nm">${esc(p.name)}</td>${cols.map(i=>`<td class="${i===h?'cur':''} ${g.hidden[i]?'hh':''} ${mm[i]||''}">${av[i]??''}</td>`).join('')}</tr>`; }); });
  return `<details class="rl-sc"${rlScOpen?' open':''} ontoggle="rlScToggle(this.open)"><summary>${t('sc.title')} <span class="muted" style="font-weight:var(--w-med);font-size:11px">${t('rl.legend')}</span></summary>
    <div class="in"><div class="scroll"><table class="sc2 rlsc">${cg}${head}${parRow}${body}</table></div></div></details>`;
}

/* 返り値 {head, body}（2026-08-20-roulette-standings.md §5・renderMatch1v1Parts と同型）。
   head=抽選カード一式（card rl-play）＝.result-sticky に同居して固定・body=スコア表＋開発者メニュー＝スクロール領域。
   ガード（rl.need2）は {head:'', body:空状態カード}＝空状態は固定しない */
function renderRouletteParts(g){
  const teams=rTeams(g);
  if(teams.length<2) return {head:'', body:`<div class="card"><h2>${t('rl.title')}</h2><div class="empty">${t('rl.need2')}</div></div>`};
  const R=g.roulette;
  teams.forEach(t=>{ if(R.remChange[t.id]===undefined)R.remChange[t.id]=R.changeN; if(R.remChallenge[t.id]===undefined)R.remChallenge[t.id]=R.challengeM; });
  const {won,pending}=rlStandings(g);
  const wonH=ti=>Math.round((won[ti]||0)*10)/10;   // 0Hから常時表示（引分は0.5刻み）

  /* 18H終了後（#31）：抽選は終わっているのでカードは描かず、リセット head → スタンディング行（取得H降順）のみ。
     取得H降順（同点=登録順・Array#sort は安定）。won/wonH は既存のまま再利用＝計算不変。数値は濃色インク（--strong・CSS側） */
  if(R.cur>=18){
    const standRow=`<div class="rl-standing">${
      teams.map((tm,ti)=>({tm,ti,v:won[ti]||0})).sort((a,b)=>b.v-a.v)
        .map(({tm,ti})=>{ const col=rColor(tm.name);
          return `<span class="rl-st"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${wonH(ti)}<small>H</small></span></span>`; }).join('')
    }</div>`;
    return {head:`<div class="rlwrap">
      <div class="card rl-play"><div class="rl-head"><button class="btn gray sm" style="margin-left:auto" onclick="rlReset()">${t('btn.reset')}</button></div>${standRow}</div></div>`,
      body:`<div class="rlwrap">${rlScorecard(g)}</div>`};
  }

  const h=R.cur; const reps=R.reps[h]||{}; const drawn=rlHoleDrawn(g);
  const holeScores=()=>teams.map(t=>{const pid=reps[t.id];return pid!=null?rlHoleScore(g,pid,h):null;});
  let holeInfo='';
  /* 大型勝敗表示（rl-head・roulette-hero 設計）。表示条件は下の stCls と同一
     （!spinning && 全代表確定 && 全スコア入力済み）。判定は既存の holeScores()+Math.min の再利用＝計算不変。
     WIN はリテラル（UP/AS/nH/Par と同じ言語非依存の記号扱い）。引分は rl.tie を rl-info から移動して大型化 */
  let holeRes='';
  if(drawn){ const sc=holeScores();
    if(sc.some(s=>s==null)) holeInfo=`<span class="muted">${t('rl.repNoScore')}</span>`;
    else if(!rl.spinning){ const mn=Math.min(...sc); const wi=sc.map((s,i)=>s===mn?i:-1).filter(i=>i>=0);
      if(wi.length===teams.length) holeRes=`<div class="rl-res"><span class="rl-res-tie">${t('rl.tie')}</span></div>`;
      else holeRes=`<div class="rl-res">${wi.map(i=>`<span class="rl-res-nm" style="color:${rColor(teams[i].name)}">${esc(teams[i].name)}</span>`).join('')}<span class="rl-res-w"${wi.length===1?` style="color:${rColor(teams[wi[0]].name)}"`:''}>WIN</span></div>`; } }
  // 確定時の勝敗クラス（#6）：勝ち=win/負け=lose/全チーム同点=tie。スコア未入力が混じれば無色
  const stCls=(()=>{ const none=teams.map(()=>''); if(!drawn||rl.spinning)return none;
    const sc=holeScores(); if(sc.some(s=>s==null))return none;
    const mn=Math.min(...sc); if(sc.every(s=>s===mn))return teams.map(()=>' tie');
    return sc.map(s=>s===mn?' win':' lose'); })();
  /* 各チームの取得H（.rl-st）はカードの直上・カード幅中央に1つずつ（カードの並び順どおり・数値は濃色インク=CSS側）。
     カード内のチーム名ラベルは撤去（直上の .rl-st と重複のため・2026-08-30 #87 指示⑥）＝ .rl-nmrow は選手名のみ中央 */
  const panels=teams.map((tm,ti)=>{ const pid=reps[tm.id]; const p=pid?state.players.find(x=>x.id===pid):null;
    const av=pid?adjHole(g,pid,h):null; const sv=pid?(av==null?'—':av):'';
    const col=rColor(tm.name);
    // 固定高さのアクション欄（ボタンが動かないように）
    let act='';
    if(rl.spinning) act='';
    else if(rl.challengeFrom) act = (rl.challengeFrom!==tm.id)?`<button class="btn sm" onclick="rlChallengeDo('${rl.challengeFrom}','${tm.id}')">${t('rl.spinThis')}</button>`:`<span class="muted" style="font-size:11px">${t('rl.choosing')}</span>`;
    else if(drawn) act=`<button class="btn sec sm" ${(R.remChange[tm.id]||0)<=0?'disabled':''} onclick="rlChange('${tm.id}')">${t('roulette.change')} ${R.remChange[tm.id]||0}</button><button class="btn gray sm" ${(R.remChallenge[tm.id]||0)<=0?'disabled':''} onclick="rlChallengeStart('${tm.id}')">${t('roulette.challenge')} ${R.remChallenge[tm.id]||0}</button>`;
    return `<div class="rl-col">
      <div class="rl-st"><span class="rl-st-team" style="color:${col}">${esc(tm.name)}</span><span class="rl-st-h">${wonH(ti)}<small>H</small></span></div>
      <div class="rl-panel${stCls[ti]}" id="rl-panel-${tm.id}" style="border-color:${col};--rl-tc:${col};--rl-tc-bg:${rColorBg(tm.name)}">
        <div class="rl-nmrow"><span class="rl-name" id="rl-name-${tm.id}">${rl.spinning&&rl.spinTeams.includes(tm.id)?'…':(p?esc(p.name):'―')}</span></div>
        <div class="rl-scorebig" id="rl-score-${tm.id}">${pid?sv:'&nbsp;'}</div>
      </div>
      <div class="rl-act">${act}</div>
    </div>`; }).join('');
  let mainBtn;
  if(rl.spinning) mainBtn=`<button class="btn danger wide rl-main" onclick="rlStop()">${t('rl.stop')}</button>`;
  else if(!drawn) mainBtn=`<button class="btn wide rl-main" onclick="rlStartInitial()">${t('rl.start')}</button>`;
  else mainBtn=`<button class="btn wide rl-main" ${rlCanAdvance(g)?'':'disabled'} onclick="rlNextHole()">${t('rl.confirmNext')}</button>`;
  const devMenu=`<details class="rl-dev"><summary>${t('rl.dev')}</summary><div class="in">
    ${teams.map(tm=>`<div class="row between" style="margin:3px 0"><span style="color:${rColor(tm.name)};font-weight:var(--w-bold);min-width:64px">${esc(tm.name)}</span>
      <select style="flex:1;max-width:52%" onchange="rlForceRep('${tm.id}',this.value)"><option value="">${t('rl.pickRep')}</option>${tm.memberIds.map(pid=>{const p=state.players.find(x=>x.id===pid);return `<option value="${pid}" ${reps[tm.id]===pid?'selected':''}>${esc(p&&p.name)}</option>`}).join('')}</select></div>`).join('')}
    <hr>${teams.map(tm=>`<div class="row between" style="margin:2px 0"><span style="color:${rColor(tm.name)};min-width:64px">${esc(tm.name)}</span><span><button class="btn gray sm" onclick="rlRefund('${tm.id}','change')">${t('rl.refundChange',{n:R.remChange[tm.id]||0})}</button> <button class="btn gray sm" onclick="rlRefund('${tm.id}','challenge')">${t('rl.refundChallenge',{n:R.remChallenge[tm.id]||0})}</button></span></div>`).join('')}
  </div></details>`;
  const head=`<div class="rlwrap">
    <div class="card rl-play">
      <div class="rl-head"><div class="rl-hole">${h+1}<small>H</small></div><div class="rl-par">Par ${g.par[h]}</div>
        ${holeRes}
        ${rl.challengeFrom?`<span class="muted">${t('rl.pickOpp')} <button class="btn gray sm" onclick="rlCancelChallenge()">${t('btn.cancel')}</button></span>`:''}
        <button class="btn gray sm" style="margin-left:auto" onclick="rlReset()">${t('btn.reset')}</button></div>
      <div class="rl-panels">${panels}</div>
      <div class="rl-ctrl">
        <div class="rl-info">${(!rl.spinning&&drawn)?holeInfo:'&nbsp;'}</div>
        ${mainBtn}
        ${(!rl.spinning&&drawn&&!rlCanAdvance(g))?`<div class="muted" style="margin-top:6px;text-align:center">${t('rl.useChanges')}</div>`:''}
      </div>
    </div>
  </div>`;
  return {head, body:`<div class="rlwrap">${rlScorecard(g)}${devMenu}</div>`};
}


// リーダーボード（1行=1選手。hlMap=強調・note=タイトル横・big=大表示・maskable=名前/スコアを show.names で隠せる）
function leaderboard(title, pids, valFn, dir, fmt, note, key, hlMap, big){
  const rows=ranked(pids,valFn,dir);
  const nameOf=pid=>{const p=state.players.find(x=>x.id===pid);return esc(p&&p.name);};
  const body=`<table class="lb ${big?'big':''}"><tr><th class="c-pos">${t('col.rank')}</th><th>${t('col.player')}</th><th class="c-val">${dir==='asc'?t('col.score'):t('col.pts')}</th></tr>
    ${rows.map(r=>{ const hb=hlMap&&hlMap[r.pid];
      return `<tr class="rank ${hb?'hlrow':''}"><td class="c-pos">${posBadge(r.rank,r.rank===1)}</td><td class="nmc">${nameOf(r.pid)}${hb?`<span class="kanjibadge">${hb}</span>`:''}</td><td class="c-val"><b>${fmt(r.v)}</b></td></tr>`; }).join('')}</table>`;
  return `<div class="card tight ${big?'wide':''}"><h2 class="lbh"><span>${title}</span>${note?`<span class="lbnote">${note}</span>`:''}</h2>${body}</div>`;
}

function renderPrizes(g){
  const P=g.prizes, NP=niapinHolesOf(g), DC=draconHolesOf(g);   // 対象ホールは par から導出（2026-08-20-npdc-par.md）
  if(!NP.length && !DC.length) return '';
  const parts=g.participants.filter(pid=>state.players.find(x=>x.id===pid));
  const opts=(sel)=>`<option value="">—</option>${parts.map(pid=>{const p=state.players.find(x=>x.id===pid);
    return `<option value="${pid}" ${sel===pid?'selected':''}>${esc(p.name)}</option>`}).join('')}`;
  let html=`<div class="card prizewin"><h2>${t('prize.recTitle')}</h2>
    <div class="muted">${t('prize.recNote')}</div>`;
  if(NP.length){ html+=`<h3>${t('term.niapin')}</h3>`;
    NP.forEach(h=>{ html+=`<div class="row between" style="margin:4px 0">
      <span class="pill e1">${h+1}H</span>
      <select style="flex:1;max-width:60%" onchange="setPrize('niapinWinner',${h},this.value)">${opts(P.niapinWinner[h])}</select></div>`; }); }
  if(DC.length){ html+=`<h3>${t('term.dracon')}</h3>`;
    DC.forEach(h=>{ html+=`<div class="row between" style="margin:4px 0">
      <span class="pill f" style="background:var(--danger-bg);color:var(--red)">${h+1}H</span>
      <select style="flex:1;max-width:60%" onchange="setPrize('draconWinner',${h},this.value)">${opts(P.draconWinner[h])}</select></div>`; }); }
  html+=`</div>`; return html;
}
function setPrize(k,h,v){ curGame().prizes[k][h]=v; save(); renderResult(); }

// チーム対抗の各結果を「個別カード」で返す。ゲームごとに master トグル＋チームごとの目隠しボタン（名前＋合計をまとめて隠す）
// only（省略可・2026-08-20-results-regroup.md §5.2）: 指定時は当該フォーマットのカード1枚だけ返す。無指定は現行どおり全カード＝後方互換
function renderTeams(g, only){
  const F=chFormats(g); const teams=g.teams.filter(t=>t.memberIds.length);   // αではβゲームのカードを出さない（§11.12 C）
  const teamGross=t=>t.memberIds.reduce((a,pid)=>a+effGross(g,pid),0);
  const teamNet=t=>Math.round(t.memberIds.reduce((a,pid)=>a+netScore(g,pid),0)*10)/10;
  // master トグルは表の下（結果が先・操作が後＝追加指示⑪・§11.14 幹事操作は控えめ配置）
  const card=(key,title,valFn,dir,note)=>{ const rows=teams.map(t=>({t,v:valFn(t)})).sort((a,b)=> dir==='desc'? b.v-a.v : a.v-b.v);
    const on = tgMode[key]==='show';
    // 発表ボタン（winpoints-reveal §5.2・card の key と種目 key は一致）: 目隠しトグルと同列の控えめ配置（§11.14）
    const tools=`<div class="cardtools mt8"><span class="tgl ${on?'on':'off'}" onclick="toggleTgAll('${key}')">${on?t('ns.allShow'):t('ns.allHide')}</span>${tpAnnounceUI(g,key)}</div>`;
    return `<div class="card tight"><h2>${title}</h2>${note?`<div class="muted" style="margin-bottom:4px">${note}</div>`:''}<table class="lb"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.team')}</th><th class="c-val">${dir==='desc'?'H':t('col.total')}</th></tr>
      ${rows.map((r,i)=>{ const m=tgMasked(key,r.t.id);
        const nm = m ? '<span class="mask">？？？</span>' : esc(r.t.name);
        const val = m ? '<span class="mask">？</span>' : `<b>${Math.round(r.v*10)/10}</b>`;
        return `<tr class="rank"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleTgRow('${key}','${r.t.id}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(i+1,i===0)}</td><td class="nmc">${nm}</td><td class="c-val">${val}</td></tr>`; }).join('')}</table>${tools}</div>`; };
  let out='';
  if(F.teamGross && (!only||only==='teamGross')) out+=card('teamGross',t('term.teamGross'),teamGross,'asc',t('team.noteLow'));
  if(F.teamNet && (!only||only==='teamNet')) out+=card('teamNet',t('term.teamNet'),teamNet,'asc',t('team.noteLow'));
  if(F.best2ball && (!only||only==='best2ball')) out+=card('best2ball',t('term.best2'),tm=>best2(g,tm),'asc',t('team.noteBest2'));
  if(F.holeByHole && (!only||only==='holeByHole') && teams.length>=2){ const {won}=holesWon(g);
    out+=card('holeByHole',t('term.hbh'),(tm)=>{const i=teams.indexOf(tm);return won[i];},'desc',t('team.noteHbh')); }
  if(F.vegas && (!only||only==='vegas')){ const vs=vegasStandings(g);
    if(vs.teams.length<2){ out+=`<div class="card tight"><h2>${t('term.vegas')}</h2><div class="muted">${t('vegas.needTeams')}</div></div>`; }
    else{ const rows=vs.teams.map((T,i)=>({t:T,v:vs.tot[i]})).sort((a,b)=>b.v-a.v);
      const on = tgMode.vegas==='show';
      const tools=`<div class="cardtools mt8"><span class="tgl ${on?'on':'off'}" onclick="toggleTgAll('vegas')">${on?t('ns.allShow'):t('ns.allHide')}</span>${tpAnnounceUI(g,'vegas')}</div>`;
      out+=`<div class="card tight"><h2>${t('term.vegas')}</h2><table class="lb"><tr><th class="c-eye"></th><th class="c-pos">${t('col.rank')}</th><th>${t('col.team')}</th><th class="c-val">${t('vegas.total')}</th></tr>
        ${rows.map((r,i)=>{ const m=tgMasked('vegas',r.t.id);
          const nm = m ? '<span class="mask">？？？</span>' : esc(r.t.name);
          const val = m ? '<span class="mask">？</span>' : `<b>${r.v>0?'+':''}${r.v}</b>`;
          return `<tr class="rank"><td class="c-eye"><button class="eyebtn ${m?'off':'on'}" onclick="toggleTgRow('vegas','${r.t.id}')">${m?EYEOFF:EYE}</button></td><td class="c-pos">${posBadge(i+1,i===0)}</td><td class="nmc" style="text-align:left">${nm}</td><td class="c-val">${val}</td></tr>`; }).join('')}</table>
        <div class="muted mt6">${t('team.noteVegasHbh')}</div>${tools}</div>`; } }   // 勝ち点はホール勝敗数（team-points §3.3.2）・点差は独立集計のまま
  return out;
}

