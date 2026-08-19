/* ============================ GAME SETUP ============================ */
function renderGame(){
  const el=document.getElementById('view-game');
  let html = `<div class="card"><h2>${t('game.title')}</h2>
    <div class="row between">
      <select id="gameSel" onchange="selectGame(this.value)" class="fx1">
        <option value="">${t('game.selectPh')}</option>
        ${state.games.map(g=>`<option value="${g.id}" ${g.id===state.currentGameId?'selected':''}>${esc(g.name)} (${g.date})</option>`).join('')}
      </select>
      <button class="btn" onclick="createGame()">${t('game.newBtn')}</button>
    </div></div>`;

  const g=curGame();
  if(!g){ el.innerHTML=html+`<div class="empty">${t('game.emptyCreate')}</div>`+hostMenuCard(); return; }

  html += `<div class="card"><h2>${t('game.basic')}</h2>
    <label class="fl">${t('game.compeName')}</label><input value="${esc(g.name)}" onchange="setG('name',this.value)">
    <div class="row"><div class="fx1"><label class="fl">${t('game.date')}</label><input type="date" value="${g.date}" onchange="setG('date',this.value)"></div>
    <div class="fx1"><label class="fl">${t('game.course')}</label><input value="${esc(g.course)}" placeholder="${t('game.coursePh')}" onchange="setG('course',this.value)"></div></div>
    <div class="row" class="mt10">
      <button class="btn danger sm" onclick="deleteGame()">${t('game.deleteBtn')}</button>
      <button class="btn gray sm" onclick="dupGame()">${t('btn.dup')}</button>
    </div>
  </div>`;

  html += `<div class="card"><h2>${t('game.courseCard')}</h2>
    <div class="muted">${t('game.hiddenNote',{n:`<b id="hidCount">${g.hidden.filter(Boolean).length}</b>`})}</div>
    <div class="row" style="margin:8px 0"><button class="btn sec sm" onclick="randomHidden()">${t('game.random12')}</button>
      <button class="btn gray sm" onclick="clearHidden()">${t('btn.clear')}</button></div>
    ${(scNarrow()? [[0,9],[9,18]] : [[0,18]]).map(([s,e])=>courseGrid(g,s,e)).join('')}</div>`;

  html += `<div class="card"><h2>${t('game.periaCard')}</h2>
    <div class="muted">${t('game.periaFormula')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.coef')}</label><input type="number" step="0.05" value="${g.periaCoef}" onchange="setG('periaCoef',parseFloat(this.value))"></div>
      <div class="fx1"><label class="fl">${t('game.cap')}</label><input type="number" step="1" value="${g.periaCap??''}" placeholder="${t('game.capPh')}" onchange="setCap(this.value)"></div>
    </div></div>`;

  html += `<div class="card"><h2>${t('game.everyCard')}</h2>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.womenEvery.enabled?'checked':''} onchange="setWE(this.checked)"> ${t('game.everyApply')}</label>
    <div class="muted" class="mt6">${t('game.everyNote')}</div></div>`;

  html += `<div class="card"><h2>${t('game.partsCard')}</h2>
    ${state.players.length? state.players.map(p=>`<span class="chip ${g.participants.includes(p.id)?'on':''}" onclick="toggleParticipant('${p.id}')">${esc(p.name)}${p.everyType!=='none'?' '+everyLabel(p.everyType):''}</span>`).join('')
      : `<div class="muted">${t('game.partsEmpty')}</div>`}
  </div>`;

  html += `<div class="card"><h2>${t('game.teamCard')}</h2>
    <div class="row"><button class="btn sec sm" onclick="addTeam()">${t('game.addTeam')}</button>
      <button class="btn gray sm" onclick="autoTeams(2)">${t('game.auto2')}</button>
      <button class="btn gray sm" onclick="autoTeams(3)">${t('game.auto3')}</button></div>
    ${g.teams.map(t=>`<div style="border:1px solid var(--line);border-radius:var(--r-md);padding:10px;margin-top:8px">
      <div class="row between"><input value="${esc(t.name)}" onchange="setTeamName('${t.id}',this.value)" style="flex:1;font-weight:var(--w-bold)">
        <button class="btn sm danger" onclick="delTeam('${t.id}')">×</button></div>
      <div class="mt6">${g.participants.map(pid=>{const p=state.players.find(x=>x.id===pid);if(!p)return'';
        return `<span class="chip ${t.memberIds.includes(pid)?'on':''}" onclick="toggleTeamMember('${t.id}','${pid}')">${esc(p.name)}</span>`}).join('')}</div>
    </div>`).join('') || `<div class="muted">${t('game.teamEmpty')}</div>`}
  </div>`;

  html += `<div class="card"><h2>${t('game.npdcCard')}</h2>
    <div class="muted">${t('game.npdcNote')}</div>
    <div class="mt6">${g.par.map((_,i)=>{
      const np=g.prizes.niapinHoles.includes(i), dc=g.prizes.draconHoles.includes(i);
      return `<button class="holebtn ${np?'np':''} ${dc?'dc':''}" onclick="cyclePrize(${i})">${i+1}</button>`}).join('')}</div>
    <div class="muted" class="mt6">${t('game.npdcLocal')}</div></div>`;

  const F=g.formats;
  const fchk=(k,label)=>`<label><input type="checkbox" ${F[k]?'checked':''} onchange="setFmt('${k}',this.checked)"> ${label}</label>`;
  // β系フォーマットのトグルは β版でだけ表示・選択可（§11.12 C）。α版でも g.formats の値自体は保持する
  const bchk=(k,label)=> CHANNEL==='b' ? fchk(k,label) : '';
  html += `<div class="card"><h2>${t('game.fmtCard')} ${CHANNEL==='b'?`<span class="tag tagbeta">${t('ch.b')}</span>`:''}</h2><div class="fmtgrid">
    ${fchk('gross',t('fmt.gross'))}${fchk('net',t('fmt.net'))}
    ${fchk('teamGross',t('fmt.teamGross'))}${fchk('teamNet',t('fmt.teamNet'))}
    ${fchk('holeByHole',t('fmt.hbh'))}${bchk('stableford',t('fmt.stableford'))}
    ${bchk('nassau',t('fmt.nassau'))}${bchk('olympic',t('fmt.olympic'))}
    ${bchk('callaway',t('fmt.callaway'))}${bchk('best2ball',t('fmt.best2'))}
    ${bchk('vegas',t('fmt.vegas'))}
  </div>${(CHANNEL==='b'&&F.vegas)?`<div style="margin-top:10px;border-top:1px solid var(--line);padding-top:10px">
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.vegas.flip?'checked':''} onchange="setVegas('flip',this.checked)"> ${t('vegas.flip')}</label>
    <div class="row" style="margin-top:8px;align-items:center"><span style="font-size:13px">${t('vegas.cap')}</span>
      <select style="flex:1;max-width:220px" onchange="setVegas('cap',this.value)">
        <option value="doublePar" ${g.vegas.cap!=='none'?'selected':''}>${t('vegas.capDouble')}</option>
        <option value="none" ${g.vegas.cap==='none'?'selected':''}>${t('vegas.capNone')}</option>
      </select></div>
  </div>`:''}</div>`;

  html += `<div class="card"><h2>${t('game.rlCard')}</h2>
    <div class="muted">${t('game.rlNote')}</div>
    <div class="row" class="mt8">
      <div class="fx1"><label class="fl">${t('game.rlChangeN')}</label><input type="number" min="0" max="9" value="${g.roulette.changeN}" onchange="setRoulette('changeN',this.value)"></div>
      <div class="fx1"><label class="fl">${t('game.rlChallengeM')}</label><input type="number" min="0" max="9" value="${g.roulette.challengeM}" onchange="setRoulette('challengeM',this.value)"></div>
    </div></div>`;

  // Points / prize pool
  const P=g.points;
  const ptsInd=(k,label)=> F[k]?`<div class="ptsrow"><span>${label}</span><span class="ptsedit"><input value="${(P[k]||[]).join(',')}" onchange="setPoints('${k}',this.value)" placeholder="5,3,1"></span></div>`:'';
  const ptsTeam=(k,label)=> F[k]?`<div class="ptsrow"><span>${label}${t('pts.each')}</span><span class="ptsedit"><input value="${(P[k]||[]).join(',')}" onchange="setPoints('${k}',this.value)" placeholder="3"></span></div>`:'';
  const npdc=g.prizes.niapinHoles.length||g.prizes.draconHoles.length;
  html += `<div class="card prizewin"><h2>${t('game.ptsCard')}</h2>
    <div class="muted">${t('game.ptsNote')}</div>
    <h3>${t('game.h3Ind')}</h3>
    ${ptsInd('net',t('fmt.net'))}${ptsInd('gross',t('fmt.gross'))}${ptsInd('stableford',t('fmt.stableford'))}
    ${ptsInd('olympic',t('fmt.olympic'))}${ptsInd('callaway',t('term.callaway'))}${ptsInd('nassauTotal',t('pts.nassauTotal'))}
    <h3>${t('game.h3Team')}</h3>
    ${ptsTeam('teamGross',t('term.teamGross'))}${ptsTeam('teamNet',t('term.teamNet'))}${ptsTeam('holeByHole',t('term.hbh'))}${ptsTeam('best2ball',t('term.best2'))}
    <div class="ptsrow"><span>${t('term.roulette')}${t('pts.each')}</span><span class="ptsedit"><input value="${(P.roulette||[]).join(',')}" onchange="setPoints('roulette',this.value)" placeholder="3"></span></div>
    <h3>${t('game.h3Prize')}</h3>
    <div class="ptsrow"><span>${t('pts.niapin')}</span><span class="ptsedit"><input type="number" value="${P.niapin}" onchange="setPointsNum('niapin',this.value)"></span></div>
    <div class="ptsrow"><span>${t('pts.dracon')}</span><span class="ptsedit"><input type="number" value="${P.dracon}" onchange="setPointsNum('dracon',this.value)"></span></div>
    <hr>
    <label class="fl">${t('game.pool')}</label>
    <input type="number" value="${g.prizePool||0}" placeholder="${t('game.poolPh')}" onchange="setG('prizePool',parseInt(this.value)||0)">
    <div class="muted" class="mt6">${t('game.poolNote')}</div>
  </div>`;

  html += hostMenuCard();
  el.innerHTML=html;
}
// 幹事メニュー（動作確認用・目立たせない。Phase2で幹事のみ表示に制限予定）
function hostMenuCard(){
  return `<details><summary>${t('host.summary')}</summary><div class="in">
    <div class="muted" style="margin-bottom:8px">${t('host.note')}</div>
    <button class="btn gold sm" onclick="seedTestData()">${t('host.seedBtn')}</button>
    <div class="muted" class="mt6">${t('host.seedNote')}</div>
  </div></details>`;
}
function setG(k,v){ const g=curGame(); g[k]=v; save(); if(k==='name'||k==='date'||k==='course')render(); }
function setCap(v){ const g=curGame(); g.periaCap = v===''?null:parseFloat(v); save(); }
function setWE(v){ curGame().womenEvery.enabled=v; save(); }
function setPar(i,v){ curGame().par[i]=parseInt(v)||0; save(); renderGame(); }
function toggleHidden(i){ const g=curGame(); g.hidden[i]=!g.hidden[i]; save(); document.getElementById('hidCount').textContent=g.hidden.filter(Boolean).length; }
/* 隠し12H＝ショート(Par3)2・ミドル(Par4)8・ロング(Par5)2（隠しPar合計48の標準新ペリア構成）。
   非標準コースは各グループ数でクリップし、不足はミドル→ロング→ショート順に補充（§11.1） */
function randomHidden(){ const g=curGame();
  const pick=(arr,n)=>arr.slice().sort(()=>Math.random()-0.5).slice(0,Math.max(0,n));
  const p3=[],p4=[],p5=[]; g.par.forEach((p,i)=>{ (p<=3?p3:p===4?p4:p5).push(i); });
  const sel=[...pick(p3,Math.min(2,p3.length)), ...pick(p4,Math.min(8,p4.length)), ...pick(p5,Math.min(2,p5.length))];
  [p4,p5,p3].forEach(grp=>{ pick(grp,grp.length).forEach(i=>{ if(sel.length<12 && !sel.includes(i)) sel.push(i); }); });
  g.hidden=Array(18).fill(false); sel.forEach(i=>g.hidden[i]=true); save(); renderGame(); }
function clearHidden(){ curGame().hidden=Array(18).fill(false); save(); renderGame(); }
/* コース設定のホール表（§11.12 D）: 狭幅は OUT(1-9)/IN(10-18) の2段、iPad/PC は18列1段。
   合計列は区間で決まる（前半=OUT小計 / 後半=IN小計＋合計、1段時は合計のみ＝従来どおり）。 */
function courseGrid(g,s,e){
  const H=[]; for(let i=s;i<e;i++)H.push(i);
  const one=(s===0&&e===18);
  const cols = one ? [{label:t('col.total'), f:a=>sum(a,0,18)}]
    : (s===0 ? [{label:'OUT', f:a=>sum(a,0,9)}]
             : [{label:'IN', f:a=>sum(a,9,18)}, {label:t('col.total'), f:a=>sum(a,0,18)}]);
  return `<div class="scroll"><table class="scoregrid">
      <tr><th class="name">H</th>${H.map(i=>`<th class="${g.hidden[i]?'hidden-h':''}">${i+1}</th>`).join('')}${cols.map(c=>`<th class="sum">${c.label}</th>`).join('')}</tr>
      <tr><td class="name">Par</td>${H.map(i=>`<td class="${g.hidden[i]?'hidden-h':''}"><input type="number" min="3" max="6" value="${g.par[i]}" onchange="setPar(${i},this.value)"></td>`).join('')}${cols.map(c=>`<td class="sum">${c.f(g.par)}</td>`).join('')}</tr>
      <tr><td class="name">${t('game.rowHidden')}</td>${H.map(i=>`<td class="${g.hidden[i]?'hidden-h':''}"><input type="checkbox" ${g.hidden[i]?'checked':''} onchange="toggleHidden(${i})"></td>`).join('')}${cols.map(()=>`<td class="sum">-</td>`).join('')}</tr>
    </table></div>`;
}

function setFmt(k,v){ curGame().formats[k]=v; save(); renderGame(); }
function setPoints(k,v){ curGame().points[k]=v.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)); save(); }
function setPointsNum(k,v){ curGame().points[k]=parseInt(v)||0; save(); }
function setRoulette(k,v){ curGame().roulette[k]=Math.max(0,parseInt(v)||0); save(); }
function setVegas(k,v){ curGame().vegas[k]=v; save(); }
function createGame(){ const g=newGame(); state.games.push(g); state.currentGameId=g.id; save(); render(); toast(t('toast.gameCreated')); }
function selectGame(id){ state.currentGameId=id||null; save(); render(); }
function deleteGame(){ if(!confirm(t('confirm.deleteGame')))return;
  state.games=state.games.filter(x=>x.id!==state.currentGameId); state.currentGameId=state.games[0]?.id||null; save(); render(); }
function dupGame(){ const g=JSON.parse(JSON.stringify(curGame())); g.id=uid(); g.name=g.name+' (複製)'; state.games.push(g); state.currentGameId=g.id; save(); render(); }
function toggleParticipant(pid){ const g=curGame(); const i=g.participants.indexOf(pid);
  if(i<0){ g.participants.push(pid); g.scores[pid]=g.scores[pid]||Array(18).fill(null); }
  else { g.participants.splice(i,1); } save(); renderGame(); }
function addTeam(){ const g=curGame(); const names=['レッド','ブルー','グリーン','イエロー'];
  g.teams.push({id:uid(),name:'チーム'+names[g.teams.length%4],memberIds:[]}); save(); renderGame(); }
function autoTeams(n){ const g=curGame(); const names=['レッド','ブルー','グリーン'];
  g.teams=[]; for(let i=0;i<n;i++)g.teams.push({id:uid(),name:'チーム'+names[i],memberIds:[]});
  g.participants.forEach((pid,i)=>g.teams[i%n].memberIds.push(pid)); save(); renderGame(); }
function setTeamName(id,v){ curGame().teams.find(t=>t.id===id).name=v; save(); }
function delTeam(id){ const g=curGame(); g.teams=g.teams.filter(t=>t.id!==id); save(); renderGame(); }
function toggleTeamMember(tid,pid){ const g=curGame();
  g.teams.forEach(t=>{ if(t.id!==tid) t.memberIds=t.memberIds.filter(x=>x!==pid); });
  const t=g.teams.find(t=>t.id===tid); const i=t.memberIds.indexOf(pid);
  if(i<0)t.memberIds.push(pid); else t.memberIds.splice(i,1); save(); renderGame(); }
function cyclePrize(i){ const p=curGame().prizes;
  const np=p.niapinHoles.includes(i), dc=p.draconHoles.includes(i);
  p.niapinHoles=p.niapinHoles.filter(x=>x!==i); p.draconHoles=p.draconHoles.filter(x=>x!==i);
  if(!np&&!dc)p.niapinHoles.push(i); else if(np)p.draconHoles.push(i);
  save(); renderGame(); }

