/* ============================ PLAYERS ============================ */
function renderPlayers(){
  const el=document.getElementById('view-players');
  el.innerHTML = `
    <div class="card">
      <h2>${t('player.master')}</h2>
      <div class="row">
        <input id="pName" placeholder="${t('player.phName')}" style="flex:2;min-width:140px">
        <div style="flex:1;min-width:90px"><select id="pGender"><option value="M">${t('player.male')}</option><option value="F">${t('player.female')}</option></select></div>
      </div>
      <div class="row" class="mt8">
        <div style="flex:1;min-width:150px"><label class="fl">${t('player.hdcpType')}</label><select id="pEvery"><option value="none">${t('every.none')}</option><option value="every1">${t('term.every1')}</option><option value="every2">${t('term.every2')}</option></select></div>
        <div style="flex:1;min-width:150px"><label class="fl">${t('player.birth')}</label><input type="date" id="pBirth"></div>
      </div>
      <div class="row" class="mt8">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="pKanji"> ${t('player.kanjiChk')}</label>
      </div>
      <button class="btn wide" class="mt10" onclick="addPlayer()">${t('player.addBtn')}</button>
      <div class="muted" class="mt6">${t('player.note')}</div>
    </div>
    <div class="card">
      <h2>${t('player.registered',{n:state.players.length})}</h2>
      ${state.players.length? `<div class="scroll"><table><tr><th>${t('player.colName')}</th><th>${t('player.colGender')}</th><th>${t('player.colBirth')}</th><th>${t('player.colType')}</th><th>${t('player.colExempt')}</th><th></th></tr>
        ${state.players.map(p=>`<tr>
          <td style="text-align:left;white-space:nowrap">${esc(p.name)}</td>
          <td><select style="padding:4px;font-size:12px" onchange="setPlayerField('${p.id}','gender',this.value)"><option value="M" ${p.gender!=='F'?'selected':''}>${t('player.m')}</option><option value="F" ${p.gender==='F'?'selected':''}>${t('player.f')}</option></select></td>
          <td><input type="date" style="padding:3px;font-size:11px" value="${p.birth||''}" onchange="setPlayerField('${p.id}','birth',this.value||null)"></td>
          <td><select style="padding:4px;font-size:12px" onchange="setPlayerEvery('${p.id}',this.value)">
            <option value="none" ${p.everyType==='none'?'selected':''}>${t('every.s.none')}</option>
            <option value="every1" ${p.everyType==='every1'?'selected':''}>E1(−18)</option>
            <option value="every2" ${p.everyType==='every2'?'selected':''}>E2(−36)</option></select></td>
          <td><input type="checkbox" ${p.kanjiExempt?'checked':''} onchange="setPlayerKanji('${p.id}',this.checked)"></td>
          <td><button class="btn sm gray" onclick="editPlayer('${p.id}')">✎</button>
              <button class="btn sm danger" onclick="delPlayer('${p.id}')">×</button></td>
        </tr>`).join('')}</table></div>` : `<div class="empty">${t('player.empty')}</div>`}
    </div>
    <div class="card">
      <h2>${t('backup.title')}</h2>
      <div class="muted">${t('backup.note')}</div>
      <div class="row" class="mt8">
        <button class="btn sec" onclick="exportData()">${t('backup.export')}</button>
        <label class="btn sec" style="cursor:pointer">${t('backup.import')}<input type="file" accept="application/json" style="display:none" onchange="importData(this)"></label>
      </div>
    </div>`;
}
function addPlayer(){
  const n=document.getElementById('pName').value.trim(); if(!n) return toast(t('toast.enterName'));
  state.players.push({id:uid(),name:n,gender:document.getElementById('pGender').value,
    birth:document.getElementById('pBirth').value||null,
    everyType:document.getElementById('pEvery').value, kanjiExempt:document.getElementById('pKanji').checked});
  save(); renderPlayers(); toast(t('toast.added'));
}
function setPlayerField(id,field,val){ state.players.find(p=>p.id===id)[field]=val; save(); }
function editPlayer(id){ const p=state.players.find(x=>x.id===id);
  const n=prompt(t('confirm.name'),p.name); if(n===null)return; p.name=n.trim()||p.name;
  save(); renderPlayers(); }
function setPlayerEvery(id,v){ state.players.find(p=>p.id===id).everyType=v; save(); }
function setPlayerKanji(id,v){ state.players.find(p=>p.id===id).kanjiExempt=v; save(); }
function delPlayer(id){ if(!confirm(t('confirm.delete')))return;
  state.players=state.players.filter(p=>p.id!==id);
  state.games.forEach(g=>{ g.participants=g.participants.filter(x=>x!==id); delete g.scores[id];
    g.teams.forEach(t=>t.memberIds=t.memberIds.filter(x=>x!==id)); });
  save(); renderPlayers(); }

