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

  html += `<div class="card"><h2>${t('game.periaCard')}</h2>
    <div class="muted">${t('game.periaFormula')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.coef')}</label><input type="number" step="0.05" value="${g.periaCoef}" onchange="setG('periaCoef',parseFloat(this.value))"></div>
      <div class="fx1"><label class="fl">${t('game.cap')}</label><input type="number" step="1" value="${g.periaCap??''}" placeholder="${t('game.capPh')}" onchange="setCap(this.value)"></div>
    </div></div>`;

  html += `<div class="card"><h2>${t('game.everyCard')}</h2>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.womenEvery.enabled?'checked':''} onchange="setWE(this.checked)"> ${t('game.everyApply')}</label>
    <div class="muted" class="mt6">${t('game.everyNote')}</div></div>`;

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
    ${bchk('vegas',t('fmt.vegas'))}${bchk('match1v1',t('fmt.match1v1'))}
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
  html += `<div class="card prizewin"><h2>${t('game.ptsCard')}</h2>
    <div class="muted">${t('game.ptsNote')}</div>
    <h3>${t('game.h3Ind')}</h3>
    ${ptsInd('net',t('fmt.net'))}${ptsInd('gross',t('fmt.gross'))}${ptsInd('stableford',t('fmt.stableford'))}
    ${ptsInd('olympic',t('fmt.olympic'))}${ptsInd('callaway',t('term.callaway'))}${ptsInd('nassauTotal',t('pts.nassauTotal'))}
    ${F.match1v1?`<div class="ptsrow"><span>${t('pts.m1win')}</span><span class="ptsedit"><input type="number" value="${P.m1win}" onchange="setPointsNum('m1win',this.value)"></span></div>
    <div class="ptsrow"><span>${t('pts.m1draw')}</span><span class="ptsedit"><input type="number" value="${P.m1draw}" onchange="setPointsNum('m1draw',this.value)"></span></div>`:''}
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

