/* Honest John: independent raw-score calculation; no display state is persisted.
   Contract: docs/handoff/2026-11-17-tosho-event-support.md §4. */
function newHonestJohn(){ return {hidden:Array(18).fill(false),declarations:{}}; }
// View provenance is volatile: HJ is revealed by its own announcement, not other events' hole controls.
const hjViewSources=new WeakMap();
function hjRawGame(g){ return hjViewSources.get(g)||g; }
function hjHiddenShape(g){ const h=g.honestJohn&&g.honestJohn.hidden;
  return Array.isArray(h)&&h.length===18&&Array.from(h).every(v=>typeof v==='boolean'); }
function hjHiddenValid(g){ return hjHiddenShape(g)&&g.honestJohn.hidden.filter(Boolean).length===4; }
function hjNumber(v){ return typeof v==='number'&&Number.isFinite(v)&&v>0; }
function hjDeclaration(g,pid){ const d=g.honestJohn&&g.honestJohn.declarations;
  if(!d||typeof d!=='object'||Array.isArray(d)||!Object.prototype.hasOwnProperty.call(d,pid))return null;
  const v=d[pid]; return typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null; }
function hjPlayer(g,pid){
  const sc=(g.scores||{})[pid], declared=hjDeclaration(g,pid);
  const scoresValid=Array.isArray(sc)&&sc.length===18&&Array.from(sc).every(hjNumber);
  const hiddenValid=hjHiddenValid(g);
  const parValid=hiddenValid&&Array.isArray(g.par)&&g.par.length===18&&
    g.honestJohn.hidden.every((v,i)=>!v||hjNumber(g.par[i]));
  const raw=scoresValid?sc.reduce((s,v)=>s+v,0):null;
  const adjusted=scoresValid&&parValid?sc.reduce((s,v,i)=>s+(g.honestJohn.hidden[i]?g.par[i]:v),0):null;
  const valid=adjusted!==null&&declared!==null&&Number.isFinite(adjusted)&&Number.isFinite(raw);
  const difference=valid?adjusted-declared:null;
  const penalty=valid?Math.max(difference,0)*10+Math.max(-difference,0)*30:null;
  const ready=valid&&Number.isFinite(penalty);
  return {pid,valid:ready,ready,pending:!ready,scoresValid,hiddenValid,parValid,
    raw,adjusted,declared,difference,penalty:ready?penalty:null};
}
function hjStanding(g){
  const rows=teamsOf(g).map(t=>{
    const members=teamMembers(g,t).map(pid=>hjPlayer(g,pid));
    const ready=members.every(p=>p.valid), total=ready?members.reduce((s,p)=>s+p.penalty,0):null;
    return {t,members,ready:ready&&Number.isFinite(total),total:Number.isFinite(total)?total:null,rank:null};
  });
  const ready=rows.length>0&&rows.every(r=>r.ready);
  if(ready){
    rows.sort((a,b)=>a.total-b.total);
    rows.forEach((r,i)=>{ r.rank=i&&r.total===rows[i-1].total?rows[i-1].rank:i+1; });
  }
  return {rows,ready};
}

// These maps follow object identity: imported/reloaded games start with five closed columns.
const hjViews=new WeakMap(), hjSignatures=new WeakMap();
let hjSpin=null, hjSpinGeneration=0;
function hjView(g){
  g=hjRawGame(g);
  if(!hjViews.has(g))hjViews.set(g,{columns:[false,false,false,false,false],order:[]});
  if(!hjSignatures.has(g))hjSignatures.set(g,hjSignature(g,state));
  return hjViews.get(g);
}
function hjSignature(g,s){
  const h=g.honestJohn||{};
  const data=[g.scores,g.par,h.declarations,h.hidden,g.participants,
    (g.teams||[]).map(t=>[t.id,t.memberIds]),
    (g.participants||[]).map(id=>[id,(s.players||[]).some(p=>p.id===id)])];
  return JSON.stringify(data,(k,v)=>{
    if(v===undefined)return '__hj_undefined';
    if(typeof v==='number'&&!Number.isFinite(v))return '__hj_'+String(v);
    if(v&&typeof v==='object'&&!Array.isArray(v))return Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]]));
    return v;
  });
}
function hjInvalidate(g){
  (g.announced=g.announced||{}).honestJohn=false;
  const view=hjViews.get(g); if(view)view.columns.fill(false,2);
}
function hjBeforeSave(s){
  if(hjSpin&&!(s.games||[]).includes(hjSpin.game))hjStopSpin();
  (s.games||[]).forEach(g=>{
    const signature=hjSignature(g,s);
    if(hjSignatures.has(g)&&hjSignatures.get(g)!==signature){
      hjInvalidate(g); if(hjSpin&&hjSpin.game===g)hjStopSpin();
    }
    hjSignatures.set(g,signature);
  });
}
function hjCanAnnounce(g){ g=hjRawGame(g); const st=hjStanding(g);
  return st.ready&&st.rows.length>=2&&hjView(g).columns[4]; }
function hjToggleColumn(index){
  const g=curGame(); if(!g||!Number.isInteger(index)||index<0||index>4)return;
  const st=hjStanding(g), view=hjView(g);
  if(index>=2&&!(st.ready&&hjHiddenValid(g)))return;
  view.columns[index]=!view.columns[index]; renderResult();
}
function hjDrawOrder(g){
  const view=hjView(g), selected=hjHiddenShape(g)?g.honestJohn.hidden.flatMap((v,i)=>v?[i]:[]):[];
  view.order=view.order.filter(i=>selected.includes(i));
  selected.forEach(i=>{if(!view.order.includes(i))view.order.push(i);});
  return view.order;
}
function hjStopSpin(){
  const g=hjSpin&&hjSpin.game;
  if(hjSpin&&hjSpin.timer!==null)clearTimeout(hjSpin.timer);
  hjSpin=null; hjSpinGeneration++;
  // Visibility changes may leave this same DOM on screen; make it resumable without a table redraw.
  if(g&&typeof document!=='undefined'&&typeof document.querySelector==='function'){
    const button=document.querySelector('.hj-spin-button'), candidate=document.getElementById('hj-candidate');
    if(candidate)candidate.textContent='—';
    if(button){button.textContent=t('hj.start');button.setAttribute('onclick','hjStartSpin()');
      button.disabled=!hjHiddenShape(g)||g.honestJohn.hidden.filter(Boolean).length>=4;}
  }
}
function hjSpinCurrent(g,generation){
  return hjSpin&&hjSpin.game===g&&hjSpin.generation===generation&&curGame()===g&&
    !(typeof document!=='undefined'&&document.hidden);
}
function hjSpinTick(g,generation){
  if(!hjSpinCurrent(g,generation)){ if(hjSpin&&hjSpin.generation===generation)hjStopSpin(); return; }
  const options=Array.from({length:18},(_,i)=>i).filter(i=>!g.honestJohn.hidden[i]);
  hjSpin.candidate=options[Math.floor(Math.random()*options.length)];
  if(typeof document!=='undefined'){const el=document.getElementById('hj-candidate');if(el)el.textContent=(hjSpin.candidate+1)+'H';}
  hjSpin.timer=setTimeout(()=>hjSpinTick(g,generation),85);
}
function hjStartSpin(){
  const g=curGame(); if(!g||hjSpin||!hjHiddenShape(g)||hjDrawOrder(g).length>=4)return;
  const generation=++hjSpinGeneration;
  hjSpin={game:g,generation,timer:null,candidate:null,signature:hjSignature(g,state)};
  hjSpinTick(g,generation); renderResult();
}
function hjCommitSpin(generation){
  if(!hjSpin||hjSpin.generation!==generation)return;
  const {game:g,candidate,signature}=hjSpin;
  const valid=hjSpinCurrent(g,generation)&&signature===hjSignature(g,state)&&Number.isInteger(candidate)&&
    hjHiddenShape(g)&&!g.honestJohn.hidden[candidate]&&hjDrawOrder(g).length<4;
  hjStopSpin(); if(!valid){renderResult();return;}
  g.honestJohn.hidden[candidate]=true; hjView(g).order.push(candidate); hjChanged();
}
function hjResetDraw(){ hjStopSpin(); hjClearHidden(); }

/* Only explicit edits repair malformed settings; calculation/rendering never do. */
function hjEditData(g){
  if(!g.honestJohn||typeof g.honestJohn!=='object'||Array.isArray(g.honestJohn))g.honestJohn=newHonestJohn();
  if(!g.honestJohn.declarations||typeof g.honestJohn.declarations!=='object'||Array.isArray(g.honestJohn.declarations))g.honestJohn.declarations={};
  return g.honestJohn;
}
function hjChanged(){ const g=curGame(); hjInvalidate(g); save(); render(); }
function hjSetHidden(i,on){
  const g=curGame(); if(!g||!Number.isInteger(i)||i<0||i>=18)return;
  if(!hjHiddenShape(g)){ toast(t('hj.chooseFour')); renderBasic(); return; }
  const h=g.honestJohn.hidden;
  if(on&&!h[i]&&h.filter(Boolean).length>=4){ toast(t('hj.chooseFour')); renderBasic(); return; }
  h[i]=!!on; hjChanged();
}
function hjRandomHidden(){
  const g=curGame(); if(!g)return;
  const indices=Array.from({length:18},(_,i)=>i);
  for(let i=17;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]]; }
  const h=Array(18).fill(false); indices.slice(0,4).forEach(i=>h[i]=true);
  hjEditData(g).hidden=h; hjChanged();
}
function hjClearHidden(){ const g=curGame(); if(!g)return; hjEditData(g).hidden=Array(18).fill(false); hjChanged(); }
function hjSetDeclaration(index,value){
  const g=curGame(); if(!g||!Number.isInteger(index))return;
  const pid=g.participants[index]; if(!state.players.some(p=>p.id===pid))return;
  const text=String(value).trim(), n=Number(text);
  if(text!==''&&(!Number.isFinite(n)||n<0)){ toast(t('hj.invalidDeclaration')); render(); return; }
  const d=hjEditData(g).declarations;
  if(text==='')delete d[pid]; else Object.defineProperty(d,pid,{value:n,writable:true,enumerable:true,configurable:true});
  hjChanged();
}
function hjDeclarationsHtml(g){
  return `<h3>${t('hj.declarations')}</h3><div class="muted">${t('hj.declarationNote')}</div>`+
    g.participants.map((pid,i)=>{ const p=state.players.find(p=>p.id===pid); if(!p)return '';
      const v=hjDeclaration(g,pid);
      return `<div class="ptsrow"><span>${esc(p.name)}</span><span class="ptsedit"><input type="number" min="0" step="any" aria-label="${esc(p.name)} ${t('hj.declared')}" value="${v===null?'':v}" onchange="hjSetDeclaration(${i},this.value)"></span></div>`;
    }).join('');
}
function hjSettingsHtml(g){
  const h=hjHiddenShape(g)?g.honestJohn.hidden:Array(18).fill(false);
  const count=h.filter(Boolean).length;
  return gsSec('honestJohn',t('term.honestJohn'),`<div class="muted">${t('hj.hiddenNote')}</div>
    <div class="row mt6"><button class="btn sec sm" onclick="hjRandomHidden()">${t('hj.randomFour')}</button>
      <button class="btn gray sm" onclick="hjClearHidden()">${t('btn.clear')}</button><span class="tag">${t('hj.selected',{n:count})}</span></div>
    <div class="fmtgrid mt8">${h.map((v,i)=>`<label><input type="checkbox" ${v?'checked':''} onchange="hjSetHidden(${i},this.checked)"> ${i+1}</label>`).join('')}</div>
    ${hjHiddenValid(g)?'':`<div class="muted mt6" style="color:var(--red)">${t('hj.chooseFour')}</div>`}
    ${hjDeclarationsHtml(g)}<div class="muted mt8">${t('hj.rule')}</div>`);
}
function hjStatus(p){
  const issues=[];
  if(!p.scoresValid)issues.push(t('hj.missingScores'));
  if(p.declared===null)issues.push(t('hj.missingDeclaration'));
  if(!p.hiddenValid)issues.push(t('hj.chooseFour'));
  else if(!p.parValid)issues.push(t('hj.invalidPar'));
  return issues.length?issues.join(' / '):t('hj.ready');
}
function renderTeamHonest(g){
  g=hjRawGame(g);
  const st=hjStanding(g), view=hjView(g), ann=!!(g.announced||{}).honestJohn;
  const eligible=st.ready&&st.rows.length>=2, visible=ann&&eligible&&view.columns[4];
  const order=new Map(teamsOf(g).map((t,i)=>[t.id,i])); st.rows.sort((a,b)=>order.get(a.t.id)-order.get(b.t.id));
  const ev=visible?teamWinPoints(g).events.find(e=>e.key==='honestJohn'):null;
  const mask='<span class="mask">—</span>';
  const hero=st.rows.map(r=>{
    const winner=visible&&r.rank===1;
    const tied=st.rows.filter(x=>x.rank===1).length>1;
    const tag=winner?`<span class="tag ${tied?'tagtie':'tagwin'}">${tied?t('custom.tie'):t('custom.win')}</span>`:'';
    const share=winner&&ev?`<span class="tag">${t('team.winpt')} +${tpShare(ev.w,ev.winners.length)}</span>`:'';
    return `<span class="rl-st tp-nd tp-ovh"><span class="rl-st-team" style="color:${tmColor(r.t.name)}">${esc(r.t.name)}</span>
      <span class="rl-st-h">${visible?r.total:mask}</span>
      ${visible?`<span class="tp-nd-tagrow">${posBadge(r.rank,winner)}${tag}${share}</span>`:''}</span>`;
  }).join('');
  const columns=['hj.declared','hj.raw','hj.adjusted','hj.difference','hj.penalty'];
  const heads=columns.map((key,i)=>`<th scope="col">${t(key)}<button class="btn sec sm hj-column-open" aria-pressed="${view.columns[i]}" onclick="hjToggleColumn(${i})" ${i>=2&&!st.ready?'disabled':''}>${view.columns[i]?t('hj.closeColumn'):t('hj.openColumn')}</button></th>`).join('');
  const rows=st.rows.map(r=>`<tr class="hj-team-head"><th colspan="6" scope="rowgroup" style="color:var(--tm-${tmKey(r.t)});background:var(--tm-${tmKey(r.t)}-bg)">${esc(r.t.name)}</th></tr>`+r.members.map(p=>{
    const person=state.players.find(x=>x.id===p.pid);
    const nums=[p.declared,p.raw,p.adjusted,p.difference,p.penalty];
    return `<tr><th class="hj-name" scope="row">${esc(person.name)}</th>${nums.map((v,i)=>`<td>${view.columns[i]&&(i<2||st.ready)?(v===null?'—':v):mask}</td>`).join('')}</tr>`;
  }).join('')).join('');
  const selected=hjDrawOrder(g), spinning=hjSpin&&hjSpin.game===g;
  const slots=Array.from({length:4},(_,i)=>`<div class="hj-slot"><small>${t('hj.drawNumber',{n:i+1})}</small><strong${spinning&&i===selected.length?' id="hj-candidate"':''}>${i<selected.length?(selected[i]+1)+'H':spinning&&i===selected.length?(hjSpin.candidate+1)+'H':'—'}</strong></div>`).join('');
  const spinButton=spinning?`<button class="btn hj-spin-button" onclick="hjCommitSpin(${hjSpin.generation})">${t('hj.stop')}</button>`:
    `<button class="btn hj-spin-button" onclick="hjStartSpin()" ${selected.length>=4||!hjHiddenShape(g)?'disabled':''}>${t('hj.start')}</button>`;
  const controls=hjCanAnnounce(g)||ann?tpAnnounceUI(g,'honestJohn'):`<button class="btn gray sm" disabled>${t('team.announce')}</button>`;
  const note=!st.rows.length?t('team.emptyTeams'):!st.ready?t('hj.pending'):st.rows.length<2?t('hj.needTeams'):!ann?t('hj.unannounced'):'';
  const statuses=st.rows.flatMap(r=>r.members.map(p=>`<li>${esc(state.players.find(x=>x.id===p.pid).name)}: ${hjStatus(p)}</li>`)).join('');
  return `<div class="card">${hero?`<div class="rl-standing tp-ovh-wrap">${hero}</div>`:''}
    <div class="scroll mt10"><table class="hj-table sc2"><thead><tr><th scope="col" class="hj-name">${t('col.player')}</th>${heads}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hj-roulette mt10"><div class="row between"><b>${t('hj.drawTitle')}</b><span class="muted">${t('hj.selected',{n:selected.length})}</span></div>
      <div class="hj-slots">${slots}</div><div class="hj-draw-label">${spinButton}<span>${selected.length===4?t('hj.drawComplete'):t('hj.drawGuide')}</span></div></div>
    <details class="hj-operator mt10"><summary>${t('hj.operator')}</summary><div class="in"><b>${t('hj.status')}</b>
      ${note?`<div class="muted mt8">${note}</div>`:''}<ul>${statuses}</ul>
      <div class="cardtools"><button class="btn gray sm" onclick="hjResetDraw()">${t('hj.resetDraw')}</button>${controls}</div></div></details>
    <details class="mt10"><summary>${t('rule.summary')}</summary><div class="in">${t('hj.rule')}</div></details></div>`;
}
if(typeof state!=='undefined')hjBeforeSave(state);
