/* ============================ PLAYERS ============================ */
function renderPlayers(){
  const el=document.getElementById('view-players');
  const g=curGame();
  /* カラースウォッチ行のラベル（2026-08-30-team-colors.md §5.2 ★）:
     下の g.teams.map の map 変数 t が i18n の t() を隠蔽するため、map の前に hoist しておく */
  const TL={label:t('team.colorLabel'),auto:t('team.colorAuto'),red:t('tmc.red'),blue:t('tmc.blue'),green:t('tmc.green'),yellow:t('tmc.yellow'),gray:t('tmc.gray')};
  // 参加者・チーム対抗カード（ゲーム未選択時は msg.needGame を1つ表示）（§11.12 N）
  const gameCards = !g ? `<div class="empty">${t('msg.needGame')}</div>`
    : `<div class="card"><h2>${t('game.partsCard')}</h2>
    ${state.players.length? state.players.map(p=>`<span class="chip ${g.participants.includes(p.id)?'on':''}" onclick="toggleParticipant('${p.id}')">${esc(p.name)}${p.everyType!=='none'?' '+everyLabel(p.everyType):''}</span>`).join('')
      : `<div class="muted">${t('game.partsEmpty')}</div>`}
  </div>
  <div class="card"><h2>${t('game.teamCard')}</h2>
    <div class="row"><button class="btn sec sm" onclick="addTeam()">${t('game.addTeam')}</button>
      <button class="btn gray sm" onclick="autoTeams(2)">${t('game.auto2')}</button>
      <button class="btn gray sm" onclick="autoTeams(3)">${t('game.auto3')}</button></div>
    ${g.teams.map(t=>`<div style="border:1px solid var(--line);border-radius:var(--r-md);padding:10px;margin-top:8px">
      <div class="row between"><input value="${esc(t.name)}" onchange="setTeamName('${t.id}',this.value)" style="flex:1;font-weight:var(--w-bold);color:var(--tm-${tmKey(t)})">
        <button class="btn sm danger" onclick="delTeam('${t.id}')">×</button></div>
      <div class="row tm-swatch-row"><span class="muted">${TL.label}</span>
        <span class="chip ${t.color?'':'on'}" onclick="setTeamColor('${t.id}',null)">${TL.auto} <span class="tm-dot" style="background:var(--tm-${tmKeyByName(t.name)})"></span></span>
        ${TM_KEYS.map(k=>`<button class="tm-swatch ${t.color===k?'on':''}" title="${TL[k]}" style="background:var(--tm-${k})" onclick="setTeamColor('${t.id}','${k}')"></button>`).join('')}</div>
      <div class="mt6">${g.participants.map(pid=>{const p=state.players.find(x=>x.id===pid);if(!p)return'';
        return `<span class="chip ${t.memberIds.includes(pid)?'on':''}" onclick="toggleTeamMember('${t.id}','${pid}')">${esc(p.name)}</span>`}).join('')}</div>
    </div>`).join('') || `<div class="muted">${t('game.teamEmpty')}</div>`}
  </div>
  ${chFormats(g).match1v1? m1EditCard(g) : ''}`;
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
    ${gameCards}
    <div class="card">
      <h2>${t('backup.title')}</h2>
      <div class="muted">${t('backup.note')}</div>
      <div class="row" class="mt8">
        <button class="btn sec" onclick="exportData()">${t('backup.export')}</button>
        <label class="btn sec" style="cursor:pointer">${t('backup.import')}<input type="file" accept="application/json" style="display:none" onchange="importData(this)"></label>
      </div>
    </div>`;
}
/* ---- 1 on 1 組合せ編集カード（§15.1・docs/handoff/2026-08-20-1on1-match.md）----
   §13.1 の編集UIを結果発表タブから移設（details 廃止＝通常カード・常時展開）。操作仕様は §13.1 のまま。
   表示条件は renderPlayers 側の chFormats(g).match1v1（チャンネル共通・2026-08-30 α昇格）。 */
function m1EditCard(g){
  const T=m1Teams(g);
  if(T.length!==2) return `<div class="card"><h2>${t('m1.edit')}</h2><div class="muted">${t('m1.need2Teams')}</div></div>`;
  const raw=(g.match1v1&&g.match1v1.pairs)||[];   // 登録済み全組（無効組もリストに出す）
  const pairs=m1ValidPairs(g);                    // 有効組（無効組は赤字＋タグ表示 §13.1）
  const nameOf=pid=>{ const p=state.players.find(x=>x.id===pid); return p?esc(p.name):'?'; };
  // 未出場（両チームの参加メンバーで組合せに1度も現れない選手）: 警告のみ・登録/集計はブロックしない（§13.1 運用ガイド）
  const appeared=new Set(); raw.forEach(([a,b])=>{ appeared.add(a); appeared.add(b); });
  const notPlayed=[...m1MemberIds(g,T[0]),...m1MemberIds(g,T[1])].filter(pid=>!appeared.has(pid));
  const npNote=(raw.length&&notPlayed.length)?`<div class="muted mt6" style="color:var(--red)">${t('m1.notPlayed',{name:notPlayed.map(nameOf).join(', ')})}</div>`:'';
  const cA={}, cB={}; raw.forEach(([a,b])=>{ cA[a]=(cA[a]||0)+1; cB[b]=(cB[b]||0)+1; });
  const mkSel=(id,ids,cnt)=>{ const def=ids.find(pid=>!appeared.has(pid))||ids[0];   // 既定=未出場の先頭（全員出場済みなら先頭）
    return `<select id="${id}">${ids.map(pid=>`<option value="${pid}"${pid===def?' selected':''}>${nameOf(pid)}${cnt[pid]?` ×${cnt[pid]}`:''}</option>`).join('')}</select>`; };
  const rows=raw.map((p,i)=>{ const [a,b]=p; const invalid=!pairs.includes(p);   // 無効組=赤字＋タグ・×で削除可（§13.1）
    return `<div class="row mt6"><span${invalid?' style="color:var(--red)"':''}>#${i+1} ${nameOf(a)} vs ${nameOf(b)}</span>
      ${invalid?`<span class="tag" style="background:var(--danger-bg);color:var(--red)">${t('m1.invalidPair')}</span>`:''}
      <button class="btn gray sm" onclick="m1MovePair(${i},-1)" ${i===0?'disabled':''}>↑</button>
      <button class="btn gray sm" onclick="m1MovePair(${i},1)" ${i===raw.length-1?'disabled':''}>↓</button>
      <button class="btn gray sm" onclick="m1DelPair(${i})">×</button></div>`; }).join('');
  return `<div class="card"><h2>${t('m1.edit')}</h2>
    <div class="row mt6">${mkSel('m1selA',m1MemberIds(g,T[0]),cA)} vs ${mkSel('m1selB',m1MemberIds(g,T[1]),cB)}
      <button class="btn gold sm" onclick="m1AddPair()">${t('m1.addPair')}</button></div>
    ${rows}${npNote}
    ${raw.length?`<div class="row mt8"><button class="btn gray sm" onclick="m1ClearAll()">${t('m1.clearAll')}</button></div>`:''}
  </div>`;
}
// 組合せ編集（§13.1・js/results.js から移設 §15.1）: いずれも save() → renderPlayers()。唯一のブロック=同一カードの重複（m1.dupPair）
function m1AddPair(){ const g=curGame(); if(!g)return;
  const T=m1Teams(g); if(T.length!==2)return;
  const selA=document.getElementById('m1selA'), selB=document.getElementById('m1selB');
  if(!selA||!selB)return; const a=selA.value, b=selB.value; if(!a||!b)return;
  const m=g.match1v1||(g.match1v1={teamA:null,teamB:null,pairs:[]});
  if((m.pairs||[]).some(([x,y])=>x===a&&y===b)){ toast(t('m1.dupPair')); return; }   // 重複カードのみ弾く。同一選手の複数回は可
  if(!m1Valid(g)){ m.teamA=T[0].id; m.teamB=T[1].id; }   // 初回追加（有効な保存がない）時に現在の2チームで確定（以後 §4.3 の stale 判定が機能）
  m.pairs.push([a,b]); save(); renderPlayers(); }
function m1DelPair(idx){ const g=curGame(); if(!g||!g.match1v1)return;
  g.match1v1.pairs.splice(idx,1); save(); renderPlayers(); }
function m1MovePair(idx,dir){ const g=curGame(); if(!g||!g.match1v1)return;
  const p=g.match1v1.pairs, j=idx+dir; if(j<0||j>=p.length)return;
  [p[idx],p[j]]=[p[j],p[idx]]; save(); renderPlayers(); }   // 並び順＝カード表示順＝「次の組」のめくり順
function m1ClearAll(){ const g=curGame(); if(!g||!g.match1v1)return;
  if(!confirm(t('m1.confirmClear')))return;
  g.match1v1={teamA:null,teamB:null,pairs:[]}; m1Opened.clear(); save(); renderPlayers(); }   // m1Opened=js/results.js の揮発表示状態（クリック時点で読込済み）
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
/* 参加者・チーム対抗（js/game.js から移動・§11.12 N） */
function toggleParticipant(pid){ const g=curGame(); const i=g.participants.indexOf(pid);
  if(i<0){ g.participants.push(pid); g.scores[pid]=g.scores[pid]||Array(18).fill(null); }
  else { g.participants.splice(i,1); } save(); renderPlayers(); }
function addTeam(){ const g=curGame(); const names=['レッド','ブルー','グリーン','イエロー'];
  g.teams.push({id:uid(),name:'チーム'+names[g.teams.length%4],memberIds:[]}); save(); renderPlayers(); }
function autoTeams(n){ const g=curGame(); const names=['レッド','ブルー','グリーン'];
  g.teams=[]; for(let i=0;i<n;i++)g.teams.push({id:uid(),name:'チーム'+names[i],memberIds:[]});
  g.participants.forEach((pid,i)=>g.teams[i%n].memberIds.push(pid)); save(); renderPlayers(); }
function setTeamName(id,v){ curGame().teams.find(t=>t.id===id).name=v; save(); renderPlayers(); }   // 再描画＝名前プレビュー色・自動ドットの追従（team-colors §5.1）
/* チームカラー設定（team-colors §5）: 自動=フィールド削除（JSON を汚さない）。色は tmColor が全画面で解決 */
function setTeamColor(id,key){ const tm=curGame().teams.find(t=>t.id===id);
  if(key) tm.color=key; else delete tm.color;
  save(); renderPlayers(); }
function delTeam(id){ const g=curGame(); g.teams=g.teams.filter(t=>t.id!==id); save(); renderPlayers(); }
function toggleTeamMember(tid,pid){ const g=curGame();
  g.teams.forEach(t=>{ if(t.id!==tid) t.memberIds=t.memberIds.filter(x=>x!==pid); });
  const t=g.teams.find(t=>t.id===tid); const i=t.memberIds.indexOf(pid);
  if(i<0)t.memberIds.push(pid); else t.memberIds.splice(i,1); save(); renderPlayers(); }

