/* ============================ GAME SETTINGS（何をどう集計するか・2026-08-20-game-split.md） ============================
   2026-09-12-settings-consolidation.md §3.5 D: 旧「ゲーム設定」タブを廃止し、renderGame() を
   gameSettingsHtml(g) へ改名して **HTML 文字列を返す純関数**にした（DOM は書かない）。
   呼び出しは js/basic.js の renderBasic() のみ＝描画先は #view-basic。g は呼び出し側で curGame() 済み。
   カード順は設計 §3.2 の S3〜S10（集計する競技だけ .card で常時展開、残りは gsSec() で <details class="gsec"> に畳む）。
   モジュール分割（2026-07-13-refactor-split.md）は維持＝本ファイルは残す・<script> 読込順も不変。 */
function gameSettingsHtml(g){
  const F=g.formats;
  const fchk=(k,label)=>`<label><input type="checkbox" ${F[k]?'checked':''} onchange="setFmt('${k}',this.checked)"> ${label}</label>`;
  // β系フォーマットのトグルは β版でだけ表示・選択可（§11.12 C）。α版でも g.formats の値自体は保持する
  const bchk=(k,label)=> CHANNEL==='b' ? fchk(k,label) : '';
  // グループ表示（バッチ95追加5・ユーザー確定順）: 結果発表のグループ構成（個人戦/チーム戦）と同じ小見出し付き。
  // 個人戦=gross→net→niadoraInd→β4種／チーム戦=niadoraTeam→gross→net→hbh→b2(β)→vegas(β)→m1→roulette。見出しは配点カードの h3 キーを流用
  // S3「集計する競技」＝統合タブの主役。折りたたまない（設計 §3.2 Q4）
  let html = `<div class="card"><h2>${t('game.fmtCard')} ${CHANNEL==='b'?`<span class="tag tagbeta">${t('ch.b')}</span>`:''}</h2>
    <h3>${t('game.h3Ind')}</h3><div class="fmtgrid">
    ${fchk('gross',t('fmt.gross'))}${fchk('net',t('fmt.net'))}${fchk('niadoraInd',t('fmt.niadoraInd'))}
    ${bchk('stableford',t('fmt.stableford'))}${bchk('olympic',t('fmt.olympic'))}
    ${bchk('callaway',t('fmt.callaway'))}${bchk('nassau',t('fmt.nassau'))}
  </div>
    <h3>${t('game.h3Team')}</h3><div class="fmtgrid">
    ${fchk('niadoraTeam',t('fmt.niadoraTeam'))}${fchk('teamGross',t('fmt.teamGross'))}${fchk('teamNet',t('fmt.teamNet'))}
    ${fchk('univMatch',t('fmt.univMatch'))}${bchk('holeByHole',t('fmt.hbh'))}${bchk('best2ball',t('fmt.best2'))}
    ${bchk('vegas',t('fmt.vegas'))}${fchk('match1v1',t('fmt.match1v1'))}
    ${fchk('roulette',t('fmt.roulette'))}${fchk('customMatch',t('fmt.customMatch'))}
  </div></div>`;

  // S4 ルーレット設定はルーレット対抗ON時のみ表示（winpoints-reveal §5.3。setFmt→renderBasic 再描画で出没）
  if(F.roulette){
    html += gsSec('roulette', t('game.rlCard'), `<div class="muted">${t('game.rlNote')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.rlChangeN')}</label><input type="number" min="0" max="9" value="${g.roulette.changeN}" onchange="setRoulette('changeN',this.value)"></div>
      <div class="fx1"><label class="fl">${t('game.rlChallengeM')}</label><input type="number" min="0" max="9" value="${g.roulette.challengeM}" onchange="setRoulette('challengeM',this.value)"></div>
    </div>`);
  }

  // S5 Vegas 個別設定（β且つチェックON時のみ表示・2026-08-20-game-split.md §3 #7b。setFmt→renderBasic 再描画で出没）
  if(CHANNEL==='b' && F.vegas){
    html += gsSec('vegas', `${t('fmt.vegas')} <span class="tag tagbeta">${t('ch.b')}</span>`,
    `<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.vegas.flip?'checked':''} onchange="setVegas('flip',this.checked)"> ${t('vegas.flip')}</label>
    <div class="row" style="margin-top:8px;align-items:center"><span style="font-size:13px">${t('vegas.cap')}</span>
      <select style="flex:1;max-width:220px" onchange="setVegas('cap',this.value)">
        <option value="doublePar" ${g.vegas.cap!=='none'?'selected':''}>${t('vegas.capDouble')}</option>
        <option value="none" ${g.vegas.cap==='none'?'selected':''}>${t('vegas.capNone')}</option>
      </select></div>`);
  }

  // S6 大学対抗 設定（ON時のみ・univ-match §6.3／§14.6 でα昇格。setFmt→renderBasic 再描画で出没。
  // 設定はエブリ適用オプションの1項目のみ＝上限36/40・係数0.8・Wパーカットは規定固定値でUI化しない）
  if(F.univMatch){
    html += gsSec('univ', t('fmt.univMatch'),
    `<label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.univ.every?'checked':''} onchange="setUniv('every',this.checked)"> ${t('univ.everyTgl')}</label>
    <div class="muted mt6">${t('univ.everyNote')}</div>
    <div class="muted">${t('univ.calcNote')}</div>`);
  }

  // S7 ダブルペリア設定
  html += gsSec('peria', t('game.periaCard'), `
    <div class="muted">${t('game.periaFormula')}</div>
    <div class="row">
      <div class="fx1"><label class="fl">${t('game.coef')}</label><input type="number" step="0.05" value="${g.periaCoef}" onchange="setG('periaCoef',parseFloat(this.value))"></div>
      <div class="fx1"><label class="fl">${t('game.cap')}</label><input type="number" step="1" value="${g.periaCap??''}" placeholder="${t('game.capPh')}" onchange="setCap(this.value)"></div>
    </div>
    <label class="mt8" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.periaDblPar?'checked':''} onchange="setG('periaDblPar',this.checked)"> ${t('game.periaCut')}</label>
    <label class="mt6" style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" ${g.periaAllowNeg?'checked':''} onchange="setG('periaAllowNeg',this.checked)"> ${t('game.periaNeg')}</label>
    <div class="muted mt6">${t('game.periaOptNote')}</div>`);

  // S8 エブリハンデ
  html += gsSec('every', t('game.everyCard'), `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.womenEvery.enabled?'checked':''} onchange="setWE(this.checked)"> ${t('game.everyApply')}</label>
    <div class="muted">${t('game.everyNote')}</div>`);

  // Points / prize pool
  const P=g.points;
  const ptsInd=(k,label)=> F[k]?`<div class="ptsrow"><span>${label}</span><span class="ptsedit"><input value="${(P[k]||[]).join(',')}" onchange="setPoints('${k}',this.value)" placeholder="5,3,1"></span></div>`:'';
  // S9 賞金ポイント配点（.prizewin は heading-unify §10.3 の load-bearing クラス＝<details> 側に付ける）
  html += gsSec('pts', t('game.ptsCard'), `<div class="muted">${t('game.ptsNote')}</div>
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
    <div class="muted">${t('game.poolNote')}</div>`, 'prizewin');

  // S10 次回幹事バッジ（コンペごと・既定OFF・2026-08-29-host-option.md §5/§14）。サブ設定＝対象順位＋順位ごと方向（マスターON時のみ表示）
  let kanjiIn = `<label style="display:flex;gap:8px;align-items:center;font-size:14px"><input type="checkbox" ${g.kanjiBadge?'checked':''} onchange="setKanjiBadge(this.checked)"> ${t('game.kanjiTgl')}</label>`;
  if(g.kanjiBadge){
    const R=g.kanjiRanks;
    const krow=(k,label,down,up)=>`<div class="row" style="margin-top:8px;align-items:center">
      <label style="display:flex;gap:8px;align-items:center;font-size:14px;min-width:96px"><input type="checkbox" ${R[k].enabled?'checked':''} onchange="setKanjiRank('${k}',this.checked)"> ${label}</label>
      <select style="flex:1;max-width:340px" ${R[k].enabled?'':'disabled'} onchange="setKanjiRankDir('${k}',this.value)">
        <option value="down" ${R[k].dir!=='up'?'selected':''}>${down}</option>
        <option value="up" ${R[k].dir==='up'?'selected':''}>${up}</option>
      </select></div>`;
    kanjiIn += `<div style="font-size:13px;margin-top:10px">${t('game.kanjiRanks')}</div>
      ${krow('r1',t('game.kanjiR1'),t('game.kanjiR1Down'),t('game.kanjiR1Up'))}
      ${krow('r2',t('game.kanjiR2'),t('game.kanjiR2Down'),t('game.kanjiR2Up'))}
      ${krow('booby',t('game.kanjiBooby'),t('game.kanjiBoobyDown'),t('game.kanjiBoobyUp'))}
      <div class="muted">${t('game.kanjiNote')}</div>`;
  }
  html += gsSec('kanji', t('game.kanjiCard'), kanjiIn);

  return html;
}
function setG(k,v){ const g=curGame(); g[k]=v; save(); if(k==='name'||k==='date'||k==='course')render(); }
function setCap(v){ const g=curGame(); g.periaCap = v===''?null:parseFloat(v); save(); }
function setWE(v){ curGame().womenEvery.enabled=v; save(); }
function setKanjiBadge(v){ curGame().kanjiBadge=v; save(); renderBasic(); }   // 再描画でサブ設定の出没を追従（§14）
function setKanjiRank(k,v){ curGame().kanjiRanks[k].enabled=v; save(); renderBasic(); }   // 再描画で select の disabled を追従
function setKanjiRankDir(k,v){ curGame().kanjiRanks[k].dir = v==='up'?'up':'down'; save(); }
function setFmt(k,v){ curGame().formats[k]=v; save(); renderBasic(); }
function setPoints(k,v){ curGame().points[k]=v.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x)); save(); }
function setPointsNum(k,v){ curGame().points[k]=parseInt(v)||0; save(); }
function setRoulette(k,v){ curGame().roulette[k]=Math.max(0,parseInt(v)||0); save(); }
function setVegas(k,v){ curGame().vegas[k]=v; save(); }
function setUniv(k,v){ curGame().univ[k]=!!v; save(); renderBasic(); }   // 大学対抗設定（univ-match §6.3・setVegas と同型）
