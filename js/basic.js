/* ============================ BASIC SETUP（どのコンペか・2026-08-20-game-split.md） ============================ */
function renderBasic(){
  const el=document.getElementById('view-basic');
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
    <div class="row">
      <button class="btn danger sm" onclick="deleteGame()">${t('game.deleteBtn')}</button>
      <button class="btn gray sm" onclick="dupGame()">${t('btn.dup')}</button>
    </div>
  </div>`;

  html += hostMenuCard();
  el.innerHTML=html;
}
// 幹事メニュー（動作確認用・目立たせない。Phase2で幹事のみ表示に制限予定）
function hostMenuCard(){
  // テストデータのパターン選択（2026-08-31-testdata-patterns.md §7）。選択は揮発変数 sdPat（localStorage 非保存）
  const sp=SD_PATTERNS.find(x=>x.key===sdPat)||SD_PATTERNS[0];
  return `<details><summary>${t('host.summary')}</summary><div class="in">
    <div class="muted" style="margin-bottom:8px">${t('host.note')}</div>
    <label class="fl">${t('host.seedPattern')}</label>
    <select onchange="sdSetPat(this.value)">${SD_PATTERNS.map(x=>
      `<option value="${x.key}" ${x.key===sp.key?'selected':''}>${esc(t(x.label))}</option>`).join('')}</select>
    <div class="muted" id="sdDesc" style="margin:6px 0 8px">${esc(t(sp.desc))}</div>
    <button class="btn gold sm" onclick="seedTestData()">${t('host.seedBtn')}</button>
    <div class="muted">${t('host.seedNote')}</div>
  </div></details>`;
}
function createGame(){ const g=newGame(); state.games.push(g); state.currentGameId=g.id; save(); render(); toast(t('toast.gameCreated')); }
function selectGame(id){ state.currentGameId=id||null; save(); render(); }
function deleteGame(){ if(!confirm(t('confirm.deleteGame')))return;
  state.games=state.games.filter(x=>x.id!==state.currentGameId); state.currentGameId=state.games[0]?.id||null; save(); render(); }
function dupGame(){ const g=JSON.parse(JSON.stringify(curGame())); g.id=uid(); g.name=g.name+' (複製)'; state.games.push(g); state.currentGameId=g.id; save(); render(); }
