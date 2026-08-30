/* ============================ GAME SETTINGS（何をどう集計するか・2026-08-20-game-split.md） ============================ */
function renderGame(){
  const el=document.getElementById('view-game');
  const g=curGame();
  if(!g){ el.innerHTML=`<div class="empty">${t('msg.needGame')}</div>`; return; }

  let html = `<div class="card"><h2>${t('game.periaCard')}</h2>
    <div class="muted">${t('game.periaFormula')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.coef')}</label><input type="number" step="0.05" value="${g.periaCoef}" onchange="setG('periaCoef',parseFloat(this.value))"></div>
      <div class="fx1"><label class="fl">${t('game.cap')}</label><input type="number" step="1" value="${g.periaCap??''}" placeholder="${t('game.capPh')}" onchange="setCap(this.value)"></div>
    </div></div>`;

  html += `<div class="card"><h2>${t('game.everyCard')}</h2>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.womenEvery.enabled?'checked':''} onchange="setWE(this.checked)"> ${t('game.everyApply')}</label>
    <div class="muted" class="mt6">${t('game.everyNote')}</div></div>`;

  // 次回幹事バッジ（コンペごと・既定OFF・2026-08-29-host-option.md §5/§14）。サブ設定＝対象順位＋順位ごと方向（マスターON時のみ表示）
  html += `<div class="card"><h2>${t('game.kanjiCard')}</h2>
    <label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.kanjiBadge?'checked':''} onchange="setKanjiBadge(this.checked)"> ${t('game.kanjiTgl')}</label>`;
  if(g.kanjiBadge){
    const R=g.kanjiRanks;
    const krow=(k,label,down,up)=>`<div class="row" style="margin-top:8px;align-items:center">
      <label style="display:flex;gap:8px;align-items:center;font-size:14px;min-width:96px"><input type="checkbox" ${R[k].enabled?'checked':''} onchange="setKanjiRank('${k}',this.checked)"> ${label}</label>
      <select style="flex:1;max-width:340px" ${R[k].enabled?'':'disabled'} onchange="setKanjiRankDir('${k}',this.value)">
        <option value="down" ${R[k].dir!=='up'?'selected':''}>${down}</option>
        <option value="up" ${R[k].dir==='up'?'selected':''}>${up}</option>
      </select></div>`;
    html += `<div style="font-size:13px;margin-top:10px">${t('game.kanjiRanks')}</div>
      ${krow('r1',t('game.kanjiR1'),t('game.kanjiR1Down'),t('game.kanjiR1Up'))}
      ${krow('r2',t('game.kanjiR2'),t('game.kanjiR2Down'),t('game.kanjiR2Up'))}
      ${krow('booby',t('game.kanjiBooby'),t('game.kanjiBoobyDown'),t('game.kanjiBoobyUp'))}
      <div class="muted" class="mt6">${t('game.kanjiNote')}</div>`;
  }
  html += `</div>`;

  const F=g.formats;
  const fchk=(k,label)=>`<label><input type="checkbox" ${F[k]?'checked':''} onchange="setFmt('${k}',this.checked)"> ${label}</label>`;
  // β系フォーマットのトグルは β版でだけ表示・選択可（§11.12 C）。α版でも g.formats の値自体は保持する
  const bchk=(k,label)=> CHANNEL==='b' ? fchk(k,label) : '';
  html += `<div class="card"><h2>${t('game.fmtCard')} ${CHANNEL==='b'?`<span class="tag tagbeta">${t('ch.b')}</span>`:''}</h2><div class="fmtgrid">
    ${fchk('gross',t('fmt.gross'))}${fchk('net',t('fmt.net'))}
    ${fchk('teamGross',t('fmt.teamGross'))}${fchk('teamNet',t('fmt.teamNet'))}
    ${fchk('holeByHole',t('fmt.hbh'))}${fchk('roulette',t('fmt.roulette'))}
    ${bchk('stableford',t('fmt.stableford'))}${bchk('nassau',t('fmt.nassau'))}${bchk('olympic',t('fmt.olympic'))}
    ${bchk('callaway',t('fmt.callaway'))}${bchk('best2ball',t('fmt.best2'))}
    ${bchk('vegas',t('fmt.vegas'))}${fchk('match1v1',t('fmt.match1v1'))}
  </div></div>`;

  // ルーレット設定カードはルーレット対抗ON時のみ表示（winpoints-reveal §5.3。β Vegas 設定カードと同型・setFmt→renderGame 再描画で出没）
  if(F.roulette){
    html += `<div class="card"><h2>${t('game.rlCard')}</h2>
    <div class="muted">${t('game.rlNote')}</div>
    <div class="row" class="mt8">
      <div class="fx1"><label class="fl">${t('game.rlChangeN')}</label><input type="number" min="0" max="9" value="${g.roulette.changeN}" onchange="setRoulette('changeN',this.value)"></div>
      <div class="fx1"><label class="fl">${t('game.rlChallengeM')}</label><input type="number" min="0" max="9" value="${g.roulette.challengeM}" onchange="setRoulette('challengeM',this.value)"></div>
    </div></div>`;
  }

  // Vegas 個別設定（β且つチェックON時のみ表示・2026-08-20-game-split.md §3 #7b。setFmt→renderGame 再描画で出没）
  if(CHANNEL==='b' && F.vegas){
    html += `<div class="card"><h2>${t('fmt.vegas')} <span class="tag tagbeta">${t('ch.b')}</span></h2>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.vegas.flip?'checked':''} onchange="setVegas('flip',this.checked)"> ${t('vegas.flip')}</label>
    <div class="row" style="margin-top:8px;align-items:center"><span style="font-size:13px">${t('vegas.cap')}</span>
      <select style="flex:1;max-width:220px" onchange="setVegas('cap',this.value)">
        <option value="doublePar" ${g.vegas.cap!=='none'?'selected':''}>${t('vegas.capDouble')}</option>
        <option value="none" ${g.vegas.cap==='none'?'selected':''}>${t('vegas.capNone')}</option>
      </select></div>
  </div>`;
  }

  // Points / prize pool
  const P=g.points;
  const ptsInd=(k,label)=> F[k]?`<div class="ptsrow"><span>${label}</span><span class="ptsedit"><input value="${(P[k]||[]).join(',')}" onchange="setPoints('${k}',this.value)" placeholder="5,3,1"></span></div>`:'';
  html += `<div class="card prizewin"><h2>${t('game.ptsCard')}</h2>
    <div class="muted">${t('game.ptsNote')}</div>
    <h3>${t('game.h3Ind')}</h3>
    ${ptsInd('net',t('fmt.net'))}${ptsInd('gross',t('fmt.gross'))}${ptsInd('stableford',t('fmt.stableford'))}
    ${ptsInd('olympic',t('fmt.olympic'))}${ptsInd('callaway',t('term.callaway'))}${ptsInd('nassauTotal',t('pts.nassauTotal'))}
    ${F.match1v1?`<div class="ptsrow"><span>${t('pts.m1win')}</span><span class="ptsedit"><input type="number" value="${P.m1win}" onchange="setPointsNum('m1win',this.value)"></span></div>
    <div class="ptsrow"><span>${t('pts.m1draw')}</span><span class="ptsedit"><input type="number" value="${P.m1draw}" onchange="setPointsNum('m1draw',this.value)"></span></div>`:''}
    <h3>${t('game.h3Team')}</h3>
    <div class="ptsrow"><span>${t('pts.teamRank')}</span><span class="ptsedit"><input value="${(P.teamRankPts||[]).join(',')}" onchange="setPoints('teamRankPts',this.value)" placeholder="10,5"></span></div>
    <h3>${t('game.h3Prize')}</h3>
    <div class="ptsrow"><span>${t('pts.niapin')}</span><span class="ptsedit"><input type="number" value="${P.niapin}" onchange="setPointsNum('niapin',this.value)"></span></div>
    <div class="ptsrow"><span>${t('pts.dracon')}</span><span class="ptsedit"><input type="number" value="${P.dracon}" onchange="setPointsNum('dracon',this.value)"></span></div>
    <hr>
    <label class="fl">${t('game.pool')}</label>
    <input type="number" value="${g.prizePool||0}" placeholder="${t('game.poolPh')}" onchange="setG('prizePool',parseInt(this.value)||0)">
    <div class="muted" class="mt6">${t('game.poolNote')}</div>
  </div>`;

  el.innerHTML=html;
}
function setG(k,v){ const g=curGame(); g[k]=v; save(); if(k==='name'||k==='date'||k==='course')render(); }
function setCap(v){ const g=curGame(); g.periaCap = v===''?null:parseFloat(v); save(); }
function setWE(v){ curGame().womenEvery.enabled=v; save(); }
function setKanjiBadge(v){ curGame().kanjiBadge=v; save(); renderGame(); }   // 再描画でサブ設定の出没を追従（§14）
function setKanjiRank(k,v){ curGame().kanjiRanks[k].enabled=v; save(); renderGame(); }   // 再描画で select の disabled を追従
function setKanjiRankDir(k,v){ curGame().kanjiRanks[k].dir = v==='up'?'up':'down'; save(); }
function setFmt(k,v){ curGame().formats[k]=v; save(); renderGame(); }
function setPoints(k,v){ curGame().points[k]=v.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)); save(); }
function setPointsNum(k,v){ curGame().points[k]=parseInt(v)||0; save(); }
function setRoulette(k,v){ curGame().roulette[k]=Math.max(0,parseInt(v)||0); save(); }
function setVegas(k,v){ curGame().vegas[k]=v; save(); }
